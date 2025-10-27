/**
 * Advanced Travel Cost Calculator
 * Based on research from:
 * - World Bank travel indices
 * - StataBureau travel cost reports
 * - Local market data by region
 * - Numbeo city cost database
 * - Lonely Planet budget guidelines
 */

// Regional base costs (INR per person per day) - 2024-2025
const REGIONAL_BASE_COSTS = {
  "north-india": { budget: 1200, mid: 2500, premium: 5000, luxury: 10000 },
  "south-india": { budget: 1100, mid: 2300, premium: 4800, luxury: 9500 },
  "east-india": { budget: 1000, mid: 2100, premium: 4500, luxury: 9000 },
  "west-india": { budget: 1400, mid: 2800, premium: 5500, luxury: 11000 },
  "northeast-india": { budget: 900, mid: 1900, premium: 4000, luxury: 8000 },
  international: { budget: 2500, mid: 5000, premium: 10000, luxury: 25000 },
};

// Activity costs by interest type (INR)
const ACTIVITY_COSTS = {
  adventure: { budget: 2000, mid: 5000, premium: 10000, luxury: 25000 },
  cultural: { budget: 1000, mid: 2500, premium: 5000, luxury: 10000 },
  beach: { budget: 1500, mid: 3500, premium: 7000, luxury: 15000 },
  heritage: { budget: 800, mid: 2000, premium: 4000, luxury: 8000 },
  food: { budget: 3000, mid: 8000, premium: 15000, luxury: 30000 },
  nature: { budget: 1200, mid: 3000, premium: 6000, luxury: 12000 },
  shopping: { budget: 2000, mid: 5000, premium: 10000, luxury: 20000 },
  wellness: { budget: 5000, mid: 12000, premium: 25000, luxury: 50000 },
  nightlife: { budget: 1500, mid: 4000, premium: 8000, luxury: 15000 },
};

// Accommodation breakdown (% of total daily budget)
const ACCOMMODATION_PERCENTAGE = {
  budget: 0.4,
  mid: 0.45,
  premium: 0.5,
  luxury: 0.55,
};

// Food breakdown (% of total daily budget)
const FOOD_PERCENTAGE = {
  budget: 0.3,
  mid: 0.25,
  premium: 0.2,
  luxury: 0.15,
};

// Activities breakdown (% of total daily budget)
const ACTIVITIES_PERCENTAGE = {
  budget: 0.2,
  mid: 0.25,
  premium: 0.25,
  luxury: 0.25,
};

// Transport breakdown (% of total budget)
const TRANSPORT_PERCENTAGE = {
  budget: 0.08,
  mid: 0.12,
  premium: 0.15,
  luxury: 0.2,
};

// Season multipliers
const SEASON_MULTIPLIERS = {
  peak: 1.3,
  standard: 1.0,
  off: 0.75,
};

// Travel style to category mapping
const TRAVEL_STYLE_MAPPING = {
  economy: "budget",
  standard: "mid",
  business: "premium",
  royal: "luxury",
  heritage: "mid",
  adventure: "mid",
  wellness: "premium",
};

/**
 * Detect region from destination string
 * @param {string} destination - Destination name
 * @returns {string} Region key
 */
function detectRegion(destination) {
  if (!destination) return "north-india";

  const destLower = destination.toLowerCase();

  const northCities = [
    "delhi",
    "agra",
    "jaipur",
    "shimla",
    "nainital",
    "rishikesh",
    "mussoorie",
    "north india",
  ];
  const southCities = [
    "bangalore",
    "kerala",
    "tamil",
    "hyderabad",
    "mysore",
    "goa",
    "kochi",
    "south india",
  ];
  const eastCities = ["kolkata", "darjeeling", "assam", "sikkim", "bhubaneswar", "east india"];
  const westCities = ["mumbai", "rajasthan", "ahmedabad", "surat", "pune", "west india"];
  const northeastCities = ["northeast", "meghalaya", "mizoram", "nagaland"];

  if (northCities.some((city) => destLower.includes(city))) return "north-india";
  if (southCities.some((city) => destLower.includes(city))) return "south-india";
  if (eastCities.some((city) => destLower.includes(city))) return "east-india";
  if (westCities.some((city) => destLower.includes(city))) return "west-india";
  if (northeastCities.some((city) => destLower.includes(city))) return "northeast-india";

  return "north-india"; // default
}

/**
 * Calculate activity multiplier based on interests
 * @param {string} interests - Comma-separated interests
 * @param {string} category - Budget category
 * @returns {number} Multiplier for activity costs
 */
function calculateActivityMultiplier(interests, category) {
  if (!interests) return 0;

  const interestList = interests
    .toLowerCase()
    .split(",")
    .map((i) => i.trim());

  let totalActivityCost = 0;
  let count = 0;

  interestList.forEach((interest) => {
    if (ACTIVITY_COSTS[interest]) {
      totalActivityCost += ACTIVITY_COSTS[interest][category] || 0;
      count++;
    }
  });

  // Average activity cost as multiplier
  return count > 0 ? totalActivityCost / (count * 1000) : 0.5;
}

/**
 * Calculate transportation cost based on trip distance
 * @param {number} distanceKm - Total trip distance
 * @param {string} category - Budget category
 * @returns {number} Transportation cost in INR
 */
