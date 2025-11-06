const express = require("express");
const router = express.Router();

const DestinationCache = require("../models/DestinationCache");
const { authenticateToken } = require("../middleware/auth");

let fetchFn = typeof fetch === "function" ? fetch : null;

const fetchApi = async (...args) => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn(...args);
};

const GEOAPIFY_PLACES_API_KEY = process.env.GEOAPIFY_PLACES_API_KEY || process.env.GEOAPIFY_API_KEY;
const GEOAPIFY_STATIC_MAP_API_KEY =
  process.env.GEOAPIFY_STATIC_MAP_API_KEY ||
  process.env.GEOAPIFY_STATIC_MAP_KEY ||
  process.env.GEOAPIFY_MAPS_API_KEY ||
  GEOAPIFY_PLACES_API_KEY;
const { fetchCurrentWeather, ensureWeatherConfigured } = require("../utils/weather");
const { buildStaticMapUrl } = require("../utils/geoapify");

const TYPE_CATEGORY_MAP = {
  lodging: "accommodation.hotel,accommodation.guest_house,accommodation.hostel",
  hotel: "accommodation.hotel,accommodation.guest_house,accommodation.hostel",
  restaurant: "catering.restaurant",
  food: "catering",
  cafe: "catering.cafe",
  bar: "catering.bar",
  attraction: "tourism.sights",
  shopping: "commercial.shopping_mall,commercial.supermarket",
  nightlife: "entertainment.nightclub,entertainment.culture",
};

const RESERVED_STATIC_MAP_KEYS = new Set([
  "location",
  "zoom",
  "size",
  "style",
  "theme",
  "language",
  "pitch",
  "bearing",
  "scale",
  "marker",
  "markers",
  "markerColor",
  "markerIcon",
  "markerType",
  "markerSize",
  "markerLabel",
  "markerText",
  "overlay",
  "overlays",
  "circle",
  "apiKey",
  "provider",
]);

// Distance/routing support (Geoapify) — minimal endpoint without new files
const ensureFetch = async () => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn;
};

const normalizeQuery = (value = "") => value.trim().toLowerCase();

const sessionHeaderNames = ["x-session-key", "x-session-id"];

