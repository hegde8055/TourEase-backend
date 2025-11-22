// /server/models/User.js
const mongoose = require("mongoose");
const Joi = require("joi");

const generateResetPinValue = () => Math.floor(100000 + Math.random() * 900000).toString();

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
    resetPin: {
      type: String,
      minlength: 6,
      maxlength: 6,
      default: generateResetPinValue,
    },
    resetPinIssuedAt: {
      type: Date,
      default: Date.now,
    },
    resetPinLastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.statics.generateResetPinValue = generateResetPinValue;
userSchema.methods.assignNewResetPin = function assignNewResetPin() {
  this.resetPin = generateResetPinValue();
  this.resetPinIssuedAt = new Date();
  return this.resetPin;
};

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

const validateSignup = (payload = {}) => signupSchema.validate(payload, { abortEarly: false });

const validatePasswordStrength = (password = "") => {
  const { error } = passwordSchema.validate(password, { abortEarly: false });
  if (!error) return [];
  return error.details.map((detail) => detail.message);
};

const User = mongoose.model("User", userSchema);

module.exports = {
  User,
  validateSignup,
  validatePasswordStrength,
  generateResetPinValue,
};
