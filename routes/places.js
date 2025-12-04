const express = require("express");
const router = express.Router();

const DestinationCache = require("../models/DestinationCache");
const { authenticateToken } = require("../middleware/auth");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

let fetchFn = typeof fetch === "function" ? fetch : null;

const fetchApi = async (...args) => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn(...args);
};

const ensureFetch = async () => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn;
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

const normalizeQuery = (value = "") => value.trim().toLowerCase();

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildQueryVariants = (raw) => {
  const variants = [];
  const base = (raw || "").trim();
  if (!base) return variants;

  variants.push(base);

  const hyphenMatch = base.match(/^(.*?)[-\s]+(\d{5,6})$/);
  if (hyphenMatch) {
    const locationPart = hyphenMatch[1].replace(/[-_,]+/g, " ").trim();
    const pinPart = hyphenMatch[2];
    if (locationPart) {
      variants.push(`${locationPart} ${pinPart}`);
      variants.push(`${locationPart}, ${pinPart}`);
      variants.push(`${pinPart} ${locationPart}`);
    }
  }

  const digitsOnly = base.replace(/[^0-9]/g, "");
  if (digitsOnly.length === 6 || digitsOnly.length === 5) {
    const sanitized = base.replace(/[-_,0-9]+/g, " ").trim();
    if (sanitized) {
      variants.push(`${sanitized} ${digitsOnly}`);
      variants.push(`${sanitized}, ${digitsOnly}`);
    }
  }

  return Array.from(new Set(variants.filter(Boolean)));
};

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

const ensureSessionKey = (req, res, next) => {
  const sessionKey = getSessionKeyFromRequest(req);
  if (!sessionKey) {
    return res.status(400).json({ error: "Session key header X-Session-Key is required" });
  }
  req.sessionKey = sessionKey;
  next();
};

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
      let cached = await DestinationCache.findOne(cacheFilter).lean();
      if (!cached) {
        cached = await DestinationCache.findOne({ normalizedQuery }).lean();
      }
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
          queryVariantUsed: cached.resolvedQuery || cached.originalQuery || trimmedQuery,
        });
      }
    }

    const key = getGeoapifyKey("places");
    const fetch = await ensureFetch();
    const variants = buildQueryVariants(trimmedQuery);
    const attemptErrors = [];

    let match = null;
    let variantUsed = null;

    for (const variant of variants) {
      try {
        const url = new URL("https://api.geoapify.com/v1/geocode/search");
        url.searchParams.set("text", variant);
        url.searchParams.set("limit", "1");
        url.searchParams.set("format", "json");
        url.searchParams.set("apiKey", key);

        const resp = await fetch(url.href);
        if (!resp.ok) {
          const detailText = await resp.text().catch(() => "");
          attemptErrors.push({
            variant,
            status: resp.status,
            details: detailText?.slice(0, 180) || undefined,
          });

          if (resp.status === 401 || resp.status === 403 || resp.status >= 500) {
            return res.status(resp.status).json({
              error: "Geoapify geocode error",
              details: detailText,
              attempts: attemptErrors,
            });
          }
          continue;
        }

        const data = await resp.json();
        const candidate = data?.results?.[0];
        if (!candidate) {
          attemptErrors.push({ variant, status: 404, details: "No results returned" });
          continue;
        }

        match = candidate;
        variantUsed = variant;
        break;
      } catch (attemptError) {
        attemptErrors.push({ variant, status: 500, details: attemptError.message });
      }
    }

    if (!match) {
      return res
        .status(404)
        .json({ error: "No results found for the query", attempts: attemptErrors });
    }

    const responsePayload = {
      coordinates: { lat: Number(match.lat), lng: Number(match.lon) },
      formattedAddress: match.formatted,
      city: match.city || match.county,
      state: match.state,
      country: match.country,
      raw: match,
      cached: false,
      queryVariantUsed: variantUsed,
    };

    if (normalizedQuery) {
      const setFields = {
        originalQuery: trimmedQuery,
        formattedAddress: responsePayload.formattedAddress,
        city: responsePayload.city,
        state: responsePayload.state,
        country: responsePayload.country,
        coordinates: responsePayload.coordinates,
        raw: match,
        lastAccessedAt: new Date(),
      };

      if (variantUsed && variantUsed !== trimmedQuery) {
        setFields.resolvedQuery = variantUsed;
      }

      if (scope?.ownerUserId) {
        setFields.ownerUserId = scope.ownerUserId;
      }
      if (scope?.sessionKey) {
        setFields.sessionKey = scope.sessionKey;
      }

      const updateOps = {
        $set: setFields,
        $inc: { searchCount: 1 },
      };

      const upsertOps = {
        ...updateOps,
        $setOnInsert: { normalizedQuery },
      };

      try {
        const scopedDoc = await DestinationCache.findOne(cacheFilter).select("_id");
        if (scopedDoc) {
          await DestinationCache.updateOne({ _id: scopedDoc._id }, updateOps);
        } else {
          await DestinationCache.updateOne(cacheFilter, upsertOps, {
            upsert: true,
            setDefaultsOnInsert: true,
          });
        }
      } catch (cacheError) {
        if (cacheError?.code === 11000) {
          try {
            await DestinationCache.updateOne({ normalizedQuery }, updateOps, {
              upsert: false,
            });
          } catch (secondaryError) {
            console.warn(
              "Destination cache fallback update failed",
              secondaryError.message || secondaryError
            );
          }
        } else {
          console.warn("Failed to cache destination geocode", cacheError.message || cacheError);
        }
      }
    }

    return res.json(responsePayload);
  } catch (error) {
    console.error("Geoapify geocode error:", error);
    return res.status(500).json({ error: "Failed to geocode", details: error.message });
  }
});

