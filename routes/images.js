// /server/routes/images.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { createApi } = require("unsplash-js");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Initialize Unsplash API client
const unsplash = UNSPLASH_ACCESS_KEY ? createApi({ accessKey: UNSPLASH_ACCESS_KEY }) : null;

// GET /api/images/destination - Fetch a hero image for a destination
router.get("/destination", authenticateToken, async (req, res) => {
  if (!unsplash) {
    console.warn("UNSPLASH_ACCESS_KEY is not configured. Skipping image fetch.");
    return res.json({ imageUrl: null });
  }

  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "A destination query is required." });
  }

  try {
    const result = await unsplash.search.getPhotos({
      query: `${query} India landscape`, // Add context for better results
      page: 1,
      perPage: 1,
      orientation: "landscape",
    });

    if (result.errors) {
      console.error("Unsplash API Error:", result.errors[0]);
      return res.status(500).json({ error: "Failed to fetch image from provider." });
    }

    const photo = result.response?.results[0];
    if (photo) {
      res.json({ imageUrl: photo.urls.regular });
    } else {
      res.json({ imageUrl: null }); // No image found for the query
    }
  } catch (error) {
    console.error("Server error fetching destination image:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

module.exports = router;
