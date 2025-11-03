// unsplash.js
// REPAIRED FILE (v2)
// This version integrates the contextual hints from `heroImageHints.js`
// and includes an aggressive negative keyword filter to eliminate portraits and people-centric photos.

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { getHeroImageHints } = require("./heroImageHints");

let fetchFn = typeof fetch === "function" ? fetch : null;
const ensureFetch = async () => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn;
};

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

const DEFAULT_FALLBACK_ASSETS = [
  "/assets/1.jpg",
  "/assets/2.jpg",
  "/assets/3.jpg",
  "/assets/4.jpg",
  "/assets/5.jpg",
  "/assets/6.jpg",
  "/assets/7.jpg",
  "/assets/8.jpg",
];

// MODIFICATION: Greatly expanded negative keywords to filter out people/portraits
const DEFAULT_NEGATIVE_KEYWORDS = [
  // Aggressively filter people/portraits
  "portrait",
  "people",
  "person",
  "man",
  "woman",
  "boy",
  "girl",
  "child",
  "children",
  "kid",
  "kids",
  "face",
  "selfie",
  "model",
  "fashion",
  "wedding",
  "couple",
  "bride",
  "groom",
  "crowd",
  "protest",
  "closeup",
  "close-up",

  // Existing filters for roads, generic animals, etc.
  "road",
  "highway",
  "street",
  "traffic",
  "vehicle",
  "truck",
  "car",
  "cars",
  "bus",
  "motorcycle",
  "tarmac",
  "expressway",
  "freeway",
  "roadway",
  "bridge",
  "overpass",
  "intersection",
  "lane",
  "parking",
  "runway",
  "railway",
  "subway",
  "metro",
  "traffic light",
  "signage",
  "billboard",
  "lightning",
  "storm",
  "thunder",
  "animal",
  "tiger",
  "lion",
  "panther",
  "wildlife",
  "zoo",
  "safari",
  "dog",
  "cat",
  "insect",
  "bird",
];

const DEFAULT_POSITIVE_KEYWORDS = [
  "landmark",
  "iconic",
  "heritage",
  "historic",
  "scenic",
  "panoramic",
  "sunset",
  "sunrise",
  "blue hour",
  "aerial",
  "skyline",
  "landscape",
  "travel",
  "tourism",
  "architecture",
  "temple",
  "palace",
  "fort",
  "mountain",
  "valley",
  "waterfall",
  "river",
  "coastal",
  "beach",
  "island",
  "vibrant",
  "night lights",
  "dramatic lighting",
];

const CITY_LIST = [
  "bangalore",
  "bengaluru",
  "mumbai",
  "delhi",
  "chennai",
  "hyderabad",
  "pune",
  "kolkata",
  "kochi",
  "mysore",
  "mysuru",
  "hubli",
  "hubballi",
  "belgaum",
  "ballari",
  "sagar",
  "sirsi",
];

const SCENIC_LIST = [
  "coorg",
  "ooty",
  "chikmagalur",
  "wayanad",
  "kodagu",
  "munnar",
  "manali",
  "darjeeling",
];
const LANDMARK_HINTS = [
  "palace",
  "temple",
  "fort",
  "monument",
  "falls",
  "bridge",
  "lake",
  "beach",
  "park",
  "stadium",
];

const randomArrayItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const fetchUnsplashImage = async (query, options = {}) => {
  if (!UNSPLASH_ACCESS_KEY) return null;
  const fetch = await ensureFetch();
  const perPage = Math.min(Number(options.perPage) || 12, 30);
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", perPage.toString());
  url.searchParams.set("page", options.page || "1");
  url.searchParams.set("orientation", options.orientation || "landscape");
  url.searchParams.set("content_filter", options.contentFilter || "high");

  if (options.collections) url.searchParams.set("collections", options.collections);

  const response = await fetch(url.href, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.errors?.[0] || "Unsplash request failed");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return Array.isArray(payload?.results) ? payload.results : [];
};

