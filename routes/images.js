// /server/routes/images.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { createApi } = require("unsplash-js");
const sharp = require("sharp");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// --- Auth middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
};

// --- Unsplash client ---
const unsplash = UNSPLASH_ACCESS_KEY ? createApi({ accessKey: UNSPLASH_ACCESS_KEY }) : null;

// --- Get optimized image for a destination ---
router.get("/destination", authenticateToken, async (req, res) => {
  if (!unsplash) {
    console.warn("UNSPLASH_ACCESS_KEY is not configured. Skipping image fetch.");
    return res.json({ imageUrl: null });
  }

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "A destination query is required." });

  try {
    const result = await unsplash.search.getPhotos({
      query: `${query} India landscape`,
      page: 1,
      perPage: 1,
      orientation: "landscape",
    });

    if (result.errors) {
      console.error("Unsplash API Error:", result.errors[0]);
      return res.status(500).json({ error: "Failed to fetch image from provider." });
    }

    const photo = result.response?.results[0];
    if (!photo) return res.json({ imageUrl: null });

    // Download and optimize
    const response = await fetch(photo.urls.raw);
    const buffer = Buffer.from(await response.arrayBuffer());
    const optimized = await sharp(buffer).resize(1280).jpeg({ quality: 75 }).toBuffer();

    const base64 = optimized.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    res.json({
      originalUrl: photo.urls.full,
      optimizedUrl: dataUrl,
      photographer: photo.user.name,
      description: photo.alt_description,
    });
  } catch (error) {
    console.error("Server error fetching destination image:", error);
    res.status(500).json({ error: "Internal server error fetching image." });
  }
});

module.exports = router;
