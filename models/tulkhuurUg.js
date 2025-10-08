const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const tulkhuurUgSchema = new Schema(
  {
    turul: String,
    tailbar: String,
    ankhaarakhEsekh: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("tulkhuurUg", tulkhuurUgSchema);
