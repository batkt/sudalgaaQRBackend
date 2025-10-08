const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);

const tokhirgooSchema = new Schema(
  {
    turul: { type: String },
    utas: { type: [String] },
    msgIlgeekhKey: { type: String },
    msgIlgeekhDugaar: { type: String },
    eyregBosgo: Number,
    surugBosgo: Number, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("tokhirgoo", tokhirgooSchema);
