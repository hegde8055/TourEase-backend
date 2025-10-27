const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

let fetchFn = typeof fetch === "function" ? fetch : null;

const ensureFetch = async () => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn;
};

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

const ensureWeatherConfigured = () => {
  if (!OPENWEATHER_API_KEY) {
    const error = new Error("OpenWeather API key is not configured");
    error.statusCode = 503;
    throw error;
  }
};

const WEATHER_CONDITION_SYMBOLS = {
  "01d": { label: "Sunny", symbol: "☀️" },
  "01n": { label: "Clear Night", symbol: "🌙" },
  "02d": { label: "Partly Cloudy", symbol: "🌤️" },
  "02n": { label: "Partly Cloudy", symbol: "☁️" },
  "03d": { label: "Cloudy", symbol: "☁️" },
  "03n": { label: "Cloudy", symbol: "☁️" },
  "04d": { label: "Overcast", symbol: "☁️" },
  "04n": { label: "Overcast", symbol: "☁️" },
  "09d": { label: "Showers", symbol: "🌧️" },
  "09n": { label: "Showers", symbol: "🌧️" },
  "10d": { label: "Rain", symbol: "🌦️" },
  "10n": { label: "Rain", symbol: "🌧️" },
  "11d": { label: "Thunderstorm", symbol: "⛈️" },
  "11n": { label: "Thunderstorm", symbol: "⛈️" },
  "13d": { label: "Snow", symbol: "❄️" },
  "13n": { label: "Snow", symbol: "❄️" },
  "50d": { label: "Mist", symbol: "🌫️" },
  "50n": { label: "Fog", symbol: "🌫️" },
};

const WEATHER_GROUP_FALLBACKS = {
  "01": { label: "Clear", symbol: "☀️" },
  "02": { label: "Partly Cloudy", symbol: "🌤️" },
  "03": { label: "Cloudy", symbol: "☁️" },
  "04": { label: "Overcast", symbol: "☁️" },
  "09": { label: "Showers", symbol: "🌧️" },
  10: { label: "Rain", symbol: "🌧️" },
  11: { label: "Thunderstorm", symbol: "⛈️" },
  13: { label: "Snow", symbol: "❄️" },
  50: { label: "Mist", symbol: "🌫️" },
};

const toTitleCase = (value = "") =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const resolveCondition = (iconCode = "", main = "", description = "") => {
  if (iconCode && WEATHER_CONDITION_SYMBOLS[iconCode]) {
    return WEATHER_CONDITION_SYMBOLS[iconCode];
  }

  const groupCode = iconCode ? iconCode.slice(0, 2) : "";
  if (groupCode && WEATHER_GROUP_FALLBACKS[groupCode]) {
    return WEATHER_GROUP_FALLBACKS[groupCode];
  }

  if (main) {
    const normalizedMain = main.toLowerCase();
    const match = Object.values(WEATHER_GROUP_FALLBACKS).find((entry) =>
      entry.label.toLowerCase().includes(normalizedMain)
    );
    if (match) return match;
  }

  if (description) {
    return {
      label: toTitleCase(description),
      symbol: "🌦️",
    };
  }

  return { label: "Weather", symbol: "🌦️" };
};

const buildWeatherSnapshot = (data = {}) => {
  const weatherEntry = Array.isArray(data.weather) ? data.weather[0] || {} : {};
  const temperature = data.main?.temp ?? null;
  const feelsLike = data.main?.feels_like ?? null;
  const min = data.main?.temp_min ?? null;
  const max = data.main?.temp_max ?? null;
  const iconCode = weatherEntry.icon || "";
  const iconUrl = iconCode ? `https://openweathermap.org/img/wn/${iconCode}@2x.png` : "";
  const rawDescription = weatherEntry.description || weatherEntry.main || "";
  const formattedDescription = rawDescription ? toTitleCase(rawDescription) : "";
  const resolvedCondition = resolveCondition(iconCode, weatherEntry.main, rawDescription);

  return {
    temperature,
    temp: temperature,
    feelsLike,
    feels_like: feelsLike,
    min,
    temp_min: min,
    max,
    temp_max: max,
    humidity: data.main?.humidity ?? null,
    pressure: data.main?.pressure ?? null,
    description: formattedDescription,
    condition: weatherEntry.main || formattedDescription,
    conditionLabel: resolvedCondition.label,
    symbol: resolvedCondition.symbol,
    emoji: resolvedCondition.symbol,
    icon: iconUrl,
    iconCode,
    visibility: data.visibility ?? null,
    wind: data.wind && typeof data.wind === "object" ? data.wind : null,
    clouds: data.clouds?.all ?? null,
    city: data.name || "",
    country: data.sys?.country || "",
    sunrise: data.sys?.sunrise || null,
    sunset: data.sys?.sunset || null,
    coordinates: {
      lat: data.coord?.lat ?? null,
      lng: data.coord?.lon ?? null,
    },
  };
};

const fetchCurrentWeather = async ({ lat, lng, units = "metric" } = {}) => {
  ensureWeatherConfigured();
  if (lat == null || lng == null) {
    const error = new Error("Latitude and longitude are required for weather lookups");
    error.statusCode = 400;
    throw error;
  }

  const fetch = await ensureFetch();
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lng);
  url.searchParams.set("appid", OPENWEATHER_API_KEY);
  url.searchParams.set("units", units);

  const response = await fetch(url.href);
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.message || `OpenWeather request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return {
    weather: buildWeatherSnapshot(payload),
    raw: payload,
  };
};

module.exports = {
  fetchCurrentWeather,
  ensureWeatherConfigured,
  buildWeatherSnapshot,
};
