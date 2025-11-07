// /server/routes/trending.js
const express = require("express");
const router = express.Router();

const normalizeState = (destination = {}) =>
  destination.state ||
  destination.location?.state ||
  destination.location?.region ||
  destination.location?.country ||
  destination.country ||
  "";

const normalizeRank = (destination = {}) =>
  destination.trendingRank ?? destination.ranking2025 ?? destination.rank ?? null;

// Get all trending destinations
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const destinationsCollection = db.collection("destinations");
    const legacyCollection = db.collection("trending_destinations");

    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(limitParam) ? 10 : Math.min(Math.max(limitParam, 1), 50);

    const primaryResults = await destinationsCollection
      .find({
        $or: [{ trending: { $in: [true, "true", 1] } }, { ranking2025: { $exists: true } }],
      })
      .sort({
        trendingRank: 1,
        ranking2025: 1,
        rating: -1,
        updatedAt: -1,
        name: 1,
      })
      .limit(limit)
      .toArray();

    let destinations = primaryResults.map((destination) => {
      const normalizedId = destination._id?.toString?.() || destination._id;
      return {
        ...destination,
        _id: normalizedId,
        trendingRank: normalizeRank(destination),
        state: normalizeState(destination),
        sourceCollection: "destinations",
      };
    });

    if (destinations.length === 0) {
      const legacyResults = await legacyCollection
        .find({ trending: true })
        .sort({ trendingRank: 1 })
        .limit(limit)
        .toArray();

      destinations = legacyResults.map((destination) => {
        const linkedId =
          destination.destinationId?.toString?.() || destination.destinationId || null;
        return {
          ...destination,
          _id: linkedId,
          legacyId: destination._id?.toString?.() || destination._id,
          trendingRank: normalizeRank(destination),
          state: normalizeState(destination),
          sourceCollection: "trending_destinations",
        };
      });
    }

    res.json({
      success: true,
      count: destinations.length,
      destinations,
    });
  } catch (error) {
    console.error("Get trending destinations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch trending destinations",
      details: error.message,
    });
  }
});

// Get single trending destination by ID
// Get single trending destination by ID (search both collections)
router.get("/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const db = req.app.locals.db;

    const destinationsCollection = db.collection("destinations");
    const trendingCollection = db.collection("trending_destinations");

    const id = req.params.id;

    let destination = null;

    // Try to find it in the main destinations collection first
    try {
      destination = await destinationsCollection.findOne({
        _id: new ObjectId(id),
      });
    } catch {
      // fallback if id is not a valid ObjectId (e.g., legacy string)
      destination = await destinationsCollection.findOne({ _id: id });
    }

    // Fallback to legacy trending collection if not found
    if (!destination) {
      try {
        destination = await trendingCollection.findOne({
          $or: [{ _id: new ObjectId(id) }, { destinationId: id }],
        });
      } catch {
        destination = await trendingCollection.findOne({
          $or: [{ _id: id }, { destinationId: id }],
        });
      }
    }

    if (!destination) {
      return res.status(404).json({
        success: false,
        error: "Destination not found",
      });
    }

    // Normalize fields (for frontend compatibility)
    const normalizedDestination = {
      _id: destination._id?.toString?.() || destination._id,
      name: destination.name || "Unknown destination",
      description: destination.description || destination.details || "",
      photo: destination.photo || destination.image || destination.imageUrl || null,
      rating: destination.rating || destination.averageRating || null,
      formatted_address:
        destination.formatted_address ||
        destination.address ||
        destination.location?.address ||
        "Address unavailable",
      location: destination.location || {
        coordinates: destination.coordinates || null,
      },
      state: destination.state || destination.location?.state || null,
      trendingRank: destination.trendingRank ?? destination.rank ?? null,
      category: destination.category || destination.type || null,
    };

    res.json({
      success: true,
      destination: normalizedDestination,
    });
  } catch (error) {
    console.error("Get single trending destination error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch trending destination",
      details: error.message,
    });
  }
});

module.exports = router;
