// Quick verification script to check seeded destinations
const { MongoClient } = require("mongodb");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = "tourease";

async function verifyDestinations() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection("destinations");

    // Count total trending destinations
    const count = await collection.countDocuments({ trending: true });
    console.log(`\n✅ Total trending destinations: ${count}\n`);

    // Get top 5
    const top5 = await collection
      .find({ trending: true })
      .sort({ trendingRank: 1 })
      .limit(5)
      .toArray();

    console.log("📍 Top 5 Trending Destinations:\n");
    top5.forEach((dest) => {
      console.log(
        `${dest.trendingRank}. ${dest.name} - ${dest.location.city}, ${dest.location.state}`
      );
      console.log(`   Rating: ${dest.rating}⭐ | Reviews: ${dest.reviews.toLocaleString()}`);
      console.log(`   Image: ${dest.image ? "✓ Available" : "✗ Missing"}`);
      console.log(`   GPS: ${dest.location.coordinates.lat}, ${dest.location.coordinates.lng}`);
      console.log("");
    });

    // Category breakdown
    const categories = await collection
      .aggregate([
        { $match: { trending: true } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    console.log("📊 Category Breakdown:\n");
    categories.forEach((cat) => {
      console.log(`   ${cat._id}: ${cat.count} destinations`);
    });

    // Check data completeness
    console.log("\n🔍 Data Completeness Check:\n");
    const withImages = await collection.countDocuments({
      trending: true,
      image: { $exists: true, $ne: "" },
    });
    const withCoords = await collection.countDocuments({
      trending: true,
      "location.coordinates.lat": { $exists: true },
    });
    const withTips = await collection.countDocuments({
      trending: true,
      tips: { $exists: true, $ne: [] },
    });

    console.log(`   Images: ${withImages}/30 ✓`);
    console.log(`   GPS Coordinates: ${withCoords}/30 ✓`);
    console.log(`   Travel Tips: ${withTips}/30 ✓`);

    console.log("\n✅ Database verification complete!\n");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await client.close();
  }
}

verifyDestinations();
