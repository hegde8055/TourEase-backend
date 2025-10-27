// /server/routes/admin.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");

const createSlug = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : item))
      .filter((item) =>
        typeof item === "string" ? item.length > 0 : item !== undefined && item !== null
      );
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\r?\n|,/) // support newline or comma separated
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const sanitizeHeroImage = (heroImage) => {
  if (!heroImage) return null;
  if (typeof heroImage === "string") {
    const trimmed = heroImage.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof heroImage === "object") {
    const candidate = heroImage.url || heroImage.src || heroImage.path;
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }
  return null;
};

const sanitizeLocation = (location = {}, fallbackName = "") => {
  if (!location || typeof location !== "object") return undefined;
  const normalized = { ...location };

  if (normalized.city && typeof normalized.city === "string") {
    normalized.city = normalized.city.trim();
  }
  if (normalized.state && typeof normalized.state === "string") {
    normalized.state = normalized.state.trim();
  }
  if (normalized.country && typeof normalized.country === "string") {
    normalized.country = normalized.country.trim();
  }
  if (!normalized.country) {
    normalized.country = "India";
  }

  if (normalized.formatted && typeof normalized.formatted === "string") {
    normalized.formatted = normalized.formatted.trim();
  } else {
    const parts = [
      normalized.name,
      normalized.city,
      normalized.state,
      normalized.country,
      fallbackName,
    ]
      .filter(Boolean)
      .map((part) => part.toString().trim());
    if (parts.length > 0) {
      normalized.formatted = Array.from(new Set(parts)).join(", ");
    }
  }

  if (normalized.coordinates && typeof normalized.coordinates === "object") {
    const lat = parseNumber(normalized.coordinates.lat);
    const lng = parseNumber(normalized.coordinates.lng);
    if (lat !== undefined && lng !== undefined) {
      normalized.coordinates = { lat, lng };
    } else {
      delete normalized.coordinates;
    }
  }

  return normalized;
};

const prepareDestinationPayload = (payload = {}, { isUpdate = false } = {}) => {
  const now = new Date();
  const name = (payload.name || "").toString().trim();

  if (!isUpdate && !name) {
    const error = new Error("Destination name is required");
    error.statusCode = 400;
    throw error;
  }

  const query = (payload.query || name).toString().trim();
  const slugSource = payload.slug || query || name;
  const slug = slugSource ? createSlug(slugSource) : undefined;
  const normalizedQuery = query ? query.toLowerCase() : undefined;

  const heroImage = sanitizeHeroImage(payload.heroImage);

  const destination = {
    name,
    category: (payload.category || "Destination").toString().trim(),
    headline: (payload.headline || (name ? `Explore ${name}` : "Explore destination"))
      .toString()
      .trim(),
    description: (payload.description || "").toString().trim(),
    summary: (payload.summary || "").toString().trim() || undefined,
    query: query || undefined,
    normalizedQuery,
    slug,
    location: sanitizeLocation(payload.location, name),
    heroImage,
    heroImageAttribution: (payload.heroImageAttribution || "").toString().trim(),
    heroImageSource: (payload.heroImageSource || "manual").toString().trim(),
    entryFee: payload.entryFee ?? "",
    timings: payload.timings ?? "",
    bestTimeToVisit: payload.bestTimeToVisit ?? "",
    rating: parseNumber(payload.rating),
    reviews: parseNumber(payload.reviews),
    visitors: parseNumber(payload.visitors),
    highlights: ensureArray(payload.highlights),
    activities: ensureArray(payload.activities),
    nearbyAttractions: ensureArray(payload.nearbyAttractions),
    travelTips: ensureArray(payload.travelTips),
    tags: ensureArray(payload.tags),
    contactNumber: (payload.contactNumber || "").toString().trim(),
    website: (payload.website || "").toString().trim(),
    mapImage: payload.mapImage || undefined,
    heroImageAlt: (payload.heroImageAlt || "").toString().trim() || undefined,
    trending: Boolean(payload.trending),
    trendingRank: parseNumber(payload.trendingRank),
    updatedAt: now,
  };

  if (!isUpdate) {
    destination.createdAt = now;
  }

  if (!destination.location) {
    delete destination.location;
  }
  if (!destination.heroImage) {
    destination.heroImage = null;
  }
  if (!destination.summary) {
    delete destination.summary;
  }
  if (!destination.heroImageAlt) {
    delete destination.heroImageAlt;
  }
  if (destination.trendingRank === undefined) {
    delete destination.trendingRank;
  }
  if (!destination.query) {
    delete destination.query;
  }
  if (!destination.slug) {
    delete destination.slug;
  }
  if (!destination.normalizedQuery) {
    delete destination.normalizedQuery;
  }

  return destination;
};