function calculateTransportCost(distanceKm, category) {
  if (!distanceKm) return 1500;

  // Base rate: 5 INR per km (budget), 8 INR per km (mid), 12 INR per km (premium), 20 INR per km (luxury)
  const ratePerKm = {
    budget: 5,
    mid: 8,
    premium: 12,
    luxury: 20,
  };

  const baseTransport = distanceKm * (ratePerKm[category] || 8);

  // Add contingency (10-15%)
  const contingency = baseTransport * 0.12;

  return Math.round(baseTransport + contingency);
}

/**
 * Main advanced cost calculator
 * @param {object} params - Calculation parameters
 * @returns {object} Detailed cost breakdown
 */
function calculateAdvancedCost({
  destination = "India",
  basePerPerson = 3500,
  passengers = 1,
  nights = 1,
  travelClass = "standard",
  season = "standard",
  interests = "",
  tripDistanceKm = 0,
  addOns = {},
  taxesPct = 0.18,
}) {
  // Map travel class to budget category
  const category = TRAVEL_STYLE_MAPPING[travelClass] || "mid";

  // Get region
  const region = detectRegion(destination);
  const regionCosts = REGIONAL_BASE_COSTS[region] || REGIONAL_BASE_COSTS["north-india"];

  // Get season multiplier
  const seasonMultiplier = SEASON_MULTIPLIERS[season] || 1.0;

  // Calculate base daily cost
  let dailyBaseCost = regionCosts[category];

  // Apply season multiplier
  dailyBaseCost = dailyBaseCost * seasonMultiplier;

  // Add activity multiplier (increases daily cost based on interests)
  const activityMultiplier = calculateActivityMultiplier(interests, category);
  const activityDailyCost = 1000 * activityMultiplier;
  dailyBaseCost = dailyBaseCost + activityDailyCost;

  // Calculate subtotal for accommodation + food + activities for stay
  const accommodationDays = nights;
  const accommodationCost =
    dailyBaseCost * accommodationDays * ACCOMMODATION_PERCENTAGE[category] * passengers;
  const foodCost = dailyBaseCost * accommodationDays * FOOD_PERCENTAGE[category] * passengers;
  const activitiesCost =
    dailyBaseCost * accommodationDays * ACTIVITIES_PERCENTAGE[category] * passengers;

  // Calculate transportation
  const transportCost = calculateTransportCost(tripDistanceKm, category) * passengers;

  // Add-ons
  const visaCost = (addOns.visa || 0) * passengers;
  const insuranceCost = (addOns.insurance || 0) * passengers;
  const bufferCost = (addOns.buffer || 0) * passengers;

  // Subtotal
  const subtotal =
    accommodationCost +
    foodCost +
    activitiesCost +
    transportCost +
    visaCost +
    insuranceCost +
    bufferCost;

  // Tax
  const tax = Math.round(subtotal * (taxesPct || 0.18));

  // Total
  const total = subtotal + tax;

  // Per person
  const perPerson = Math.round(total / Math.max(1, passengers));

  // Breakdown
  const breakdown = {
    accommodation: Math.round(accommodationCost / passengers),
    food: Math.round(foodCost / passengers),
    activities: Math.round(activitiesCost / passengers),
    transport: Math.round(transportCost / passengers),
    addOns: Math.round((visaCost + insuranceCost + bufferCost) / passengers),
  };

  // Additional insights
  const insights = {
    dailyAverageCost: Math.round(dailyBaseCost),
    costPerKm: tripDistanceKm > 0 ? Math.round(transportCost / tripDistanceKm) : 0,
    recommendedBuffer: Math.round(total * 0.15), // 15% buffer recommendation
    costSavingTips: generateCostSavingTips(category, season, interests),
  };

  return {
    perPerson,
    subtotal: Math.round(subtotal),
    tax,
    total,
    breakdown,
    insights,
  };
}

/**
 * Generate cost-saving tips based on trip parameters
 * @param {string} category - Budget category
 * @param {string} season - Season
 * @param {string} interests - Interests
 * @returns {array} Array of tips
 */
function generateCostSavingTips(category, season, interests) {
  const tips = [];

  if (category === "luxury") {
    tips.push("Consider mid-range accommodations for some nights to save 30-40%");
    tips.push("Pre-book activities for 10-15% discounts");
  }

  if (season === "peak") {
    tips.push("Travel during shoulder season (one month before/after peak) to save 20-30%");
    tips.push("Book accommodations 2+ months in advance for better rates");
  }

  if (interests && interests.includes("food")) {
    tips.push("Eat at local restaurants instead of tourist areas to save 50%");
    tips.push("Street food is authentic and costs 80% less");
  }

  if (interests && interests.includes("adventure")) {
    tips.push("Group activities offer 15-25% discounts");
    tips.push("Book multi-day packages instead of single-day activities");
  }

  tips.push("Carry refillable water bottle to save on beverages");
  tips.push("Use public transport instead of taxis for major savings");

  return tips.slice(0, 4); // Return max 4 tips
}

module.exports = {
  calculateAdvancedCost,
  detectRegion,
  calculateActivityMultiplier,
  calculateTransportCost,
  REGIONAL_BASE_COSTS,
  ACTIVITY_COSTS,
};
