// Seed 10 India-focused trending destinations for 2025 demo grids
const { MongoClient } = require("mongodb");
require("dotenv").config();
const { enrichDestination } = require("./utils/enrichDestination");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "tourease";
const COLLECTION_NAME = "trending_destinations";

const enrichAllDestinations = async (destinations = []) => {
  for (const destination of destinations) {
    // Sequential processing to stay within rate limits of external APIs
    // eslint-disable-next-line no-await-in-loop
    await enrichDestination(destination, {
      includeRawWeather: false,
    });
  }
  return destinations;
};

const trendingSpotlightIndia2025 = [
  {
    name: "Coorg Coffee Trails",
    slug: "coorg-coffee-trails",
    category: "Hill Retreat",
    headline: "Aromas of fresh beans, misty valleys, and plantation homestays",
    description:
      "Rolling hills around Madikeri invite travelers to sip estate brews, trek hidden waterfalls, and reconnect with Kodava hospitality in Western Ghats' emerald cradle.",
    state: "Karnataka",
    country: "India",
    location: {
      city: "Madikeri",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 12.4244, lng: 75.7382 },
      timeZone: "Asia/Kolkata",
      airports: ["IXE", "MYQ"],
    },
    image:
      "https://images.unsplash.com/photo-1516637090014-cb1ab0d08fc7?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1494475673543-6a6a27143b22?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1603021532912-1d87e76e0f41?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.7,
    reviews: 58200,
    visitors: 890000,
    bestTimeToVisit: "September–March",
    climate: "Tropical highland",
    highlights: [
      "Morning estate walks with cupping sessions",
      "Abbey Falls and Mandalpatti sunrise jeep trail",
      "Nagarhole wildlife safari extensions",
      "Kodava culinary classes in heritage bungalows",
    ],
    travelTips: [
      "Layer light woollens—nights can be chilly post-monsoon",
      "Pre-book plantation stays for immersive experiences",
      "Carry reusable bottles; mountain towns limit plastic",
    ],
    experienceStyles: ["Nature", "Culinary", "Slow Travel"],
    averageBudgetPerDay: 95,
    durationRecommendation: "3-4 days",
    currency: "INR",
    primaryLanguage: "Kannada & English",
    sustainabilityNote: "Opt for estates practicing shade-grown, rainwater-harvested farming.",
    tags: ["coffee", "western ghats", "plantation"],
    source: "Karnataka Tourism 2025 insights",
    externalUrl: "https://www.karnatakatourism.org/tour-item/coorg/",
  },
  {
    name: "Kashmir Great Lakes Trek",
    slug: "kashmir-great-lakes-trek",
    category: "Adventure Trek",
    headline: "Seven alpine lakes, wildflower meadows, and celestial camps",
    description:
      "From Sonamarg to Naranag, the Great Lakes trail strings together glacier-fed bowls, shepherd hamlets, and reflections of the Pir Panjal range under starry skies.",
    state: "Jammu & Kashmir",
    country: "India",
    location: {
      city: "Sonamarg",
      state: "Jammu & Kashmir",
      country: "India",
      coordinates: { lat: 34.2926, lng: 75.2901 },
      timeZone: "Asia/Kolkata",
      airports: ["SXR"],
    },
    image:
      "https://images.unsplash.com/photo-1600276765669-9e262988cdc0?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.9,
    reviews: 18400,
    visitors: 52000,
    bestTimeToVisit: "July–September",
    climate: "Alpine",
    highlights: [
      "Crystal reflections at Vishansar and Krishansar",
      "Ridge views of twin Gadsar peaks",
      "Lunch with Gujjar shepherds beside meadows",
      "Summit postage from Gadsar Pass (4,200 m)",
    ],
    travelTips: [
      "Secure ILP permits and trek with certified operators",
      "Acclimatise in Sonamarg a day before hitting the trail",
      "Leave no trace—pack reusable cutlery and dry bags",
    ],
    experienceStyles: ["Adventure", "Photography", "Backpacking"],
    averageBudgetPerDay: 110,
    durationRecommendation: "6-8 days",
    currency: "INR",
    primaryLanguage: "Kashmiri, Urdu & English",
    sustainabilityNote: "Use bio-toilets at camps and avoid single-use oxygen canisters.",
    tags: ["trek", "alpine lakes", "pir panjal"],
    source: "Jammu & Kashmir Tourism alpine bulletin 2025",
    externalUrl: "https://www.jktdc.co.in/",
  },
  {
    name: "Rann of Kutch Midnight Desert",
    slug: "rann-of-kutch-midnight-desert",
    category: "Desert Culture",
    headline: "Salt flats, folk beats, and full-moon whiteout at the border",
    description:
      "The Great Rann transforms under moonlight with tent cities, handcrafted mirrors, and camel safaris rising out of Gujarat's salt desert expanse.",
    state: "Gujarat",
    country: "India",
    location: {
      city: "Dhordo",
      state: "Gujarat",
      country: "India",
      coordinates: { lat: 23.8123, lng: 69.1876 },
      timeZone: "Asia/Kolkata",
      airports: ["BHJ", "RAJ"],
    },
    image:
      "https://images.unsplash.com/photo-1601650613222-b26132aec6e0?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1606589097396-1a989c6cdcf0?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.6,
    reviews: 67400,
    visitors: 1080000,
    bestTimeToVisit: "November–February",
    climate: "Arid",
    highlights: [
      "White Desert festival with Kutchi folk stages",
      "Sunset ATV rides on salt-crusted plains",
      "Handicraft trails through Hodka and Nirona villages",
      "Ekal ka Rann birding at Banni grasslands",
    ],
    travelTips: [
      "Book tent city packages ahead for full-moon weekends",
      "Carry warm layers—nights dip sharply in winter",
      "Respect BSF restrictions near the border pillars",
    ],
    experienceStyles: ["Culture", "Festival", "Road Trip"],
    averageBudgetPerDay: 135,
    durationRecommendation: "3-4 days",
    currency: "INR",
    primaryLanguage: "Gujarati & Kutchi",
    sustainabilityNote: "Support artisans via certified cooperatives and avoid plastic decor.",
    tags: ["salt desert", "folk music", "tent city"],
    source: "Gujarat Tourism Rann Utsav 2025 brief",
    externalUrl: "https://www.gujarattourism.com/destination/details/1/86",
  },
  {
    name: "Havelock Azure Escape",
    slug: "havelock-azure-escape",
    category: "Island Retreat",
    headline: "Andaman blues, bioluminescent bays, and scuba memories",
    description:
      "Swaraj Dweep's powder beaches and coral shelves make it India's poster child for regenerative island tourism with eco-resorts and night-kayak tours.",
    state: "Andaman & Nicobar Islands",
    country: "India",
    location: {
      city: "Swaraj Dweep (Havelock)",
      state: "Andaman & Nicobar Islands",
      country: "India",
      coordinates: { lat: 11.982, lng: 92.986 },
      timeZone: "Asia/Kolkata",
      airports: ["IXZ"],
    },
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1505739773365-e959864af2ce?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviews: 74200,
    visitors: 640000,
    bestTimeToVisit: "October–April",
    climate: "Tropical marine",
    highlights: [
      "Sunset swim at Radhanagar's Blue Flag beach",
      "Night kayaking through glowing phytoplankton",
      "PADI-certified dives at Nemo Reef and Lighthouse",
      "Seafood pop-ups featuring island-sourced produce",
    ],
    travelTips: [
      "Ferry tickets sell fast—reserve both ways before landing",
      "Carry reef-safe sunscreen and reusable snorkel gear",
      "Network can be patchy; download maps and permits offline",
    ],
    experienceStyles: ["Beach", "Adventure", "Wellness"],
    averageBudgetPerDay: 155,
    durationRecommendation: "4-5 days",
    currency: "INR",
    primaryLanguage: "Hindi, Bengali & English",
    sustainabilityNote: "Choose resorts with coral restoration programs and waste segregation.",
    tags: ["andaman", "scuba", "bioluminescence"],
    source: "Andaman Tourism Blue Destinations 2025",
    externalUrl: "https://www.andamantourism.gov.in/",
  },
  {
    name: "Hampi Temple Circuit",
    slug: "hampi-temple-circuit",
    category: "UNESCO Heritage",
    headline: "Ruined bazaars, boulder sunsets, and coracle rides on Tungabhadra",
    description:
      "The Vijayanagara capital blends stone-carved UNESCO marvels with backpacker cafes and river island adventures amid Karnataka's dramatic boulder fields.",
    state: "Karnataka",
    country: "India",
    location: {
      city: "Hampi",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 15.335, lng: 76.461 },
      timeZone: "Asia/Kolkata",
      airports: ["HBX", "BLR"],
    },
    image:
      "https://images.unsplash.com/photo-1603262110263-fb0112e7cc33?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1610986603166-6fba880f4109?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1610986602923-7f1b0e9ac898?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.7,
    reviews: 91500,
    visitors: 1450000,
    bestTimeToVisit: "October–February",
    climate: "Semi-arid",
    highlights: [
      "Sunrise cycling through Virupaksha temple street",
      "Matanga Hill golden hour panoramas",
      "Coracle rides to Anjanadri Hill across Tungabhadra",
      "Interactive light-and-sound show at Vittala complex",
    ],
    travelTips: [
      "Hire local guides to decode Deccan iconography",
      "Wear sturdy footwear—boulder climbs get slippery at dawn",
      "Respect heritage zones; drones require ASI permission",
    ],
    experienceStyles: ["Heritage", "Backpacking", "Cycling"],
    averageBudgetPerDay: 90,
    durationRecommendation: "3-4 days",
    currency: "INR",
    primaryLanguage: "Kannada & English",
    sustainabilityNote: "Stay in homestays that contribute to restoration funds and local crafts.",
    tags: ["unesco", "bouldering", "heritage"],
    source: "Karnataka Heritage Revival 2025 dossier",
    externalUrl: "https://hampi.in/",
  },
  {
    name: "Meghalaya Living Root Bridges",
    slug: "meghalaya-living-root-bridges",
    category: "Eco Escape",
    headline: "Bio-engineered bridges, rainforest canyons, and monsoon mists",
    description:
      "Centuries-old Khasi ingenuity shapes rubber fig roots into bridges, inviting hikers to chase waterfalls, caves, and lemon grass tea through Meghalaya's rain-soaked valleys.",
    state: "Meghalaya",
    country: "India",
    location: {
      city: "Mawlynnong",
      state: "Meghalaya",
      country: "India",
      coordinates: { lat: 25.2006, lng: 91.8801 },
      timeZone: "Asia/Kolkata",
      airports: ["SHL", "GAU"],
    },
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1583912268188-5ff02bcfbf6e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1603107489550-1c0ee45d8b58?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviews: 36200,
    visitors: 670000,
    bestTimeToVisit: "October–April",
    climate: "Humid subtropical",
    highlights: [
      "Double-decker bridge hike in Nongriat",
      "Seven Sisters falls from Tyrna viewpoints",
      "Caving expeditions at Mawsmai and Arwah",
      "Living root skywalks in Mawlynnong's bamboo groves",
    ],
    travelTips: [
      "Step lightly—roots are living and need gentle footing",
      "Use certified local guides to access sacred groves",
      "Carry rainproof gear even in peak season",
    ],
    experienceStyles: ["Nature", "Community", "Adventure"],
    averageBudgetPerDay: 80,
    durationRecommendation: "3-4 days",
    currency: "INR",
    primaryLanguage: "Khasi & English",
    sustainabilityNote: "Avoid chemical insect repellents near roots; choose natural alternatives.",
    tags: ["root bridges", "waterfalls", "khasi"],
    source: "Meghalaya Responsible Tourism 2025 update",
    externalUrl: "https://www.meghalayatourism.in/",
  },
  {
    name: "Varanasi Dawn Ghats",
    slug: "varanasi-dawn-ghats",
    category: "Spiritual Trail",
    headline: "Morning aartis, silk lanes, and boat rides on the Ganga",
    description:
      "India's spiritual capital captivates with sunrise chants, handloom ateliers, and hidden courtyards echoing stories of sages and musicians.",
    state: "Uttar Pradesh",
    country: "India",
    location: {
      city: "Varanasi",
      state: "Uttar Pradesh",
      country: "India",
      coordinates: { lat: 25.3176, lng: 82.9739 },
      timeZone: "Asia/Kolkata",
      airports: ["VNS"],
    },
    image:
      "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1526481280695-3c4691990f04?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.7,
    reviews: 118500,
    visitors: 3100000,
    bestTimeToVisit: "November–March",
    climate: "Humid subtropical",
    highlights: [
      "Subah-e-Banaras melodic sunrise ceremony",
      "Boat drift past Dashashwamedh and Assi ghats",
      "Handloom trail showcasing Banarasi weavers",
      "Street food crawl featuring kachori-jalebi and blue lassi",
    ],
    travelTips: [
      "Hire licensed rowers and guides for authentic storytelling",
      "Dress modestly and respect cremation ghats from a distance",
      "Use eco earthen diyas if participating in rituals",
    ],
    experienceStyles: ["Culture", "Food", "Heritage"],
    averageBudgetPerDay: 85,
    durationRecommendation: "2-3 days",
    currency: "INR",
    primaryLanguage: "Hindi & English",
    sustainabilityNote: "Support Ganga cleanup initiatives by avoiding plastic offerings.",
    tags: ["ghats", "aartis", "banarasi silk"],
    source: "Uttar Pradesh Tourism River Heritage 2025",
    externalUrl: "https://www.uptourism.gov.in/",
  },
  {
    name: "Spiti Valley High Circuit",
    slug: "spiti-valley-high-circuit",
    category: "High-Altitude Expedition",
    headline: "Lunar landscapes, ancient monasteries, and stargazer homestays",
    description:
      "The cold desert of Himachal rewards patient travelers with fossil parks, mud monasteries, and the world's highest post office at Hikkim.",
    state: "Himachal Pradesh",
    country: "India",
    location: {
      city: "Kaza",
      state: "Himachal Pradesh",
      country: "India",
      coordinates: { lat: 32.2263, lng: 78.0615 },
      timeZone: "Asia/Kolkata",
      airports: ["KUU", "IXL"],
    },
    image:
      "https://images.unsplash.com/photo-1524492412937-4961d66aa114?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1531933892547-1b46e1577f2d?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.9,
    reviews: 29800,
    visitors: 215000,
    bestTimeToVisit: "June–September",
    climate: "Cold desert",
    highlights: [
      "Key monastery sunset chants and butter tea",
      "Chandratal lake camping under Milky Way",
      "Villager-led fossil hikes near Langza",
      "Yak safaris and apple orchard stays in Pin Valley",
    ],
    travelTips: [
      "Acclimatise in Kaza; keep hydration salts handy",
      "Carry cash—ATMs are sparse and unreliable",
      "Avoid off-roading into black ice patches during shoulder months",
    ],
    experienceStyles: ["Adventure", "Culture", "Astronomy"],
    averageBudgetPerDay: 120,
    durationRecommendation: "6-7 days",
    currency: "INR",
    primaryLanguage: "Hindi, Spitian & English",
    sustainabilityNote:
      "Stay in homestays using solar heating and bio-toilets to conserve resources.",
    tags: ["high altitude", "monasteries", "stargazing"],
    source: "Himachal Pradesh Eco-Tourism Council 2025",
    externalUrl: "https://himachaltourism.gov.in/",
  },
  {
    name: "Alleppey Backwater Slow Cruise",
    slug: "alleppey-backwater-slow-cruise",
    category: "Backwater Escape",
    headline: "Houseboats, toddy tastings, and paddy fields in Kerala",
    description:
      "Vembanad Lake's labyrinth of canals sets the stage for kettuvallam cruises, village life sessions, and Ayurvedic detox retreats along coconut-lined shores.",
    state: "Kerala",
    country: "India",
    location: {
      city: "Alappuzha",
      state: "Kerala",
      country: "India",
      coordinates: { lat: 9.4981, lng: 76.3388 },
      timeZone: "Asia/Kolkata",
      airports: ["COK", "TRV"],
    },
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600679472692-5f1c8d26ab9a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1603021532912-1d87e76e0f41?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviews: 82400,
    visitors: 2200000,
    bestTimeToVisit: "September–March",
    climate: "Tropical monsoon",
    highlights: [
      "Overnight luxury houseboat with traditional meals",
      "Village canoe rides through Kainakary's narrow canals",
      "Toddy tasting and coir making demonstrations",
      "Nehru Trophy boat race add-on during August",
    ],
    travelTips: [
      "Choose solar-powered boats to reduce diesel fumes",
      "Carry mosquito repellent and lightweight linens",
      "Book Ayurveda sessions in advance during peak months",
    ],
    experienceStyles: ["Relaxation", "Culture", "Wellness"],
    averageBudgetPerDay: 140,
    durationRecommendation: "2-3 days",
    currency: "INR",
    primaryLanguage: "Malayalam & English",
    sustainabilityNote: "Ensure operators segregate waste and avoid plastic on the backwaters.",
    tags: ["houseboat", "ayurveda", "backwaters"],
    source: "Kerala Responsible Tourism Mission 2025",
    externalUrl: "https://www.keralatourism.org/",
  },
  {
    name: "Jaipur Heritage Palette",
    slug: "jaipur-heritage-palette",
    category: "Royal Getaway",
    headline: "Pink facades, palace stays, and rooftop bazaars in Rajasthan",
    description:
      "The Pink City dazzles with illuminated forts, design-forward boutiques, and culinary walks celebrating royal Rajasthani kitchens and craft guilds.",
    state: "Rajasthan",
    country: "India",
    location: {
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      coordinates: { lat: 26.9124, lng: 75.7873 },
      timeZone: "Asia/Kolkata",
      airports: ["JAI"],
    },
    image:
      "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1526481280695-3c4691990f04?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviews: 132000,
    visitors: 3400000,
    bestTimeToVisit: "October–March",
    climate: "Semi-arid",
    highlights: [
      "Sound-and-light spectacle at Amer Fort",
      "Night heritage walk through Johri Bazaar's gemstones",
      "Block-print studios in Sanganer and Bagru",
      "Craft cocktails at repurposed havelis in Nahargarh",
    ],
    travelTips: [
      "Pre-book palace museum slots to skip weekend queues",
      "Hire registered guides—rates fixed by RTDC",
      "Stay hydrated; afternoons can be dry even in winter",
    ],
    experienceStyles: ["Heritage", "Shopping", "Culinary"],
    averageBudgetPerDay: 130,
    durationRecommendation: "3-4 days",
    currency: "INR",
    primaryLanguage: "Hindi & English",
    sustainabilityNote: "Choose e-rickshaws or metros to cut emissions inside the walled city.",
    tags: ["forts", "bazaars", "royal cuisine"],
    source: "Rajasthan Tourism Craft Revival 2025",
    externalUrl: "https://www.tourism.rajasthan.gov.in/",
  },
];

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function seedTrendingDemoData() {
  await enrichAllDestinations(trendingSpotlightIndia2025);
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Ensure indexes for quick lookups (ignore conflicts if already present)
    try {
      await collection.createIndex({ trending: 1, trendingRank: 1 });
    } catch (indexError) {
      console.warn("⚠️  Skipped creating trending index:", indexError.message);
    }

    try {
      await collection.createIndex({ name: 1 }, { unique: true, sparse: false });
    } catch (indexError) {
      console.warn("⚠️  Skipped creating name index:", indexError.message);
    }

    const now = new Date();
    let insertedCount = 0;
    let updatedCount = 0;

    for (let index = 0; index < trendingSpotlightIndia2025.length; index += 1) {
      const destination = trendingSpotlightIndia2025[index];
      const normalizedState =
        destination.state ||
        destination.location?.state ||
        destination.location?.region ||
        destination.location?.country ||
        destination.country;

      const normalized = {
        ...destination,
        slug: destination.slug || slugify(destination.name),
        state: normalizedState,
        trending: true,
        trendingRank: destination.trendingRank ?? index + 1,
        tags: destination.tags || [],
        gallery: destination.gallery || [],
        experienceStyles: destination.experienceStyles || [],
        createdBy: destination.createdBy || "seed:demo-india-2025",
        updatedAt: now,
      };

      const { createdAt = now, ...rest } = normalized;

      const result = await collection.updateOne(
        { name: normalized.name },
        {
          $set: rest,
          $setOnInsert: {
            createdAt,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        insertedCount += 1;
      } else if (result.modifiedCount > 0) {
        updatedCount += 1;
      }
    }

    console.log("============================================================");
    console.log("🌍 Trending Destinations Demo Seed Complete");
    console.log(`   ➕ Inserted: ${insertedCount}`);
    console.log(`   ♻️  Updated: ${updatedCount}`);
    console.log("   Collection:", COLLECTION_NAME);
    console.log("   Database:", DB_NAME);
    console.log("============================================================\n");
  } catch (error) {
    console.error("❌ Failed to seed trending destinations:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seedTrendingDemoData();