const buildTrendingSnapshot = (destinationDoc) => {
  if (!destinationDoc) return null;
  const timestamp = destinationDoc.updatedAt || new Date();
  return {
    name: destinationDoc.name,
    slug: destinationDoc.slug,
    category: destinationDoc.category,
    headline: destinationDoc.headline,
    description: destinationDoc.description,
    state: destinationDoc.location?.state || "",
    country: destinationDoc.location?.country || "India",
    location: destinationDoc.location || null,
    image: destinationDoc.heroImage,
    gallery: destinationDoc.gallery || [],
    rating: destinationDoc.rating ?? 4.6,
    visitors: destinationDoc.visitors ?? null,
    bestTimeToVisit: destinationDoc.bestTimeToVisit || "",
    highlights: destinationDoc.highlights || [],
    travelTips: destinationDoc.travelTips || [],
    tags: destinationDoc.tags || [],
    trending: true,
    trendingRank: destinationDoc.trendingRank ?? 1,
    source: destinationDoc.source || {
      provider: "admin",
      curatedBy: "admin-panel",
      curatedAt: timestamp,
    },
    createdAt: destinationDoc.createdAt || timestamp,
    updatedAt: timestamp,
  };
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const { ObjectId } = require("mongodb");
    const db = req.app.locals.db;
    const users = db.collection("users");

    const user = await users.findOne({ _id: new ObjectId(req.user.userId) });

    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to verify admin status",
    });
  }
};

// Get all destinations (admin view with more details)
router.get("/destinations", authenticateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const destinationsCollection = db.collection("destinations");

    const destinations = await destinationsCollection.find({}).sort({ createdAt: -1 }).toArray();

    res.json({
      success: true,
      count: destinations.length,
      destinations,
    });
  } catch (error) {
    console.error("Admin get destinations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch destinations",
    });
  }
});

// Create new destination
router.post("/destinations", authenticateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const destinationsCollection = db.collection("destinations");
    const trendingCollection = db.collection("trending_destinations");

    let destinationPayload;

    try {
      destinationPayload = prepareDestinationPayload(req.body || {});
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({
        success: false,
        error: error.message || "Invalid destination payload",
      });
    }

    if (destinationPayload.slug) {
      const duplicate = await destinationsCollection.findOne({ slug: destinationPayload.slug });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: "A destination with the same slug already exists. Please adjust the name or slug.",
        });
      }
    }

    const result = await destinationsCollection.insertOne(destinationPayload);
    const inserted = await destinationsCollection.findOne({ _id: result.insertedId });

    if (inserted?.trending) {
      const snapshot = buildTrendingSnapshot(inserted);
      if (snapshot && snapshot.slug) {
        await trendingCollection.updateOne(
          { slug: snapshot.slug },
          { $set: snapshot },
          { upsert: true }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: "Destination created successfully",
      destinationId: result.insertedId,
      destination: inserted,
    });
  } catch (error) {
    console.error("Admin create destination error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create destination",
      details: error.message,
    });
  }
});

