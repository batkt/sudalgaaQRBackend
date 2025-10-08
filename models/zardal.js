const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);

const dedSchema = new Schema({
  desDugaar: String,
  ner: String,
});

dedSchema.add({ dedKhesguud: [dedSchema] });

const zardalSchema = new Schema(
  {
    desDugaar: String,
    ner: String,
    baiguullagiinId: String,
    barilgiinId: String,
    dedKhesguud: [dedSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("zardal", zardalSchema);

