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
  if (conn && typeof conn.model === 'function') {
    // It's already a mongoose connection
    return conn.model("baiguullaga", baiguullagaSchema);
  }
  
  // Check if it has kholbolt property (expected pattern from zevbackv2)
  if (conn && conn.kholbolt && typeof conn.kholbolt === 'object') {
    const kholboltConn = conn.kholbolt;
    if (kholboltConn && typeof kholboltConn.model === 'function') {
      return kholboltConn.model("baiguullaga", baiguullagaSchema);
    }
  }
  
  // If conn is null, undefined, or empty object (or doesn't have valid connection), use default mongoose connection
  if (!conn || 
      (typeof conn === 'object' && Object.keys(conn).length === 0) ||
      (conn && typeof conn !== 'object')) {
    return BaiguullagaModel;
  }
  
  // Last resort: throw error (only if conn has properties but none are valid)
  throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
};

