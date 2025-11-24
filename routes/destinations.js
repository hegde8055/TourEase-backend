// Wikipedia summary endpoint
const { fetchWikipediaSummary } = require("../utils/wikipedia");

// ensure router is initialized before handlers are attached
const express = require("express");
const router = express.Router();

// GET /api/destinations/:id/wikipedia or /api/destinations/wikipedia?title=...
router.get(["/:id/wikipedia", "/wikipedia"], async (req, res) => {
  try {
    let title = req.query.title;
    if (!title && req.params.id) {
      // Lookup destination by ID to get its name
      const { ObjectId } = require("mongodb");
      const db = req.app.locals.db;
      if (!db) return res.status(503).json({ success: false, error: "DB not ready" });
      const doc = await db.collection("destinations").findOne({ _id: new ObjectId(req.params.id) });
      if (!doc) return res.status(404).json({ success: false, error: "Destination not found" });
      title = doc.name;
    }
    if (!title) return res.status(400).json({ success: false, error: "No title provided" });
    const wiki = await fetchWikipediaSummary(title);
    if (!wiki) return res.status(404).json({ success: false, error: "No Wikipedia summary found" });
    res.json({ success: true, ...wiki });
  } catch (err) {
    res.status(500).json({ success: false, error: "Wikipedia fetch failed", details: err.message });
  }
});
// /server/routes/destinations.js
const {
  geocode,
  fetchPlaces,
  buildStaticMapUrl,
  transformPlaceFeature,
} = require("../utils/geoapify");
const {
  getHeroImage,
  DEFAULT_NEGATIVE_KEYWORDS,
  DEFAULT_POSITIVE_KEYWORDS,
} = require("../utils/unsplash");
const { fetchCurrentWeather } = require("../utils/weather");
const { getHeroImageHints } = require("../utils/heroImageHints");

const PLACE_CATEGORY_MAP = {
  attractions: "tourism.sights,tourism.attraction",
  hotels: "accommodation.hotel,accommodation.guest_house,accommodation.hostel",
  restaurants: "catering.restaurant",
};

const createSlug = (text = "") =>
  String(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSummary = (baseRecord = {}, attractions = []) => {
  const lines = [];
  const formatted = baseRecord.formatted || baseRecord.result?.formatted_address;
  if (formatted) {
    lines.push(`Discover ${formatted}.`);
  }
  const topAttraction = attractions[0]?.name;
  if (topAttraction) {
    lines.push(`Don't miss ${topAttraction}, a favourite nearby highlight.`);
  }
  if (baseRecord.timezone?.name) {
    lines.push(`Local timezone: ${baseRecord.timezone.name}.`);
  }
  return lines.join(" ") || "Plan an unforgettable escape across India with TourEase.";
};

const buildTags = (baseRecord = {}, query = "") => {
  const tokens = new Set();
  const push = (value) => {
    if (!value || typeof value !== "string") return;
    const cleaned = value.trim().toLowerCase();
    if (cleaned) tokens.add(cleaned);
  };

  push(query);
  push(baseRecord.name || baseRecord.result?.name);
  push(baseRecord.country);
  push(baseRecord.state);
  push(baseRecord.city || baseRecord.county);
  push(baseRecord.result?.kind);

  return Array.from(tokens);
};

const toLocationObject = (baseRecord = {}) => {
  const lat = baseRecord.lat != null ? Number(baseRecord.lat) : null;
  const lng = baseRecord.lon != null ? Number(baseRecord.lon) : null;
  return {
    formatted: baseRecord.formatted || "",
    name: baseRecord.result?.name || baseRecord.name || baseRecord.address_line1 || "",
    city:
      baseRecord.city ||
      baseRecord.county ||
      baseRecord.town ||
      baseRecord.suburb ||
      baseRecord.state_district ||
      "",
    state: baseRecord.state || baseRecord.state_code || baseRecord.region || "",
    country: baseRecord.country || "India",
    postcode: baseRecord.postcode || baseRecord.result?.address?.postcode || "",
    coordinates: lat != null && lng != null ? { lat, lng } : null,
    timezone: baseRecord.timezone?.name || null,
  };
};

const fetchPlaceCollection = async (coordinates, categories, { radius, limit }) => {
  if (!coordinates) return [];
  try {
    const features = await fetchPlaces({
      lat: coordinates.lat,
      lng: coordinates.lng,
      categories,
      radius,
      limit,
    });
    return features.map(transformPlaceFeature).filter(Boolean);
  } catch (error) {
    console.error(`Geoapify places fetch failed (${categories}):`, error.message || error);
    return [];
  }
};

// Get all destinations with optional filters
router.get("/", async (req, res) => {
  try {
    const { category, city, search, limit = 30, sort = "rating", trending } = req.query;

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database connection not ready",
      });
    }
    const destinationsCollection = db.collection("destinations");

    // Build query
    const query = {};
    if (category) query.category = category;
    if (city) query["location.city"] = new RegExp(city, "i");
    if (trending === "true" || trending === true) query.trending = true;
    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { "location.city": new RegExp(search, "i") },
      ];
    }

    // Build sort
    const sortOptions = {};
    if (sort === "rating") sortOptions.rating = -1;
    else if (sort === "name") sortOptions.name = 1;
    else if (sort === "recent") sortOptions._id = -1;
    else if (sort === "trendingRank") sortOptions.trendingRank = 1;

    const destinations = await destinationsCollection
      .find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .toArray();

    res.json({
      success: true,
      count: destinations.length,
      destinations,
    });
  } catch (error) {
    console.error("Get destinations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch destinations",
      details: error.message,
    });
  }
});

