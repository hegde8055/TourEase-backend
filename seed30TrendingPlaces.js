// Script to seed 30 top trending tourist destinations in India
const { MongoClient } = require("mongodb");
require("dotenv").config();
const { enrichDestination } = require("./utils/enrichDestination");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = "tourease";

const top30TrendingDestinations = [
  {
    name: "Taj Mahal",
    category: "Historical",
    description:
      "The Taj Mahal is an ivory-white marble mausoleum, built by Mughal emperor Shah Jahan in memory of his wife Mumtaz Mahal. One of the Seven Wonders of the World and UNESCO World Heritage Site, it stands as a timeless symbol of love and architectural brilliance.",
    location: {
      city: "Agra",
      state: "Uttar Pradesh",
      country: "India",
      coordinates: { lat: 27.1751, lng: 78.0421 },
      address: "Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001",
    },
    rating: 4.9,
    reviews: 125000,
    entryFee: "₹50 Indians, ₹1300 Foreigners",
    timings: "Sunrise to Sunset (Closed Fridays)",
    bestTimeToVisit: "October to March",
    image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800",
    highlights: [
      "UNESCO World Heritage Site",
      "Seven Wonders of the World",
      "White marble architecture",
      "Mughal Gardens",
      "Intricate inlay work",
      "Combine with Bhopal trip",
    ],
    contactNumber: "+91-7480-266723",
    website: "https://www.mptourism.com",
    trending: true,
    trendingRank: 29,
    popularity: 73,
  },

  {
    name: "Mahabalipuram",
    category: "Historical",
    description:
      "UNESCO World Heritage Site with 7th-century rock-cut temples and sculptures. Ancient port city of Pallava dynasty featuring Shore Temple and Five Rathas.",
    location: {
      city: "Mahabalipuram",
      state: "Tamil Nadu",
      country: "India",
      coordinates: { lat: 12.6269, lng: 80.1992 },
      address: "Mahabalipuram, Tamil Nadu, India",
    },
    rating: 4.6,
    reviews: 53000,
    entryFee: "₹40 Indians, ₹600 Foreigners",
    timings: "6 AM - 6 PM",
    bestTimeToVisit: "November to February",
    image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800",
    highlights: [
      "Shore Temple",
      "Five Rathas",
      "Arjuna's Penance",
      "Krishna's Butter Ball",
      "Beach",
      "Rock-cut caves",
      "Lighthouses",
    ],
    activities: [
      "Temple exploration",
      "Beach relaxation",
      "Photography",
      "Sculpture viewing",
      "Surfing",
      "Shopping handicrafts",
    ],
    nearbyAttractions: [
      { name: "Chennai", distance: "60 km" },
      { name: "Pondicherry", distance: "105 km" },
      { name: "Kanchipuram", distance: "65 km" },
      { name: "Vedanthangal Bird Sanctuary", distance: "50 km" },
      { name: "Covelong Beach", distance: "20 km" },
    ],
    howToReach: "Chennai Airport 60 km, Chengalpattu Station 29 km, ECR from Chennai",
    tips: [
      "Visit early to avoid heat",
      "Combine monuments with beach",
      "Buy stone sculptures",
      "Try fresh seafood",
      "Spend full day",
    ],
    contactNumber: "+91-44-27443845",
    website: "https://www.tamilnadutourism.tn.gov.in",
    trending: true,
    trendingRank: 30,
    popularity: 80,
  },
];

// MongoDB Connection and Seeding Function
async function seedDatabase() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("Connected successfully to MongoDB!");

    const db = client.db(DB_NAME);
    const collection = db.collection("destinations");

    // Clear existing trending destinations
    console.log("Clearing existing trending destinations...");
    await collection.deleteMany({ trending: true });

    console.log("Preparing destination media, maps, and weather metadata...");
    const destinationsToInsert = [];
    for (const destination of top30TrendingDestinations) {
      const clone = JSON.parse(JSON.stringify(destination));
      // Sequential to respect API rate limits
      // eslint-disable-next-line no-await-in-loop
      await enrichDestination(clone, { includeRawWeather: false });
      destinationsToInsert.push(clone);
    }

    // Insert new trending destinations
    console.log("Inserting 30 new trending destinations...");
    const result = await collection.insertMany(destinationsToInsert);

    console.log(`\n✅ Successfully inserted ${result.insertedCount} trending destinations!`);
    console.log("\n📊 Summary:");
    console.log(`Total destinations: ${result.insertedCount}`);
    console.log("\nTop 5 Trending:");
    destinationsToInsert.slice(0, 5).forEach((dest, index) => {
      console.log(
        `${index + 1}. ${dest.name} - ${dest.city}, ${dest.state} (Rating: ${dest.rating})`
      );
    });

    // Verify insertion
    const count = await collection.countDocuments({ trending: true });
    console.log(`\n✓ Verified: ${count} trending destinations in database`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\n👋 Database connection closed.");
  }
}

// Run the seeding function
if (require.main === module) {
  seedDatabase();
}

module.exports = { top30TrendingDestinations, seedDatabase };
