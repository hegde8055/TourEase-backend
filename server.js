// /server/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
require("dotenv").config();

// --- Routers ---
const destinationsRouter = require("./routes/destinations");
const trendingRouter = require("./routes/trending");
const itineraryRouter = require("./routes/itinerary");
const placesRouter = require("./routes/places");
const chatbotRouter = require("./routes/chatbot");
const imagesRouter = require("./routes/images");
const { User } = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// --- CORS ---
const allowedOrigins = [
  CLIENT_URL,
  SERVER_URL,
  process.env.PUBLIC_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  `http://127.0.0.1:${PORT}`,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// --- Static directories ---
app.use(express.static(path.join(__dirname, "..", "client", "build")));
app.use("/public", express.static(path.join(__dirname, "public")));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

// --- MongoDB connection ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tourease";
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully!");
    app.locals.db = mongoose.connection.db;
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- Authentication middleware ---
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

// ============================================================================
// 🔐 AUTH ROUTES
// ============================================================================
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (await User.findOne({ email }))
      return res.status(400).json({ error: "Email already used." });
    if (await User.findOne({ username })) return res.status(400).json({ error: "Username taken." });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const payload = { user: { userId: user.id, username: user.username } };
    const token = jwt.sign(payload.user, JWT_SECRET, { expiresIn: "7d" });

    res
      .status(201)
      .json({ token, username: user.username, message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error during registration." });
  }
});

app.post("/api/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found." });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Wrong password." });

    const payload = { user: { userId: user.id, username: user.username } };
    const token = jwt.sign(payload.user, JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, username: user.username, message: "Signed in successfully" });
  } catch {
    res.status(500).json({ error: "Server error during sign in." });
  }
});

// --- Forgot & Reset Password ---
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: "If registered, a reset link will be sent." });

    const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
    console.log(`🔗 Reset link: ${CLIENT_URL}/reset-password/${resetToken}`);
    res.json({
      message: "If registered, a reset link will be sent.",
      dev_token: resetToken,
    });
  } catch {
    res.status(500).json({ error: "Server error during password reset." });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: "Password reset successful." });
  } catch {
    res.status(400).json({ error: "Invalid or expired token." });
  }
});

// ============================================================================
// 👤 PROFILE ROUTES
// ============================================================================
app.get("/api/profile", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.put("/api/profile/update", authenticateToken, async (req, res) => {
  const { username, about } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { username, about },
    { new: true, runValidators: true }
  ).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ message: "Profile updated", user });
});

app.post("/api/profile/upload-photo", authenticateToken, async (req, res) => {
  const { photo } = req.body;
  if (!photo) return res.status(400).json({ error: "No photo provided." });

  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { profile_photo_base64: photo },
    { new: true }
  ).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ message: "Photo uploaded", user });
});

app.delete("/api/profile/photo", authenticateToken, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { profile_photo_base64: null },
    { new: true }
  ).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ message: "Photo deleted", user });
});

// ============================================================================
// 🌍 ROUTE REGISTRATION
// ============================================================================
app.use("/api/destinations", destinationsRouter);
app.use("/api/trending", trendingRouter);
app.use("/api/itinerary", itineraryRouter);
app.use("/api/places", placesRouter);
app.use("/api/chatbot", chatbotRouter);
app.use("/api/images", imagesRouter);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "build", "index.html"));
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