router.get("/suggest", async (req, res) => {
  const rawQuery = req.query.query || req.query.q || "";
  const normalizedPartial = normalizeQuery(rawQuery);
  const scope = getCacheScope(req);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);

  const filter = buildCacheFilter(null, scope);
  if (normalizedPartial) {
    filter.normalizedQuery = {
      $regex: new RegExp(`^${escapeRegExp(normalizedPartial)}`),
    };
  }

  try {
    const docs = await DestinationCache.find(filter)
      .sort({ lastAccessedAt: -1 })
      .limit(limit)
      .lean();

    const seen = new Set();
    const suggestions = [];

    docs.forEach((doc) => {
      if (!doc) return;
      const label =
        doc.originalQuery || doc.formattedAddress || doc.city || doc.state || doc.country;
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      suggestions.push({
        text: label,
        formattedAddress: doc.formattedAddress,
        city: doc.city,
        state: doc.state,
        country: doc.country,
        coordinates: doc.coordinates,
        searchCount: doc.searchCount,
        lastSearchedAt: doc.lastAccessedAt,
      });
    });

    if (!normalizedPartial && suggestions.length === 0) {
      const fallbackDocs = await DestinationCache.find({ ownerUserId: { $exists: false } })
        .sort({ searchCount: -1 })
        .limit(5)
        .lean();
      fallbackDocs.forEach((doc) => {
        if (!doc) return;
        const label =
          doc.originalQuery || doc.formattedAddress || doc.city || doc.state || doc.country;
        if (!label) return;
        const key = label.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        suggestions.push({
          text: label,
          formattedAddress: doc.formattedAddress,
          city: doc.city,
          state: doc.state,
          country: doc.country,
          coordinates: doc.coordinates,
          searchCount: doc.searchCount,
          lastSearchedAt: doc.lastAccessedAt,
        });
      });
    }

    return res.json({ suggestions });
  } catch (error) {
    console.error("Destination suggest error:", error);
    return res.status(500).json({ error: "Failed to fetch suggestions", details: error.message });
  }
});

