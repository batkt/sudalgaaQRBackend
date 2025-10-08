const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const tsegSchema = new Schema(
  {
    kod: String,
    ner: String,
    ajiltniiToo: Number,
    ajiltnuud: [
      {
        ner: String,
        kheltes: String,
        tsol: String,
        khoch: String,
      },
    ],
    bairshil: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("tseg", tsegSchema);
