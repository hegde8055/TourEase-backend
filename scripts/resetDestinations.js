/*
 * Script to backup and reset curated destinations for TourEase.
 * - Exports existing destination names to server/backups
 * - Clears destinations and trending_destinations collections
 * - Inserts a curated Karnataka-focused destination set with verified hero imagery
 */

const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "tourease";

const createSlug = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

// Import the expanded trending destinations data
const curatedDestinations = require("./trendingDestinationsData");

const shouldSeedCuratedDestinations = true; // Always seed for this update

const formatTimestamp = (date = new Date()) => {
  const pad = (value) => value.toString().padStart(2, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "-" +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
};

const buildDestinationDocument = (data, index, timestamp) => {
  const slug = createSlug(data.slug || data.query || data.name);
  const normalizedQuery = (data.query || data.name).trim().toLowerCase();
  const baseTags = new Set(
    [data.name, data.category, data.location?.city, data.location?.state]
      .filter(Boolean)
      .map((token) => token.toLowerCase())
  );
  (data.tags || []).forEach((tag) => baseTags.add(tag.toLowerCase()));

  return {
    name: data.name,
    slug,
    query: data.query || data.name,
    normalizedQuery,
    category: data.category,
    headline: data.headline || `Explore ${data.name}`,
    description: data.description,
    summary: data.summary || data.description,
    location: data.location,
    heroImage: data.heroImage?.url || data.image || data.heroImage, // Added data.image support
    heroImageAttribution: data.heroImage?.attribution || "",
    heroImageSource: data.heroImage?.source || "unsplash",
    mapImage: data.mapImage || null,
    highlights: data.highlights || [],
    bestTimeToVisit: data.bestTimeToVisit || "",
    entryFee: data.entryFee || "",
    rating: data.rating ?? null,
    reviews: data.reviews ?? null,
    visitors: data.visitors ?? null,
    nearbyAttractions: data.nearbyAttractions || [],
    hotels: data.hotels || [],
    restaurants: data.restaurants || [],
    itineraryIdeas: data.itineraryIdeas || [],
    travelTips: data.travelTips || [],
    tags: Array.from(baseTags),
    weather: null,
    weatherRaw: null,
    source: {
      provider: "manual-curated",
      curatedBy: "resetDestinations script",
      curatedAt: timestamp,
      reference: data.source || "Tourism departments & verified travel guides",
    },
    geoapify: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    trending: data.trending ?? true,
    trendingRank: data.trendingRank ?? index + 1,
  };
};

const buildTrendingDocument = (destinationDocument) => ({
  name: destinationDocument.name,
  slug: destinationDocument.slug,
  category: destinationDocument.category,
  headline: destinationDocument.headline,
  description: destinationDocument.description,
  state: destinationDocument.location?.state || "",
  country: destinationDocument.location?.country || "India",
  location: destinationDocument.location,
  image: destinationDocument.heroImage,
  gallery: [],
  rating: destinationDocument.rating || 4.6,
  visitors: destinationDocument.visitors || null,
  bestTimeToVisit: destinationDocument.bestTimeToVisit,
  highlights: destinationDocument.highlights,
  travelTips: destinationDocument.travelTips,
  tags: destinationDocument.tags,
  trending: true,
  trendingRank: destinationDocument.trendingRank,
  source: destinationDocument.source,
  createdAt: destinationDocument.createdAt,
  updatedAt: destinationDocument.updatedAt,
});

const run = async () => {
  const client = new MongoClient(MONGODB_URI);
  const timestamp = new Date();
  const formattedTimestamp = formatTimestamp(timestamp);
  const backupDir = path.join(__dirname, "..", "backups");

  try {
    fs.mkdirSync(backupDir, { recursive: true });

    await client.connect();
    const db = client.db(DB_NAME);
    const destinationsCollection = db.collection("destinations");
    const trendingCollection = db.collection("trending_destinations");

    const existingDestinations = await destinationsCollection
      .find({}, { projection: { name: 1, slug: 1 } })
      .toArray();

    const backupPayload = {
      generatedAt: timestamp.toISOString(),
      count: existingDestinations.length,
      names: existingDestinations.map((item) => ({
        name: item.name,
        slug: item.slug || createSlug(item.name || ""),
      })),
    };

    const backupPath = path.join(backupDir, `destination-names-${formattedTimestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2), "utf8");
    console.log(`Backed up ${backupPayload.count} destination names to ${backupPath}`);

    if (backupPayload.count > 0) {
      await destinationsCollection.deleteMany({});
      console.log("Cleared destinations collection.");
    } else {
      await destinationsCollection.deleteMany({});
    }

    await trendingCollection.deleteMany({});
    console.log("Cleared trending_destinations collection.");

    let destinationDocs = [];

    if (shouldSeedCuratedDestinations) {
      destinationDocs = curatedDestinations.map((item, index) =>
        buildDestinationDocument(item, index, timestamp)
      );

      if (destinationDocs.length > 0) {
        await destinationsCollection.insertMany(destinationDocs);
        console.log(`Inserted ${destinationDocs.length} curated destinations.`);
      }

      const trendingDocs = destinationDocs.map((doc) => buildTrendingDocument(doc));
      if (trendingDocs.length > 0) {
        await trendingCollection.insertMany(trendingDocs);
        console.log(`Inserted ${trendingDocs.length} trending destination snapshots.`);
      }
    } else {
      console.log(
        "Skipped curated destination seeding. Run with --seed or set SEED_CURATED_DESTINATIONS=true to repopulate."
      );
    }

    console.log("Destination reset completed successfully.");
  } catch (error) {
    console.error("Destination reset failed:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
};

run();
