// /server/makeFirstUserAdmin.js
// Script to make the first user (your account) an admin
const { MongoClient } = require("mongodb");

const uri = "mongodb://127.0.0.1:27017";
const dbName = "tourease";

async function makeFirstUserAdmin() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db(dbName);
    const users = db.collection("users");

    // Get the first user (likely your account)
    const firstUser = await users.findOne({});

    if (!firstUser) {
      console.log("❌ No users found in database");
      await client.close();
      return;
    }

    if (firstUser.isAdmin) {
      console.log(`ℹ️  User "${firstUser.email}" is already an admin`);
    } else {
      await users.updateOne({ _id: firstUser._id }, { $set: { isAdmin: true } });
      console.log(`✅ User "${firstUser.email}" (${firstUser.name}) is now an admin!`);
    }

    console.log(`\n🎯 Access the admin panel at: http://localhost:3000/admin`);
    console.log(`📧 Admin Email: ${firstUser.email}`);

    await client.close();
  } catch (error) {
    console.error("❌ Error:", error);
    await client.close();
  }
}

makeFirstUserAdmin();
