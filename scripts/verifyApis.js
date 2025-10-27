const path = require("path");
const colors = {
  green: (text) => `\u001b[32m${text}\u001b[0m`,
  yellow: (text) => `\u001b[33m${text}\u001b[0m`,
  red: (text) => `\u001b[31m${text}\u001b[0m`,
  cyan: (text) => `\u001b[36m${text}\u001b[0m`,
};

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

let fetchFn = typeof fetch === "function" ? fetch : null;

const ensureFetch = async () => {
  if (!fetchFn) {
    const { default: nodeFetch } = await import("node-fetch");
    fetchFn = nodeFetch;
  }
  return fetchFn;
};

const redact = (value = "") => {
  if (!value) return "<missing>";
  if (value.length <= 6) return "******";
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
};

const maybePlaceholder = (value = "") => /your[_-]?/i.test(value);

const logResult = ({ service, status, detail, error }) => {
  const heading = `${colors.cyan(service)} — ${status}`;
  if (error) {
    console.log(`${heading} ${colors.red("✖")}`);
    console.log(`  ${colors.red(error)}`);
    if (detail) console.log(`  Details: ${detail}`);
  } else {
    console.log(`${heading} ${colors.green("✔")}`);
    if (detail) console.log(`  ${detail}`);
  }
};

const results = [];

const record = (entry) => {
  results.push(entry);
  logResult(entry);
};

const testGeoapify = async () => {
  const key = process.env.GEOAPIFY_API_KEY || process.env.GEOAPIFY_PLACES_API_KEY;
  if (!key) {
    record({ service: "Geoapify", status: "missing", error: "API key not configured" });
    return;
  }

  if (maybePlaceholder(key)) {
    record({ service: "Geoapify", status: "placeholder", error: "Placeholder value detected" });
    return;
  }

  try {
    const fetch = await ensureFetch();
    const response = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=Mysuru%2C%20India&limit=1&apiKey=${key}`
    );
    const data = await response.json();

    if (!response.ok) {
      record({
        service: "Geoapify",
        status: `HTTP ${response.status}`,
        error: data?.message || "Request failed",
      });
      return;
    }

    const formatted = data?.features?.[0]?.properties?.formatted || "Unknown result";
    record({
      service: "Geoapify",
      status: "ok",
      detail: `Sample lookup → ${formatted}`,
    });
  } catch (error) {
    record({ service: "Geoapify", status: "error", error: error.message });
  }
};

const testGroq = async () => {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    record({ service: "Groq", status: "missing", error: "API key not configured" });
    return;
  }

  if (maybePlaceholder(key)) {
    record({ service: "Groq", status: "placeholder", error: "Placeholder value detected" });
    return;
  }

  const candidates = Array.from(
    new Set(
      [
        process.env.GROQ_MODEL,
        "llama-3.3-70b-versatile",
        "llama-3.2-90b-text-preview",
        "llama-3.1-8b-instant",
      ].filter(Boolean)
    )
  );

  try {
    const fetch = await ensureFetch();
    for (const model of candidates) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 32,
          temperature: 0.6,
          messages: [
            { role: "system", content: "You are a cheerful Indian travel assistant." },
            { role: "user", content: "Reply with the single word OK." },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data?.error?.message || JSON.stringify(data);
        if (/decommissioned/i.test(message) || response.status === 404) {
          continue;
        }
        record({
          service: "Groq",
          status: `HTTP ${response.status}`,
          error: message,
        });
        return;
      }

      const reply = data?.choices?.[0]?.message?.content || "<no reply>";
      record({ service: "Groq", status: "ok", detail: `Model ${model} replied: ${reply}` });
      return;
    }

    record({
      service: "Groq",
      status: "model_unavailable",
      error: "Tried multiple models, but all appear to be deprecated or unavailable.",
    });
  } catch (error) {
    record({ service: "Groq", status: "error", error: error.message });
  }
};

const testGemini = async () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    record({ service: "Gemini", status: "missing", error: "API key not configured" });
    return;
  }

  if (maybePlaceholder(key)) {
    record({ service: "Gemini", status: "placeholder", error: "Placeholder value detected" });
    return;
  }

  const candidates = Array.from(
    new Set(
      [
        process.env.GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-2.5-pro-preview-03-25",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.0-pro",
      ].filter(Boolean)
    )
  );

  try {
    const fetch = await ensureFetch();
    for (const model of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: "Please respond with the single word OK." }] },
          ],
          systemInstruction: {
            parts: [{ text: "You are a friendly Indian travel assistant verifying connectivity." }],
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 16,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data?.error?.message || JSON.stringify(data);
        if (/not found/i.test(message) || /unsupported/i.test(message)) {
          continue;
        }
        record({
          service: "Gemini",
          status: `HTTP ${response.status}`,
          error: message,
        });
        return;
      }

      const reply =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text)
          .filter(Boolean)
          .join(" ") || "<no reply>";
      record({ service: "Gemini", status: "ok", detail: `Model ${model} replied: ${reply}` });
      return;
    }

    try {
      const fetch = await ensureFetch();
      const listResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      const listData = await listResponse.json();
      const names = (listData?.models || [])
        .map((model) => (model?.name || "").split("/").pop())
        .filter(Boolean)
        .slice(0, 5)
        .join(", ");

      record({
        service: "Gemini",
        status: "model_unavailable",
        error:
          "Tried multiple Gemini models without success. Update GEMINI_MODEL to a supported value.",
        detail: names ? `First available models: ${names}` : undefined,
      });
    } catch (listError) {
      record({
        service: "Gemini",
        status: "model_unavailable",
        error:
          "Tried multiple Gemini models without success. Update GEMINI_MODEL to a supported value.",
        detail: `Additionally failed to list models: ${listError.message}`,
      });
    }
  } catch (error) {
    record({ service: "Gemini", status: "error", error: error.message });
  }
};

const testUnsplash = async () => {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    record({ service: "Unsplash", status: "missing", error: "API key not configured" });
    return;
  }

  if (maybePlaceholder(key)) {
    record({ service: "Unsplash", status: "placeholder", error: "Placeholder value detected" });
    return;
  }

  try {
    const fetch = await ensureFetch();
    const response = await fetch(
      "https://api.unsplash.com/search/photos?query=India+landscape&per_page=1",
      {
        headers: {
          Authorization: `Client-ID ${key}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      record({
        service: "Unsplash",
        status: `HTTP ${response.status}`,
        error: data?.errors?.[0] || JSON.stringify(data),
      });
      return;
    }

    const photo = data?.results?.[0];
    if (!photo) {
      record({
        service: "Unsplash",
        status: "no_results",
        error: "No photos returned for the sample search",
      });
      return;
    }

    record({
      service: "Unsplash",
      status: "ok",
      detail: `Photographer: ${photo.user?.name || "Unknown"}`,
    });
  } catch (error) {
    record({ service: "Unsplash", status: "error", error: error.message });
  }
};