const fetchPexelsImage = async (query, options = {}) => {
  if (!PEXELS_API_KEY) return null;
  const fetch = await ensureFetch();
  const perPage = Math.min(Number(options.perPage) || 12, 30);
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", perPage.toString());
  url.searchParams.set("orientation", options.orientation || "landscape");

  const response = await fetch(url.href, {
    headers: { Authorization: PEXELS_API_KEY },
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error || "Pexels request failed");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  const photos = Array.isArray(payload?.photos) ? payload.photos : [];
  return photos.map((p) => ({
    id: p.id,
    width: p.width,
    height: p.height,
    description: p.alt,
    alt_description: p.alt,
    urls: { regular: p.src.landscape, full: p.src.original, small: p.src.small, thumb: p.src.tiny },
    likes: p.liked ? 1 : 0,
    user: { name: p.photographer },
    photographer: p.photographer,
    location: { name: p.photographer },
    tags: [],
  }));
};

const buildWebFallback = (query, size = "1600x900") =>
  `https://source.unsplash.com/featured/${size}/?${encodeURIComponent(query)}`;

const pickAssetFallback = (options = {}) => {
  const pool =
    Array.isArray(options.assets) && options.assets.length
      ? options.assets
      : DEFAULT_FALLBACK_ASSETS;
  return randomArrayItem(pool);
};

const normalizeImageUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().toLowerCase();
  } catch (error) {
    const idx = url.indexOf("?");
    return (idx >= 0 ? url.slice(0, idx) : url).toLowerCase();
  }
};

