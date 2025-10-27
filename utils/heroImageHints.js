const slugify = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

const buildKeySet = (destination = {}) => {
  const keys = new Set();

  const push = (value) => {
    if (!value || typeof value !== "string") return;
    const slug = slugify(value);
    if (slug) keys.add(slug);
  };

  push(destination.slug);
  push(destination.name);
  push(destination.query);
  push(destination.normalizedQuery);
  push(destination.category);

  if (Array.isArray(destination.aliases)) {
    for (const alias of destination.aliases) push(alias);
  }

  const location = destination.location || {};
  push(location.name);
  push(location.city);
  push(location.state);
  push(location.country);
  push(location.formatted);

  if (Array.isArray(destination.tags)) {
    for (const tag of destination.tags) push(tag);
  }

  const countryStateCombo = [location.city, location.state, location.country]
    .filter(Boolean)
    .join(" ");
  push(countryStateCombo);

  if (typeof destination.search === "string") push(destination.search);

  return keys;
};

const HINTS = [
  {
    matches: ["tirupati", "tirumala", "sri-venkateswara-temple", "tirupati-andhra-pradesh"],
    queryVariants: [
      "Sri Venkateswara Temple Tirumala Tirupati Andhra Pradesh",
      "Tirumala Tirupati Balaji Temple India",
      "Tirupati Venkateswara Gopuram Andhra Pradesh",
    ],
    preferredKeywords: ["venkateswara", "tirumala", "gopuram", "temple", "balaji", "pilgrimage"],
    bannedKeywords: ["city skyline", "generic city", "people portrait", "construction"],
    extraTokens: ["sri", "venkateswara", "tirumala", "tirupati"],
  },
  {
    matches: ["vaishno-devi", "mata-vaishno-devi", "katra"],
    queryVariants: [
      "Vaishno Devi Bhawan Trikuta Hills Jammu",
      "Mata Vaishno Devi Temple Katra Night",
    ],
    preferredKeywords: ["pilgrimage", "temple", "shrine", "trikuta"],
    bannedKeywords: ["beach", "resort", "city skyline"],
    extraTokens: ["vaishno", "devi", "katra", "bhawan"],
  },
  {
    matches: ["kedarnath", "kedarnath-temple", "badrinath"],
    queryVariants: [
      "Kedarnath Temple Himalayas Uttarakhand",
      "Kedarnath Dham Mandir with mountains",
    ],
    preferredKeywords: ["himalaya", "snow", "temple", "pilgrimage"],
    bannedKeywords: ["city", "crowd", "illustration"],
    extraTokens: ["kedarnath", "himalaya", "mandir"],
  },
  {
    matches: ["golden-temple", "harmandir-sahib", "amritsar"],
    queryVariants: [
      "Golden Temple Harmandir Sahib Amritsar Punjab",
      "Harmandir Sahib night reflection Amritsar",
    ],
    preferredKeywords: ["gurdwara", "reflection", "sikh", "temple"],
    bannedKeywords: ["city traffic", "market", "people portrait"],
    extraTokens: ["harmandir", "sahib", "amritsar", "punjab"],
  },
];

const mergeUnique = (target, values = []) => {
  if (!Array.isArray(values)) return target;
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed && !target.includes(trimmed)) {
      target.push(trimmed);
    }
  }
  return target;
};

const getHeroImageHints = (destination = {}) => {
  const keys = buildKeySet(destination);
  const queryVariants = [];
  const preferredKeywords = [];
  const bannedKeywords = [];
  const extraTokens = [];

  for (const hint of HINTS) {
    if (!Array.isArray(hint.matches)) continue;
    const match = hint.matches.some((candidate) => keys.has(slugify(candidate)));
    if (!match) continue;

    mergeUnique(queryVariants, hint.queryVariants);
    mergeUnique(preferredKeywords, hint.preferredKeywords);
    mergeUnique(bannedKeywords, hint.bannedKeywords);
    mergeUnique(extraTokens, hint.extraTokens);
  }

  return {
    queryVariants,
    preferredKeywords,
    bannedKeywords,
    extraTokens,
  };
};

module.exports = {
  getHeroImageHints,
};
