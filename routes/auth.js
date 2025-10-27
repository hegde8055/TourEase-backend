// /server/routes/auth.js
const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateSignup, validatePasswordStrength } = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

module.exports = (db) => {
  const signup = async (req, res) => {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const { error: validationError } = validateSignup({ username, email, password });
      if (validationError) {
        return res.status(400).json({ error: validationError.details[0].message });
      }

      const users = db.collection("users");
      const existingUser = await users.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        username,
        email,
        password: hashedPassword,
        about: "",
        profile_photo_url: null,
        created_at: new Date(),
      };

      const result = await users.insertOne(newUser);

      const token = jwt.sign({ userId: result.insertedId.toString(), username }, JWT_SECRET, {
        expiresIn: "7d",
      });

      res.status(201).json({
        message: "User registered successfully",
        userId: result.insertedId,
        token,
        username,
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Server error during registration" });
    }
  };

  const signin = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const users = db.collection("users");
      const user = await users.findOne({ email });
      if (!user) {
        return res.status(404).json({
          error: "Email not found",
          userNotFound: true,
          message: "No account found with this email. Please sign up first.",
        });
      }

      if (!user.password) {
        return res.status(500).json({ error: "User account is corrupted, password missing" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          error: "Wrong password",
          message: "Incorrect password. Please try again or reset your password.",
        });
      }

      const token = jwt.sign({ userId: user._id.toString(), username: user.username }, JWT_SECRET, {
        expiresIn: "7d",
      });

      res.json({
        token,
        username: user.username,
      });
    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({ error: "Server error during login" });
    }
  };

  const forgotPassword = async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const users = db.collection("users");
      const user = await users.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const resetToken = jwt.sign({ userId: user._id.toString(), type: "reset" }, JWT_SECRET, {
        expiresIn: "1h",
      });

      // In production, send email with reset link (e.g., using nodemailer)
      // For development, return token for testing
      res.json({ message: "Reset link sent to your email", token: resetToken });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Server error" });
    }
  };

  const resetPassword = async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password required" });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== "reset") {
        return res.status(400).json({ error: "Invalid token" });
      }

      const passwordErrors = validatePasswordStrength(newPassword);
      if (passwordErrors.length > 0) {
        return res.status(400).json({ error: passwordErrors.join(", ") });
      }

      const hashed = await bcrypt.hash(newPassword, 10);

      const users = db.collection("users");
      const result = await users.updateOne(
        { _id: new ObjectId(decoded.userId) },
        { $set: { password: hashed } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "Password reset successfully" });
    } catch (err) {
      console.error("Reset password error:", err);
      if (err.name === "TokenExpiredError") {
        return res.status(400).json({ error: "Token expired" });
      }
      return res.status(400).json({ error: "Invalid token" });
    }
  };

  return { signup, signin, forgotPassword, resetPassword };
};