const getHeroImage = async (destination, options = {}) => {
  const debug = options.debug || false;
  const result = { url: null, source: "", attribution: "", meta: {} };

  const isObjectInput = typeof destination === "object" && destination !== null;
  const query = isObjectInput ? destination.name || destination.query : destination;

  if (!query || typeof query !== "string" || !query.trim()) {
    result.url = pickAssetFallback(options);
    result.source = "asset";
    return result;
  }

  const normalizedQuery = query.trim();
  const hints = isObjectInput ? getHeroImageHints(destination) : {};
  const baseVariants = resolveQueryVariants(normalizedQuery, options.queryVariants);
  const variants = Array.from(new Set([...(hints.queryVariants || []), ...baseVariants]));

  const apiOptions = {
    perPage: options.apiOptions?.perPage ?? 15,
    orientation: options.apiOptions?.orientation ?? "landscape",
    contentFilter: options.apiOptions?.contentFilter ?? "high",
    collections: options.apiOptions?.collections,
  };

  const qLower = normalizedQuery.toLowerCase();
  let queryType = "generic";
  if (LANDMARK_HINTS.some((h) => qLower.includes(h))) queryType = "landmark";
  else if (SCENIC_LIST.includes(qLower)) queryType = "scenic";
  else if (CITY_LIST.includes(qLower)) queryType = "city";

  const normalizeKeywordList = (keywords) =>
    Array.from(new Set((keywords || []).map((kw) => kw.trim().toLowerCase()).filter(Boolean)));

  let negativeKeywords = normalizeKeywordList([
    ...DEFAULT_NEGATIVE_KEYWORDS,
    ...(options.bannedKeywords || []),
    ...(hints.bannedKeywords || []),
  ]);

  if (queryType === "city") {
    negativeKeywords = normalizeKeywordList([
      ...negativeKeywords,
      "wildlife",
      "animal",
      "forest",
      "waterfall",
    ]);
  }

  const preferredKeywords = normalizeKeywordList(hints.preferredKeywords);
  const extraTokens = normalizeKeywordList(hints.extraTokens);

  const providers = options.providers || ["unsplash", "pexels"];
  const excludedUrls = new Set((options.excludeUrls || []).map(normalizeImageUrl).filter(Boolean));
  const isDuplicate = (url) => excludedUrls.has(normalizeImageUrl(url));
  const registerUrl = (url) => excludedUrls.add(normalizeImageUrl(url));

  let candidatePool = [];
  try {
    for (const v of variants) {
      if (debug) console.debug("Trying variant:", v);
      const tasks = [
        providers.includes("unsplash") ? fetchUnsplashImage(v, apiOptions) : Promise.resolve([]),
        providers.includes("pexels") ? fetchPexelsImage(v, apiOptions) : Promise.resolve([]),
      ];

      const results = await Promise.allSettled(tasks);

      if (results[0].status === "fulfilled" && Array.isArray(results[0].value)) {
        candidatePool.push(...results[0].value.map((p) => ({ provider: "unsplash", raw: p })));
      }
      if (results[1].status === "fulfilled" && Array.isArray(results[1].value)) {
        candidatePool.push(...results[1].value.map((p) => ({ provider: "pexels", raw: p })));
      }

      if (candidatePool.length >= 10) break;
    }
  } catch (err) {
    if (options.onError) options.onError(err);
    if (debug) console.error("Provider fetch error:", err);
  }

  if (candidatePool.length > 0) {
    const scoredCandidates = [];

    for (const entry of candidatePool) {
      const { raw, provider } = entry;
      const photoUrl = raw.urls?.regular || raw.urls?.full || null;

      if (!photoUrl || isDuplicate(photoUrl)) continue;

      const width = Number(raw.width) || 0;
      const height = Number(raw.height) || 0;
      if (width && height && width < height) {
        if (debug) console.debug("Skipped portrait candidate", photoUrl);
        continue;
      }

      const textFragments = [
        raw.description,
        raw.alt_description,
        raw.location?.name,
        raw.location?.city,
        raw.location?.country,
        ...(raw.tags || []).map((t) => t.title),
      ].filter(Boolean);
      const combinedText = textFragments.join(" ").toLowerCase();

      if (negativeKeywords.some((kw) => combinedText.includes(kw))) {
        if (debug)
          console.debug(`Rejected [${photoUrl}] due to negative keyword in: "${combinedText}"`);
        continue;
      }

      let score = 0;
      preferredKeywords.forEach((kw) => {
        if (combinedText.includes(kw)) score += 10;
      });
      extraTokens.forEach((kw) => {
        if (combinedText.includes(kw)) score += 5;
      });
      DEFAULT_POSITIVE_KEYWORDS.forEach((kw) => {
        if (combinedText.includes(kw)) score += 2;
      });

      if (raw.likes && raw.likes > 100) score += 3;
      if (raw.likes && raw.likes > 50) score += 1;

      scoredCandidates.push({
        score,
        url: photoUrl,
        thumbnail: raw.urls?.small || raw.urls?.thumb,
        source: provider,
        attribution:
          (raw.user?.name &&
            `${raw.user.name} on ${provider.charAt(0).toUpperCase() + provider.slice(1)}`) ||
          "Unknown",
        meta: { provider, width, height, likes: raw.likes || 0, text: combinedText },
      });
    }

    if (scoredCandidates.length > 0) {
      scoredCandidates.sort((a, b) => b.score - a.score);
      const best = scoredCandidates[0];

      if (debug) console.debug("Best candidate:", best);

      registerUrl(best.url);
      result.url = best.url;
      result.thumbnail = best.thumbnail;
      result.source = best.source;
      result.attribution = best.attribution;
      result.meta = best.meta;
      return result;
    }
  }

  if (!options.skipWebFallback) {
    const fallbackQuery = `${normalizedQuery} ${queryType === "city" ? "cityscape" : "scenic landmark"}`;
    const fallbackUrl = buildWebFallback(fallbackQuery, options.webSize || "1600x900");
    if (!isDuplicate(fallbackUrl)) {
      registerUrl(fallbackUrl);
      result.url = fallbackUrl;
      result.source = "web-fallback";
      return result;
    }
  }

  if (!options.skipAssetFallback) {
    const asset = pickAssetFallback(options);
    if (!isDuplicate(asset)) {
      registerUrl(asset);
      result.url = asset;
      result.source = "asset";
      return result;
    }
  }

  if (options.defaultUrl && !isDuplicate(options.defaultUrl)) {
    registerUrl(options.defaultUrl);
    result.url = options.defaultUrl;
    result.source = "default";
    return result;
  }

  return result;
};

const resolveQueryVariants = (query, providedVariants = []) => {
  const variants = [];
  if (typeof query === "string" && query.trim()) variants.push(query.trim());

  if (Array.isArray(providedVariants)) variants.push(...providedVariants);

  if (variants.length > 0) {
    const base = variants[0];
    variants.push(`${base} landmark`, `${base} tourism`, `${base} scenic`);
    variants.push(`${base} cinematic view`, `${base} dramatic landscape`, `${base} cityscape`);
  }
  return Array.from(new Set(variants.map((v) => v.trim()).filter(Boolean)));
};

module.exports = {
  getHeroImage,
  fetchUnsplashImage,
  fetchPexelsImage,
  buildWebFallback,
  pickAssetFallback,
  DEFAULT_NEGATIVE_KEYWORDS,
  DEFAULT_POSITIVE_KEYWORDS,
};
