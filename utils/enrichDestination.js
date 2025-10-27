const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const {
  getHeroImage,
  pickAssetFallback,
  DEFAULT_NEGATIVE_KEYWORDS,
  DEFAULT_POSITIVE_KEYWORDS,
} = require("./unsplash");
const {
  buildStaticMapUrl,
  fetchPlaceDetails,
  fetchPlaces,
  transformPlaceFeature,
} = require("./geoapify"); // NEW: Import new functions
const { fetchCurrentWeather } = require("./weather");
const { getHeroImageHints } = require("./heroImageHints");

const deriveImageQuery = (destination = {}) => {
  const parts = [
    destination.name,
    destination.headline,
    destination.city,
    destination.state,
    destination.country,
    destination.location?.name,
    destination.location?.city,
    destination.location?.state,
    destination.location?.country,
    destination.location?.region,
    "India cinematic landmark",
  ]
    .filter(Boolean)
    .map((value) => String(value).trim());

  return parts.length ? Array.from(new Set(parts)).join(" ") : "Incredible India travel";
};

const extractCoordinates = (destination = {}) => {
  const location = destination.location || {};
  const coordinates = location.coordinates || destination.coordinates || {};

  const lat =
    location.lat ??
    location.latitude ??
    coordinates.lat ??
    coordinates.latitude ??
    destination.lat ??
    destination.latitude ??
    null;

  const lng =
    location.lng ??
    location.lon ??
    location.longitude ??
    coordinates.lng ??
    coordinates.lon ??
    coordinates.longitude ??
    destination.lng ??
    destination.lon ??
    destination.longitude ??
    null;

  if (lat == null || lng == null) return null;

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const numericLat = toNumber(lat);
  const numericLng = toNumber(lng);

  if (numericLat == null || numericLng == null) return null;

  return { lat: numericLat, lng: numericLng };
};

