const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.pluralize(null);

const barilgaSchema = new Schema({
  ner: String,
  khayag: String,
  register: String,
  licenseRegister: String,
  _id: Schema.Types.ObjectId,
});

const tokhirgooSchema = new Schema({
  zogsoolNer: String,
});

const baiguullagaSchema = new Schema(
  {
    ner: String,
    register: String,
    khayag: String,
    zasakhEsekh: { type: Boolean, default: false },
    barilguud: [barilgaSchema],
    tokhirgoo: tokhirgooSchema,
  },
  {
    timestamps: true,
  }
);

// Default model for main connection
const BaiguullagaModel = mongoose.model("baiguullaga", baiguullagaSchema);

// Export function that matches zevbackv2 pattern
module.exports = function a(conn) {
  // If it's already a mongoose connection, use it directly
  if (conn && conn.model) {
    // It's already a mongoose connection
    return conn.model("baiguullaga", baiguullagaSchema);
  }
  
  // Otherwise, extract kholbolt (expected pattern from zevbackv2)
  if (!conn || !conn.kholbolt) {
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  }
  conn = conn.kholbolt;
  
  // Return model class that can be instantiated or used for queries
  return conn.model("baiguullaga", baiguullagaSchema);
};

