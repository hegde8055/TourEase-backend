// /server/routes/profile.js
const express = require("express");
const router = express.Router();
const { User } = require("../models/User");
const { authenticateToken: auth } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/profiles/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, "profile-" + req.user.userId + "-" + uniqueSuffix + fileExtension);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/update", auth, async (req, res) => {
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

router.post("/upload-photo", auth, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profile_photo_url: photoUrl },
      { new: true }
    ).select("-password");
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "Profile photo uploaded successfully", user });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

router.delete("/photo", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.profile_photo_url) {
      const photoPath = path.resolve(__dirname, "..", user.profile_photo_url.substring(1));
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }
    user.profile_photo_url = null;
    await user.save();
    const updatedUser = user.toObject();
    delete updatedUser.password;
    res.json({ message: "Profile photo deleted successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete profile photo" });
  }
});

module.exports = router;
