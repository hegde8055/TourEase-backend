// /server/models/Itinerary.js
const mongoose = require("mongoose");

const ItinerarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    destination: {
      id: String,
      name: { type: String, required: true },
      heroImageURL: { type: String, default: null }, // <-- ADD THIS LINE
      category: String,
      description: String,
      formatted_address: String,
      rating: mongoose.Schema.Types.Mixed,
      photo: String,
      location: {
        city: String,
        state: String,
        country: String,
        formatted: String,
        coordinates: {
          lat: Number,
          lng: Number,
        },
      },
      website: String,
      entryFee: String,
      bestTimeToVisit: String,
    },
    // New structure: Places organized by day
    touristPlacesByDay: [
      {
        dayNumber: { type: Number, required: true },
        places: [
          {
            placeId: String,
            name: String,
            address: String,
            rating: mongoose.Schema.Types.Mixed, // Can be number or null
            distanceText: String,
            categories: [String],
            heroImage: String,
            description: String,
            coordinates: {
              lat: Number,
              lng: Number,
            },
          },
        ],
      },
    ],
    // (legacy flat touristPlaces/hotels/restaurants removed - use touristPlacesByDay)
    passengerInfo: {
      passengers: {
        type: Number,
        default: 1,
        min: 1,
      },
      travelClass: {
        type: String,
        enum: ["standard", "royal", "heritage", "adventure", "wellness", "economy", "business"],
        default: "standard",
      },
      travelDates: {
        start: {
          type: Date,
          required: true,
        },
        end: {
          type: Date,
          required: true,
        },
      },
      preferences: [String],
      notes: String,
    },
    costEstimate: {
      perPerson: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        default: 0,
      },
      tax: {
        type: Number,
        default: 0,
      },
    },
    dateAdded: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["draft", "confirmed", "completed", "cancelled"],
      default: "draft",
    },
    aiPlan: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    costHistory: [
      {
        inputs: {
          basePerPerson: Number,
          passengers: Number,
          nights: Number,
          travelClass: String,
          season: String,
          taxesPct: Number,
          addOns: {
            visa: { type: Number, default: 0 },
            insurance: { type: Number, default: 0 },
            buffer: { type: Number, default: 0 },
          },
        },
        result: {
          perPerson: Number,
          subtotal: Number,
          fixedFees: Number,
          tax: Number,
          total: Number,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    distanceHistory: [
      {
        from: {
          lat: Number,
          lng: Number,
        },
        to: {
          lat: Number,
          lng: Number,
        },
        mode: { type: String, default: "drive" },
        distanceMeters: Number,
        durationSeconds: Number,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

ItinerarySchema.index({ userId: 1, dateAdded: -1 });
ItinerarySchema.index({ "passengerInfo.travelDates.start": 1 });

ItinerarySchema.virtual("tripDuration").get(function () {
  if (!this.passengerInfo?.travelDates?.start || !this.passengerInfo?.travelDates?.end) {
    return 0;
  }
  const start = new Date(this.passengerInfo.travelDates.start);
  const end = new Date(this.passengerInfo.travelDates.end);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return days;
});

ItinerarySchema.methods.isUpcoming = function () {
  if (!this.passengerInfo?.travelDates?.start) return false;
  return new Date(this.passengerInfo.travelDates.start) > new Date();
};

ItinerarySchema.methods.isPast = function () {
  if (!this.passengerInfo?.travelDates?.end) return false;
  return new Date(this.passengerInfo.travelDates.end) < new Date();
};

ItinerarySchema.set("toJSON", { virtuals: true });
ItinerarySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Itinerary", ItinerarySchema);
