// server/utils/wikipedia.js
// Utility to fetch Wikipedia summaries for a given place or topic

const axios = require("axios");

/**
 * Fetch a summary from Wikipedia for a given title (destination name).
 * @param {string} title - The Wikipedia page title (e.g., 'Taj Mahal')
 * @param {string} [lang='en'] - Language code
 * @returns {Promise<{title: string, summary: string, url: string}|null>}
 */
async function fetchWikipediaSummary(title, lang = "en") {
  if (!title) return null;
  const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const { data } = await axios.get(apiUrl);
    if (data.extract) {
      return {
        title: data.title,
        summary: data.extract,
        url:
          data.content_urls?.desktop?.page ||
          `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      };
    }
    return null;
  } catch (err) {
    // Not found or error
    return null;
  }
}

module.exports = { fetchWikipediaSummary };
