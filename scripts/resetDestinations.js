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

const curatedDestinations = [
  {
    name: "Mysuru Palace",
    query: "Mysuru Palace, Karnataka",
    category: "Royal Heritage",
    headline: "Illuminated arches, gilded halls, and Wadiyar-era grandeur",
    description:
      "The Amba Vilas Palace is the ceremonial heart of Mysuru, shimmering with Belgian crystal chandeliers, teak ceilings, and Dussehra folklore. Evening light shows set the Indo-Saracenic facade ablaze and narrate the city’s royal chronicle.",
    location: {
      formatted: "Mysuru Palace, Sayyaji Rao Road, Mysuru, Karnataka 570001, India",
      name: "Mysuru Palace",
      city: "Mysuru",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 12.3052, lng: 76.6552 },
      timezone: "Asia/Kolkata",
    },
    heroImage: {
      url: "https://images.unsplash.com/photo-1581873372798-8eb29bbd65bd?auto=format&fit=crop&w=1600&q=80",
      attribution: "Photo by Girish Dalvi on Unsplash",
      source: "unsplash",
    },
    mapImage: null,
    highlights: [
      "Sound-and-light show every evening",
      "Durbar Hall with stained-glass ceiling",
      "Golden Throne unveiled during Dussehra",
    ],
    bestTimeToVisit: "October to March",
    entryFee: "₹100 Indians, ₹300 Foreign visitors",
    rating: 4.7,
    reviews: 112000,
    visitors: 3500000,
    nearbyAttractions: [
      {
        name: "Chamundi Hill Temple",
        distance: "13 km",
        description:
          "Panoramic views of Mysuru and a revered 17th-century shrine dedicated to Chamundeshwari.",
      },
      {
        name: "St. Philomena’s Cathedral",
        distance: "3 km",
        description: "Neo-Gothic spires inspired by Cologne Cathedral, built in 1936.",
      },
    ],
    hotels: [
      {
        name: "Radisson Blu Plaza Hotel Mysore",
        rating: 4.6,
        address: "1 MG Road, JC Nagar, Mysuru",
        description: "Five-star stay with Chamundi Hill views and an infinity pool.",
        contact: "+91-821-7101234",
        website: "https://www.radissonhotels.com/en-us/hotels/radisson-blu-mysore",
      },
      {
        name: "Royal Orchid Metropole",
        rating: 4.5,
        address: "5 Jhansi Lakshmi Bai Road, Mysuru",
        description: "Colonial heritage hotel set amidst landscaped courtyards.",
        contact: "+91-821-4255555",
        website: "https://www.royalorchidhotels.com/royal-orchid-metropole-mysore/overview",
      },
    ],
    restaurants: [
      {
        name: "Vinayaka Mylari",
        specialty: "Soft benne dosas served since 1938",
        address: "Ittigegud, Mysuru",
      },
      {
        name: "The Old House",
        specialty: "Wood-fired pizzas and artisanal coffee in a restored bungalow",
        address: "Siddhartha Layout, Mysuru",
      },
    ],
    tags: ["heritage", "palace", "mysuru", "dussehra"],
    travelTips: [
      "Arrive by 7 pm for the illumination show on weekends",
      "Shoes must be removed before entering the palace interiors",
    ],
  },
  {
    name: "Hampi Group of Monuments",
    query: "Hampi, Karnataka",
    category: "UNESCO World Heritage",
    headline: "Granite ruins along the Tungabhadra narrating Vijayanagara legends",
    description:
      "Boulder-strewn plains hide temples, bazaars, and royal enclosures from the 14th-century Vijayanagara Empire. Sunrise from Matanga Hill and coracle rides on the Tungabhadra make Hampi a timeless open-air museum.",
    location: {
      formatted: "Hampi, Vijayanagara District, Karnataka 583239, India",
      name: "Hampi",
      city: "Hampi",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 15.335, lng: 76.461 },
      timezone: "Asia/Kolkata",
    },
    heroImage: {
      url: "https://images.unsplash.com/photo-1602491676819-3fe09c7e3831?auto=format&fit=crop&w=1600&q=80",
      attribution: "Photo by Raghu Nayyar on Unsplash",
      source: "unsplash",
    },
    mapImage: null,
    highlights: [
      "Virupaksha Temple’s towering gopuram",
      "Stone chariot and musical pillars at Vittala Temple",
      "Lotus Mahal inside the Zenana Enclosure",
    ],
    bestTimeToVisit: "November to February",
    entryFee: "₹40 Indians, ₹600 Foreign visitors (Vittala complex)",
    rating: 4.8,
    reviews: 98000,
    visitors: 650000,
    nearbyAttractions: [
      {
        name: "Matanga Hill",
        distance: "1.5 km",
        description: "Sunrise trek rewarding 360° views over the ruins and river.",
      },
      {
        name: "Anegundi Village",
        distance: "6 km",
        description: "Rustic sister settlement with banana plantations and coracle crossings.",
      },
    ],
    hotels: [
      {
        name: "Evolve Back Kamalapura Palace",
        rating: 4.7,
        address: "Kamalapura, Hampi",
        description: "Luxury resort echoing Dravidian architecture with Ayurveda spa.",
        contact: "+91-80-46123232",
        website: "https://www.evolveback.com/hampi/",
      },
      {
        name: "Heritage Resort Hampi",
        rating: 4.4,
        address: "SH 49, Urban Forest, Hampi",
        description: "Eco-conscious cottages surrounded by laterite gardens.",
        contact: "+91-8394-241144",
        website: "https://www.heritageresortshampi.com/",
      },
    ],
    restaurants: [
      {
        name: "Mango Tree",
        specialty: "Plant-based thalis and river views",
        address: "Virupapura Gaddi, Hampi",
      },
      {
        name: "Laughing Buddha",
        specialty: "Backpacker favourite for Israeli and continental plates",
        address: "Virupapura Gaddi, Hampi",
      },
    ],
    tags: ["hampi", "vijayanagara", "unesco", "temples"],
    travelTips: [
      "Carry cash—ATMs are limited inside the heritage zone",
      "Hire a licensed guide to decode temple iconography",
    ],
  },
  {
    name: "Coorg Coffee Estates",
    query: "Coorg, Madikeri",
    category: "Hill Retreat",
    headline: "Cardamom-scented mist, waterfalls, and Kodava hospitality",
    description:
      "Perched in the Western Ghats, Coorg invites travellers to wake up in plantation bungalows, sip single-origin brews, and chase the spray of Abbey Falls amid lush rainforest.",
    location: {
      formatted: "Madikeri, Kodagu District, Karnataka 571201, India",
      name: "Coorg",
      city: "Madikeri",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 12.4244, lng: 75.7382 },
      timezone: "Asia/Kolkata",
    },
    heroImage: {
      url: "https://images.unsplash.com/photo-1541411438265-4cb4687110e9?auto=format&fit=crop&w=1600&q=80",
      attribution: "Photo by Vivek Doshi on Unsplash",
      source: "unsplash",
    },
    mapImage: null,
    highlights: [
      "Dawn jeep ride to Mandalpatti viewpoint",
      "Estate walks with coffee cupping sessions",
      "River rafting on the Barapole",
    ],
    bestTimeToVisit: "September to March",
    entryFee: "Free entry; activities priced separately",
    rating: 4.6,
    reviews: 76500,
    visitors: 890000,
    nearbyAttractions: [
      {
        name: "Abbey Falls",
        distance: "8 km",
        description: "Waterfall gushing through spice estates, best after monsoon.",
      },
      {
        name: "Nagarhole National Park",
        distance: "90 km",
        description: "Wildlife safaris spotting elephants, gaur, and if lucky, tigers.",
      },
    ],
    hotels: [
      {
        name: "Taj Madikeri Resort & Spa",
        rating: 4.7,
        address: "1st Monnangeri Galibeedu, Madikeri",
        description: "Luxury rainforest villas with infinity pool and Jiva spa.",
        contact: "+91-8272-661111",
        website: "https://www.tajhotels.com/en-in/taj/taj-madikeri-resort-and-spa-coorg/",
      },
      {
        name: "The Tamara Coorg",
        rating: 4.8,
        address: "Kabbinakad Estate, Napoklu",
        description: "Elevated wooden cottages overlooking coffee valleys.",
        contact: "+91-8068-033000",
        website: "https://www.thetamara.com/coorg/",
      },
    ],
    restaurants: [
      {
        name: "Coorg Cuisine",
        specialty: "Authentic Pandi Curry and Kadambuttu",
        address: "Stewart Hill, Madikeri",
      },
      {
        name: "Beans N Brews Café",
        specialty: "Estate roasts and homemade desserts",
        address: "Madikeri town",
      },
    ],
    tags: ["western ghats", "coffee", "kodava", "nature"],
    travelTips: [
      "Pack rain jackets—showers are frequent even outside monsoon",
      "Respect private estate boundaries while trekking",
    ],
  },
  {
    name: "Gokarna Om Beach",
    query: "Gokarna, Karnataka",
    category: "Beach Escape",
    headline: "Shiva temples, chill surf shacks, and the iconic Om-shaped cove",
    description:
      "Gokarna blends sacred pilgrimage with slow-living beach vibes. Trek the coastal trail linking Kudle, Om, Half Moon, and Paradise beaches or kayak with golden sunsets on the Arabian Sea horizon.",
    location: {
      formatted: "Om Beach Road, Gokarna, Uttara Kannada, Karnataka 581326, India",
      name: "Gokarna",
      city: "Gokarna",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 14.517, lng: 74.3249 },
      timezone: "Asia/Kolkata",
    },
    heroImage: {
      url: "https://images.unsplash.com/photo-1587500151181-8731e5ed7f84?auto=format&fit=crop&w=1600&q=80",
      attribution: "Photo by Sarang Pande on Unsplash",
      source: "unsplash",
    },
    mapImage: null,
    highlights: [
      "Beach-hopping trek spanning four coves",
      "Stand-up paddleboarding at Om Beach",
      "Mahabaleshwar Temple rituals in town",
    ],
    bestTimeToVisit: "November to February",
    entryFee: "Public beach access is free",
    rating: 4.5,
    reviews: 54200,
    visitors: 420000,
    nearbyAttractions: [
      {
        name: "Mirjan Fort",
        distance: "22 km",
        description: "Laterite fort draped in moss, dating back to the 16th century.",
      },
      {
        name: "Yana Caves",
        distance: "50 km",
        description: "Basalt rock towers with a Shiva shrine amid evergreen forest.",
      },
    ],
    hotels: [
      {
        name: "Swaswara CGH Earth",
        rating: 4.6,
        address: "Om Beach, Gokarna",
        description: "Wellness retreat featuring yoga, meditation, and Ayurvedic cuisine.",
        contact: "+91-484-4261711",
        website: "https://www.cghearth.com/swaswara",
      },
      {
        name: "Kahani Paradise",
        rating: 4.7,
        address: "Belekan Road, Gokarna",
        description: "Boutique cliffside suites with private plunge pools.",
        contact: "+91-94835-83344",
        website: "https://www.kahaniparadise.com/",
      },
    ],
    restaurants: [
      {
        name: "Namaste Café",
        specialty: "Seafood grills and smoothies right on Om Beach",
        address: "Om Beach, Gokarna",
      },
      {
        name: "Chez Christophe",
        specialty: "French owner-chef serving fresh baguettes and pastas",
        address: "Kudle Beach Road, Gokarna",
      },
    ],
    tags: ["beach", "sunset", "temple town", "arabian sea"],
    travelTips: [
      "Beach treks get warm—start before 8 am and carry water",
      "Respect no-plastic zones enforced by local communities",
    ],
  },
  {
    name: "Chikkamagaluru Highlands",
    query: "Chikkamagaluru, Karnataka",
    category: "Mountain Drive",
    headline: "Mullayanagiri peaks, coffee homestays, and starry skies",
    description:
      "Chikkamagaluru is the birthplace of Indian coffee, wrapped in rolling hills and shola forests. Drive hairpin bends to Mullayanagiri, Karnataka’s highest summit, and unwind in rustic homestays.",
    location: {
      formatted: "Chikkamagaluru, Karnataka 577101, India",
      name: "Chikkamagaluru",
      city: "Chikkamagaluru",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 13.315, lng: 75.7754 },
      timezone: "Asia/Kolkata",
    },
    heroImage: {
      url: "https://images.unsplash.com/photo-1541412963993-418b523142bc?auto=format&fit=crop&w=1600&q=80",
      attribution: "Photo by Vivek Doshi on Unsplash",
      source: "unsplash",
    },
    mapImage: null,
    highlights: [
      "Sunrise drive to Mullayanagiri (1,930 m)",
      "Trek the Baba Budangiri – Manikyadhara trail",
      "Star-gazing nights at coffee estate stays",
    ],
    bestTimeToVisit: "September to February",
    entryFee: "Free entry; hill permits may apply",
    rating: 4.6,
    reviews: 43800,
    visitors: 520000,
    nearbyAttractions: [
      {
        name: "Hebbe Falls",
        distance: "35 km",
        description: "Two-stage waterfall reached via forest jeep ride.",
      },
      {
        name: "Bhadra Wildlife Sanctuary",
        distance: "38 km",
        description: "Wetland reserve known for tiger conservation and river safaris.",
      },
    ],
    hotels: [
      {
        name: "Trivik Hotels & Resorts",
        rating: 4.7,
        address: "Channagondanahalli, Chikkamagaluru",
        description: "Luxury villas overlooking Mullayanagiri ridges.",
        contact: "+91-93535-55555",
        website: "https://www.trivikhotels.com/chikmagalur/",
      },
      {
        name: "Java Rain Resorts",
        rating: 4.6,
        address: "Survey No. 618, Mullayanagiri Road, Chikkamagaluru",
        description: "Sky bridges, infinity pools, and insta-famous Machan tree bar.",
        contact: "+91-9483-444-444",
        website: "https://www.javarainresorts.com/",
      },
    ],
    restaurants: [
      {
        name: "Town Canteen",
        specialty: "Legendary benne dosas and filter coffee",
        address: "Indira Gandhi Road, Chikkamagaluru",
      },
      {
        name: "MG Park Inn",
        specialty: "Malnad meals served on banana leaves",
        address: "IG Road, Chikkamagaluru",
      },
    ],
    tags: ["coffee country", "mullayanagiri", "road trip", "western ghats"],
    travelTips: [
      "Fog reduces visibility post-monsoon—drive cautiously",
      "Estate stays fill quickly over weekends; book early",
    ],
  },
  {
    name: "Kabini Safari & Backwaters",
    query: "Kabini, Karnataka",
    category: "Wildlife",
    headline: "Elephant herds, black panther lore, and sunset boat safaris",
    description:
      "Forming the southern gateway to Nagarhole National Park, Kabini’s teak forests deliver unforgettable jeep and boat safaris with sightings of elephants, dholes, and the famed melanistic leopard.",
    location: {
      formatted:
        "Kabini River Lodge, Karapura, N. Begur Post, HD Kote Taluk, Karnataka 571114, India",
      name: "Kabini",
      city: "Karapura",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 12.0269, lng: 76.0914 },
      timezone: "Asia/Kolkata",
    },
    heroImage: {
      url: "https://images.unsplash.com/photo-1619089728865-2dba9d24d782?auto=format&fit=crop&w=1600&q=80",
      attribution: "Photo by Hu Chen on Unsplash",
      source: "unsplash",
    },
    mapImage: null,
    highlights: [
      "Boat safaris spotting elephants at the backwaters",
      "Chance encounters with the elusive Kabini black panther",
      "Guided nature walks learning about forest conservation",
    ],
    bestTimeToVisit: "October to May",
    entryFee: "Safari packages from ₹2,000 per person",
    rating: 4.7,
    reviews: 28600,
    visitors: 210000,
    nearbyAttractions: [
      {
        name: "Nagarhole National Park",
        distance: "0 km",
        description: "UNESCO listed tiger reserve formerly the royal hunting grounds.",
      },
      {
        name: "Brahmagiri Wildlife Sanctuary",
        distance: "60 km",
        description: "Cross the border into Kerala for mist-draped trekking trails.",
      },
    ],
    hotels: [
      {
        name: "Evolve Back Kabini",
        rating: 4.8,
        address: "Karapura Village, Kabini",
        description: "Luxury hut-inspired villas with infinity pools over the Kabini backwaters.",
        contact: "+91-80-46123232",
        website: "https://www.evolveback.com/kabini/",
      },
      {
        name: "The Serai Kabini",
        rating: 4.7,
        address: "Survey No. 60/1, Nishana Village, Kabini",
        description: "Waterfront cottages with private decks and curated safari experiences.",
        contact: "+91-80-9500-7000",
        website: "https://www.theserai.in/kabini",
      },
    ],
    restaurants: [
      {
        name: "Waterwoods Dine",
        specialty: "Wildlife-lodge dining with farm-fresh produce",
        address: "Waterwoods Lodge, Kabini",
      },
      {
        name: "Kabini Springs",
        specialty: "Multi-cuisine buffet frequented by safari-goers",
        address: "Karapura, Kabini",
      },
    ],
    tags: ["wildlife", "safari", "kabini river", "black panther"],
    travelTips: [
      "Safaris sell out fast—pre-book slots through Jungle Lodges",
      "Wear neutral colours and carry binoculars",
    ],
  },
  {
    name: "Badami Cave Temples",
    query: "Badami, Karnataka",
    category: "Rock-Cut Heritage",
    headline: "Sandstone cliffs carved with Chalukyan mythology",
    description:
      "Badami’s 6th-century cave temples showcase intricate carvings of Shiva, Vishnu, and Jain Tirthankaras. The Agastya lakefront backdrop glows copper at sunset, reflecting millennia of Deccan art.",
    location: {
      formatted: "Badami Cave Temples, Badami, Bagalkot District, Karnataka 587201, India",
      name: "Badami Cave Temples",
      city: "Badami",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 15.9155, lng: 75.6754 },
      timezone: "Asia/Kolkata",
    },
    heroImage: {
      url: "https://images.unsplash.com/photo-1600369671954-7d07212e726a?auto=format&fit=crop&w=1600&q=80",
      attribution: "Photo by Vivek Kumar on Unsplash",
      source: "unsplash",
    },
    mapImage: null,
    highlights: [
      "Four cave shrines blending Shaiva, Vaishnava, and Jain iconography",
      "Breathtaking sunset over Agastya Lake and North Fort",
      "Archaeological Museum housing Chalukyan sculptures",
    ],
    bestTimeToVisit: "October to March",
    entryFee: "₹25 Indians, ₹300 Foreign visitors",
    rating: 4.6,
    reviews: 32100,
    visitors: 190000,
    nearbyAttractions: [
      {
        name: "Pattadakal Monuments",
        distance: "22 km",
        description: "UNESCO site with a blend of Dravidian and Nagara temple styles.",
      },
      {
        name: "Aihole Temple Complex",
        distance: "35 km",
        description: "Experimental temple architecture from the early Chalukyan era.",
      },
    ],
    hotels: [
      {
        name: "Heritage Resort Badami",
        rating: 4.3,
        address: "Station Road, Badami",
        description: "Comfortable stay with views towards North Fort cliffs.",
        contact: "+91-94814-77444",
        website: "https://www.heritageresortbadami.com/",
      },
      {
        name: "Clarks Inn Badami",
        rating: 4.2,
        address: "Badami Main Road, Bagalkot",
        description: "Modern amenities close to the cave complex.",
        contact: "+91-8357-220044",
        website: "https://www.clarksinn.in/badami/",
      },
    ],
    restaurants: [
      {
        name: "Krishnendu",
        specialty: "South Indian thalis and fresh juices",
        address: "Station Road, Badami",
      },
      {
        name: "Banashankari Canteen",
        specialty: "Budget-friendly idli, vada, and filter coffee",
        address: "Near Cave Temples Parking, Badami",
      },
    ],
    tags: ["chalukya", "rock cut", "unesco buffer", "agastya lake"],
    travelTips: [
      "Climb steps early morning to avoid midday heat",
      "Carry socks—stone floors get hot by noon",
    ],
  },
  {
    name: "Bengaluru Urban Pulse",
    query: "Bengaluru, Karnataka",
    category: "City Break",
    headline: "Garden city parks, craft breweries, and design-forward neighborhoods",
    description:
      "India’s tech capital balances Victorian-era gardens with rooftop microbreweries and indie art spaces. Spend mornings at Cubbon Park, afternoons exploring church street bookstores, and evenings sampling farm-to-table menus.",
    location: {
      formatted: "Bengaluru, Karnataka 560001, India",
      name: "Bengaluru",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      coordinates: { lat: 12.9716, lng: 77.5946 },
      timezone: "Asia/Kolkata",
    },
    heroImage: {
      url: "https://images.unsplash.com/photo-1526481280695-3c4692f3f469?auto=format&fit=crop&w=1600&q=80",
      attribution: "Photo by Darshan Patil on Unsplash",
      source: "unsplash",
    },
    mapImage: null,
    highlights: [
      "Sunrise balloon rides over Lalbagh Glass House",
      "Craft beer trails across Indiranagar and Koramangala",
      "Art walks through National Gallery of Modern Art",
    ],
    bestTimeToVisit: "October to February",
    entryFee: "City attractions individually ticketed",
    rating: 4.4,
    reviews: 128000,
    visitors: 5200000,
    nearbyAttractions: [
      {
        name: "Nandi Hills",
        distance: "60 km",
        description: "Early morning drive for clouds, cycling trails, and paragliding.",
      },
      {
        name: "Nrityagram Dance Village",
        distance: "35 km",
        description: "Gurukul for Odissi dance surrounded by rustic mud cottages.",
      },
    ],
    hotels: [
      {
        name: "The Leela Palace Bengaluru",
        rating: 4.8,
        address: "23 Old Airport Road, Bengaluru",
        description: "Opulent palace-style hotel with award-winning restaurants.",
        contact: "+91-80-2521-1234",
        website: "https://www.theleela.com/the-leela-palace-bengaluru/",
      },
      {
        name: "The Oberoi Bengaluru",
        rating: 4.7,
        address: "39 MG Road, Bengaluru",
        description: "Urban resort known for its rain tree canopy and spa.",
        contact: "+91-80-2558-5858",
        website: "https://www.oberoihotels.com/hotels-in-bengaluru/",
      },
    ],
    restaurants: [
      {
        name: "The Only Place",
        specialty: "Classic Bengaluru steaks and apple pie since 1965",
        address: "Museum Road, Bengaluru",
      },
      {
        name: "The Permit Room",
        specialty: "Inventive cocktails with South Indian bites",
        address: "Residency Road, Bengaluru",
      },
    ],
    tags: ["garden city", "craft beer", "tech hub", "culture"],
    travelTips: [
      "Metro is the fastest way to cross town during peak hours",
      "Make dinner reservations on weekends—restaurants fill up quickly",
    ],
  },
];

const shouldSeedCuratedDestinations =
  process.argv.includes("--seed") || process.env.SEED_CURATED_DESTINATIONS === "true";

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
    heroImage: data.heroImage?.url || data.heroImage,
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
