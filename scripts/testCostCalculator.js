const { calculateAdvancedCost } = require("../utils/advancedCostCalculator");

const testCases = [
  {
    destination: "Goa",
    basePerPerson: 3500,
    passengers: 2,
    nights: 5,
    travelClass: "standard",
    season: "peak",
    interests: "beach,nightlife",
    tripDistanceKm: 500,
  },
  {
    destination: "Paris",
    basePerPerson: 10000,
    passengers: 1,
    nights: 7,
    travelClass: "luxury",
    season: "standard",
    interests: "cultural,food",
    tripDistanceKm: 8000,
  },
];

testCases.forEach((params, index) => {
  console.log(`\n--- Test Case ${index + 1} ---`);
  console.log("Params:", params);
  try {
    const result = calculateAdvancedCost(params);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
});