const getSessionKeyFromRequest = (req) => {
  for (const headerName of sessionHeaderNames) {
    const candidate = req.headers?.[headerName];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

const getCacheScope = (req) => ({
  ownerUserId: req.user?.userId || null,
  sessionKey: req.sessionKey || getSessionKeyFromRequest(req),
});

const buildCacheFilter = (normalizedQuery, scope) => {
  const filter = {};
  if (normalizedQuery) {
    filter.normalizedQuery = normalizedQuery;
  }
  if (scope?.ownerUserId) {
    filter.ownerUserId = scope.ownerUserId;
  }
  if (scope?.sessionKey) {
    filter.sessionKey = scope.sessionKey;
  }
  return filter;
};

const ensureSessionKey = (req, res, next) => {
  const sessionKey = getSessionKeyFromRequest(req);
  if (!sessionKey) {
    return res.status(400).json({ error: "Session key header X-Session-Key is required" });
  }
  req.sessionKey = sessionKey;
  next();
};

router.use(authenticateToken);
router.use(ensureSessionKey);

const touchDestinationCache = async (docId, originalQuery) => {
  if (!docId) return;
  try {
    await DestinationCache.updateOne(
      { _id: docId },
      {
        $inc: { searchCount: 1 },
        $set: { lastAccessedAt: new Date(), originalQuery },
      }
    ).catch(() => {});
  } catch (error) {
    console.warn("Destination cache touch failed", error.message || error);
  }
};

router.delete("/cache", async (req, res) => {
  const scope = getCacheScope(req);
  if (!scope.ownerUserId) {
    return res.status(400).json({ error: "Unable to resolve user for cache scope" });
  }
  if (!scope.sessionKey) {
    return res.status(400).json({ error: "Session key header X-Session-Key is required" });
  }

  try {
    const filter = buildCacheFilter(null, scope);
    const result = await DestinationCache.deleteMany(filter);
    return res.json({ cleared: result?.deletedCount || 0 });
  } catch (error) {
    console.error("Destination cache clear error:", error);
    return res
      .status(500)
      .json({ error: "Failed to clear destination cache", details: error.message });
  }
});

// Geocode endpoint - convert address/place name to coordinates
router.post("/geocode", async (req, res) => {
  if (!ensureGeoapifyConfigured(res)) return;
  const { query } = req.body || {};
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "A query string is required" });
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return res.status(400).json({ error: "A query string is required" });
  }

  const normalizedQuery = normalizeQuery(trimmedQuery);
  const scope = getCacheScope(req);
  const cacheFilter = buildCacheFilter(normalizedQuery, scope);

  try {
    if (normalizedQuery) {
      const cached = await DestinationCache.findOne(cacheFilter).lean();
      if (cached) {
        await touchDestinationCache(cached._id, trimmedQuery);
        return res.json({
          coordinates: cached.coordinates,
          formattedAddress: cached.formattedAddress,
          city: cached.city,
          state: cached.state,
          country: cached.country,
          raw: cached.raw,
          cached: true,
        });
      }
    }

    const key = getGeoapifyKey("places");
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", trimmedQuery);
    url.searchParams.set("limit", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("apiKey", key);
    const fetch = await ensureFetch();
    const resp = await fetch(url.href);
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Geoapify geocode error`, details: text });
    }
    const data = await resp.json();
    const match = data?.results?.[0];
    if (!match) {
      return res.status(404).json({ error: "No results found for the query" });
    }

    const responsePayload = {
      coordinates: { lat: Number(match.lat), lng: Number(match.lon) },
      formattedAddress: match.formatted,
      city: match.city || match.county,
      state: match.state,
      country: match.country,
      raw: match,
      cached: false,
    };

    if (normalizedQuery) {
      try {
        await DestinationCache.findOneAndUpdate(
          cacheFilter,
          {
            $set: {
              originalQuery: trimmedQuery,
              formattedAddress: responsePayload.formattedAddress,
              city: responsePayload.city,
              state: responsePayload.state,
              country: responsePayload.country,
              coordinates: responsePayload.coordinates,
              raw: match,
              lastAccessedAt: new Date(),
            },
            $setOnInsert: {
              normalizedQuery,
              ownerUserId: scope.ownerUserId,
              sessionKey: scope.sessionKey,
            },
            $inc: { searchCount: 1 },
          },
          { upsert: true }
        );
      } catch (cacheError) {
        console.warn("Failed to cache destination geocode", cacheError.message || cacheError);
      }
    }

    return res.json(responsePayload);
  } catch (error) {
    console.error("Geoapify geocode error:", error);
    return res.status(500).json({ error: "Failed to geocode", details: error.message });
  }
});

router.post("/distance", async (req, res) => {
  if (!ensureGeoapifyConfigured(res)) return;
  const { from, to, mode = "drive", itineraryId } = req.body || {};
  if (!from || !to || from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
    return res.status(400).json({ error: "from {lat,lng} and to {lat,lng} are required" });
  }
  const key = getGeoapifyKey("places");
  try {
    const url = new URL("https://api.geoapify.com/v1/routing");
    url.searchParams.set("waypoints", `${from.lng},${from.lat}|${to.lng},${to.lat}`);
    url.searchParams.set("mode", `${mode}`);
    url.searchParams.set("details", "instruction_details,route_details");
    url.searchParams.set("apiKey", key);
    const fetch = await ensureFetch();
    const resp = await fetch(url.href);
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Geoapify routing error`, details: text });
    }
    const data = await resp.json();
    const summary = data?.features?.[0]?.properties?.summary || {};
    const distanceMeters = summary.distance || null;
    const durationSeconds = summary.duration || null;

    // Persist to itinerary.distanceHistory if itineraryId provided
    try {
      if (itineraryId) {
        const Itinerary = require("../models/Itinerary");
        const itinerary = await Itinerary.findById(itineraryId);
        if (itinerary) {
          itinerary.distanceHistory = itinerary.distanceHistory || [];
          itinerary.distanceHistory.push({
            from,
            to,
            mode,
            distanceMeters,
            durationSeconds,
            createdAt: new Date(),
          });
          itinerary.updatedAt = new Date();
          await itinerary.save();
        }
      }
    } catch (persistError) {
      console.warn("Persist distance failed:", persistError.message || persistError);
    }

    return res.json({ distanceMeters, durationSeconds, raw: summary });
  } catch (error) {
    console.error("Geoapify distance error:", error);
    return res.status(500).json({ error: "Failed to compute distance", details: error.message });
  }
});