const testOpenWeather = async () => {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    record({ service: "OpenWeather", status: "missing", error: "API key not configured" });
    return;
  }

  if (maybePlaceholder(key)) {
    record({ service: "OpenWeather", status: "placeholder", error: "Placeholder value detected" });
    return;
  }

  try {
    const fetch = await ensureFetch();
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=12.9716&lon=77.5946&appid=${key}&units=metric`
    );
    const data = await response.json();

    if (!response.ok) {
      record({
        service: "OpenWeather",
        status: `HTTP ${response.status}`,
        error: data?.message || JSON.stringify(data),
      });
      return;
    }

    const description = data?.weather?.[0]?.description || "n/a";
    record({
      service: "OpenWeather",
      status: "ok",
      detail: `Bengaluru conditions: ${description}, ${data?.main?.temp ?? "?"}°C`,
    });
  } catch (error) {
    record({ service: "OpenWeather", status: "error", error: error.message });
  }
};

(async () => {
  console.log(colors.cyan("Running API connectivity checks..."));
  await testGeoapify();
  await testGroq();
  await testGemini();
  await testUnsplash();
  await testOpenWeather();

  const failing = results.filter((entry) => entry.error);
  const summaryColor = failing.length ? colors.red : colors.green;
  console.log();
  console.log(
    summaryColor(
      failing.length
        ? `Checks completed with ${failing.length} issue(s).`
        : "All configured API checks passed."
    )
  );

  if (failing.length) {
    console.log("Problematic services:");
    for (const entry of failing) {
      console.log(` • ${entry.service} — ${entry.status}`);
    }
    process.exitCode = 1;
  }
})();