router.post("/distance", async (req, res) => {
  if (!ensureGeoapifyConfigured(res)) return;
  const { from, to, mode = "drive", itineraryId } = req.body || {};
  if (!from || !to || from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
    return res.status(400).json({ error: "from {lat,lng} and to {lat,lng} are required" });
  }
  const key = getGeoapifyKey("places");
  const fromPoint = {
    lat: Number(from.lat),
    lng: Number(from.lng ?? from.lon ?? from.longitude),
  };
  const toPoint = {
    lat: Number(to.lat),
    lng: Number(to.lng ?? to.lon ?? to.longitude),
  };

  if (
    !Number.isFinite(fromPoint.lat) ||
    !Number.isFinite(fromPoint.lng) ||
    !Number.isFinite(toPoint.lat) ||
    !Number.isFinite(toPoint.lng)
  ) {
    return res.status(400).json({ error: "Invalid coordinate values" });
  }

  const toRadians = (deg) => (deg * Math.PI) / 180;
  const haversineMeters = (a, b) => {
    const R = 6371000;
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return 2 * R * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
  };

  const defaultSpeeds = {
    drive: 16.67,
    "drive+traffic": 13.9,
    walk: 1.4,
    bike: 4.5,
  };

  let providerPayload = null;
  let distanceMeters = null;
  let durationSeconds = null;
  let providerError = null;
  let usedFallback = false;

  try {
    const url = new URL("https://api.geoapify.com/v1/routing");
    url.searchParams.set(
      "waypoints",
      `${fromPoint.lng},${fromPoint.lat}|${toPoint.lng},${toPoint.lat}`
    );
    url.searchParams.set("mode", `${mode}`);
    url.searchParams.set("details", "instruction_details,route_details");
    url.searchParams.set("apiKey", key);
    const fetch = await ensureFetch();
    const resp = await fetch(url.href);

    if (resp.ok) {
      const data = await resp.json();
      providerPayload = data;
      const feature = data?.features?.[0] || null;
      const properties = feature?.properties || {};
      const summary = properties.summary || {};

      const parsedDistance = Number(
        properties.distance ?? properties.distance_m ?? summary.distance ?? summary.length
      );
      const parsedDuration = Number(
        properties.time ?? properties.time_seconds ?? summary.duration ?? summary.time
      );

      if (Number.isFinite(parsedDistance) && parsedDistance > 0) {
        distanceMeters = parsedDistance;
      }
      if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
        durationSeconds = parsedDuration;
      }

      if (!distanceMeters || !durationSeconds) {
        providerError = "Geoapify response missing distance/time";
      }
    } else {
      providerError = `HTTP ${resp.status}`;
      const text = await resp.text();
      providerPayload = text;
    }
  } catch (error) {
    providerError = error.message;
  }

  if (!distanceMeters || !durationSeconds) {
    usedFallback = true;
    distanceMeters = haversineMeters(fromPoint, toPoint);
    const speed = defaultSpeeds[mode] || defaultSpeeds.drive;
    durationSeconds = speed > 0 ? distanceMeters / speed : 0;
  }

  try {
    if (itineraryId) {
      const Itinerary = require("../models/Itinerary");
      const itinerary = await Itinerary.findById(itineraryId);
      if (itinerary) {
        itinerary.distanceHistory = itinerary.distanceHistory || [];
        itinerary.distanceHistory.push({
          from: fromPoint,
          to: toPoint,
          mode,
          distanceMeters,
          durationSeconds,
          providerError,
          providerPayload,
          usedFallback,
          createdAt: new Date(),
        });
        itinerary.updatedAt = new Date();
        await itinerary.save();
      }
    }
  } catch (persistError) {
    console.warn("Persist distance failed:", persistError.message || persistError);
  }

  return res.json({
    distanceMeters,
    durationSeconds,
    fallback: usedFallback,
    providerError,
    providerPayload,
  });
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
    const effectiveCategories =
      categories || "tourism,entertainment,catering,commercial.shopping_mall";
    const effectiveRadius = clampRadius(radius || 5000); // Reverted to 5km default for safety

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
