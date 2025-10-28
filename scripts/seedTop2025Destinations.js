/*
 * Seed script: Top 25 Indian destinations for 2025
 *
 * This script relies on the existing /api/destinations/ingest endpoint to fetch
 * Geoapify, Unsplash, and weather-backed data, then enriches each record with
 * curated copy.
 *
 * Usage:
 * 1. Ensure your local .env file (server/.env) has all API keys:
 * - MONGODB_URI (pointing to your Atlas cluster)
 * - GEOAPIFY_API_KEY
 * - UNSPLASH_ACCESS_KEY
 * - OPENWEATHER_API_KEY
 * 2. Ensure your local server is running (npm run start in /server)
 * 3. From the repo root run: node server/scripts/seedTop2025Destinations.js
 */

const path = require("path");
const axios = require("axios");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Make sure your local server is running on port 10000 (or change this)
const SERVER_URL = process.env.SERVER_URL || "http://localhost:10000";
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "tourease";

if (!MONGODB_URI) {
  console.error(
    "🚨 MONGODB_URI is not defined in your .env file. Point it to your MongoDB Atlas cluster."
  );
  process.exit(1);
}

const SOURCE_URL = "https://traveltriangle.com/blog/places-to-visit-in-india-before-you-turn-30/";

const curatedDestinations = [
  // Your Original Top 10
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

  // New 15 Destinations
  {
    rank: 11,
    query: "Rishikesh, Uttarakhand",
    category: "Adventure & Spirituality",
    rating: 4.7,
    bestTimeToVisit: "September to November & March to May",
    entryFee: "Activities (rafting, bungee) priced individually",
    summary:
      "The 'Yoga Capital of the World' and a hub for white-water rafting, bridging spiritual ghats with thrilling Himalayan adventure.",
    highlights: [
      "White-water rafting on the Ganges (Rapids Grade I-IV)",
      "Bungee jumping from India's highest platform",
      "Attend the evening Ganga Aarti at Parmarth Niketan",
    ],
    nearbyAttractions: [
      {
        name: "Lakshman Jhula & Ram Jhula",
        description: "Iconic suspension bridges offering panoramic views of the river and temples.",
      },
      {
        name: "The Beatles Ashram",
        description: "Explore the graffiti-covered ruins of the Maharishi Mahesh Yogi's ashram.",
      },
    ],
    recommendedDuration: "3-5 days",
    tags: ["2025", "adventure", "yoga", "spiritual", "ganges"],
  },
  {
    rank: 12,
    query: "Jaisalmer, Rajasthan",
    category: "Desert Heritage",
    rating: 4.6,
    bestTimeToVisit: "October to March",
    entryFee: "Fort entry free; Desert Safari from ₹1,500",
    summary:
      "A 'Golden City' rising from the Thar Desert, known for its living fort, ornate havelis, and magical desert safaris.",
    highlights: [
      "Camel safari to the Sam Sand Dunes for a sunset and cultural night",
      "Explore the narrow lanes of the Jaisalmer Fort (a living fort)",
      "Visit the intricately carved Patwon Ki Haveli",
    ],
    nearbyAttractions: [
      {
        name: "Gadisar Lake",
        description:
          "A serene artificial lake surrounded by temples and shrines, perfect for boating.",
      },
      {
        name: "Kuldhara Village",
        description: "An abandoned, haunted village with a mysterious history.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "desert", "rajasthan", "heritage", "forts"],
  },
  {
    rank: 13,
    query: "Udaipur, Rajasthan",
    category: "Royal Lakes",
    rating: 4.8,
    bestTimeToVisit: "September to March",
    entryFee: "City Palace entry ₹300",
    summary:
      "The 'City of Lakes,' famed for its romantic, shimmering lakes, opulent palaces, and vibrant arts scene.",
    highlights: [
      "Boat ride on Lake Pichola to see the Jag Mandir and Lake Palace",
      "Tour the magnificent City Palace complex",
      "Attend a traditional Rajasthani cultural show at Bagore Ki Haveli",
    ],
    nearbyAttractions: [
      {
        name: "Sajjangarh Monsoon Palace",
        description: "A mountaintop palace offering breathtaking sunset views over the city.",
      },
      {
        name: "Kumbhalgarh Fort",
        description: "A UNESCO World Heritage Site with the second-longest wall in the world.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "lakes", "royal", "rajasthan", "romantic"],
  },
  {
    rank: 14,
    query: "Amritsar, Punjab",
    category: "Spiritual & History",
    rating: 4.9,
    bestTimeToVisit: "October to March",
    entryFee: "Golden Temple is free; Wagah Border ceremony is free",
    summary:
      "The spiritual heart of Sikhism, home to the magnificent Golden Temple and the patriotic energy of the Wagah Border.",
    highlights: [
      "Experience the serene beauty of the Golden Temple at dawn",
      "Witness the high-energy Wagah Border closing ceremony",
      "Visit the Jallianwala Bagh memorial",
    ],
    nearbyAttractions: [
      {
        name: "Partition Museum",
        description: "The world's first museum dedicated to the 1947 Partition of India.",
      },
      {
        name: "Gobindgarh Fort",
        description: "A historic fort showcasing Punjabi culture, history, and cuisine.",
      },
    ],
    recommendedDuration: "2-3 days",
    tags: ["2025", "spiritual", "history", "punjab", "temples"],
  },
  {
    rank: 15,
    query: "Manali, Himachal Pradesh",
    category: "Mountain Adventure",
    rating: 4.5,
    bestTimeToVisit: "May to July (Summer) & December to February (Snow)",
    entryFee: "Permits required for Rohtang Pass",
    summary:
      "A high-altitude Himalayan resort town, serving as a gateway for adventure sports in Solang Valley and the journey to Ladakh.",
    highlights: [
      "Paragliding and skiing in Solang Valley",
      "Drive to Rohtang Pass for snow-capped peaks (May-Oct)",
      "Explore the cafes and markets of Old Manali",
    ],
    nearbyAttractions: [
      {
        name: "Hadimba Devi Temple",
        description: "An ancient cave temple surrounded by a cedar forest.",
      },
      {
        name: "Atal Tunnel",
        description: "The world's longest highway tunnel above 10,000 feet.",
      },
    ],
    recommendedDuration: "4-5 days",
    tags: ["2025", "himalayas", "adventure", "mountains", "skiing"],
  },
  {
    rank: 16,
    query: "Munnar, Kerala",
    category: "Tea Highlands",
    rating: 4.7,
    bestTimeToVisit: "September to March",
    entryFee: "Tea gardens and parks entry ₹100-₹300",
    summary:
      "A breathtaking landscape of rolling hills carpeted in emerald-green tea plantations, mist, and cool mountain air.",
    highlights: [
      "Visit a tea factory to learn about tea processing",
      "Hike to Top Station for views above the clouds",
      "Spot the Nilgiri Tahr at Eravikulam National Park",
    ],
    nearbyAttractions: [
      {
        name: "Mattupetty Dam",
        description: "A picturesque dam popular for boating and its surrounding tea gardens.",
      },
      {
        name: "Kolukkumalai Tea Estate",
        description:
          "The world's highest organic tea plantation, accessible by a scenic jeep ride.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "tea", "kerala", "nature", "western ghats"],
  },
  {
    rank: 17,
    query: "Agra, Uttar Pradesh",
    category: "Iconic Heritage",
    rating: 4.8,
    bestTimeToVisit: "October to March",
    entryFee: "Taj Mahal entry ₹250 (Indians), ₹1300 (Foreigners)",
    summary:
      "Home to the world's most famous monument to love, the Taj Mahal, and a rich history of Mughal architecture.",
    highlights: [
      "Witness the Taj Mahal at sunrise or sunset",
      "Explore the vast and historic Agra Fort (UNESCO)",
      "Visit the exquisite tomb of Itmad-ud-Daulah (Baby Taj)",
    ],
    nearbyAttractions: [
      {
        name: "Fatehpur Sikri",
        description: "A perfectly preserved 16th-century Mughal capital city, now a UNESCO site.",
      },
      {
        name: "Mehtab Bagh (Moonlight Garden)",
        description: "A garden across the river offering a serene, symmetrical view of the Taj.",
      },
    ],
    recommendedDuration: "2 days",
    tags: ["2025", "heritage", "unesco", "taj mahal", "mughal"],
  },
  {
    rank: 18,
    query: "Puducherry",
    category: "French-Colonial Coast",
    rating: 4.6,
    bestTimeToVisit: "October to March",
    entryFee: "Beaches and ashram are free",
    summary:
      "A quaint coastal town with a unique blend of French colonial heritage, spiritual ashrams, and Tamil culture.",
    highlights: [
      "Stroll through the bougainvillea-lined streets of the French Quarter (White Town)",
      "Visit the Sri Aurobindo Ashram and the utopian city of Auroville",
      "Relax on Promenade Beach and see the French War Memorial",
    ],
    nearbyAttractions: [
      {
        name: "Auroville Matrimandir",
        description: "A golden spherical dome for silent concentration, the soul of the city.",
      },
      {
        name: "Paradise Beach",
        description: "A beautiful and clean beach accessible by a short boat ride.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "french", "coastal", "spiritual", "culture"],
  },
  {
    rank: 19,
    query: "Shillong, Meghalaya",
    category: "Northeast Hills",
    rating: 4.7,
    bestTimeToVisit: "March to June & September to November",
    entryFee: "Parks and waterfalls entry ₹20-₹100",
    summary:
      "The 'Scotland of the East,' known for its rolling hills, pine forests, vibrant music scene, and stunning waterfalls.",
    highlights: [
      "Boating on Umiam Lake (Barapani)",
      "Visit Elephant Falls and Sweet Falls",
      "Explore the cafes and live music venues",
    ],
    nearbyAttractions: [
      {
        name: "Cherrapunji (Sohra)",
        description:
          "Once the wettest place on Earth, famous for its living root bridges and caves.",
      },
      {
        name: "Mawlynnong",
        description: "Acclaimed as 'Asia's Cleanest Village' with a skywalk over the forest.",
      },
    ],
    recommendedDuration: "4-5 days (including day trips)",
    tags: ["2025", "northeast", "nature", "waterfalls", "music"],
  },
  {
    rank: 20,
    query: "Rann of Kutch, Gujarat",
    category: "Unique Landscape",
    rating: 4.8,
    bestTimeToVisit: "November to February (during Rann Utsav)",
    entryFee: "Permit required (approx. ₹100 per person)",
    summary:
      "A vast, surreal salt marsh in the Thar Desert that transforms into a white wonderland under the full moon.",
    highlights: [
      "Experience the Rann Utsav, a vibrant festival of music, culture, and crafts",
      "Watch the sunset or moonrise over the endless white salt desert",
      "Visit the highest point, Kalo Dungar (Black Hill), for a panoramic view",
    ],
    nearbyAttractions: [
      {
        name: "Dholavira",
        description: "A UNESCO World Heritage Site, the ruins of an ancient Harappan city.",
      },
      {
        name: "Mandvi Beach",
        description: "A pristine beach with a historic 400-year-old shipbuilding yard.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "desert", "unique", "culture", "festival"],
  },
  {
    rank: 21,
    query: "Kolkata, West Bengal",
    category: "Cultural Capital",
    rating: 4.5,
    bestTimeToVisit: "October to March",
    entryFee: "Victoria Memorial entry ₹30",
    summary:
      "India's 'City of Joy,' a soulful city with colonial architecture, a rich literary history, and incredible street food.",
    highlights: [
      "Visit the iconic Victoria Memorial and Howrah Bridge",
      "Explore the traditional potters' colony of Kumartuli",
      "Savor street food like puchka, kathi rolls, and mishti doi",
    ],
    nearbyAttractions: [
      {
        name: "Sundarbans National Park",
        description: "The world's largest mangrove forest, home to the Royal Bengal Tiger.",
      },
      {
        name: "Dakshineswar Kali Temple",
        description:
          "A revered Hindu temple dedicated to Goddess Kali on the banks of the Hooghly.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "city", "culture", "food", "heritage"],
  },
  {
    rank: 22,
    query: "Ooty, Tamil Nadu",
    category: "Hill Station",
    rating: 4.4,
    bestTimeToVisit: "March to June & September to November",
    entryFee: "Botanical Gardens entry ₹30",
    summary:
      "The 'Queen of Hill Stations,' a popular colonial-era retreat known for its toy train, botanical gardens, and tea estates.",
    highlights: [
      "Ride the Nilgiri Mountain Railway (Toy Train), a UNESCO site",
      "Explore the Government Botanical Gardens",
      "Boating on Ooty Lake",
    ],
    nearbyAttractions: [
      {
        name: "Doddabetta Peak",
        description:
          "The highest peak in the Nilgiris, offering stunning views of the surrounding hills.",
      },
      {
        name: "Coonoor",
        description:
          "A smaller, quieter hill station nearby, famous for Sim's Park and tea gardens.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "hill station", "tea", "colonial", "nature"],
  },
  {
    rank: 23,
    query: "Tirupati, Andhra Pradesh",
    category: "Pilgrimage",
    rating: 4.9,
    bestTimeToVisit: "September to February",
    entryFee: "Free darshan; Special entry (Seeghra) darshan ₹300",
    summary:
      "Home to the world-renowned Tirumala Venkateswara Temple, one of the richest and most visited pilgrimage sites on Earth.",
    highlights: [
      "Seek blessings at the Tirumala Venkateswara Temple",
      "Visit the Sri Padmavathi Ammavari Temple",
      "Take a holy dip in the Swami Pushkarini tank",
    ],
    nearbyAttractions: [
      {
        name: "Talakona Waterfalls",
        description: "The highest waterfall in Andhra Pradesh, located in a scenic forest reserve.",
      },
      {
        name: "Sri Kalyana Venkateswara Swamy Temple",
        description:
          "A historic temple in Srinivasa Mangapuram, visited by devotees before Tirumala.",
      },
    ],
    recommendedDuration: "2-3 days",
    tags: ["2025", "temples", "spiritual", "pilgrimage", "heritage"],
  },
  {
    rank: 24,
    query: "Khajuraho, Madhya Pradesh",
    category: "UNESCO World Heritage",
    rating: 4.7,
    bestTimeToVisit: "October to March",
    entryFee: "Western Group of Temples entry ₹40 (Indians), ₹600 (Foreigners)",
    summary:
      "World-famous for its stunning groups of temples, adorned with intricate and erotic rock carvings from the Chandela dynasty.",
    highlights: [
      "Explore the Western Group of Temples (UNESCO site)",
      "Visit the Eastern and Southern Groups for Jain and other temples",
      "Attend the sound and light show in the evening",
    ],
    nearbyAttractions: [
      {
        name: "Raneh Falls",
        description:
          "A dramatic canyon carved by the Ken River, often called the 'Grand Canyon of India'.",
      },
      {
        name: "Panna National Park",
        description: "A prominent tiger reserve, ideal for a wildlife safari.",
      },
    ],
    recommendedDuration: "2-3 days",
    tags: ["2025", "temples", "unesco", "architecture", "heritage"],
  },
  {
    rank: 25,
    query: "Hampi, Karnataka",
    category: "UNESCO World Heritage",
    rating: 4.8,
    bestTimeToVisit: "November to February",
    entryFee: "Vittala Temple complex entry ₹40 (Indians), ₹600 (Foreigners)",
    summary:
      "A vast, boulder-strewn landscape of ruins from the 14th-century Vijayanagara Empire, a captivating open-air museum.",
    highlights: [
      "Marvel at the Stone Chariot and musical pillars of Vittala Temple",
      "Climb Matanga Hill for a panoramic sunrise over the ruins",
      "Explore the Virupaksha Temple, which is still in active use",
    ],
    nearbyAttractions: [
      {
        name: "Anegundi",
        description:
          "An ancient, quieter village across the river, believed to be the monkey kingdom of Kishkindha.",
      },
      {
        name: "Tungabhadra Dam",
        description: "A large dam offering scenic views and a musical fountain show.",
      },
    ],
    recommendedDuration: "3-4 days",
    tags: ["2025", "unesco", "heritage", "ruins", "temples"],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const client = new MongoClient(MONGODB_URI, { useUnifiedTopology: true });
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");

    const db = client.db(DB_NAME);
    const destinationsCollection = db.collection("destinations");

    // Before we start, make sure the local server is running
    try {
      await axios.get(`${SERVER_URL}/api/health`); // Assuming you have a /health endpoint
      console.log(`✅ Connected to local server at ${SERVER_URL}`);
    } catch (e) {
      console.error(`🚨 CRITICAL: Cannot connect to your local server at ${SERVER_URL}.`);
      console.error(
        "Please start your local server (npm run start) in another terminal before running this script."
      );
      await client.close();
      return;
    }

    for (const destinationConfig of curatedDestinations) {
      console.log(`\n➡️  Processing #${destinationConfig.rank}: ${destinationConfig.query}`);

      try {
        const ingestResponse = await axios.post(
          `${SERVER_URL}/api/destinations/ingest`,
          { query: destinationConfig.query, force: true },
          { timeout: 1000 * 60 * 2 } // 2 minute timeout
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
        // === THIS IS THE FIX ===
        // This will now print the FULL error details, helping us find the real problem.
        console.error(
          `   ❌ Failed to process ${destinationConfig.query}: `,
          error.response ? error.response.data : error
        );
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
