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
router.get("/:id", async (req, res) => {
  try {
    const { ObjectId } = require("mongodb");
    const db = req.app.locals.db;
    const trendingCollection = db.collection("trending_destinations");

    const destination = await trendingCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!destination) {
      return res.status(404).json({
        success: false,
        error: "Trending destination not found",
      });
    }

    res.json({
      success: true,
      destination,
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
