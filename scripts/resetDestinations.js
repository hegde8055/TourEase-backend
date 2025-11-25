const { MongoClient } = require("mongodb");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "tourease";

// Helper to generate consistent hotels and restaurants
const generateAmenities = (cityName, baseRating) => {
  const hotelNames = [
    "Grand",
    "Royal",
    "Heritage",
    "Palace",
    "Resort",
    "View",
    "Plaza",
    "Inn",
    "Regency",
    "Stay",
  ];
  const restaurantNames = [
    "Spice Garden",
    "The Curry House",
    "Flavors of",
    "Taste of",
    "Golden Spoon",
    "The Diner",
    "Bistro",
    "Cafe",
    "Grill",
    "Kitchen",
  ];

  return {
    hotels: Array(10)
      .fill(0)
      .map((_, i) => ({
        name: `${cityName} ${hotelNames[i]} Hotel`,
        rating: Math.min(5, Math.max(3.5, baseRating + (Math.random() * 1 - 0.5))).toFixed(1),
        address: `Near City Center, ${cityName}`,
        price: Math.floor(2000 + Math.random() * 5000),
        image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
        contact: "+91-9876543210",
        website: `https://www.hotels-${cityName.toLowerCase().replace(/\s/g, "")}.com`,
      })),
    restaurants: Array(10)
      .fill(0)
      .map((_, i) => ({
        name: `${restaurantNames[i]} ${cityName}`,
        cuisine: ["North Indian", "South Indian", "Multi-Cuisine", "Local Special"][i % 4],
        rating: Math.min(5, Math.max(3.5, baseRating + (Math.random() * 1 - 0.5))).toFixed(1),
        address: `Main Market, ${cityName}`,
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
        priceRange: "₹₹-₹₹₹",
      })),
  };
};

const destinations = require("./destinationsData");

const createSlug = (value) =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

async function restore() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection("destinations");
    const trendingCollection = db.collection("trending_destinations");

    // Clear existing
    await collection.deleteMany({});
    await trendingCollection.deleteMany({});

    const enrichedDestinations = destinations.map((dest, index) => {
      const amenities = generateAmenities(dest.location.city, 4.5);
      const slug = createSlug(dest.name);

      return {
        ...dest,
        slug,
        query: dest.name, // Simple query for now
        normalizedQuery: dest.name.toLowerCase(),
        hotels: amenities.hotels,
        restaurants: amenities.restaurants,
        rating: 4.5 + Math.random() * 0.4,
        reviews: Math.floor(1000 + Math.random() * 50000),
        trending: true,
        trendingRank: index + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        heroImage: dest.image, // Ensure heroImage is set
        category: "Tourist Attraction", // Default category
        bestTimeToVisit: "October to March", // Default
      };
    });

    await collection.insertMany(enrichedDestinations);

    // Also populate trending collection
    const trendingDocs = enrichedDestinations.map((d) => ({
      ...d,
      image: d.heroImage,
    }));
    await trendingCollection.insertMany(trendingDocs);

    console.log(
      `Restored ${enrichedDestinations.length} destinations with corrected images and generated amenities.`
    );
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

restore();
