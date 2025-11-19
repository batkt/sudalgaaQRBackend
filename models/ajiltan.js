const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const ajiltanSchema = new Schema(
  {
    id: String,
    // Dynamic department assignments - stores hierarchy path as array of ObjectIds
    departmentAssignments: [{
      level: Number, // 0 = root, 1 = first level, etc.
      departmentId: {
        type: Schema.Types.ObjectId,
        ref: 'buleg'
      },
      departmentName: String, // Store name for easy reference
      departmentValue: String // Store the cell value from Excel
    }],
    // Employee personal information
    ovog: String,
    ner: String,
    register: String,
    utas: String,
    mail: String,
    nevtrekhNer: String,
    erkh: String,
    porool: String,
    khayag: String,
    zurgiinId: String,
    nuutsUg: {
      type: String,
      select: false,
      default: "123",
    },
  },
  {
    timestamps: true,
  }
);

ajiltanSchema.methods.tokenUusgeye = function (duusakhOgnoo, salbaruud) {
  const payload = {
    id: this._id,
    ner: this.ner,
  };
  if (duusakhOgnoo) {
    payload.duusakhOgnoo = duusakhOgnoo;
  }
  if (salbaruud) {
    payload.salbaruud = salbaruud;
  }
  const token = jwt.sign(
    payload,
    process.env.APP_SECRET,
    {
      expiresIn: "12h",
    }
  );
  return token;
};

ajiltanSchema.pre("save", async function () {
  const salt = await bcrypt.genSalt(12);
  this.nuutsUg = await bcrypt.hash(this.nuutsUg, salt);
});

ajiltanSchema.pre("updateOne", async function () {
  const salt = await bcrypt.genSalt(12);
  if (this._update.nuutsUg)
    this._update.nuutsUg = await bcrypt.hash(this._update.nuutsUg, salt);
});

ajiltanSchema.methods.passwordShalgaya = async function (pass) {
  return await bcrypt.compare(pass, this.nuutsUg);
};

// Method to populate department hierarchy
ajiltanSchema.methods.populateDepartments = function() {
  return this.populate('departmentAssignments.departmentId', 'ner desDugaar');
};

// Static method to find employees with populated departments
ajiltanSchema.statics.findWithDepartments = function(query = {}) {
  return this.find(query).populate('departmentAssignments.departmentId', 'ner desDugaar');
};

// Method to get department hierarchy as a readable path
ajiltanSchema.methods.getDepartmentPath = function() {
  return this.departmentAssignments
    .sort((a, b) => a.level - b.level)
    .map(dept => dept.departmentName)
    .join(' > ');
};

// Method to add department assignment
ajiltanSchema.methods.addDepartmentAssignment = function(level, departmentId, departmentName, departmentValue = null) {
  this.departmentAssignments.push({
    level,
    departmentId,
    departmentName,
    departmentValue
  });
  return this.save();
};

const AjiltanModel = mongoose.model("ajiltan", ajiltanSchema);

// Note: Default admin user initialization removed since we're using zevbackv2
// Admin users should be created through the baiguullagaBurtgekh route or manually

// Export function that matches zevbackv2 pattern (like Baiguullaga)
function AjiltanFunction(conn) {
  // If it's already a mongoose connection, use it directly
  if (conn && typeof conn.model === 'function') {
    // It's already a mongoose connection
    return conn.model("ajiltan", ajiltanSchema);
  }

  // Check if it has kholbolt property (expected pattern from zevbackv2)
  if (conn && conn.kholbolt && typeof conn.kholbolt === 'object') {
    const kholboltConn = conn.kholbolt;
    if (kholboltConn && typeof kholboltConn.model === 'function') {
      return kholboltConn.model("ajiltan", ajiltanSchema);
    }
  }

  // If conn is null, undefined, or empty object (or doesn't have valid connection), use default mongoose connection
  if (!conn ||
      (typeof conn === 'object' && Object.keys(conn).length === 0) ||
      (conn && typeof conn !== 'object')) {
    return AjiltanModel;
  }

  // Last resort: throw error (only if conn has properties but none are valid)
  throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
}

// Copy all static methods from AjiltanModel to the function for backward compatibility
Object.setPrototypeOf(AjiltanFunction, AjiltanModel);
Object.getOwnPropertyNames(AjiltanModel).forEach(name => {
  if (name !== 'constructor' && typeof AjiltanModel[name] === 'function') {
    AjiltanFunction[name] = AjiltanModel[name];
  }
});

// Also copy instance methods and make the function callable as a constructor
AjiltanFunction.prototype = AjiltanModel.prototype;

// Export the function as main export
module.exports = AjiltanFunction;

// Also export the default model and schema for backward compatibility
module.exports.default = AjiltanModel;
module.exports.schema = ajiltanSchema;
