const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const khariultSchema = new Schema(
  {
    ajiltan: {
      _id: String,
      nevtrekhNer: String,
      ner: String,
      ovog: String,
      tsol: String,
      tasag: String,
      kheltes: String,
      utas: String,
      mail: String,
      register: String,
      khayag: String,
    },
    utas: String,
    asuultiinId: String,
    asuultiinNer: String,
    asuultiinTurul: String,
    tailbar: String,
    surugEsekh: { type: Boolean, default: false },
    onoo: { type: Number, default: 0 }, 
    onooMessage: { type: String, default: "" },
    ognoo: {
      type: Date,
      default: new Date(),
    },
    khariultuud: [
      {
        asuult: String,
        khariult: String,
        sudalgaaniiTurul: String,
      },
    ],
  },
  { timestamps: true }
);
module.exports = mongoose.model("khariult", khariultSchema);
