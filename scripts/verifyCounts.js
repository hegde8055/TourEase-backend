const { MongoClient } = require("mongodb");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "tourease";

async function verifyCounts() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const destinations = await db.collection("destinations").find({}).toArray();

    console.log(`Total Destinations: ${destinations.length}`);

    let allPass = true;
    destinations.forEach((d) => {
      const hotels = d.hotels?.length || 0;
      const restaurants = d.restaurants?.length || 0;
      const attractions = d.nearbyAttractions?.length || 0;
      const total = hotels + restaurants + attractions;

      if (total < 30) {
        console.log(
          `❌ ${d.name}: Total ${total} (H:${hotels}, R:${restaurants}, A:${attractions})`
        );
        allPass = false;
      } else {
        // console.log(`✅ ${d.name}: Total ${total}`);
      }
    });

    if (allPass) {
      console.log(
        "✅ All 30 destinations have 30+ total items (Hotels + Restaurants + Attractions)."
      );
    } else {
      console.log("❌ Some destinations failed the count check.");
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

verifyCounts();