const clampNumber = (
  value,
  { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, fallback = 0 } = {}
) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < min) return min;
  if (numeric > max) return max;
  return numeric;
};

const clampZoom = (value, fallback = 13) => clampNumber(value, { min: 1, max: 19, fallback });

const parseSize = (value, fallback = "800x600") => {
  const preset = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const match = preset.match(/^(\d{2,4})\s*x\s*(\d{2,4})$/i);
  if (!match) {
    const [width, height] = fallback.split("x");
    return {
      width: clampNumber(width, { min: 100, max: 1280, fallback: 800 }),
      height: clampNumber(height, { min: 100, max: 1280, fallback: 600 }),
      literal: fallback,
    };
  }

  const width = clampNumber(match[1], { min: 100, max: 1280, fallback: 800 });
  const height = clampNumber(match[2], { min: 100, max: 1280, fallback: 600 });
  return {
    width,
    height,
    literal: `${width}x${height}`,
  };
};

const buildOsmStaticMapUrl = (
  { lat, lng },
  { zoom = 13, size = "800x600", markerColor = "lightblue1" } = {}
) => {
  if (lat == null || lng == null) return null;

  const { literal: sizeLiteral } = parseSize(size);
  const safeZoom = clampZoom(zoom, 13);

  let normalizedColor = typeof markerColor === "string" ? markerColor.trim() : "";
  if (!/^[a-z]+[a-z0-9]*$/i.test(normalizedColor)) {
    normalizedColor = "lightblue1";
  }

  const url = new URL("https://staticmap.openstreetmap.de/staticmap.php");
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", safeZoom);
  url.searchParams.set("size", sizeLiteral);
  url.searchParams.set("maptype", "mapnik");
  url.searchParams.set("markers", `${lat},${lng},${normalizedColor}`);

  return url.href;
};

const getGeoapifyKey = (type = "places") =>
  type === "static" ? GEOAPIFY_STATIC_MAP_API_KEY : GEOAPIFY_PLACES_API_KEY;

const ensureGeoapifyConfigured = (res, type = "places") => {
  const key = getGeoapifyKey(type);
  if (!key) {
    const label = type === "static" ? "static map" : "places";
    res.status(503).json({ error: `Geoapify ${label} API key is not configured on the server.` });
    return false;
  }
  return true;
};

