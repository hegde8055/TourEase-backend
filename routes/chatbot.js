const express = require("express");
const router = express.Router();

let fetchFn = typeof fetch === "function" ? fetch : null;

const fetchApi = async (...args) => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn(...args);
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const FALLBACK_INTRO =
  "I'm having a little trouble connecting to my live travel brain right now, but here are some handpicked escapes across India you can explore:";

const SYSTEM_PROMPT = `You are "TravelEase AI," an Indian travel concierge. Provide upbeat, detailed, and actionable guidance about destinations across India, including itineraries, cultural tips, weather, transport, food, and hidden gems. Always prioritise traveller safety and call out when information may be outdated. Use bullet lists for itineraries or multi-point answers, sprinkle relevant emojis, and keep tone friendly yet professional.`;

const normalise = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase();

const getDestinationScore = (destination, keywords) => {
  const haystack = [
    destination.name,
    destination.state,
    destination.country,
    destination.category,
    destination.headline,
    destination.description,
    ...(destination.tags || []),
  ]
    .filter(Boolean)
    .map(normalise)
    .join(" ");

  return keywords.reduce((score, word) => (haystack.includes(word) ? score + 1 : score), 0);
};

const buildFallbackReply = async (message, db) => {
  if (!db) {
    return `${FALLBACK_INTRO}\n• Coorg Coffee Trails — Karnataka\n• Hampi Temple Circuit — Karnataka\n• Varanasi Dawn Ghats — Uttar Pradesh\n\nAsk me which season works best or how to stitch them into a trip!`;
  }

  try {
    const trendingCollection = db.collection("trending_destinations");
    const docs = await trendingCollection.find({ trending: true }).limit(20).toArray();

    if (!docs.length) {
      return `${FALLBACK_INTRO}\n• Kashmir Great Lakes Trek — Jammu & Kashmir\n• Meghalaya Living Root Bridges — Meghalaya\n• Havelock Azure Escape — Andaman & Nicobar Islands`;
    }

    const keywords = normalise(message)
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 8);

    const scored = docs
      .map((destination) => ({
        destination,
        score: keywords.length ? getDestinationScore(destination, keywords) : 0,
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.destination.trendingRank || Infinity) - (b.destination.trendingRank || Infinity)
      );

    const topPicks = (
      scored.some((item) => item.score > 0) ? scored.filter((item) => item.score > 0) : scored
    )
      .slice(0, 4)
      .map(({ destination }) => destination);

    const bulletLines = topPicks.map((destination) => {
      const state =
        destination.state || destination.location?.state || destination.country || "India";
      const highlight =
        destination.headline || destination.description || "An unforgettable experience.";
      return `• ${destination.name} — ${state}\n  ${highlight}`;
    });

    return `${FALLBACK_INTRO}\n\n${bulletLines.join("\n\n")}\n\nTell me which one interests you and I can suggest best seasons, budgets, or nearby add-ons.`;
  } catch (fallbackError) {
    console.error("Chatbot fallback error:", fallbackError);
    return `${FALLBACK_INTRO}\n• Spiti Valley High Circuit — Himachal Pradesh\n• Rann of Kutch Midnight Desert — Gujarat\n• Hampi Temple Circuit — Karnataka`;
  }
};

const mapHistoryToContents = (history = []) =>
  history
    .filter((item) => item && item.content)
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    }));

const mapHistoryToMessages = (history = []) =>
  history
    .filter((item) => item && item.content)
    .slice(-10)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content,
    }));

const callGroq = async (message, history = []) => {
  if (!GROQ_API_KEY) return null;

  const payload = {
    model: GROQ_MODEL,
    temperature: 0.6,
    top_p: 0.9,
    max_tokens: 900,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...mapHistoryToMessages(history),
      { role: "user", content: message },
    ],
  };

  const response = await fetchApi("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  return reply ? { reply, source: "groq" } : null;
};

const callGemini = async (message, history = []) => {
  if (!GEMINI_API_KEY) return null;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const conversation = mapHistoryToContents(history).slice(-10);
  conversation.push({ role: "user", parts: [{ text: message }] });

  const payload = {
    contents: conversation,
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.8,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetchApi(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const reply = candidate?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    ?.trim();

  return reply ? { reply, source: "gemini" } : null;
};

router.post("/", async (req, res) => {
  const { message, history = [] } = req.body || {};
  const db = req.app.locals?.db;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "A user message is required." });
  }

  const providersConfigured = Boolean(GROQ_API_KEY || GEMINI_API_KEY);

  try {
    if (GROQ_API_KEY) {
      try {
        const groqResult = await callGroq(message, history);
        if (groqResult?.reply) {
          return res.status(200).json(groqResult);
        }
      } catch (groqError) {
        console.error("Groq provider error:", groqError);
      }
    }

    if (GEMINI_API_KEY) {
      try {
        const geminiResult = await callGemini(message, history);
        if (geminiResult?.reply) {
          return res.status(200).json(geminiResult);
        }
      } catch (geminiError) {
        console.error("Gemini provider error:", geminiError);
      }
    }

    const fallbackReply = await buildFallbackReply(message, db);
    return res.status(200).json({
      reply: fallbackReply,
      source: "fallback",
      error: providersConfigured
        ? "All AI providers failed. Showing curated ideas instead."
        : "No AI provider is configured. Set GROQ_API_KEY or GEMINI_API_KEY to enable live answers.",
    });
  } catch (error) {
    console.error("Chatbot route unexpected error:", error);
    const fallbackReply = await buildFallbackReply(message, db);
    return res.status(200).json({ reply: fallbackReply, source: "fallback" });
  }
});

module.exports = router;