// Get single destination by ID
router.get("/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database connection not ready",
      });
    }
    const destinationsCollection = db.collection("destinations");

    const destination = await destinationsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!destination) {
      return res.status(404).json({
        success: false,
        error: "Destination not found",
      });
    }

    res.json({
      success: true,
      destination,
    });
  } catch (error) {
    console.error("Get destination error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch destination",
      details: error.message,
    });
  }
});

// Get destinations by category
router.get("/category/:category", async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database connection not ready",
      });
    }
    const destinationsCollection = db.collection("destinations");

    const destinations = await destinationsCollection
      .find({ category: req.params.category })
      .sort({ rating: -1 })
      .toArray();

    res.json({
      success: true,
      category: req.params.category,
      count: destinations.length,
      destinations,
    });
  } catch (error) {
    console.error("Get category destinations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch destinations",
      details: error.message,
    });
  }
});

// Get all available categories
router.get("/meta/categories", async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database connection not ready",
      });
    }
    const destinationsCollection = db.collection("destinations");

    const categories = await destinationsCollection.distinct("category");

    res.json({
      success: true,
      categories: categories.sort(),
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
      details: error.message,
    });
  }
});

// Search destinations
router.post("/search", async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database connection not ready",
      });
    }
    const destinationsCollection = db.collection("destinations");

    const searchQuery = {
      $or: [
        { name: new RegExp(query, "i") },
        { description: new RegExp(query, "i") },
        { "location.city": new RegExp(query, "i") },
        { category: new RegExp(query, "i") },
      ],
    };

    // Apply additional filters
    if (filters.category) searchQuery.category = filters.category;
    if (filters.minRating) searchQuery.rating = { $gte: filters.minRating };

    const destinations = await destinationsCollection
      .find(searchQuery)
      .sort({ rating: -1 })
      .limit(20)
      .toArray();

    res.json({
      success: true,
      query,
      count: destinations.length,
      destinations,
    });
  } catch (error) {
    console.error("Search destinations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search destinations",
      details: error.message,
    });
  }
});

