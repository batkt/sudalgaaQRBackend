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

// Function to get model for specific connection (like zevbackv2 pattern)
function getBaiguullagaModel(connection) {
  if (!connection) {
    return BaiguullagaModel;
  }
  // If connection is provided, return a model bound to that connection
  if (connection.models && connection.models.baiguullaga) {
    return connection.models.baiguullaga;
  }
  return connection.model("baiguullaga", baiguullagaSchema);
}

// Export function that can be called with connection or used as model directly
module.exports = function(connection) {
  if (connection) {
    // Return model class that can be instantiated
    const Model = getBaiguullagaModel(connection);
    return function(data) {
      return new Model(data);
    };
  }
  // If no connection, return the default model
  return BaiguullagaModel;
};

// Also export the default model for direct use
module.exports.default = BaiguullagaModel;

