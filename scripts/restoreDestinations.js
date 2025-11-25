const { MongoClient } = require("mongodb");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "tourease";

// Helper to generate consistent hotels and restaurants
const generateAmenities = (cityName, baseRating) => {
  const hotelNames = [
    "Grand", "Royal", "Heritage", "Palace", "Resort", "View", "Plaza", "Inn", "Regency", "Stay"
  ];
  const restaurantNames = [
    "Spice Garden", "The Curry House", "Flavors of", "Taste of", "Golden Spoon", "The Diner", "Bistro", "Cafe", "Grill", "Kitchen"
  ];

  return {
    hotels: Array(10).fill(0).map((_, i) => ({
      name: `${cityName} ${hotelNames[i]} Hotel`,
      rating: Math.min(5, Math.max(3.5, baseRating + (Math.random() * 1 - 0.5))).toFixed(1),
      address: `Near City Center, ${cityName}`,
      price: Math.floor(2000 + Math.random() * 5000),
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
      contact: "+91-9876543210",
      website: `https://www.hotels-${cityName.toLowerCase().replace(/\s/g, "")}.com`
    })),
    restaurants: Array(10).fill(0).map((_, i) => ({
      name: `${restaurantNames[i]} ${cityName}`,
      cuisine: ["North Indian", "South Indian", "Multi-Cuisine", "Local Special"][i % 4],
      rating: Math.min(5, Math.max(3.5, baseRating + (Math.random() * 1 - 0.5))).toFixed(1),
      address: `Main Market, ${cityName}`,
      image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
      priceRange: "₹₹-₹₹₹"
    }))
  };
};

