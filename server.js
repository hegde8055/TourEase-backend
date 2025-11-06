// /server/server.js
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // Needed for password hashing
const jwt = require("jsonwebtoken"); // Needed for auth and reset tokens
const fs = require("fs");
const destinationsRouter = require("./routes/destinations");
const trendingRouter = require("./routes/trending");
const itineraryRouter = require("./routes/itinerary");
const placesRouter = require("./routes/places");
const chatbotRouter = require("./routes/chatbot");
const imagesRouter = require("./routes/images");
require("dotenv").config();

// --- INITIAL SETUP ---
const app = express();
app.set("trust proxy", 1);
const parsePort = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const PORT = parsePort(process.env.PORT, 5000);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000"; // Needed for reset link
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// --- MIDDLEWARE ---
const additionalCorsOrigins = (process.env.ADDITIONAL_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set(
    [
      CLIENT_URL,
      SERVER_URL,
      process.env.PUBLIC_URL,
      "http://localhost:3000",
      "http://localhost:3001",
      `http://127.0.0.1:${PORT}`,
      "https://tourease-theta.vercel.app",
      ...additionalCorsOrigins,
    ].filter(Boolean)
  )
);

const vercelPreviewPattern = /^https:\/\/tourease-[a-z0-9-]+\.vercel\.app$/i;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.includes(origin) || vercelPreviewPattern.test(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS error: Origin ${origin} not allowed`); // Log CORS errors
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// --- STATIC FILE SERVING (FOR UPLOADS) ---
// We keep this, so you can serve user-uploaded images if needed
app.use(
  "/public",
  express.static(path.join(__dirname, "public"), {
    maxAge: "2h",
    etag: true,
    immutable: false,
  })
);
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "15m",
    etag: true,
  })
);

// --- DATABASE CONNECTION ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tourease";
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully using Mongoose!");
    if (mongoose.connection && mongoose.connection.db) {
      app.locals.db = mongoose.connection.db;
      console.log("MongoDB database handle attached to app.locals");
    }
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// --- MODELS ---
const { User } = require("./models/User"); // Make sure User model is imported

// --- AUTHENTICATION MIDDLEWARE ---
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

// =================================================================
// --- API ROUTES ---
// =================================================================

// Simple health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

// --- AUTHENTICATION ROUTES ---
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: "User with this email already exists." });

    user = await User.findOne({ username });
    if (user) return res.status(400).json({ error: "Username is already taken." });

    user = new User({ username, email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = { user: { userId: user.id, username: user.username } };
    jwt.sign(payload.user, JWT_SECRET, { expiresIn: "7d" }, (err, token) => {
      if (err) throw err;
      res
        .status(201)
        .json({ token, username: user.username, message: "User registered successfully" });
    });
  } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ error: error.message });
    res.status(500).json({ error: "Server error during registration." });
  }
});

app.post("/api/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Invalid credentials.", userNotFound: true });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials. Wrong password." });

    const payload = { user: { userId: user.id, username: user.username } };
    jwt.sign(payload.user, JWT_SECRET, { expiresIn: "7d" }, (err, token) => {
      if (err) throw err;
      res.json({ token, username: user.username, message: "Signed in successfully" });
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during sign in." });
  }
});

// --- NEW: FORGOT PASSWORD ROUTE ---
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // IMPORTANT: Even if user not found, send a success-like response
      // This prevents attackers from guessing which emails are registered.
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.json({
        message: "If your email is registered, you will receive a password reset link.",
      });
    }

    // --- Password Reset Logic ---
    // 1. Generate a unique, short-lived reset token
    const resetToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET, // Use your existing JWT secret
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    // 2. TODO: Store the resetToken or associate it with the user in the DB (optional but recommended)
    //    For simplicity, we are not storing it here, but in a real app you might.

    // 3. TODO: Send an email to the user with the reset link
    //    This part requires an email sending library (like Nodemailer) which is not set up here.
    //    The link would typically be like: ${CLIENT_URL}/reset-password/${resetToken}
    console.log(`Password reset token for ${email}: ${resetToken}`); // Log token for now
    console.log(`Reset Link (for testing): ${CLIENT_URL}/reset-password/${resetToken}`);

    // --- IMPORTANT ---
    // In a real application, you would *email* the link containing the resetToken.
    // DO NOT send the token directly in the API response like this in production!

    res.json({
      message: "If your email is registered, you will receive a password reset link.",
      // --- REMOVE THIS IN PRODUCTION ---
      _development_testing_token: resetToken, // Only for testing since email isn't set up
      // --- END REMOVE ---
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Server error during password reset request." });
  }
});

// --- NEW: RESET PASSWORD ROUTE ---
// This handles the link clicked from the (simulated) email
app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and new password are required." });
  }

  try {
    // 1. Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    const userId = decoded.userId;

    // 2. Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // 3. Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Update the user's password
    user.password = hashedPassword;
    // TODO: Invalidate the token if you stored it in the DB

    await user.save();

    res.json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Server error during password reset." });
  }
});
// --- END OF NEW AUTH ROUTES ---

// --- PROFILE ROUTES ---
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

app.put("/api/profile/update", authenticateToken, async (req, res) => {
  try {
    const { username, about } = req.body;
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (about !== undefined) updateData.about = about;

    const user = await User.findByIdAndUpdate(req.user.userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ error: error.message });
    res.status(500).json({ error: "Failed to update profile" });
  }
});

app.post("/api/profile/upload-photo", authenticateToken, async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) {
      return res.status(400).json({ error: "No photo data provided." });
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { profile_photo_base64: photo },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "Profile photo uploaded successfully", user: updatedUser });
  } catch (error) {
    console.error("Photo upload error:", error);
    res.status(500).json({ error: "Failed to upload photo." });
  }
});

app.delete("/api/profile/photo", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profile_photo_base64: null },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "Profile photo deleted successfully", user });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete profile photo" });
  }
});

// --- ADDITIONAL FEATURE ROUTES ---
app.use("/api/destinations", destinationsRouter);
app.use("/api/trending", trendingRouter);
app.use("/api/itinerary", itineraryRouter);
app.use("/api/places", placesRouter);
app.use("/api/chatbot", chatbotRouter);
app.use("/api/images", imagesRouter);

// =================================================================
// --- CATCH-ALL ROUTE (REMOVED) ---
// =================================================================
//
// ‼️‼️ FIX: REMOVED THE app.get("*", ...) CATCH-ALL ROUTE.
// Vercel handles serving the frontend. This backend should only be an API.
// This was causing the "ENOENT" crash on Render.
//
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "..", "client", "build", "index.html"));
// });
//
// ‼️‼️ FIX: ALSO REMOVED THE STATIC SERVING FOR THE CLIENT BUILD
// app.use(express.static(path.join(__dirname, "..", "client", "build")));

// --- SERVER LISTENER ---
const candidatePorts = Array.from(
  new Set([
    PORT,
    5000,
    8080,
    0, // lets Node pick a random free port as a last resort
  ])
);

const startServer = (index = 0) => {
  const targetPort = candidatePorts[index];
  const server = app
    .listen(targetPort, () => {
      const address = server.address();
      const assignedPort = typeof address === "object" && address ? address.port : targetPort;
      console.log(`🚀 Server running on http://localhost:${assignedPort}`);
    })
    .on("error", (error) => {
      if (error.code === "EADDRINUSE" && index < candidatePorts.length - 1) {
        const nextPort = candidatePorts[index + 1];
        console.warn(
          `⚠️ Port ${targetPort} is busy. Retrying with ${nextPort || "an open port"}...`
        );
        startServer(index + 1);
      } else {
        console.error(`❌ Unable to start server on port ${targetPort}:`, error.message);
        process.exit(1);
      }
    });
};

startServer();
