// /server/routes/itinerary.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Itinerary = require("../models/Itinerary");
const { calculateAdvancedCost } = require("../utils/advancedCostCalculator");
let fetchFn = typeof fetch === "function" ? fetch : null;

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEOAPIFY_KEY =
  process.env.GEOAPIFY_PLACES_API_KEY ||
  process.env.GEOAPIFY_STATIC_MAP_API_KEY ||
  process.env.GEOAPIFY_API_KEY ||
  process.env.GEOAPIFY_MAPS_API_KEY;

const ROUTE_CACHE_TTL_MS = 15 * 60 * 1000;
const routeCache = new Map();

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

// Minimal Groq caller for AI itinerary planning (kept local to avoid new files)
const ensureFetch = async () => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn;
};

const sanitizeJsonText = (text) => {
  if (!text || typeof text !== "string") return text;
  const fence = text.match(/```[\s\S]*?```/);
  if (fence) {
    return fence[0]
      .replace(/^```(json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) return arr[0];
  return text;
};

const removeTrailingCommas = (jsonText) => {
  if (!jsonText || typeof jsonText !== "string") return jsonText;
  return jsonText.replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]");
};

const callGroqPlan = async ({ prompt }) => {
  if (!GROQ_API_KEY) {
    const err = new Error("GROQ_API_KEY not configured");
    err.statusCode = 503;
    throw err;
  }
  const fetch = await ensureFetch();
  const payload = {
    model: GROQ_MODEL,
    temperature: 0.5,
    top_p: 0.9,
    max_tokens: 1400,
    messages: [
      {
        role: "system",
        content:
          "You are TravelEase AI. Return ONLY valid JSON (no prose). Keys: days (array of {day,title,summary,activities:[{time,title,details}]}), tips (array), packing (array), estimatedBasePerPerson (number, INR).",
      },
      { role: "user", content: prompt },
    ],
  };

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const body = await resp.text();
    const err = new Error(`Groq API error ${resp.status}: ${body}`);
    err.statusCode = resp.status;
    throw err;
  }
  const data = await resp.json();
  const text = (data?.choices?.[0]?.message?.content || "").trim();
  return sanitizeJsonText(text);
};

// ==========================================================
// --- THIS IS THE MISSING FUNCTION THAT FIXES THE 404 ERROR ---
// ==========================================================
router.post("/calculate-route", authenticateToken, async (req, res) => {
  const { waypoints, mode = "drive" } = req.body;

  const normalizedWaypoints = Array.isArray(waypoints)
    ? waypoints
        .map((wp) => {
          if (!wp || typeof wp !== "object") return null;
          const lat = Number(wp.lat ?? wp.latitude);
          const lng = Number(wp.lng ?? wp.lon ?? wp.longitude ?? wp.long);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng };
        })
        .filter(Boolean)
    : [];

  if (normalizedWaypoints.length < 2) {
    return res.status(400).json({ error: "Invalid waypoint coordinates" });
  }

  if (!GEOAPIFY_KEY) {
    console.error("GEOAPIFY_KEY is not set for /calculate-route");
    return res.status(503).json({ error: "Routing service is not configured" });
  }

  try {
    const fetch = await ensureFetch();

    const cacheKey = JSON.stringify({
      mode,
      waypoints: normalizedWaypoints.map((wp) => ({
        lat: Number(wp.lat.toFixed(6)),
        lng: Number(wp.lng.toFixed(6)),
      })),
    });

    const now = Date.now();
    const cached = routeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.json(cached.data);
    }

    const geoapifyWaypoints = normalizedWaypoints.map((wp) => `${wp.lat},${wp.lng}`).join("|");

    const normalizeRoutePayload = (payload) => {
      if (!payload || typeof payload !== "object") return payload;
      if ((!payload.features || payload.features.length === 0) && Array.isArray(payload.results)) {
        const fallbackFeatures = payload.results
          .map((result) => {
            const { geometry, ...properties } = result || {};
            if (!geometry || !geometry.type || !geometry.coordinates) return null;
            return {
              type: "Feature",
              geometry,
              properties,
            };
          })
          .filter(Boolean);

        if (fallbackFeatures.length) {
          payload.features = fallbackFeatures;
        }
      }
      return payload;
    };

    const queryVariants = [
      { format: "geojson", details: "instruction_details,route_details" },
      { format: "geojson", details: "route_details" },
      { format: "json", details: "route_details" },
    ];

    let routeData = null;
    let providerError = null;
    let providerPayload = null;

    for (const variant of queryVariants) {
      const variantUrl = new URL("https://api.geoapify.com/v1/routing");
      variantUrl.searchParams.set("apiKey", GEOAPIFY_KEY);
      variantUrl.searchParams.set("mode", mode);
      variantUrl.searchParams.set("waypoints", geoapifyWaypoints);
      if (variant.format) {
        variantUrl.searchParams.set("format", variant.format);
      }
      if (variant.details) {
        variantUrl.searchParams.set("details", variant.details);
      }

      const variantResponse = await fetch(variantUrl.href, { method: "GET" });

      if (!variantResponse.ok) {
        const variantErrorText = await variantResponse.text();
        providerError = `HTTP ${variantResponse.status}: ${variantErrorText}`;
        providerPayload = null;
        console.warn("Geoapify route variant failed", providerError, { variant });
        continue;
      }

      const variantJson = await variantResponse.json();
      providerPayload = variantJson;
      const normalized = normalizeRoutePayload(JSON.parse(JSON.stringify(variantJson)));

      if (normalized?.features && normalized.features.length > 0) {
        routeData = normalized;
        break;
      }

      providerError = normalized?.error || normalized?.message || "No route features";
      console.warn("Geoapify route variant missing features", providerError, {
        variant,
        providerPayload: normalized,
      });
    }

    if (!routeData) {
      const toRadians = (deg) => (deg * Math.PI) / 180;
      const haversineMeters = (a, b) => {
        const R = 6371000; // meters
        const dLat = toRadians(b.lat - a.lat);
        const dLng = toRadians(b.lng - a.lng);
        const lat1 = toRadians(a.lat);
        const lat2 = toRadians(b.lat);
        const sinLat = Math.sin(dLat / 2);
        const sinLng = Math.sin(dLng / 2);
        const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
        return 2 * R * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
      };

      const defaultSpeeds = {
        drive: 16.67, // ≈60 km/h
        "drive+traffic": 13.9,
        walk: 1.4,
        bike: 4.5,
      };

      const speedMetersPerSecond = defaultSpeeds[mode] || defaultSpeeds.drive;

      let totalMeters = 0;
      const lineCoords = normalizedWaypoints.map((wp) => [wp.lng, wp.lat]);

      for (let index = 0; index < normalizedWaypoints.length - 1; index += 1) {
        totalMeters += haversineMeters(normalizedWaypoints[index], normalizedWaypoints[index + 1]);
      }

      const totalSeconds = speedMetersPerSecond > 0 ? totalMeters / speedMetersPerSecond : 0;

      const fallbackFeature = {
        type: "Feature",
        properties: {
          mode,
          distance: totalMeters,
          time: totalSeconds,
          summary: {
            distance: totalMeters,
            duration: totalSeconds,
          },
          fallback: true,
          providerError,
          providerPayload,
          waypoints: normalizedWaypoints.map((wp, order) => ({ ...wp, order })),
        },
        geometry: {
          type: "LineString",
          coordinates: lineCoords,
        },
      };

      routeData = {
        type: "FeatureCollection",
        features: [fallbackFeature],
      };
    }

    routeCache.set(cacheKey, {
      data: routeData,
      expiresAt: now + ROUTE_CACHE_TTL_MS,
    });
    if (routeCache.size > 200) {
      const [firstKey] = routeCache.keys();
      routeCache.delete(firstKey);
    }

    res.json(routeData);
  } catch (error) {
    console.error("Route calculation error:", error);
    res.status(500).json({ error: "Server error during route calculation" });
  }
});
// ==========================================================
// --- END OF NEW ROUTE ---
// ==========================================================

// POST /api/itinerary/ai/plan - Generate AI plan using Groq
router.post("/ai/plan", authenticateToken, async (req, res) => {
  try {
    const {
      destination,
      startDate,
      endDate,
      passengers = 1,
      travelStyle = "standard",
      save,
      fromLocation,
    } = req.body || {};

    if (!destination || !destination.name) {
      return res.status(400).json({ error: "Destination (with name) is required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const loc = destination.location || {};
    const prompt = `Create a ${travelStyle} ${passengers}-person travel plan for ${
      destination.name
    } (${loc.city || ""} ${loc.state || ""} ${
      loc.country || "India"
    }) from ${startDate} to ${endDate}. Include realistic day-wise activities near ${
      destination.name
    }, travel tips, a short packing list, and an estimatedBasePerPerson in INR for budget category matching '${travelStyle}'. Return JSON only.`;

    const modelReply = await callGroqPlan({ prompt });

    let parsed;
    try {
      parsed = JSON.parse(removeTrailingCommas(modelReply));
    } catch (_e) {
      try {
        parsed = JSON.parse(removeTrailingCommas(sanitizeJsonText(modelReply)));
      } catch (_e2) {
        parsed = { days: [], tips: [], packing: [], estimatedBasePerPerson: 3500 };
      }
    }

    const responsePayload = { plan: parsed };

    if (save) {
      const nights = Math.max(
        1,
        Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      const perPerson = Number(parsed.estimatedBasePerPerson || 0) || 0;
      const tax = Math.round(perPerson * passengers * nights * 0.18);
      const total = Math.round(perPerson * passengers * nights + tax);

      const newItinerary = new Itinerary({
        userId: req.user.userId,
        destination,
        passengerInfo: {
          passengers,
          travelClass: travelStyle,
          travelDates: { start: startDate, end: endDate },
        },
        costEstimate: { perPerson, total, tax },
        aiPlan: parsed,
        dateAdded: new Date().toISOString(),
      });
      // Precompute distance if fromLocation and destination coordinates are available
      try {
        if (fromLocation && GEOAPIFY_KEY) {
          const to = destination?.location?.coordinates;
          const fromLat = Number(fromLocation.lat ?? fromLocation.latitude);
          const fromLng = Number(
            fromLocation.lng ?? fromLocation.longitude ?? fromLocation.lon ?? fromLocation.long
          );

          if (
            to &&
            typeof to.lat === "number" &&
            typeof to.lng === "number" &&
            Number.isFinite(fromLat) &&
            Number.isFinite(fromLng)
          ) {
            const fetch = await ensureFetch();

            const url = new URL("https://api.geoapify.com/v1/routing");
            url.searchParams.set("apiKey", GEOAPIFY_KEY);
            url.searchParams.set("mode", "drive");
            url.searchParams.set("waypoints", `${fromLat},${fromLng}|${to.lat},${to.lng}`);
            url.searchParams.append("details", "instruction_details");
            url.searchParams.append("details", "route_details");

            const r = await fetch(url.href, { method: "GET" });

            if (r.ok) {
              const data = await r.json();
              // Check for features array and its length
              if (data.features && data.features.length > 0) {
                const summary = data.features[0].properties || {};
                const distanceMeters = summary.distance || null;
                const durationSeconds = summary.duration || null;

                newItinerary.distanceHistory = newItinerary.distanceHistory || [];
                newItinerary.distanceHistory.push({
                  from: fromLocation,
                  to: { lat: to.lat, lng: to.lng },
                  mode: "drive",
                  distanceMeters,
                  durationSeconds,
                  createdAt: new Date(),
                });
              } else {
                console.warn("Distance precompute (ai/plan) returned no features.");
              }
            } else {
              const errorText = await r.text();
              console.warn("Distance precompute (ai/plan) failed:", errorText);
            }
          }
        }
      } catch (e) {
        console.warn("Distance precompute failed:", e.message || e);
      }

      // Save baseline cost snapshot to history as well
      newItinerary.costHistory = newItinerary.costHistory || [];
      newItinerary.costHistory.push({
        inputs: {
          basePerPerson: perPerson,
          passengers,
          nights,
          travelClass,
          season: "standard",
          taxesPct: 0.18,
          addOns: { visa: 0, insurance: 0, buffer: 0 },
        },
        result: { perPerson, subtotal: perPerson * passengers * nights, fixedFees: 0, tax, total },
        createdAt: new Date(),
      });

      await newItinerary.save();
      responsePayload.saved = true;
      responsePayload.itinerary = newItinerary;
    }

    return res.json(responsePayload);
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("AI plan error:", error);
    return res.status(status).json({ error: error.message || "Failed to generate plan" });
  }
});

// POST /api/itinerary/ai/cost - Advanced Cost Estimator (Research-backed Formulas)
router.post("/ai/cost", authenticateToken, async (req, res) => {
  try {
    const {
      basePerPerson = 3500,
      passengers = 1,
      nights = 1,
      travelClass = "economy",
      season = "standard",
      addOns = { visa: 0, insurance: 0, buffer: 0 },
      taxesPct = 0.18,
      destination = "India",
      interests = "",
      tripDistanceKm = 0,
      itineraryId,
    } = req.body || {};

    console.log("=== ADVANCED COST CALCULATION ===");
    console.log("Destination:", destination);
    console.log("Interests:", interests);
    console.log("Trip Distance:", tripDistanceKm, "km");

    // Use advanced calculator
    const result = calculateAdvancedCost({
      destination,
      basePerPerson,
      passengers,
      nights,
      travelClass,
      season,
      interests,
      tripDistanceKm,
      addOns,
      taxesPct,
    });

    console.log("Calculated cost:", result.total);

    // Persist result if needed
    if (itineraryId) {
      const itinerary = await Itinerary.findOne({ _id: itineraryId, userId: req.user.userId });
      if (itinerary) {
        itinerary.costHistory = itinerary.costHistory || [];
        itinerary.costHistory.push({
          inputs: {
            basePerPerson,
            passengers,
            nights,
            travelClass,
            season,
            taxesPct,
            addOns,
            destination,
            interests,
            tripDistanceKm,
          },
          result,
          createdAt: new Date(),
        });
        itinerary.costEstimate = {
          perPerson: result.perPerson,
          total: result.total,
          tax: result.tax,
          breakdown: result.breakdown,
        };
        itinerary.updatedAt = new Date();
        await itinerary.save();
      }
    }

    return res.json(result);
  } catch (error) {
    console.error("Cost estimate error:", error);
    return res.status(500).json({ error: "Failed to estimate cost", details: error.message });
  }
});

// GET /api/itinerary - Get all itineraries for logged-in user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const itineraries = await Itinerary.find({ userId: req.user.userId })
      .sort({ dateAdded: -1 })
      .lean();

    res.json({
      success: true,
      itineraries,
      count: itineraries.length,
    });
  } catch (error) {
    console.error("Get itineraries error:", error);
    res.status(500).json({
      error: "Failed to fetch itineraries",
      details: error.message,
    });
  }
});

// GET /api/itinerary/:id - Get single itinerary
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const itinerary = await Itinerary.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    }).lean();

    if (!itinerary) {
      return res.status(404).json({ error: "Itinerary not found" });
    }

    res.json({ success: true, itinerary });
  } catch (error) {
    console.error("Get itinerary error:", error);
    res.status(500).json({
      error: "Failed to fetch itinerary",
      details: error.message,
    });
  }
});

// POST /api/itinerary/save - Save new itinerary
router.post("/save", authenticateToken, async (req, res) => {
  try {
    const { destination, aiPlan, touristPlacesByDay, passengerInfo, costEstimate, dateAdded } =
      req.body;

    console.log("=== SAVE ITINERARY REQUEST ===");
    console.log("User ID:", req.user?.userId);
    console.log("Destination:", destination?.name);
    console.log("PassengerInfo:", passengerInfo);
    console.log("Request Body Keys:", Object.keys(req.body));

    // Validate required fields
    if (!destination || !destination.name) {
      console.error("Missing destination or destination.name");
      return res.status(400).json({ error: "Destination information is required" });
    }

    if (!passengerInfo || !passengerInfo.travelDates) {
      console.error("Missing passengerInfo or travelDates");
      return res.status(400).json({ error: "Travel dates are required" });
    }

    console.log("Validation passed, creating itinerary...");

    // Create new itinerary
    const newItinerary = new Itinerary({
      userId: req.user.userId,
      destination: {
        id: destination.id || destination._id,
        name: destination.name,
        category: destination.category,
        description: destination.description,
        formatted_address: destination.formatted_address || destination.location?.formatted,
        rating: destination.rating,
        photo: destination.photo || destination.heroImage,
        location: destination.location,
        website: destination.website,
        entryFee: destination.entryFee,
        bestTimeToVisit: destination.bestTimeToVisit,
        heroImageURL: destination.heroImageURL, // Store hero image URL
      },
      aiPlan: aiPlan || null, // Store the AI-generated plan
      // Handle new touristPlacesByDay structure
      touristPlacesByDay: (touristPlacesByDay || []).map((day) => ({
        dayNumber: day.dayNumber,
        places: (day.places || []).map((place) => ({
          placeId: place.placeId,
          name: place.name,
          address: place.address,
          rating: place.rating || null,
          distanceText: place.distanceText,
          categories: place.categories || [],
          heroImage: place.heroImage,
          description: place.description,
          coordinates: place.coordinates, // Include coordinates
        })),
      })),
      // Note: legacy flat arrays removed; using touristPlacesByDay for day-organized places
      passengerInfo: {
        passengers: passengerInfo.passengers || 1,
        travelClass: passengerInfo.travelClass,
        travelDates: {
          start: passengerInfo.travelDates.start,
          end: passengerInfo.travelDates.end,
        },
        preferences: passengerInfo.preferences || [],
        notes: passengerInfo.notes || "",
      },
      costEstimate: {
        perPerson: costEstimate?.perPerson || 0,
        total: costEstimate?.total || 0,
        tax: costEstimate?.tax || 0,
      },
      dateAdded: dateAdded || new Date().toISOString(),
    });

    await newItinerary.save();

    console.log("Itinerary saved successfully, ID:", newItinerary._id);

    res.status(201).json({
      success: true,
      message: "Itinerary saved successfully",
      itinerary: newItinerary,
    });
  } catch (error) {
    console.error("Save itinerary error:", error);
    console.error("Error stack:", error.stack);
    // ==========================================================
    // --- THIS IS THE SYNTAX ERROR FIX ---
    // Changed 5im00 to 500
    // ==========================================================
    res.status(500).json({
      // This was 5im00 in your file
      error: "Failed to save itinerary",
      details: error.message,
    });
  }
});

// PUT /api/itinerary/:id - Update itinerary
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const itinerary = await Itinerary.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!itinerary) {
      return res.status(404).json({ error: "Itinerary not found" }); // Was 4404 in your file
    }

    // Update fields (touristPlacesByDay replaces legacy flat arrays)
    const allowedUpdates = [
      "destination",
      "touristPlacesByDay",
      "passengerInfo",
      "costEstimate",
      "aiPlan",
    ]; // Added aiPlan

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        itinerary[field] = req.body[field];
      }
    });

    itinerary.updatedAt = new Date();
    await itinerary.save();

    res.json({
      success: true,
      message: "Itinerary updated successfully",
      itinerary,
    });
  } catch (error) {
    console.error("Update itinerary error:", error);
    res.status(500).json({
      error: "Failed to update itinerary",
      details: error.message,
    });
  }
});

// DELETE /api/itinerary/:id - Delete itinerary
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const itinerary = await Itinerary.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!itinerary) {
      return res.status(404).json({ error: "Itinerary not found" });
    }

    res.json({
      success: true,
      message: "Itinerary deleted successfully",
    });
  } catch (error) {
    console.error("Delete itinerary error:", error);
    res.status(500).json({
      error: "Failed to delete itinerary",
      details: error.message,
    });
  }
});

// GET /api/itinerary/stats/summary - Get user's itinerary statistics
router.get("/stats/summary", authenticateToken, async (req, res) => {
  try {
    const itineraries = await Itinerary.find({ userId: req.user.userId }).lean();

    const now = new Date();
    const upcoming = itineraries.filter((item) => {
      const startDate = item.passengerInfo?.travelDates?.start;
      return startDate && new Date(startDate) > now;
    }).length;

    const past = itineraries.filter((item) => {
      const endDate = item.passengerInfo?.travelDates?.end;
      return endDate && new Date(endDate) < now;
    }).length;

    const totalCost = itineraries.reduce((sum, item) => {
      return sum + (item.costEstimate?.total || 0);
    }, 0);

    res.json({
      success: true,
      stats: {
        total: itineraries.length,
        upcoming,
        past,
        totalCost,
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      details: error.message,
    });
  }
});

// === ALL BAD ROUTES HAVE BEEN REMOVED FROM THIS FILE ===

module.exports = router;
