const { MongoClient } = require("mongodb");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "tourease";

async function verify() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const hampi = await db.collection("destinations").findOne({ name: "Hampi" });

    if (hampi) {
      console.log("Hampi Image:", hampi.heroImage);
      console.log("Hampi Hotels:", hampi.hotels?.length);
      console.log("Hampi Restaurants:", hampi.restaurants?.length);
      console.log("Hampi Nearby:", hampi.nearbyAttractions?.length);
    } else {
      console.log("Hampi not found");
    }

    const taj = await db.collection("destinations").findOne({ name: "Taj Mahal" });
    if (taj) {
      console.log("Taj Image:", taj.heroImage);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

verify();