router.post("/ingest", async (req, res) => {
  try {
    const { query, type = "destination", force = false } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        success: false,
        error: "A destination search query is required",
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database connection not ready",
      });
    }

    const destinationsCollection = db.collection("destinations");
    const slug = createSlug(query);
    const normalizedQuery = query.trim().toLowerCase();
    const strictMatchRegex = new RegExp(`^${escapeRegExp(query.trim())}$`, "i");

    const existingDestination = await destinationsCollection.findOne({
      $or: [
        { slug },
        { normalizedQuery },
        { query: strictMatchRegex },
        { name: strictMatchRegex },
        { "location.name": strictMatchRegex },
        { "location.formatted": strictMatchRegex },
      ],
    });

    if (existingDestination && !force) {
      return res.json({
        success: true,
        status: "cached",
        destination: existingDestination,
        meta: {
          heroImageSource: existingDestination.heroImageSource || "cache",
          touristCount: existingDestination.nearbyAttractions?.length || 0,
          hotelCount: existingDestination.hotels?.length || 0,
          restaurantCount: existingDestination.restaurants?.length || 0,
        },
      });
    }

    let baseRecord;
    try {
      baseRecord = await geocode(query, { country: "in" });
    } catch (error) {
      console.error("Geoapify geocode failed:", error.message || error);
      const status = error.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: error.message || "Failed to fetch destination from Geoapify",
      });
    }

    if (!baseRecord) {
      return res.status(404).json({
        success: false,
        error: "Geoapify could not locate that destination in India",
      });
    }

    const location = toLocationObject(baseRecord);
    const baseName = location.name || query.trim();
    const categoryLabel =
      type === "pincode"
        ? "City"
        : baseRecord.result?.kind?.replace(/_/g, " ")?.replace(/\b\w/g, (m) => m.toUpperCase()) ||
          "Destination";
    const tags = buildTags(baseRecord, query);
    const normalizedCategory = typeof categoryLabel === "string" ? categoryLabel.toLowerCase() : "";
    const tagsLower = new Set(
      (Array.isArray(tags) ? tags : [])
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.toLowerCase())
    );

    const hasTag = (...values) => values.some((value) => tagsLower.has(value));

    const heroContextKeywords = new Set(["cinematic view", "dramatic lighting", "iconic landmark"]);

    const isCity =
      normalizedCategory.includes("city") || hasTag("city", "urban", "metropolitan", "metro");
    const isHeritage = hasTag(
      "heritage",
      "fort",
      "temple",
      "palace",
      "monument",
      "historical",
      "museum"
    );
    const isNature =
      normalizedCategory.includes("national park") ||
      hasTag(
        "hill",
        "hills",
        "hill station",
        "mountain",
        "mountains",
        "forest",
        "valley",
        "waterfall",
        "sanctuary",
        "wildlife"
      );
    const isBeach = hasTag("beach", "coast", "coastal", "island", "seaside");
    const isWaterfront = hasTag("river", "riverfront", "lake", "backwater", "waterfront");

    if (isCity) {
      ["city skyline", "cityscape", "urban aerial", "night lights", "panoramic view"].forEach(
        (keyword) => heroContextKeywords.add(keyword)
      );
    }

    if (isHeritage) {
      [
        "heritage architecture",
        "historic fort",
        "temple complex",
        "palace",
        "iconic monument",
      ].forEach((keyword) => heroContextKeywords.add(keyword));
    }

    if (isNature) {
      ["scenic landscape", "mountain range", "valley vista", "sunrise view", "misty hills"].forEach(
        (keyword) => heroContextKeywords.add(keyword)
      );
    }

    if (isBeach) {
      ["sunset beach", "coastal aerial", "tropical shore", "blue hour"].forEach((keyword) =>
        heroContextKeywords.add(keyword)
      );
    }

    if (isWaterfront) {
      ["waterfront reflection", "riverfront skyline", "lakeside view"].forEach((keyword) =>
        heroContextKeywords.add(keyword)
      );
    }

    const heroContextKeywordList = Array.from(heroContextKeywords);

    const heroQueryPrimaryParts = [
      location.name,
      location.city,
      location.state,
      location.country || "India",
      isCity ? "city skyline" : null,
      isHeritage ? "heritage monument" : null,
      isNature ? "scenic landscape" : null,
      isBeach ? "sunset beach" : null,
      isWaterfront ? "riverfront" : null,
      "India cinematic",
    ].filter(Boolean);

    const heroQueryPrimary = Array.from(
      new Set(
        heroQueryPrimaryParts
          .filter((value) => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    ).join(" ");

    const heroHintInput = {
      slug,
      name: baseName,
      query,
      normalizedQuery,
      category: categoryLabel,
      location,
      tags,
      aliases: [baseRecord.result?.name, baseRecord.name, baseRecord.address_line1].filter(Boolean),
    };
    const heroHints = getHeroImageHints(heroHintInput);

    const heroQueryVariants = Array.from(
      new Set(
        [
          heroQueryPrimary,
          location.formatted,
          [location.name, location.state, "India landmark"].filter(Boolean).join(" "),
          [location.name, location.state, "tourist attraction"].filter(Boolean).join(" "),
          [location.city, location.state, "travel guide"].filter(Boolean).join(" "),
          [location.name, "Karnataka", "heritage"].filter(Boolean).join(" "),
          [location.city, location.country, "tourism"].filter(Boolean).join(" "),
          [location.name, "national park"].filter(Boolean).join(" "),
          isCity
            ? [location.name, location.state, "city skyline India"].filter(Boolean).join(" ")
            : null,
          isCity
            ? [location.name, location.state, "aerial night lights"].filter(Boolean).join(" ")
            : null,
          isHeritage
            ? [location.name, location.state, "historic monument India"].filter(Boolean).join(" ")
            : null,
          isNature
            ? [location.name, location.state, "scenic landscape India"].filter(Boolean).join(" ")
            : null,
          isBeach
            ? [location.name, location.state, "sunset beach India"].filter(Boolean).join(" ")
            : null,
          isWaterfront
            ? [location.name, location.state, "riverfront skyline India"].filter(Boolean).join(" ")
            : null,
          ...heroContextKeywordList.map((keyword) =>
            [location.name, keyword].filter(Boolean).join(" ")
          ),
          query,
          ...(Array.isArray(heroHints.queryVariants) ? heroHints.queryVariants : []),
        ].filter(Boolean)
      )
    ).filter(Boolean);

    const existingHeroDocs = await destinationsCollection
      .find({ slug: { $ne: slug }, heroImage: { $exists: true, $ne: null } })
      .project({ heroImage: 1 })
      .toArray();
    const excludeHeroUrls = existingHeroDocs.map((doc) => doc.heroImage).filter(Boolean);
    if (existingDestination?.heroImage) {
      excludeHeroUrls.push(existingDestination.heroImage);
    }

    let heroImage;
    try {
      heroImage = await getHeroImage(heroQueryVariants[0] || query, {
        queryVariants: heroQueryVariants,
        apiOptions: { perPage: 15, orientation: "landscape" },
        bannedKeywords: Array.from(
          new Set([
            ...DEFAULT_NEGATIVE_KEYWORDS,
            ...(Array.isArray(heroHints.bannedKeywords) ? heroHints.bannedKeywords : []),
          ])
        ),
        providers: ["unsplash", "pexels"],
        excludeUrls: excludeHeroUrls,
      });
    } catch (imageError) {
      console.error("Hero image fetch failed:", imageError.message || imageError);
      heroImage = { url: null, source: "error", attribution: "" };
    }

    const coords = location.coordinates;
    const touristPlaces = await fetchPlaceCollection(coords, PLACE_CATEGORY_MAP.attractions, {
      radius: 25000,
      limit: 12,
    });
    const hotels = await fetchPlaceCollection(coords, PLACE_CATEGORY_MAP.hotels, {
      radius: 20000,
      limit: 12,
    });
    const restaurants = await fetchPlaceCollection(coords, PLACE_CATEGORY_MAP.restaurants, {
      radius: 12000,
      limit: 12,
    });

    const rankSource =
      baseRecord.rank ||
      baseRecord.result?.rank ||
      baseRecord.datasource?.raw?.rank ||
      baseRecord.datasource?.rank ||
      {};

    const collectNumeric = (...values) =>
      values
        .flat()
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

    const rankCandidates = collectNumeric(
      rankSource.confidence,
      rankSource.importance,
      rankSource.popularity,
      baseRecord.importance,
      baseRecord.confidence,
      baseRecord.popularity
    );

    const attractionRankCandidates = touristPlaces
      .map((place) => place?.rating)
      .filter((value) => Number.isFinite(value));

    const normalizeRankValue = (value) => {
      if (!Number.isFinite(value)) return null;
      const scaled = value <= 1 ? value * 5 : value;
      return Math.max(0.5, Math.min(scaled, 5));
    };

    const normalizedRankScores = rankCandidates
      .map((value) => normalizeRankValue(value))
      .filter((value) => value != null);

    const normalizedAttractionScores = attractionRankCandidates
      .map((value) => normalizeRankValue(value))
      .filter((value) => value != null);

    let derivedRating = null;
    if (normalizedRankScores.length > 0) {
      const average =
        normalizedRankScores.reduce((total, value) => total + value, 0) /
        normalizedRankScores.length;
      derivedRating = Number(Math.min(5, Math.max(3.8, average)).toFixed(1));
    } else if (normalizedAttractionScores.length > 0) {
      const average =
        normalizedAttractionScores.reduce((total, value) => total + value, 0) /
        normalizedAttractionScores.length;
      derivedRating = Number(Math.min(4.7, Math.max(3.9, average)).toFixed(1));
    } else if (touristPlaces.length > 0) {
      derivedRating = Number(Math.min(4.6, 3.9 + touristPlaces.length * 0.08).toFixed(1));
    }

    if (!derivedRating) {
      const existingRating = Number(existingDestination?.rating);
      if (Number.isFinite(existingRating)) {
        derivedRating = Number(existingDestination.rating);
      } else {
        derivedRating = 4.2;
      }
    }

    const estimatedReviewCount = (() => {
      if (Number.isFinite(rankSource.popularity)) {
        return Math.max(180, Math.round(rankSource.popularity * 20000));
      }
      if (Number.isFinite(rankSource.importance)) {
        return Math.max(160, Math.round(rankSource.importance * 15000));
      }
      if (touristPlaces.length > 0) {
        return Math.max(140, touristPlaces.length * 1200);
      }
      if (Number.isFinite(existingDestination?.userRatingsTotal)) {
        return existingDestination.userRatingsTotal;
      }
      if (Number.isFinite(existingDestination?.reviews)) {
        return existingDestination.reviews;
      }
      return 120;
    })();

    const timestamp = new Date();
    const mapImage = coords ? buildStaticMapUrl(coords, { zoom: 12, size: "900x600" }) : null;
    let weatherData = null;
    let weatherRaw = null;

    if (coords) {
      try {
        const { weather: currentWeather, raw: rawWeather } = await fetchCurrentWeather({
          lat: coords.lat,
          lng: coords.lng,
        });
        weatherData = {
          ...currentWeather,
          fetchedAt: timestamp,
        };
        weatherRaw = rawWeather;
      } catch (weatherError) {
        console.warn("OpenWeather fetch failed:", weatherError.message || weatherError);
      }
    }

    const summary = buildSummary(baseRecord, touristPlaces);

    const updatePayload = {
      name: baseName,
      slug,
      query,
      normalizedQuery,
      category: categoryLabel,
      headline: `Explore ${baseName}`,
      description: summary,
      location,
      heroImage: heroImage?.url || heroImage?.meta?.url || null,
      heroImageAttribution: heroImage?.attribution || "",
      mapImage,
      nearbyAttractions: touristPlaces,
      hotels,
      restaurants,
      rating: derivedRating,
      userRatingsTotal: estimatedReviewCount,
      user_ratings_total: estimatedReviewCount,
      reviews: estimatedReviewCount,
      weather: weatherData,
      weatherRaw,
      tags,
      source: {
        provider: "geoapify",
        query,
        fetchedAt: timestamp,
        heroImageSource: heroImage?.source || "fallback",
      },
      geoapify: {
        placeId: baseRecord.place_id,
        datasource: baseRecord.datasource,
        timezone: baseRecord.timezone,
        raw: baseRecord,
      },
      updatedAt: timestamp,
    };

    const result = await destinationsCollection.findOneAndUpdate(
      { slug },
      {
        $set: updatePayload,
        $setOnInsert: {
          createdAt: timestamp,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    let destination = result.value;
    if (!destination) {
      const upsertedId = result.lastErrorObject?.upserted;
      if (upsertedId) {
        destination = await destinationsCollection.findOne({ _id: upsertedId });
      }
    }
    if (!destination) {
      // Some driver versions ignore returnDocument, so read directly as a fallback.
      destination = await destinationsCollection.findOne({ slug });
    }
    const inserted = Boolean(result.lastErrorObject?.upserted);

    res.json({
      success: true,
      status: inserted ? "created" : "updated",
      destination,
      meta: {
        heroImageSource: heroImage?.source || "fallback",
        touristCount: touristPlaces.length,
        hotelCount: hotels.length,
        restaurantCount: restaurants.length,
      },
    });
  } catch (error) {
    console.error("Destination ingest error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to ingest destination",
      details: error.message,
    });
  }
});

module.exports = router;
