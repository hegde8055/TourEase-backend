const express = require("express");
const router = express.Router();
const NodeCache = require("node-cache");
const { fetchUnsplashImage } = require("../utils/unsplash");

// Initialize cache:
// stdTTL (Standard Time-To-Live): 86400 seconds = 1 day
// checkperiod: 3600 seconds = 1 hour (how often to check for expired keys)
const imageCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

/**
 * @route   GET /api/images/destination/:name
 * @desc    Get a hero image for a destination, using cache
 * @access  Public (or add auth middleware if you prefer)
 */
router.get("/destination/:name", async (req, res) => {
  try {
    const destinationName = req.params.name;
    if (!destinationName) {
      return res.status(400).json({ error: "Destination name is required." });
    }

    // Use a consistent cache key
    const cacheKey = `hero_image_${destinationName.toLowerCase().trim()}`;

    // 1. Check the cache
    const cachedImageUrl = imageCache.get(cacheKey);

    if (cachedImageUrl) {
      // 2. Cache HIT: Return the cached URL immediately
      console.log(`[Cache HIT] for destination: ${destinationName}`);
      return res.json({ imageUrl: cachedImageUrl });
    }

    // 3. Cache MISS: Fetch the image from the external API
    console.log(`[Cache MISS] for destination: ${destinationName}`);
    const newImageUrl = await fetchUnsplashImage(destinationName);

    // 4. Store the new URL in the cache for next time
    imageCache.set(cacheKey, newImageUrl);

    // 5. Return the new URL
    return res.json({ imageUrl: newImageUrl });
  } catch (error) {
    console.error("Error in image route:", error);
    res.status(500).json({ error: "Server error fetching image." });
  }
});

module.exports = router;
