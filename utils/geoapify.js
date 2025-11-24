/**
 * geoapify.js — Enhanced version
 * Author: Shridhar S Hegde (2025)
 * Purpose: Unified and improved Geoapify integration
 */

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

let fetchFn = typeof fetch === "function" ? fetch : null;

const ensureFetch = async () => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn;
};

// 🔑 Unified key handling
const GEOAPIFY_KEY =
  process.env.GEOAPIFY_PLACES_API_KEY ||
  process.env.GEOAPIFY_STATIC_MAP_API_KEY ||
  process.env.GEOAPIFY_API_KEY ||
  process.env.GEOAPIFY_MAPS_API_KEY;

if (!GEOAPIFY_KEY) {
  console.warn(
    "\x1b[33m[Geoapify Warning]\x1b[0m API key not found. Make sure you set GEOAPIFY_API_KEY (and related variants) in .env"
  );
}

// ✅ Ensure key present
const ensureConfigured = () => {
  if (!GEOAPIFY_KEY) {
    const error = new Error("Geoapify API key is not configured");
    error.statusCode = 503;
    throw error;
  }
  return GEOAPIFY_KEY;
};

// 🔧 Generic fetch JSON
const fetchJson = async (url) => {
  const fetch = await ensureFetch();
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload?.error || payload?.message || `Geoapify request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

// 📍 Geocode text query → coordinates
// 📍 Geocode text query → coordinates (Smart Filter)
const geocode = async (query, options = {}) => {
  const apiKey = ensureConfigured();
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", query);
  url.searchParams.set("limit", "5"); // Fetch top 5 to filter
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey);

  if (options.country) {
    url.searchParams.set("filter", `countrycode:${options.country.toLowerCase()}`);
  }

  const result = await fetchJson(url.href);
  const results = result?.results || [];

  if (results.length === 0) return null;

  // Prioritize administrative areas over businesses/amenities
  const priorityTypes = ["city", "state", "country", "county", "state_district", "postcode"];
  const bestMatch = results.find((r) => priorityTypes.includes(r.result_type));

  return bestMatch || results[0];
};

// 🏨 Fetch place details by ID
const fetchPlaceDetails = async (placeId) => {
  const apiKey = ensureConfigured();
  const url = new URL("https://api.geoapify.com/v2/place-details");
  url.searchParams.set("id", placeId);
  url.searchParams.set("apiKey", apiKey);
  const result = await fetchJson(url.href);
  return result?.features?.[0]?.properties || null;
};

// 🧭 Category mapper (human → Geoapify)
const mapCategory = (term) => {
  const lower = term.toLowerCase();
  if (lower.includes("tour")) return "tourism.attraction";
  if (lower.includes("rest") || lower.includes("food") || lower.includes("dine"))
    return "catering.restaurant,catering.cafe";
  if (lower.includes("hotel") || lower.includes("stay") || lower.includes("lodge"))
    return "accommodation.hotel,accommodation.motel,accommodation.guest_house";
  if (lower.includes("shop")) return "commercial.shop";
  return term; // fallback for already valid Geoapify categories
};

// 🗺️ Fetch nearby places
const fetchPlaces = async ({ lat, lng, categories, radius = 5000, limit = 20 }) => {
  const apiKey = ensureConfigured();
  if (lat == null || lng == null) {
    throw new Error("Latitude and longitude are required to fetch Geoapify places");
  }

  const mappedCats = Array.isArray(categories)
    ? categories.map(mapCategory).join(",")
    : mapCategory(categories || "tourism.attraction");

  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", mappedCats);
  url.searchParams.set("filter", `circle:${lng},${lat},${radius}`);
  url.searchParams.set("bias", `proximity:${lng},${lat}`);
  url.searchParams.set("limit", Math.min(Number(limit) || 20, 50));
  url.searchParams.set("lang", "en");
  url.searchParams.set("apiKey", apiKey);

  const result = await fetchJson(url.href);
  return result?.features || [];
};

// ✨ Autocomplete place names
const autocomplete = async (query, limit = 10) => {
  const apiKey = ensureConfigured();
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", query);
  url.searchParams.set("limit", Math.min(Number(limit) || 10, 15));
  url.searchParams.set("apiKey", apiKey);
  const result = await fetchJson(url.href);
  return result?.features || [];
};

// 🎨 Encode hex color for static map
const encodeHexColor = (value) => {
  if (!value || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.startsWith("%23") || trimmed.startsWith("#")) {
    return `%23${trimmed.replace(/^%23|#/u, "")}`;
  }
  return `%23${trimmed}`;
};

// 🏷️ Marker formatter
const formatMarkerDefinition = (marker, fallback = {}) => {
  if (!marker) return null;
  if (typeof marker === "string") return marker.trim() || null;
  const lat = marker.lat ?? marker.latitude ?? fallback.lat;
  const lng = marker.lng ?? marker.lon ?? marker.longitude ?? fallback.lng;
  if (lat == null || lng == null) return null;

  const parts = [`lonlat:${lng},${lat}`];
  parts.push(`type:${marker.type || "material"}`);
  parts.push(`color:${encodeHexColor(marker.color || "%23f72585")}`);
  parts.push(`icon:${marker.icon || "material:place"}`);
  if (marker.size) parts.push(`size:${marker.size}`);
  if (marker.label) parts.push(`label:${marker.label}`);
  if (marker.text) parts.push(`text:${encodeURIComponent(marker.text)}`);
  return parts.join(";");
};

// ⛳ Build static map URL with multiple markers
const buildStaticMapUrl = (
  { lat, lng } = {},
  { zoom = 13, size = "800x600", style = "osm-carto", markers = [], additionalParams = {} } = {}
) => {
  const apiKey = ensureConfigured();
  if (lat == null || lng == null) return null;

  const [width, height] = size.split("x");
  const url = new URL("https://maps.geoapify.com/v1/staticmap");
  url.searchParams.set("style", style);
  url.searchParams.set("width", width || "800");
  url.searchParams.set("height", height || "600");
  url.searchParams.set("center", `lonlat:${lng},${lat}`);
  url.searchParams.set("zoom", zoom);

  const markerDefs =
    markers.length > 0
      ? markers.map((m) => formatMarkerDefinition(m, { lat, lng })).filter(Boolean)
      : [formatMarkerDefinition({ lat, lng })];

  markerDefs.forEach((m) => url.searchParams.append("marker", m));

  Object.entries(additionalParams).forEach(([key, val]) => {
    if (val != null) url.searchParams.set(key, val);
  });

  url.searchParams.set("apiKey", apiKey);
  const mapUrl = url.href;
  console.log("Static Map URL:", mapUrl);
  return mapUrl;
};

// 🔤 Resolve readable name (supports local languages)
const resolvePlaceName = (props = {}) => {
  const candidates = [
    props.name,
    props.name_en,
    props.datasource?.raw?.name_en,
    props.datasource?.raw?.name,
    props.address_line1,
    props.address_line2,
    props.street,
    props.city,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  return candidates[0] || "Unnamed place";
};

// 🧩 Convert raw Geoapify feature → app-friendly format
const transformPlaceFeature = (feature) => {
  if (!feature || typeof feature !== "object") return null;
  const props = feature.properties || {};

  const coordinates = Array.isArray(feature.geometry?.coordinates)
    ? { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] }
    : null;

  return {
    placeId: props.place_id,
    name: resolvePlaceName(props),
    address: props.formatted || props.address_line2 || "",
    categories: props.categories || [],
    distance: props.distance || null,
    rating:
      props.datasource?.raw?.rating ||
      props.rank?.popularity ||
      props.rank?.confidence ||
      props.rank?.importance ||
      null,
    website: props.website || props.datasource?.raw?.website || "",
    phone: props.datasource?.raw?.phone || "",
    coordinates,
    raw: props,
  };
};

module.exports = {
  geocode,
  fetchPlaces,
  fetchPlaceDetails,
  autocomplete,
  buildStaticMapUrl,
  transformPlaceFeature,
};