// Update destination
router.put("/destinations/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const db = req.app.locals.db;
    const destinationsCollection = db.collection("destinations");
    const trendingCollection = db.collection("trending_destinations");
    const destinationId = new ObjectId(req.params.id);

    const existingDestination = await destinationsCollection.findOne({ _id: destinationId });

    if (!existingDestination) {
      return res.status(404).json({
        success: false,
        error: "Destination not found",
      });
    }

    let updatePayload;
    try {
      const mergedPayload = { ...existingDestination, ...req.body };
      updatePayload = prepareDestinationPayload(mergedPayload, { isUpdate: true });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({
        success: false,
        error: error.message || "Invalid destination payload",
      });
    }

    delete updatePayload._id;
    if (existingDestination.createdAt) {
      updatePayload.createdAt = existingDestination.createdAt;
    }

    if (updatePayload.slug && updatePayload.slug !== existingDestination.slug) {
      const duplicate = await destinationsCollection.findOne({
        slug: updatePayload.slug,
        _id: { $ne: destinationId },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error:
            "A destination with the same slug already exists. Please choose another name or slug.",
        });
      }
    }

    const result = await destinationsCollection.updateOne(
      { _id: destinationId },
      { $set: updatePayload }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Destination not found",
      });
    }

    const updatedDestination = await destinationsCollection.findOne({ _id: destinationId });

    if (updatedDestination?.trending && updatedDestination.slug) {
      const snapshot = buildTrendingSnapshot(updatedDestination);
      if (snapshot) {
        await trendingCollection.updateOne(
          { slug: snapshot.slug },
          { $set: snapshot },
          { upsert: true }
        );
      }
    } else if (existingDestination?.slug) {
      await trendingCollection.deleteOne({ slug: existingDestination.slug });
    }

    res.json({
      success: true,
      message: "Destination updated successfully",
      destination: updatedDestination,
    });
  } catch (error) {
    console.error("Admin update destination error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update destination",
      details: error.message,
    });
  }
});

// Delete destination
router.delete("/destinations/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const db = req.app.locals.db;
    const destinationsCollection = db.collection("destinations");
    const trendingCollection = db.collection("trending_destinations");

    const destinationId = new ObjectId(req.params.id);
    const existingDestination = await destinationsCollection.findOne({ _id: destinationId });

    const result = await destinationsCollection.deleteOne({
      _id: destinationId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Destination not found",
      });
    }

    if (existingDestination?.slug) {
      await trendingCollection.deleteOne({ slug: existingDestination.slug });
    }

    res.json({
      success: true,
      message: "Destination deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete destination error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete destination",
      details: error.message,
    });
  }
});

// Get all users
router.get("/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const users = db.collection("users");

    const allUsers = await users
      .find({})
      .project({ password: 0 }) // Don't send passwords
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: allUsers.length,
      users: allUsers,
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
    });
  }
});

// Toggle user admin status
router.patch("/users/:id/toggle-admin", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const db = req.app.locals.db;
    const users = db.collection("users");

    const user = await users.findOne({ _id: new ObjectId(req.params.id) });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    await users.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isAdmin: !user.isAdmin } }
    );

    res.json({
      success: true,
      message: `User ${user.isAdmin ? "removed from" : "granted"} admin privileges`,
    });
  } catch (error) {
    console.error("Admin toggle admin status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update user",
    });
  }
});

// Get dashboard statistics
router.get("/stats", authenticateToken, isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;

    const destinations = db.collection("destinations");
    const users = db.collection("users");
    const itineraries = db.collection("itineraries");
    const trending = db.collection("trending_destinations");

    const [
      destinationCount,
      userCount,
      itineraryCount,
      trendingCount,
      recentDestinations,
      recentUsers,
    ] = await Promise.all([
      destinations.countDocuments(),
      users.countDocuments(),
      itineraries.countDocuments(),
      trending.countDocuments(),
      destinations.find({}).sort({ createdAt: -1 }).limit(5).toArray(),
      users.find({}).sort({ createdAt: -1 }).limit(5).project({ password: 0 }).toArray(),
    ]);

    res.json({
      success: true,
      stats: {
        destinations: destinationCount,
        users: userCount,
        itineraries: itineraryCount,
        trending: trendingCount,
      },
      recent: {
        destinations: recentDestinations,
        users: recentUsers,
      },
    });
  } catch (error) {
    console.error("Admin get stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
    });
  }
});

module.exports = router;
