const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const irtsSchema = new Schema(
  {
    ajiltniiId: String,
    ovog: String,
    ner: String,
    albanTushaal: String,
    tsol: String,
    ognoo: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const irtsModel = mongoose.model("irts", irtsSchema);

module.exports = irtsModel;
