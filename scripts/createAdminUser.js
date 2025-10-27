// Script to create or promote an admin user for TourEase
const path = require("path");
const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");
const { validatePasswordStrength } = require("../models/User");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "tourease";

const [emailArg, passwordArg, usernameArg] = process.argv.slice(2);

if (!emailArg || !passwordArg) {
  console.error(
    "Usage: node createAdminUser.js <email> <password> [username]\n" +
      'Example: node createAdminUser.js admin@tourease.test "StrongPass123!" "Site Admin"'
  );
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const username = (usernameArg || email.split("@")[0] || "admin").trim();

const passwordErrors = validatePasswordStrength(passwordArg);
if (passwordErrors.length > 0) {
  console.error("Password does not meet strength requirements:");
  passwordErrors.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

const hashPassword = async (password) => bcrypt.hash(password, 10);

const run = async () => {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const users = db.collection("users");

    const now = new Date();
    const hashedPassword = await hashPassword(passwordArg);

    const existingUser = await users.findOne({ email });

    if (existingUser) {
      await users.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            username: existingUser.username || username,
            password: hashedPassword,
            isAdmin: true,
            updatedAt: now,
            updated_at: now,
          },
          $setOnInsert: {
            createdAt: now,
            created_at: now,
          },
        }
      );

      console.log(
        `Promoted existing user ${email} to admin. Password reset and admin privileges granted.`
      );
      return;
    }

    const newUser = {
      username,
      email,
      password: hashedPassword,
      isAdmin: true,
      about: "",
      profile_photo_base64: null,
      profile_photo_url: null,
      phone: "",
      preferences: {
        travel_style: "cultural",
        notifications: {
          email: true,
          sms: false,
        },
      },
      createdAt: now,
      updatedAt: now,
      created_at: now,
      updated_at: now,
    };

    await users.insertOne(newUser);
    console.log(`Created new admin user ${email}.`);
  } catch (error) {
    console.error("Failed to create admin user:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
};

run();
