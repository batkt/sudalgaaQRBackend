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
      departmentName: String // Store name for easy reference
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

ajiltanSchema.methods.tokenUusgeye = function () {
  const token = jwt.sign(
    {
      id: this._id,
      ner: this.ner,
    },
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
ajiltanSchema.methods.addDepartmentAssignment = function(level, departmentId, departmentName) {
  this.departmentAssignments.push({
    level,
    departmentId,
    departmentName
  });
  return this.save();
};

const AjiltanModel = mongoose.model("ajiltan", ajiltanSchema);
AjiltanModel.estimatedDocumentCount().then((count) => {
  console.dir(count);

  if (count == 0) {
    AjiltanModel.create(
      new AjiltanModel({
        ner: "Admin",
        nevtrekhNer: "Admin",
        utas: "Admin",
        mail: "Admin",
        erkh: "superAdmin",
        register: "Admin",
        albanTushaal: "Admin",
        nuutsUg: "123",
      })
    );
  }
});

module.exports = AjiltanModel;
