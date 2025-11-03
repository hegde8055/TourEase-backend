const axios = require("axios");
require("dotenv").config();

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

/**
 * Fetches a single high-quality image URL from Unsplash.
 * @param {string} query - The destination name (e.g., "Kyoto", "Goa")
 * @returns {Promise<string>} - A promise that resolves to an image URL.
 */
const fetchUnsplashImage = async (query) => {
  if (!UNSPLASH_ACCESS_KEY) {
    console.error("Unsplash Access Key is not configured in .env");
    // Return a high-quality fallback image to prevent errors
    return "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=2070";
  }

  const url = "https://api.unsplash.com/search/photos";

  try {
    const response = await axios.get(url, {
      params: {
        query: `${query} travel destination`,
        per_page: 1,
        orientation: "landscape",
        client_id: UNSPLASH_ACCESS_KEY,
      },
      headers: {
        "Accept-Version": "v1",
      },
    });

    const results = response.data.results;

    if (results && results.length > 0) {
      // Return a high-quality, but not massive, image URL
      return results[0].urls.regular;
    } else {
      console.warn(`No Unsplash image found for query: ${query}`);
      // Fallback if no image is found
      return "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=2070";
    }
  } catch (error) {
    console.error("Error fetching image from Unsplash:", error.response?.data || error.message);
    // Return a generic fallback on API error
    return "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=2070";
  }
};

module.exports = { fetchUnsplashImage };
