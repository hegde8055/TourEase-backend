// /server/models/User.js
import mongoose from "mongoose";
import Joi from "joi";

// --- Mongoose Schema ---
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      unique: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    profile_photo_base64: {
      type: String,
      default: null,
    },
    profile_photo_url: {
      type: String,
      default: null,
    },
    about: {
      type: String,
      default: "",
      maxlength: [500, "About section cannot exceed 500 characters"],
    },
    phone: {
      type: String,
      default: "",
    },
    preferences: {
      travel_style: {
        type: String,
        enum: ["budget", "luxury", "adventure", "cultural", "relaxation"],
        default: "cultural",
      },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
      },
    },
  },
  {
    timestamps: true,
  }
);

// --- Joi Validation Schemas ---
const usernameSchema = Joi.string().min(3).max(30).trim();
const emailSchema = Joi.string().trim().lowercase().email();
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/)
  .message(
    "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
  );

const signupSchema = Joi.object({
  username: usernameSchema.required(),
  email: emailSchema.required(),
  password: passwordSchema.required(),
});

export const validateSignup = (payload = {}) =>
  signupSchema.validate(payload, { abortEarly: false });

export const validatePasswordStrength = (password = "") => {
  const { error } = passwordSchema.validate(password, { abortEarly: false });
  if (!error) return [];
  return error.details.map((detail) => detail.message);
};

// --- Mongoose Model ---
export const User = mongoose.model("User", userSchema);
