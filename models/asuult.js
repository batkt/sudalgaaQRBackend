const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const asuultSchema = new Schema(
  {
    ner: String,
    turul: String,
    idevkhteiEsekh: { type: Boolean, default: false },
    tailbar: String,
    asuultuud: [
      {
        asuult: String,
        turul: String,
        khariultuud: [String],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("asuult", asuultSchema);