const destinations = [
  {
    name: "Taj Mahal",
    image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800",
    location: { city: "Agra", state: "Uttar Pradesh", country: "India" },
    description: "The Taj Mahal is an ivory-white marble mausoleum, built by Mughal emperor Shah Jahan in memory of his wife Mumtaz Mahal.",
    nearbyAttractions: [
      { name: "Agra Fort", distance: "2.5 km" }, { name: "Mehtab Bagh", distance: "7 km" }, { name: "Fatehpur Sikri", distance: "40 km" },
      { name: "Itimad-ud-Daulah", distance: "6 km" }, { name: "Akbar's Tomb", distance: "10 km" }, { name: "Jama Masjid", distance: "5 km" },
      { name: "Chini Ka Rauza", distance: "8 km" }, { name: "Anguri Bagh", distance: "2.5 km" }, { name: "Moti Masjid", distance: "2.5 km" },
      { name: "Taj Museum", distance: "0.5 km" }
    ]
  },
  {
    name: "Jaipur - The Pink City",
    image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800",
    location: { city: "Jaipur", state: "Rajasthan", country: "India" },
    description: "Jaipur is known as the Pink City due to its distinctively colored buildings. Famous for stunning palaces, forts, and bazaars.",
    nearbyAttractions: [
      { name: "Amber Fort", distance: "11 km" }, { name: "Hawa Mahal", distance: "4 km" }, { name: "City Palace", distance: "4 km" },
      { name: "Jantar Mantar", distance: "4 km" }, { name: "Nahargarh Fort", distance: "15 km" }, { name: "Jaigarh Fort", distance: "12 km" },
      { name: "Jal Mahal", distance: "6 km" }, { name: "Albert Hall Museum", distance: "5 km" }, { name: "Birla Mandir", distance: "8 km" },
      { name: "Galtaji Temple", distance: "10 km" }
    ]
  },
  {
    name: "Goa Beaches",
    image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800",
    location: { city: "Goa", state: "Goa", country: "India" },
    description: "Goa is renowned for pristine beaches, vibrant nightlife, Portuguese heritage, and laid-back atmosphere.",
    nearbyAttractions: [
      { name: "Calangute Beach", distance: "15 km" }, { name: "Baga Beach", distance: "16 km" }, { name: "Fort Aguada", distance: "18 km" },
      { name: "Basilica of Bom Jesus", distance: "10 km" }, { name: "Dudhsagar Falls", distance: "60 km" }, { name: "Anjuna Beach", distance: "20 km" },
      { name: "Chapora Fort", distance: "22 km" }, { name: "Palolem Beach", distance: "70 km" }, { name: "Se Cathedral", distance: "10 km" },
      { name: "Vagator Beach", distance: "21 km" }
    ]
  },
  {
    name: "Varanasi (Kashi)",
    image: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800",
    location: { city: "Varanasi", state: "Uttar Pradesh", country: "India" },
    description: "Varanasi is the spiritual capital of India, famous for ghats, temples, and the Ganga Aarti.",
    nearbyAttractions: [
      { name: "Kashi Vishwanath Temple", distance: "1 km" }, { name: "Dashashwamedh Ghat", distance: "1 km" }, { name: "Assi Ghat", distance: "2 km" },
      { name: "Sarnath", distance: "10 km" }, { name: "Ramnagar Fort", distance: "14 km" }, { name: "Manikarnika Ghat", distance: "1.5 km" },
      { name: "Sankat Mochan Temple", distance: "5 km" }, { name: "BHU", distance: "6 km" }, { name: "Tulsi Manas Mandir", distance: "4 km" },
      { name: "Bharat Mata Mandir", distance: "3 km" }
    ]
  },
  {
    name: "Kerala Backwaters",
    image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800",
    location: { city: "Alleppey", state: "Kerala", country: "India" },
    description: "A network of interconnected canals, rivers, lakes, and inlets along Kerala's coast, famous for houseboats.",
    nearbyAttractions: [
      { name: "Alleppey Beach", distance: "2 km" }, { name: "Marari Beach", distance: "15 km" }, { name: "Kumarakom Bird Sanctuary", distance: "30 km" },
      { name: "Vembanad Lake", distance: "5 km" }, { name: "Krishnapuram Palace", distance: "47 km" }, { name: "Ambalapuzha Temple", distance: "14 km" },
      { name: "Pathiramanal Island", distance: "13 km" }, { name: "Kuttanad", distance: "20 km" }, { name: "Punnamada Lake", distance: "4 km" },
      { name: "Revi Karunakaran Museum", distance: "3 km" }
    ]
  },
  {
    name: "Ladakh - Land of High Passes",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    location: { city: "Leh", state: "Ladakh", country: "India" },
    description: "High-altitude desert with stunning landscapes, Buddhist monasteries, and pristine lakes.",
    nearbyAttractions: [
      { name: "Pangong Lake", distance: "160 km" }, { name: "Nubra Valley", distance: "120 km" }, { name: "Thiksey Monastery", distance: "19 km" },
      { name: "Leh Palace", distance: "2 km" }, { name: "Shanti Stupa", distance: "5 km" }, { name: "Magnetic Hill", distance: "30 km" },
      { name: "Hemis Monastery", distance: "40 km" }, { name: "Khardung La", distance: "40 km" }, { name: "Spituk Gompa", distance: "8 km" },
      { name: "Hall of Fame", distance: "6 km" }
    ]
  },
  {
    name: "Rishikesh - Yoga Capital",
    image: "https://images.unsplash.com/photo-1596021688656-35fdc9ed0274?w=800",
    location: { city: "Rishikesh", state: "Uttarakhand", country: "India" },
    description: "Spiritual town in Himalayan foothills on Ganges River, known for yoga, temples, and adventure sports.",
    nearbyAttractions: [
      { name: "Lakshman Jhula", distance: "2 km" }, { name: "Ram Jhula", distance: "3 km" }, { name: "Triveni Ghat", distance: "5 km" },
      { name: "Beatles Ashram", distance: "4 km" }, { name: "Parmarth Niketan", distance: "3.5 km" }, { name: "Neer Garh Waterfall", distance: "8 km" },
      { name: "Vashishta Gufa", distance: "22 km" }, { name: "Kunjapuri Temple", distance: "25 km" }, { name: "Rajaji National Park", distance: "18 km" },
      { name: "Shivpuri", distance: "16 km" }
    ]
  },
  {
    name: "Darjeeling - Queen of Hills",
    image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800",
    location: { city: "Darjeeling", state: "West Bengal", country: "India" },
    description: "Picturesque hill station famous for tea plantations, Kanchenjunga views, and the Toy Train.",
    nearbyAttractions: [
      { name: "Tiger Hill", distance: "11 km" }, { name: "Batasia Loop", distance: "5 km" }, { name: "Ghoom Monastery", distance: "8 km" },
      { name: "Peace Pagoda", distance: "2 km" }, { name: "Himalayan Zoo", distance: "3 km" }, { name: "Happy Valley Tea Estate", distance: "3 km" },
      { name: "Rock Garden", distance: "4 km" }, { name: "Observatory Hill", distance: "1 km" }, { name: "Mahakal Temple", distance: "1.5 km" },
      { name: "Nightingale Park", distance: "2 km" }
    ]
  },
  {
    name: "Andaman Islands",
    image: "https://images.unsplash.com/photo-1589330273594-fade1ee91647?w=800",
    location: { city: "Port Blair", state: "Andaman", country: "India" },
    description: "Tropical islands with pristine beaches, turquoise waters, coral reefs, and rich marine life.",
    nearbyAttractions: [
      { name: "Havelock Island", distance: "50 km" }, { name: "Neil Island", distance: "40 km" }, { name: "Cellular Jail", distance: "1 km" },
      { name: "Radhanagar Beach", distance: "55 km" }, { name: "Ross Island", distance: "3 km" }, { name: "Elephant Beach", distance: "52 km" },
      { name: "North Bay Island", distance: "5 km" }, { name: "Chidiya Tapu", distance: "25 km" }, { name: "Baratang Caves", distance: "100 km" },
      { name: "Wandoor Beach", distance: "25 km" }
    ]
  },
  {
    name: "Mysore Palace",
    image: "https://images.unsplash.com/photo-1581873372798-8eb29bbd65bd?w=800",
    location: { city: "Mysore", state: "Karnataka", country: "India" },
    description: "Magnificent Indo-Saracenic palace, one of India's most visited monuments.",
    nearbyAttractions: [
      { name: "Chamundi Hill", distance: "13 km" }, { name: "Brindavan Gardens", distance: "20 km" }, { name: "Mysore Zoo", distance: "2 km" },
      { name: "St. Philomena's Church", distance: "3 km" }, { name: "Jaganmohan Palace", distance: "1.5 km" }, { name: "Karanji Lake", distance: "3 km" },
      { name: "Rail Museum", distance: "2 km" }, { name: "Lalitha Mahal", distance: "5 km" }, { name: "Ranganathittu Bird Sanctuary", distance: "16 km" },
      { name: "Srirangapatna", distance: "15 km" }
    ]
  },
  {
    name: "Hampi",
    image: "https://images.unsplash.com/photo-1602491676819-3fe09c7e3831?w=800",
    location: { city: "Hampi", state: "Karnataka", country: "India" },
    description: "UNESCO World Heritage Site with ruins of Vijayanagara Empire. Ancient temples and massive boulders.",
    nearbyAttractions: [
      { name: "Virupaksha Temple", distance: "0.5 km" }, { name: "Vittala Temple", distance: "2 km" }, { name: "Stone Chariot", distance: "2 km" },
      { name: "Lotus Mahal", distance: "3 km" }, { name: "Elephant Stables", distance: "3.2 km" }, { name: "Matanga Hill", distance: "1 km" },
      { name: "Hemakuta Hill", distance: "0.8 km" }, { name: "Achyutaraya Temple", distance: "1.5 km" }, { name: "Queen's Bath", distance: "3.5 km" },
      { name: "Tungabhadra Dam", distance: "15 km" }
    ]
  },
  {
    name: "Udaipur - City of Lakes",
    image: "https://images.unsplash.com/photo-1580055733199-07e48814c6dc?w=800",
    location: { city: "Udaipur", state: "Rajasthan", country: "India" },
    description: "Romantic city with beautiful palaces, lakes, and havelis. Known as Venice of the East.",
    nearbyAttractions: [
      { name: "City Palace", distance: "0.5 km" }, { name: "Lake Pichola", distance: "1 km" }, { name: "Jag Mandir", distance: "1.5 km" },
      { name: "Saheliyon Ki Bari", distance: "4 km" }, { name: "Fateh Sagar Lake", distance: "5 km" }, { name: "Monsoon Palace", distance: "10 km" },
      { name: "Bagore Ki Haveli", distance: "0.5 km" }, { name: "Jagdish Temple", distance: "0.2 km" }, { name: "Vintage Car Museum", distance: "2 km" },
      { name: "Eklingji Temple", distance: "22 km" }
    ]
  },
  {
    name: "Munnar",
    image: "https://images.unsplash.com/photo-1591012911216-f639a4d102b9?w=800",
    location: { city: "Munnar", state: "Kerala", country: "India" },
    description: "Picturesque hill station in Western Ghats, famous for tea plantations and misty mountains.",
    nearbyAttractions: [
      { name: "Tea Gardens", distance: "2 km" }, { name: "Mattupetty Dam", distance: "13 km" }, { name: "Eravikulam National Park", distance: "15 km" },
      { name: "Anamudi Peak", distance: "20 km" }, { name: "Echo Point", distance: "15 km" }, { name: "Tea Museum", distance: "2 km" },
      { name: "Top Station", distance: "32 km" }, { name: "Kundala Lake", distance: "20 km" }, { name: "Attukad Waterfalls", distance: "9 km" },
      { name: "Pothamedu View Point", distance: "6 km" }
    ]
  },
  {
    name: "Coorg",
    image: "https://images.unsplash.com/photo-1541411438265-4cb4687110e9?w=800",
    location: { city: "Coorg", state: "Karnataka", country: "India" },
    description: "Scotland of India, known for coffee plantations, lush green hills, and waterfalls.",
    nearbyAttractions: [
      { name: "Abbey Falls", distance: "8 km" }, { name: "Raja's Seat", distance: "1 km" }, { name: "Dubare Elephant Camp", distance: "30 km" },
      { name: "Talakaveri", distance: "45 km" }, { name: "Golden Temple (Bylakuppe)", distance: "35 km" }, { name: "Mandalpatti", distance: "20 km" },
      { name: "Nagarhole National Park", distance: "90 km" }, { name: "Iruppu Falls", distance: "80 km" }, { name: "Nisargadhama", distance: "28 km" },
      { name: "Omkareshwara Temple", distance: "1 km" }
    ]
  },
  {
    name: "Srinagar",
    image: "https://images.unsplash.com/photo-1566837945700-30057527ade0?w=800",
    location: { city: "Srinagar", state: "Jammu & Kashmir", country: "India" },
    description: "Famous for Dal Lake, houseboats, Mughal gardens, and stunning Himalayan views.",
    nearbyAttractions: [
      { name: "Dal Lake", distance: "0 km" }, { name: "Shalimar Bagh", distance: "15 km" }, { name: "Nishat Bagh", distance: "12 km" },
      { name: "Shankaracharya Temple", distance: "5 km" }, { name: "Tulip Garden", distance: "8 km" }, { name: "Pari Mahal", distance: "10 km" },
      { name: "Hazratbal Shrine", distance: "10 km" }, { name: "Gulmarg", distance: "50 km" }, { name: "Pahalgam", distance: "90 km" },
      { name: "Sonamarg", distance: "80 km" }
    ]
  },
  {
    name: "Manali",
    image: "https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=800",
    location: { city: "Manali", state: "Himachal Pradesh", country: "India" },
    description: "High-altitude Himalayan resort town, gateway for adventure sports and Ladakh.",
    nearbyAttractions: [
      { name: "Hadimba Temple", distance: "2 km" }, { name: "Solang Valley", distance: "13 km" }, { name: "Rohtang Pass", distance: "51 km" },
      { name: "Old Manali", distance: "3 km" }, { name: "Vashisht Hot Springs", distance: "3 km" }, { name: "Jogini Falls", distance: "4 km" },
      { name: "Manu Temple", distance: "3 km" }, { name: "Naggar Castle", distance: "20 km" }, { name: "Atal Tunnel", distance: "28 km" },
      { name: "Beas River", distance: "1 km" }
    ]
  },
  {
    name: "Pondicherry",
    image: "https://images.unsplash.com/photo-1582555610519-56608825a33f?w=800",
    location: { city: "Pondicherry", state: "Puducherry", country: "India" },
    description: "Former French colony with distinct French Quarter, promenade, and spiritual Auroville.",
    nearbyAttractions: [
      { name: "Promenade Beach", distance: "0 km" }, { name: "Auroville", distance: "12 km" }, { name: "Sri Aurobindo Ashram", distance: "1 km" },
      { name: "Paradise Beach", distance: "8 km" }, { name: "Manakula Vinayagar Temple", distance: "1 km" }, { name: "French War Memorial", distance: "0.5 km" },
      { name: "Basilica of Sacred Heart", distance: "2 km" }, { name: "Serenity Beach", distance: "5 km" }, { name: "Botanical Garden", distance: "3 km" },
      { name: "Chunnambar Boat House", distance: "7 km" }
    ]
  },
  {
    name: "Shillong",
    image: "https://images.unsplash.com/photo-1583912268188-5ff02bcfbf6e?w=800",
    location: { city: "Shillong", state: "Meghalaya", country: "India" },
    description: "Scotland of the East, known for rolling hills, waterfalls, and vibrant music scene.",
    nearbyAttractions: [
      { name: "Umiam Lake", distance: "15 km" }, { name: "Elephant Falls", distance: "12 km" }, { name: "Shillong Peak", distance: "10 km" },
      { name: "Don Bosco Museum", distance: "3 km" }, { name: "Ward's Lake", distance: "1 km" }, { name: "Laitlum Canyons", distance: "25 km" },
      { name: "Cherrapunji", distance: "54 km" }, { name: "Mawlynnong", distance: "78 km" }, { name: "Dawki River", distance: "85 km" },
      { name: "Living Root Bridges", distance: "60 km" }
    ]
  },
  {
    name: "Rann of Kutch",
    image: "https://images.unsplash.com/photo-1601650613222-b26132aec6e0?w=800",
    location: { city: "Kutch", state: "Gujarat", country: "India" },
    description: "World's largest salt desert, famous for the Rann Utsav and white salt plains.",
    nearbyAttractions: [
      { name: "White Desert", distance: "0 km" }, { name: "Kala Dungar", distance: "45 km" }, { name: "Kutch Fossil Park", distance: "60 km" },
      { name: "Vijay Vilas Palace", distance: "80 km" }, { name: "Mandvi Beach", distance: "85 km" }, { name: "Aina Mahal", distance: "75 km" },
      { name: "Prag Mahal", distance: "75 km" }, { name: "Narayan Sarovar", distance: "100 km" }, { name: "Dholavira", distance: "200 km" },
      { name: "Bhuj", distance: "75 km" }
    ]
  },
  {
    name: "Kolkata",
    image: "https://images.unsplash.com/photo-1558431382-27e303142255?w=800",
    location: { city: "Kolkata", state: "West Bengal", country: "India" },
    description: "City of Joy, famous for colonial architecture, literature, and street food.",
    nearbyAttractions: [
      { name: "Victoria Memorial", distance: "2 km" }, { name: "Howrah Bridge", distance: "4 km" }, { name: "Dakshineswar Kali Temple", distance: "12 km" },
      { name: "Belur Math", distance: "10 km" }, { name: "Indian Museum", distance: "1 km" }, { name: "Kalighat Temple", distance: "5 km" },
      { name: "Science City", distance: "8 km" }, { name: "Eco Park", distance: "15 km" }, { name: "St. Paul's Cathedral", distance: "2 km" },
      { name: "Princep Ghat", distance: "3 km" }
    ]
  },
  {
    name: "Ooty",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800",
    location: { city: "Ooty", state: "Tamil Nadu", country: "India" },
    description: "Queen of Hill Stations in Nilgiris, famous for botanical gardens and toy train.",
    nearbyAttractions: [
      { name: "Botanical Gardens", distance: "2 km" }, { name: "Ooty Lake", distance: "1 km" }, { name: "Doddabetta Peak", distance: "9 km" },
      { name: "Rose Garden", distance: "2 km" }, { name: "Pykara Lake", distance: "20 km" }, { name: "Emerald Lake", distance: "20 km" },
      { name: "Avalanche Lake", distance: "22 km" }, { name: "Tea Museum", distance: "4 km" }, { name: "St. Stephen's Church", distance: "2 km" },
      { name: "Mudumalai National Park", distance: "40 km" }
    ]
  },
  {
    name: "Tirupati",
    image: "https://images.unsplash.com/photo-1623945205686-21443657c688?w=800",
    location: { city: "Tirupati", state: "Andhra Pradesh", country: "India" },
    description: "Home to the world-renowned Tirumala Venkateswara Temple.",
    nearbyAttractions: [
      { name: "Tirumala Temple", distance: "20 km" }, { name: "Kapila Theertham", distance: "3 km" }, { name: "Sri Govindaraja Swamy Temple", distance: "1 km" },
      { name: "Talakona Waterfalls", distance: "50 km" }, { name: "Chandragiri Fort", distance: "15 km" }, { name: "Sri Padmavathi Ammavari Temple", distance: "5 km" },
      { name: "Silathoranam", distance: "21 km" }, { name: "Akasaganga Teertham", distance: "22 km" }, { name: "Papavinasam", distance: "24 km" },
      { name: "Deer Park", distance: "25 km" }
    ]
  },
  {
    name: "Khajuraho",
    image: "https://images.unsplash.com/photo-1605447957288-727974301e05?w=800",
    location: { city: "Khajuraho", state: "Madhya Pradesh", country: "India" },
    description: "Famous for stunning temples adorned with intricate and erotic rock carvings.",
    nearbyAttractions: [
      { name: "Western Group of Temples", distance: "1 km" }, { name: "Eastern Group of Temples", distance: "2 km" }, { name: "Raneh Falls", distance: "20 km" },
      { name: "Panna National Park", distance: "25 km" }, { name: "Pandav Falls", distance: "30 km" }, { name: "Archaeological Museum", distance: "1 km" },
      { name: "Jain Temples", distance: "2 km" }, { name: "Dulhadev Temple", distance: "3 km" }, { name: "Chaturbhuj Temple", distance: "3 km" },
      { name: "Ken Gharial Sanctuary", distance: "25 km" }
    ]
  },
  {
    name: "Jaisalmer",
    image: "https://images.unsplash.com/photo-1588416936097-41850ab3d86d?w=800",
    location: { city: "Jaisalmer", state: "Rajasthan", country: "India" },
    description: "Golden City famous for its yellow sandstone architecture and living fort.",
    nearbyAttractions: [
      { name: "Jaisalmer Fort", distance: "0 km" }, { name: "Sam Sand Dunes", distance: "40 km" }, { name: "Patwon Ki Haveli", distance: "1 km" },
      { name: "Gadisar Lake", distance: "2 km" }, { name: "Bada Bagh", distance: "6 km" }, { name: "Kuldhara Village", distance: "18 km" },
      { name: "Tanot Mata Temple", distance: "120 km" }, { name: "Desert National Park", distance: "40 km" }, { name: "Jain Temples", distance: "0.5 km" },
      { name: "Nathmal Ki Haveli", distance: "0.5 km" }
    ]
  },
  {
    name: "Amritsar",
    image: "https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=800",
    location: { city: "Amritsar", state: "Punjab", country: "India" },
    description: "Spiritual heart of Sikhism, home to the Golden Temple and Wagah Border.",
    nearbyAttractions: [
      { name: "Golden Temple", distance: "0 km" }, { name: "Jallianwala Bagh", distance: "0.5 km" }, { name: "Wagah Border", distance: "30 km" },
      { name: "Partition Museum", distance: "1 km" }, { name: "Gobindgarh Fort", distance: "2 km" }, { name: "Durgiana Temple", distance: "1.5 km" },
      { name: "Ram Tirath", distance: "11 km" }, { name: "Akal Takht", distance: "0 km" }, { name: "Hall Bazaar", distance: "1 km" },
      { name: "Maharaja Ranjit Singh Museum", distance: "3 km" }
    ]
  },
  {
    name: "Gangtok",
    image: "https://images.unsplash.com/photo-1578564969230-9407328326b1?w=800",
    location: { city: "Gangtok", state: "Sikkim", country: "India" },
    description: "Capital of Sikkim, known for cleanliness, Kanchenjunga views, and monasteries.",
    nearbyAttractions: [
      { name: "MG Marg", distance: "0 km" }, { name: "Tsomgo Lake", distance: "40 km" }, { name: "Nathula Pass", distance: "56 km" },
      { name: "Rumtek Monastery", distance: "24 km" }, { name: "Ban Jhakri Falls", distance: "7 km" }, { name: "Ganesh Tok", distance: "6 km" },
      { name: "Tashi View Point", distance: "8 km" }, { name: "Enchey Monastery", distance: "3 km" }, { name: "Baba Mandir", distance: "52 km" },
      { name: "Flower Exhibition Centre", distance: "2 km" }
    ]
  },
  {
    name: "Kodaikanal",
    image: "https://images.unsplash.com/photo-1591012911216-f639a4d102b9?w=800",
    location: { city: "Kodaikanal", state: "Tamil Nadu", country: "India" },
    description: "Princess of Hills, centered around a star-shaped lake.",
    nearbyAttractions: [
      { name: "Kodai Lake", distance: "0 km" }, { name: "Coaker's Walk", distance: "1 km" }, { name: "Bryant Park", distance: "1 km" },
      { name: "Pillar Rocks", distance: "7 km" }, { name: "Silver Cascade Falls", distance: "8 km" }, { name: "Green Valley View", distance: "5.5 km" },
      { name: "Dolphin's Nose", distance: "8 km" }, { name: "Bear Shola Falls", distance: "3 km" }, { name: "Guna Caves", distance: "8.5 km" },
      { name: "Berijam Lake", distance: "21 km" }
    ]
  },
  {
    name: "Nainital",
    image: "https://images.unsplash.com/photo-1596021688656-35fdc9ed0274?w=800",
    location: { city: "Nainital", state: "Uttarakhand", country: "India" },
    description: "Lake District of India, built around the mango-shaped Naini Lake.",
    nearbyAttractions: [
      { name: "Naini Lake", distance: "0 km" }, { name: "Naina Devi Temple", distance: "1 km" }, { name: "Snow View Point", distance: "3 km" },
      { name: "Tiffin Top", distance: "4 km" }, { name: "Eco Cave Gardens", distance: "2 km" }, { name: "High Altitude Zoo", distance: "2 km" },
      { name: "Bhimtal", distance: "22 km" }, { name: "Sattal", distance: "23 km" }, { name: "Naukuchiatal", distance: "26 km" },
      { name: "Kainchi Dham", distance: "17 km" }
    ]
  },
  {
    name: "Gir National Park",
    image: "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?w=800",
    location: { city: "Sasan Gir", state: "Gujarat", country: "India" },
    description: "The only natural habitat of Asiatic Lions in the world.",
    nearbyAttractions: [
      { name: "Devalia Safari Park", distance: "12 km" }, { name: "Somnath Temple", distance: "45 km" }, { name: "Kamleshwar Dam", distance: "10 km" },
      { name: "Jamjir Waterfall", distance: "20 km" }, { name: "Kankai Mata Temple", distance: "25 km" }, { name: "Uparkot Fort", distance: "75 km" },
      { name: "Mahabat Maqbara", distance: "75 km" }, { name: "Diu", distance: "65 km" }, { name: "Tulsi Shyam", distance: "30 km" },
      { name: "Chorwad Beach", distance: "60 km" }
    ]
  },
  {
    name: "Sundarbans National Park",
    image: "https://images.unsplash.com/photo-1534234828563-025317354318?w=800",
    location: { city: "Sundarbans", state: "West Bengal", country: "India" },
    description: "World's largest mangrove forest and home to Royal Bengal Tigers.",
    nearbyAttractions: [
      { name: "Sajnekhali Watch Tower", distance: "0 km" }, { name: "Sudhanyakhali Watch Tower", distance: "10 km" }, { name: "Dobanki Watch Tower", distance: "20 km" },
      { name: "Netidhopani", distance: "25 km" }, { name: "Burirdabri", distance: "40 km" }, { name: "Kanak", distance: "15 km" },
      { name: "Holiday Island", distance: "30 km" }, { name: "Bhagabatpur Crocodile Project", distance: "50 km" }, { name: "Piyali Island", distance: "70 km" },
      { name: "Bakkhali", distance: "100 km" }
    ]
  }
];

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
        rating: 4.5 + (Math.random() * 0.4),
        reviews: Math.floor(1000 + Math.random() * 50000),
        trending: true,
        trendingRank: index + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        heroImage: dest.image, // Ensure heroImage is set
        category: "Tourist Attraction", // Default category
        bestTimeToVisit: "October to March" // Default
      };
    });

    await collection.insertMany(enrichedDestinations);
    
    // Also populate trending collection
    const trendingDocs = enrichedDestinations.map(d => ({
      ...d,
      image: d.heroImage
    }));
    await trendingCollection.insertMany(trendingDocs);

    console.log(`Restored ${enrichedDestinations.length} destinations with corrected images and generated amenities.`);

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

restore();
