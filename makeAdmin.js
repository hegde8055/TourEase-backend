// /server/makeAdmin.js
// Script to make a user an admin
const { MongoClient } = require("mongodb");

const uri = "mongodb://127.0.0.1:27017";
const dbName = "tourease";

async function makeAdmin() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db(dbName);
    const users = db.collection("users");

    // Get all users
    const allUsers = await users.find({}).toArray();

    if (allUsers.length === 0) {
      console.log("❌ No users found in database");
      return;
    }

    console.log("\n📋 Current Users:");
    allUsers.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.email} - ${user.name} ${user.isAdmin ? "(Already Admin ✅)" : ""}`
      );
    });

    // Prompt for email
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question("\n🔧 Enter email of user to make admin: ", async (email) => {
      const user = await users.findOne({ email: email.trim() });

      if (!user) {
        console.log(`❌ User with email "${email}" not found`);
      } else if (user.isAdmin) {
        console.log(`ℹ️  User "${email}" is already an admin`);
      } else {
        await users.updateOne({ email: email.trim() }, { $set: { isAdmin: true } });
        console.log(`✅ User "${email}" is now an admin!`);
        console.log(`\n🎯 You can now access the admin panel at: http://localhost:3000/admin`);
      }

      readline.close();
      await client.close();
    });
  } catch (error) {
    console.error("❌ Error:", error);
    await client.close();
  }
}

makeAdmin();
