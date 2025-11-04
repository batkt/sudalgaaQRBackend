// models/license.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const licenseSchema = new Schema(
  {
    duusakhOgnoo: {
      type: Date,
      required: true,
    },
    register: {
      type: String,
      unique: true,
      index: true,
      required: false, // Only if you need to identify the org
    },
    // Optional: Store last fetched date to cache
    lastFetched: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Since single-tenant, you can have only one license record
licenseSchema.index({ _id: 1 }, { unique: true });

module.exports = mongoose.model("license", licenseSchema);