const ensureHeroImage = async (destination, { timestamp }) => {
  const existingUrl = destination.heroImage || destination.image || "";
  const query = deriveImageQuery(destination);
  const localizedName = destination.location?.name || destination.name || "";
  const cityName = destination.location?.city || destination.city || "";
  const stateName = destination.location?.state || destination.state || "";
  const countryName = destination.location?.country || destination.country || "India";

  const heroHints = getHeroImageHints(destination);

  const normalizedCategory =
    typeof destination.category === "string" ? destination.category.toLowerCase() : "";
  const tagsLower = new Set(
    (Array.isArray(destination.tags) ? destination.tags : [])
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

  const hintedVariants = Array.isArray(heroHints.queryVariants) ? heroHints.queryVariants : [];

  const queryVariants = Array.from(
    new Set(
      [
        query,
        destination.location?.formatted,
        [localizedName, stateName, "India landmark"].filter(Boolean).join(" "),
        [localizedName, stateName, "tourist attraction"].filter(Boolean).join(" "),
        [cityName, stateName, "travel guide"].filter(Boolean).join(" "),
        [localizedName, countryName, "heritage"].filter(Boolean).join(" "),
        [localizedName, "waterfall"].filter(Boolean).join(" "),
        [localizedName, "temple"].filter(Boolean).join(" "),
        isCity ? [localizedName, stateName, "city skyline India"].filter(Boolean).join(" ") : null,
        isHeritage
          ? [localizedName, stateName, "historic monument India"].filter(Boolean).join(" ")
          : null,
        isNature
          ? [localizedName, stateName, "scenic landscape India"].filter(Boolean).join(" ")
          : null,
        isBeach ? [localizedName, stateName, "sunset beach India"].filter(Boolean).join(" ") : null,
        isWaterfront
          ? [localizedName, stateName, "riverfront skyline India"].filter(Boolean).join(" ")
          : null,
        ...heroContextKeywordList.map((keyword) =>
          [localizedName || cityName, keyword].filter(Boolean).join(" ")
        ),
        ...hintedVariants,
      ].filter(Boolean)
    )
  );

  const preferredKeywords = Array.from(
    new Set([
      ...DEFAULT_POSITIVE_KEYWORDS,
      ...(Array.isArray(heroHints.preferredKeywords) ? heroHints.preferredKeywords : []),
      ...heroContextKeywordList,
    ])
  );

  const bannedKeywords = Array.from(
    new Set([
      ...DEFAULT_NEGATIVE_KEYWORDS,
      ...(Array.isArray(heroHints.bannedKeywords) ? heroHints.bannedKeywords : []),
    ])
  );

  const extraTokens = Array.from(
    new Set(
      [
        localizedName,
        cityName,
        stateName,
        countryName,
        destination.category,
        ...(Array.isArray(destination.tags) ? destination.tags : []),
        ...(Array.isArray(heroHints.extraTokens) ? heroHints.extraTokens : []),
        ...heroContextKeywordList.flatMap((phrase) => phrase.split(/\s+/)),
      ]
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  let heroImageUrl = existingUrl;
  let heroImageSource = destination.heroImageSource || (existingUrl ? "existing" : "");
  let heroImageAttribution = destination.heroImageAttribution || "";
  let heroThumbnail = destination.heroImageThumbnail;
  let heroMeta = destination.heroImageMeta;

  try {
    const heroResult = await getHeroImage(queryVariants[0] || query, {
      queryVariants,
      apiOptions: { perPage: 12, orientation: "landscape" },
      preferredKeywords,
      bannedKeywords,
      minScore: 1,
      extraTokens,
      contextKeywords: heroContextKeywordList,
    });

    if (heroResult?.url) {
      heroImageUrl = heroResult.url;
      heroImageSource = heroResult.source || "web";
      heroImageAttribution = heroResult.attribution || heroImageAttribution;
      heroThumbnail = heroResult.thumbnail || heroThumbnail;
      heroMeta = heroResult.meta || heroMeta;
    }
  } catch (error) {
    console.warn(
      `⚠️  Unsplash hero lookup failed for ${destination.name || query}:`,
      error.message || error
    );
  }

  if (!heroImageUrl) {
    heroImageUrl = pickAssetFallback();
    heroImageSource = "asset";
  }

  if (heroImageUrl) {
    destination.heroImage = heroImageUrl;
    destination.image = heroImageUrl;
    destination.heroImageSource = heroImageSource;
    destination.heroImageUpdatedAt = timestamp;
  }

  if (heroImageAttribution) {
    destination.heroImageAttribution = heroImageAttribution;
  }

  if (heroThumbnail && !destination.heroImageThumbnail) {
    destination.heroImageThumbnail = heroThumbnail;
  }

  if (heroMeta && !destination.heroImageMeta) {
    destination.heroImageMeta = heroMeta;
  }

  if (Array.isArray(destination.gallery)) {
    if (destination.gallery.length === 0) {
      destination.gallery.push(heroImageUrl);
    } else {
      destination.gallery[0] = heroImageUrl;
    }
  } else {
    destination.gallery = heroThumbnail ? [heroImageUrl, heroThumbnail] : [heroImageUrl];
  }

  return destination;
};

const ensureMapImage = (destination) => {
  if (destination.mapImage) return destination;
  const coords = extractCoordinates(destination);
  if (!coords) return destination;

  try {
    destination.mapImage = buildStaticMapUrl(coords, { zoom: 12, size: "900x600" });
    destination.mapImageSource = "geoapify";
  } catch (error) {
    console.warn(
      `⚠️  Geoapify static map failed for ${destination.name || "destination"}:`,
      error.message || error
    );
  }

  return destination;
};

const ensureWeatherSnapshot = async (destination, { timestamp, includeRawWeather }) => {
  const hasWeatherData =
    destination.weather &&
    typeof destination.weather === "object" &&
    destination.weather.temperature != null;

  if (hasWeatherData) return destination;

  const coords = extractCoordinates(destination);
  if (!coords) return destination;

  try {
    const { weather, raw } = await fetchCurrentWeather({ lat: coords.lat, lng: coords.lng });
    if (weather) {
      destination.weather = { ...weather, fetchedAt: timestamp };
      if (includeRawWeather) {
        destination.weatherRaw = raw;
      }
    }
  } catch (error) {
    console.warn(
      `⚠️  OpenWeather lookup failed for ${destination.name || "destination"}:`,
      error.message || error
    );
  }

  return destination;
};

// NEW: Ensure details and rating from place-details API
const ensureDetails = async (destination) => {
  if (destination.rating) return destination; // Skip if already has rating

  if (destination.placeId) {
    try {
      const details = await fetchPlaceDetails(destination.placeId);
      if (details) {
        destination.rating =
          details.datasource?.raw?.rating ||
          details.rank?.popularity ||
          details.rank?.confidence ||
          null;
        destination.details = details; // Add full details for popup (e.g., opening hours, contact)
      }
    } catch (error) {
      console.warn(
        `⚠️  Geoapify details failed for ${destination.name || "destination"}:`,
        error.message || error
      );
    }
  }

  return destination;
};

// NEW: Fetch and enrich nearby places in categories
const ensureNearby = async (destination, settings) => {
  const coords = extractCoordinates(destination);
  if (!coords) return destination;

  try {
    // Categories from Geoapify docs: https://apidocs.geoapify.com/docs/places/#categories
    const touristFeatures = await fetchPlaces({
      lat: coords.lat,
      lng: coords.lng,
      categories: "tourism.attraction,tourism.sights,natural,cultural", // Tourist places
      radius: 10000, // 10km, adjustable
      limit: 5,
    });

    const restaurantFeatures = await fetchPlaces({
      lat: coords.lat,
      lng: coords.lng,
      categories: "catering.restaurant,catering.fast_food,catering", // Diners/restaurants
      radius: 10000,
      limit: 5,
    });

    const accommodationFeatures = await fetchPlaces({
      lat: coords.lat,
      lng: coords.lng,
      categories: "accommodation.hotel,accommodation.guest_house,accommodation.motel,accommodation", // Lodges/boardings
      radius: 10000,
      limit: 5,
    });

    const nearby = {
      tourist: touristFeatures.map(transformPlaceFeature).filter(Boolean),
      restaurants: restaurantFeatures.map(transformPlaceFeature).filter(Boolean),
      accommodations: accommodationFeatures.map(transformPlaceFeature).filter(Boolean),
    };

    // Enrich each nearby place with hero image (mini version, no weather/map for simplicity)
    for (const category in nearby) {
      for (const place of nearby[category]) {
        const miniDest = {
          name: place.name,
          location: {
            name: place.name,
            formatted: place.address,
            city: destination.city,
            state: destination.state,
            country: destination.country,
          },
          coordinates: place.coordinates,
          tags: place.categories,
        };
        await ensureHeroImage(miniDest, settings);
        place.heroImage = miniDest.heroImage;
        place.heroImageSource = miniDest.heroImageSource;
        place.heroImageAttribution = miniDest.heroImageAttribution;

        // Fetch rating/details for each if placeId exists
        if (place.placeId) {
          try {
            const placeDetails = await fetchPlaceDetails(place.placeId);
            if (placeDetails) {
              place.rating =
                placeDetails.datasource?.raw?.rating ||
                placeDetails.rank?.popularity ||
                place.rating;
              place.details = placeDetails;
            }
          } catch (error) {
            console.warn(`⚠️  Details failed for nearby ${place.name}:`, error.message);
          }
        }
      }
    }

    destination.nearby = nearby;
  } catch (error) {
    console.warn(
      `⚠️  Nearby fetch failed for ${destination.name || "destination"}:`,
      error.message || error
    );
  }

  return destination;
};

const enrichDestination = async (destination = {}, options = {}) => {
  if (!destination || typeof destination !== "object") return destination;

  const settings = {
    hero: options.hero !== false,
    map: options.map !== false,
    weather: options.weather !== false,
    // NEW: New options for details/ratings and nearby
    details: options.details !== false,
    nearby: options.nearby !== false,
    includeRawWeather: options.includeRawWeather !== false,
    timestamp: options.timestamp || new Date(),
  };

  if (settings.hero) {
    await ensureHeroImage(destination, settings);
  }

  if (settings.map) {
    ensureMapImage(destination);
  }

  if (settings.weather) {
    await ensureWeatherSnapshot(destination, settings);
  }

  // NEW: Add details/ratings and nearby
  if (settings.details) {
    await ensureDetails(destination);
  }

  if (settings.nearby) {
    await ensureNearby(destination, settings);
  }

  return destination;
};

module.exports = {
  enrichDestination,
  deriveImageQuery,
  extractCoordinates,
};