const callGeoapify = async (url) => {
  const response = await fetchApi(url);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Geoapify API error ${response.status}: ${errorBody}`);
  }
  return response.json();
};

const clampRadius = (radius = 5000) => Math.min(Math.max(Number(radius) || 5000, 500), 50000);

router.post("/validate", async (req, res) => {
  if (!ensureGeoapifyConfigured(res)) return;

  const { query, type } = req.body || {};
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "A destination query is required." });
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return res.status(400).json({ error: "A destination query is required." });
  }

  try {
    const normalizedQuery = normalizeQuery(trimmedQuery);
    const scope = getCacheScope(req);
    const cacheFilter = buildCacheFilter(normalizedQuery, scope);
    if (normalizedQuery) {
      const cached = await DestinationCache.findOne(cacheFilter).lean();
      if (cached) {
        await touchDestinationCache(cached._id, trimmedQuery);

        const responsePayload = {
          exists: true,
          name: cached.raw?.result?.name || cached.raw?.name || trimmedQuery,
          formattedAddress: cached.formattedAddress,
          location: cached.coordinates,
          timezone: cached.raw?.timezone?.name || null,
          country: cached.country,
          state: cached.state,
          city: cached.city,
          type: type || cached.raw?.result?.kind,
          raw: cached.raw,
          cached: true,
        };

        return res.json(responsePayload);
      }
    }

    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", trimmedQuery);
    url.searchParams.set("limit", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("filter", "countrycode:in");
    url.searchParams.set("apiKey", getGeoapifyKey("places"));

    const data = await callGeoapify(url.href);
    const match = data?.results?.[0];

    if (!match) {
      return res.json({ exists: false, query });
    }

    const responsePayload = {
      exists: true,
      name: match?.result?.name || match?.name || query,
      formattedAddress: match?.formatted,
      location: { lat: Number(match.lat), lng: Number(match.lon) },
      timezone: match?.timezone?.name || null,
      country: match?.country,
      state: match?.state,
      city: match?.city || match?.county,
      type: type || match?.result?.kind,
      raw: match,
    };

    if (normalizedQuery) {
      try {
        await DestinationCache.findOneAndUpdate(
          cacheFilter,
          {
            $set: {
              originalQuery: trimmedQuery,
              formattedAddress: responsePayload.formattedAddress,
              city: responsePayload.city,
              state: responsePayload.state,
              country: responsePayload.country,
              coordinates: responsePayload.location,
              raw: match,
              lastAccessedAt: new Date(),
            },
            $setOnInsert: {
              normalizedQuery,
              ownerUserId: scope.ownerUserId,
              sessionKey: scope.sessionKey,
            },
            $inc: { searchCount: 1 },
          },
          { upsert: true }
        );
      } catch (cacheError) {
        console.warn("Failed to cache destination validation", cacheError.message || cacheError);
      }
    }

    return res.json(responsePayload);
  } catch (error) {
    console.error("Geoapify validate error:", error);
    return res
      .status(500)
      .json({ error: "Failed to validate destination.", details: error.message });
  }
});

router.post("/tourist", async (req, res) => {
  if (!ensureGeoapifyConfigured(res)) return;

  const { location = {}, radius, limit = 20, categories } = req.body || {};
  if (location.lat == null || location.lng == null) {
    return res.status(400).json({ error: "Latitude and longitude are required." });
  }

  try {
    const effectiveCategories = categories || "tourism.sights,tourism.attraction";
    const effectiveRadius = clampRadius(radius);

    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", effectiveCategories);
    url.searchParams.set("filter", `circle:${location.lng},${location.lat},${effectiveRadius}`);
    url.searchParams.set("bias", `proximity:${location.lng},${location.lat}`);
    url.searchParams.set("limit", Math.min(Number(limit) || 20, 50));
    url.searchParams.set("lang", "en");
    url.searchParams.set("apiKey", getGeoapifyKey("places"));

    const data = await callGeoapify(url.href);
    const places = (data?.features || []).map((item) => {
      const props = item.properties || {};
      return {
        id: props.place_id,
        name: props.name || props.address_line1,
        address: props.formatted || props.address_line2,
        categories: props.categories,
        distance: props.distance,
        rating: props.rank?.importance || null,
        coordinates: {
          lat: item.geometry?.coordinates?.[1],
          lng: item.geometry?.coordinates?.[0],
        },
        raw: props,
      };
    });

    return res.json({ places });
  } catch (error) {
    console.error("Geoapify tourist places error:", error);
    return res
      .status(500)
      .json({ error: "Failed to load tourist places.", details: error.message });
  }
});

router.post("/nearby", async (req, res) => {
  if (!ensureGeoapifyConfigured(res)) return;

  const { location = {}, type, radius, limit = 20, categories } = req.body || {};
  if (location.lat == null || location.lng == null) {
    return res.status(400).json({ error: "Latitude and longitude are required." });
  }

  try {
    const categoryFromType = TYPE_CATEGORY_MAP[type] || TYPE_CATEGORY_MAP.attraction;
    const effectiveCategories = categories || categoryFromType;
    const effectiveRadius = clampRadius(radius);

    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", effectiveCategories);
    url.searchParams.set("filter", `circle:${location.lng},${location.lat},${effectiveRadius}`);
    url.searchParams.set("bias", `proximity:${location.lng},${location.lat}`);
    url.searchParams.set("limit", Math.min(Number(limit) || 20, 50));
    url.searchParams.set("lang", "en");
    url.searchParams.set("apiKey", getGeoapifyKey("places"));

    const data = await callGeoapify(url.href);
    const places = (data?.features || []).map((item) => {
      const props = item.properties || {};
      return {
        id: props.place_id,
        name: props.name || props.address_line1,
        address: props.formatted || props.address_line2,
        categories: props.categories,
        distance: props.distance,
        rating: props.rank?.confidence || null,
        coordinates: {
          lat: item.geometry?.coordinates?.[1],
          lng: item.geometry?.coordinates?.[0],
        },
        raw: props,
      };
    });

    return res.json({ places });
  } catch (error) {
    console.error("Geoapify nearby places error:", error);
    return res.status(500).json({ error: "Failed to load nearby places.", details: error.message });
  }
});

router.post("/details", async (req, res) => {
  if (!ensureGeoapifyConfigured(res)) return;

  const { placeId } = req.body || {};
  if (!placeId) {
    return res.status(400).json({ error: "A Geoapify placeId is required." });
  }

  try {
    const url = new URL("https://api.geoapify.com/v2/place-details");
    url.searchParams.set("id", placeId);
    url.searchParams.set("lang", "en");
    url.searchParams.set("apiKey", getGeoapifyKey("places"));

    const data = await callGeoapify(url.href);
    const place = data?.features?.[0]?.properties || null;

    return res.json({ place });
  } catch (error) {
    console.error("Geoapify place details error:", error);
    return res.status(500).json({ error: "Failed to load place details.", details: error.message });
  }
});

router.post("/search", async (req, res) => {
  if (!ensureGeoapifyConfigured(res)) return;

  const { query, limit = 10 } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: "Search text is required." });
  }

  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", query);
    url.searchParams.set("limit", Math.min(Number(limit) || 10, 15));
    url.searchParams.set("filter", "countrycode:in");
    url.searchParams.set("apiKey", getGeoapifyKey("places"));

    const data = await callGeoapify(url.href);
    const suggestions = (data?.features || []).map((feature) => {
      const props = feature.properties || {};
      return {
        id: props.place_id,
        name: props.name || props.address_line1,
        formattedAddress: props.formatted,
        location: {
          lat: feature.geometry?.coordinates?.[1],
          lng: feature.geometry?.coordinates?.[0],
        },
        country: props.country,
        state: props.state,
        city: props.city || props.county,
      };
    });

    return res.json({ suggestions });
  } catch (error) {
    console.error("Geoapify search error:", error);
    return res.status(500).json({ error: "Failed to search places.", details: error.message });
  }
});

router.get("/weather", async (req, res) => {
  try {
    ensureWeatherConfigured();
  } catch (error) {
    return res.status(error.statusCode || 503).json({ error: error.message });
  }

  const { lat, lng } = req.query;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: "Latitude and longitude are required." });
  }

  try {
    const { weather, raw } = await fetchCurrentWeather({ lat, lng });
    return res.json({ weather, raw });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("Weather fetch error:", error.message || error);
    return res
      .status(status)
      .json({ error: "Failed to fetch weather information.", details: error.message });
  }
});

router.get("/map", async (req, res) => {
  const { location = "", zoom = 14, size = "600x400", skipVerification } = req.query;
  const [latString, lngString] = typeof location === "string" ? location.split(",") : [];

  const lat = Number(latString);
  const lng = Number(lngString);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Location must be provided as 'lat,lng'." });
  }

  const {
    style,
    theme,
    language,
    pitch,
    bearing,
    scale,
    markerColor,
    markerIcon,
    markerType,
    markerSize,
    markerLabel,
    markerText,
    overlays,
    overlay,
    markers,
    circle,
  } = req.query;

  const parseJsonArray = (value) => {
    if (!value || typeof value !== "string") return null;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      console.warn("Geoapify map markers JSON parse failed:", error.message || error);
      return null;
    }
  };

  const markerInputs = [];
  const markerQuery = req.query.marker;

  if (Array.isArray(markerQuery)) {
    markerInputs.push(...markerQuery);
  } else if (typeof markerQuery === "string") {
    markerInputs.push(markerQuery);
  }

  const parsedMarkers = parseJsonArray(markers);
  if (parsedMarkers) {
    markerInputs.push(...parsedMarkers);
  }

  if (markerInputs.length === 0) {
    markerInputs.push({
      lat,
      lng,
      color: markerColor,
      icon: markerIcon,
      type: markerType,
      size: markerSize,
      label: markerLabel,
      text: markerText,
    });
  }

  const overlayValues = [];
  if (Array.isArray(overlay)) {
    overlayValues.push(...overlay);
  } else if (typeof overlay === "string") {
    overlayValues.push(overlay);
  }
  const parsedOverlays = parseJsonArray(overlays);
  if (parsedOverlays) {
    overlayValues.push(...parsedOverlays);
  }

  let circleValue = null;
  if (typeof circle === "string" && circle.trim()) {
    const trimmedCircle = circle.trim();
    if (trimmedCircle.startsWith("{")) {
      try {
        const parsedCircle = JSON.parse(trimmedCircle);
        circleValue = parsedCircle;
      } catch (error) {
        console.warn("Geoapify map circle JSON parse failed:", error.message || error);
        circleValue = trimmedCircle;
      }
    } else {
      circleValue = trimmedCircle;
    }
  } else if (circle && typeof circle === "object") {
    circleValue = circle;
  }

  const additionalParams = {};
  Object.entries(req.query).forEach(([key, value]) => {
    if (RESERVED_STATIC_MAP_KEYS.has(key)) return;
    if (value == null || value === "") return;
    additionalParams[key] = value;
  });

  const shouldVerify = String(skipVerification).toLowerCase() !== "true";

  let mapUrl = null;
  let provider = "geoapify";
  let fallbackReason = null;
  let fallbackMapUrl = null;

  try {
    mapUrl = buildStaticMapUrl(
      { lat, lng },
      {
        zoom,
        size,
        style,
        theme,
        language,
        pitch,
        bearing,
        scale,
        markers: markerInputs,
        overlays: overlayValues,
        circle: circleValue,
        additionalParams,
      }
    );

    if (!mapUrl) {
      throw new Error("Geoapify static map URL could not be generated");
    }

    if (shouldVerify) {
      try {
        const headResponse = await fetchApi(mapUrl, { method: "HEAD" });
        if (!headResponse.ok) {
          fallbackReason = `Geoapify static map responded with ${headResponse.status}`;
          fallbackMapUrl = buildOsmStaticMapUrl(
            { lat, lng },
            {
              zoom,
              size,
              markerColor: markerColor || "lightblue1",
            }
          );
        }
      } catch (verificationError) {
        fallbackReason = verificationError.message || "Geoapify static map verification failed";
        fallbackMapUrl = buildOsmStaticMapUrl(
          { lat, lng },
          {
            zoom,
            size,
            markerColor: markerColor || "lightblue1",
          }
        );
      }
    }
  } catch (geoapifyError) {
    fallbackReason = geoapifyError.message || "Geoapify static map unavailable";
    mapUrl = null;
    fallbackMapUrl = buildOsmStaticMapUrl(
      { lat, lng },
      {
        zoom,
        size,
        markerColor: markerColor || "lightblue1",
      }
    );
  }

  if (!mapUrl) {
    provider = "osm";
    mapUrl = fallbackMapUrl;
    fallbackMapUrl = null;
  } else if (fallbackMapUrl) {
    provider = "geoapify";
  }

  return res.json({ mapUrl, provider, fallbackReason, fallbackMapUrl });
});

module.exports = router;
