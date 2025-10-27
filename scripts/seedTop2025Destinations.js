/*
 * Seed script: Top 10 Indian destinations for 2025
 *
 * This script relies on the existing /api/destinations/ingest endpoint to fetch
 * Geoapify, Unsplash, and weather-backed data, then enriches each record with
 * curated copy sourced from the TravelTriangle "108 Must-Visit Destinations in India Before You Turn 30" list
 * (updated February 11, 2025).
 *
 * Usage:
 *   1. Ensure the API server is running locally (default: http://localhost:5000).
 *   2. Set MONGODB_URI / DB_NAME in server/.env if they differ from defaults.
 *   3. From the repo root run: node server/scripts/seedTop2025Destinations.js
 *
 * The script is idempotent: repeated runs will refresh curated fields without duplicating documents.
 */

const path = require("path");
const axios = require("axios");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "tourease";

const SOURCE_URL = "https://traveltriangle.com/blog/places-to-visit-in-india-before-you-turn-30/";

const curatedDestinations = [
  {
    rank: 1,
    query: "Goa, India",
    category: "Beach Escape",
    rating: 4.8,
    bestTimeToVisit: "November to February",
    entryFee: "Public beaches are free; activities priced separately",
    summary:
      "Pristine beaches, Portuguese quarters, and a nightlife that stretches from Anjuna to Palolem make Goa India's perennial coastal favourite.",
    highlights: [
      "Beach-hop between Anjuna, Vagator, Palolem, and Butterfly Beach",
      "Kayak or snorkel in the calmer backwaters of South Goa",
      "Browse the Anjuna Flea Market and savour fresh seafood shack-side",
    ],
    nearbyAttractions: [
      {
        name: "Fort Aguada",
        description:
          "17th-century fortification overlooking the Arabian Sea with sunset panoramas.",
      },
      {
        name: "Dudhsagar Falls",
        description:
          "A four-tiered waterfall on the Goa-Karnataka border popular for monsoon jeep safaris.",
      },
    ],
    recommendedDuration: "4-6 days",
    tags: ["2025", "beach", "culture", "nightlife"],
  },
  {
    rank: 2,
    query: "Havelock Island, Andaman and Nicobar Islands",
    category: "Island Retreat",
    rating: 4.7,
    bestTimeToVisit: "November to mid-May",
    entryFee: "Protected beaches are free; scuba and cruises billed separately",
    summary:
      "Bioluminescent shores, coral gardens, and laid-back island life have kept the Andaman archipelago on every 2025 travel wishlist.",
    highlights: [
      "Snorkel or dive at Elephant Beach to spot vibrant coral reefs",
      "Kayak through the glowing mangroves on a bioluminescence tour",
      "Cruise from Port Blair to Neil Island for a slow island hop",
    ],
    nearbyAttractions: [
      {
        name: "Radhanagar Beach",
        description: "Blue Flag-certified beach famed for powder-soft sand and pastel sunsets.",
      },
      {
        name: "Kalapathar Beach",
        description: "Rocky black boulders flanking an emerald lagoon ideal for sunrise walks.",
      },
    ],
    recommendedDuration: "5-7 days",
    tags: ["2025", "islands", "adventure", "snorkelling"],
  },
  {
    rank: 3,
    query: "Mumbai, Maharashtra",
    category: "Urban Getaway",
    rating: 4.6,
    bestTimeToVisit: "November to February",
    entryFee: "Landmarks largely free; museum entries ₹20-₹500",
    summary:
      "India's city that never sleeps pairs Art Deco skylines, seaside promenades, and Bollywood buzz for an energetic 2025 escape.",
    highlights: [
      "Sunset strolls along Marine Drive and Worli Sea Face",
      "Ferry to Elephanta Caves for UNESCO-listed basalt sculptures",
      "Sample street eats from vada pav to late-night kebabs in Mohammed Ali Road",
    ],
    nearbyAttractions: [
      {
        name: "Gateway of India",
        description:
          "Iconic Indo-Saracenic arch facing the Arabian Sea, gateway to coastal ferries.",
      },
      {
        name: "Chhatrapati Shivaji Maharaj Terminus",
        description:
          "Victorian Gothic UNESCO station and Bollywood favourite for architectural walks.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "city", "food", "heritage"],
  },
  {
    rank: 4,
    query: "Alleppey, Kerala",
    category: "Backwater Escape",
    rating: 4.7,
    bestTimeToVisit: "October to February",
    entryFee: "Houseboats from ₹6,000/night; backwater entry free",
    summary:
      "Kerala's emerald backwaters promise languid houseboat cruises, Ayurvedic retreats, and vibrant ecotourism for 2025 travellers.",
    highlights: [
      "Overnight aboard a kettuvallam houseboat on Vembanad Lake",
      "Kayak through coconut-fringed canals at sunrise",
      "Spot migratory birds at Kumarakom Bird Sanctuary",
    ],
    nearbyAttractions: [
      {
        name: "Marari Beach",
        description: "Quiet fishing village shoreline perfect for hammock downtime.",
      },
      {
        name: "Kumarakom",
        description: "Lakeside village known for birdlife, toddy shops, and sunset shikara rides.",
      },
    ],
    recommendedDuration: "3-5 days",
    tags: ["2025", "kerala", "backwaters", "wellness"],
  },
  {
    rank: 5,
    query: "Visakhapatnam, Andhra Pradesh",
    category: "Coastal City",
    rating: 4.5,
    bestTimeToVisit: "September to March",
    entryFee: "Beach access free; museum tickets ₹50-₹200",
    summary:
      "Vizag blends cliffside beaches, submarine museums, and Eastern Ghats viewpoints—one of India's surprise all-rounders for 2025.",
    highlights: [
      "Ride the Kailasagiri ropeway for sweeping Bay of Bengal views",
      "Tour the INS Kursura Submarine Museum for naval history",
      "Unwind on the golden curve of Rushikonda Beach",
    ],
    nearbyAttractions: [
      {
        name: "Araku Valley",
        description:
          "Cool highland getaway two hours inland with tribal culture and coffee plantations.",
      },
      {
        name: "Borra Caves",
        description:
          "Spectacular limestone caverns lit with colour, nestled in the Ananthagiri Hills.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "beach", "eastern ghats", "culture"],
  },
  {
    rank: 6,
    query: "Srinagar, Jammu and Kashmir",
    category: "Lake Retreat",
    rating: 4.8,
    bestTimeToVisit: "April to October",
    entryFee: "Gardens ₹20-₹200; shikara rides from ₹700/hour",
    summary:
      "Willow-lined lakes, Mughal gardens, and snow-dusted Himalayan views keep Srinagar atop 2025 bucket lists.",
    highlights: [
      "Float across Dal Lake in a hand-painted shikara",
      "Stay overnight in a cedarwood houseboat with kahwah at dawn",
      "Wander Mughal-era Shalimar and Nishat Gardens",
    ],
    nearbyAttractions: [
      {
        name: "Gulmarg",
        description: "Premier ski and meadow resort one scenic gondola ride away.",
      },
      {
        name: "Pahalgam",
        description: "Lidder Valley base for trout fishing, pine walks, and Amarnath trek routes.",
      },
    ],
    recommendedDuration: "4-5 days",
    tags: ["2025", "himalayas", "lakes", "nature"],
  },
  {
    rank: 7,
    query: "Leh, Ladakh",
    category: "High-Altitude Adventure",
    rating: 4.9,
    bestTimeToVisit: "May to September",
    entryFee: "Monastery entry ₹30-₹200; permits required for select valleys",
    summary:
      "Trans-Himalayan passes, turquoise lakes, and monastery trails cement Leh-Ladakh as 2025's ultimate adventure circuit.",
    highlights: [
      "Road trip over Khardung La en route to Nubra Valley",
      "Witness the changing palette of Pangong Tso",
      "Explore Thiksey and Hemis monasteries at sunrise",
    ],
    nearbyAttractions: [
      {
        name: "Nubra Valley",
        description: "Cold desert with double-humped Bactrian camels and sand dunes.",
      },
      {
        name: "Sham Valley",
        description: "Easy hiking circuit dotted with Likir Monastery and confluence viewpoints.",
      },
    ],
    recommendedDuration: "6-8 days",
    tags: ["2025", "himalayas", "roadtrip", "monasteries"],
  },
  {
    rank: 8,
    query: "Darjeeling, West Bengal",
    category: "Tea Highlands",
    rating: 4.6,
    bestTimeToVisit: "February to March & September to December",
    entryFee: "Toy train ₹1,500-₹3,000; gardens ₹50-₹200",
    summary:
      "Mist-laden tea slopes, Kanchenjunga dawn views, and colonial promenades define Darjeeling's 2025 appeal.",
    highlights: [
      "Catch sunrise over Kanchenjunga from Tiger Hill",
      "Ride the Darjeeling Himalayan Railway to Ghum",
      "Sip single-estate brews on tea garden tastings",
    ],
    nearbyAttractions: [
      {
        name: "Batasia Loop",
        description: "Engineering marvel offering circular vistas of the eastern Himalayas.",
      },
      {
        name: "Mirik Lake",
        description: "Quiet day trip for boating amid pine forests and orange orchards.",
      },
    ],
    recommendedDuration: "4-5 days",
    tags: ["2025", "tea", "heritage", "himalayas"],
  },
  {
    rank: 9,
    query: "Jaipur, Rajasthan",
    category: "Royal Heritage",
    rating: 4.7,
    bestTimeToVisit: "November to March",
    entryFee: "Palace tickets ₹200-₹1,000; combo passes available",
    summary:
      "Pink-hued palaces, balloon rides, and regal bazaars make Jaipur the quintessential royal escape for 2025.",
    highlights: [
      "Scale the ramparts of Amer Fort at dawn",
      "Shop gemstones and block prints in Johari and Bapu Bazaars",
      "Take a hot-air balloon ride over desert villages",
    ],
    nearbyAttractions: [
      {
        name: "Nahargarh Fort",
        description: "Hilltop fort best at sunset with sweeping views of Jaipur's city lights.",
      },
      {
        name: "Chand Baori",
        description: "Rajasthan's most intricate stepwell located in the village of Abhaneri.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "heritage", "architecture", "shopping"],
  },
  {
    rank: 10,
    query: "Varanasi, Uttar Pradesh",
    category: "Spiritual Trail",
    rating: 4.6,
    bestTimeToVisit: "October to February",
    entryFee: "Ghat access free; boat rides from ₹150",
    summary:
      "Timeless Ganga aartis, labyrinthine alleys, and silk weavers keep Varanasi essential for 2025 culture seekers.",
    highlights: [
      "Attend the Ganga Aarti at Dashashwamedh Ghat",
      "Cruise the river at sunrise for ghats glowing gold",
      "Explore Sarnath's Buddhist stupas on a short hop",
    ],
    nearbyAttractions: [
      {
        name: "Sarnath",
        description: "Buddha's first sermon site with Dhamek Stupa and serene monasteries.",
      },
      {
        name: "Ramnagar Fort",
        description:
          "18th-century riverside fort housing royal artefacts and a vintage car museum.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "spiritual", "ganges", "culture"],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const client = new MongoClient(MONGODB_URI, { useUnifiedTopology: true });
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db(DB_NAME);
    const destinationsCollection = db.collection("destinations");

    for (const destinationConfig of curatedDestinations) {
      console.log(`\n➡️  Processing #${destinationConfig.rank}: ${destinationConfig.query}`);

      try {
        const ingestResponse = await axios.post(
          `${SERVER_URL}/api/destinations/ingest`,
          { query: destinationConfig.query, force: true },
          { timeout: 1000 * 60 * 2 }
        );

        const destination = ingestResponse.data?.destination;
        if (!destination || !destination._id) {
          console.warn("⚠️  Ingest response did not return a destination document.");
          continue;
        }

        const updatePayload = {
          category: destinationConfig.category,
          rating: destinationConfig.rating,
          bestTimeToVisit: destinationConfig.bestTimeToVisit,
          entryFee: destinationConfig.entryFee,
          summary: destinationConfig.summary,
          curatedHighlights: destinationConfig.highlights,
          nearbyAttractions: destinationConfig.nearbyAttractions,
          recommendedDuration: destinationConfig.recommendedDuration,
          tags: Array.from(new Set([...(destination.tags || []), ...destinationConfig.tags])),
          trending: true,
          trendingRank: destinationConfig.rank,
          ranking2025: destinationConfig.rank,
          curatedBy: {
            label: "Top India Destinations 2025",
            source: SOURCE_URL,
            compiledAt: new Date(),
          },
          sources: [
            {
              label: "TravelTriangle 2025 India list",
              url: SOURCE_URL,
              retrievedAt: new Date(),
            },
          ],
          updatedAt: new Date(),
        };

        await destinationsCollection.updateOne(
          { _id: new ObjectId(destination._id) },
          {
            $set: updatePayload,
            $setOnInsert: { createdAt: new Date() },
          }
        );

        console.log(`   ✅ Seeded and enriched ${destination.name}`);

        // Small delay to stay polite with upstream APIs
        await sleep(1500);
      } catch (error) {
        const message =
          error.response?.data?.error || error.message || "Unknown error during ingestion";
        console.error(`   ❌ Failed to process ${destinationConfig.query}: ${message}`);
      }
    }

    console.log("\n🎉 Completed Top 2025 destinations seeding.\n");
  } catch (error) {
    console.error("🚨 Script failed:", error);
  } finally {
    await client.close();
  }
}

main();
