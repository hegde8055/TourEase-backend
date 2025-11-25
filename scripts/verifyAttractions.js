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
    const destinations = await db.collection("destinations").find({}).toArray();
    
    console.log(`Total destinations: ${destinations.length}`);
    destinations.forEach(d => {
      console.log(`${d.name}: ${d.nearbyAttractions?.length || 0} nearby attractions`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

verify();
