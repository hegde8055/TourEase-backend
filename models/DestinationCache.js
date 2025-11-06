const mongoose = require("mongoose");

const DestinationCacheSchema = new mongoose.Schema(
  {
    ownerUserId: { type: String, index: true },
    sessionKey: { type: String, index: true },
    originalQuery: { type: String, required: true },
    normalizedQuery: { type: String, required: true, index: true },
    formattedAddress: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    raw: { type: mongoose.Schema.Types.Mixed },
    searchCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
DestinationCacheSchema.index(
  { ownerUserId: 1, sessionKey: 1, normalizedQuery: 1 },
  {
    unique: true,
    partialFilterExpression: { ownerUserId: { $exists: true }, sessionKey: { $exists: true } },
    name: "user_session_query_unique",
  }
);

module.exports = mongoose.model("DestinationCache", DestinationCacheSchema);
