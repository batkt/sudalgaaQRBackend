const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

mongoose.pluralize(null);
const ajiltanSchema = new Schema(
  {
    id: String,
    duureg: String,
    kheltes: String,
    tasag: String,
    albanTushaal: String,
    tsol: String,
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
    tokhirgoo: {
      gereeKharakhErkh: [String], //barilgiin id-nuud
      gereeZasakhErkh: [String],
      gereeSungakhErkh: [String],
      gereeSergeekhErkh: [String],
      gereeTsutslakhErkh: [String],
      umkhunSaraarKhungulultEsekh: [String],
      guilgeeUstgakhErkh: [String],
      guilgeeKhiikhEsekh: [String],
      aldangiinUldegdelZasakhEsekh: [String],
    },
  },
  {
    timestamps: true,
  }
);

ajiltanSchema.methods.tokenUusgeye = function (duusakhOgnoo, salbaruud) {
  const token = jwt.sign(
    {
      id: this._id,
      ner: this.ner,
      baiguullagiinId: this.baiguullagiinId,
      salbaruud: salbaruud || [],
      duusakhOgnoo: duusakhOgnoo || new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
    },
    process.env.APP_SECRET,
    {
      expiresIn: "12h",
    }
  );
  return token;
};

ajiltanSchema.methods.khugatsaaguiTokenUusgeye = function () {
  const token = jwt.sign(
    {
      id: this._id,
      ner: this.ner,
      baiguullagiinId: this.baiguullagiinId,
    },
    process.env.APP_SECRET,
    {}
  );
  return token;
};

ajiltanSchema.methods.zochinTokenUusgye = function (
  baiguullagiinId,
  gishuunEsekh
) {
  const token = jwt.sign(
    {
      id: "zochin",
      baiguullagiinId,
    },
    process.env.APP_SECRET,
    gishuunEsekh
      ? {
          expiresIn: "12h",
        }
      : {
          expiresIn: "1h",
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

const AjiltanModel = mongoose.model("ajiltan", ajiltanSchema);

module.exports = function a(conn) {
  if (!conn) {
    throw new Error("Холболтын мэдээлэл заавал бөглөх шаардлагатай!");
  }

  // Handle zevbackv2 connection structure
  let actualConnection = conn;
  if (conn.kholbolt) {
    actualConnection = conn.kholbolt;
  }

  // Check if the connection object is empty or invalid
  if (!actualConnection || Object.keys(actualConnection).length === 0) {
    throw new Error(
      "Холболтын мэдээлэл хоосон байна! Зэвбэкв2 холболт бэлэн болоогүй байна."
    );
  }

  if (typeof actualConnection.model !== "function") {
    throw new Error(
      "Холболтын мэдээлэл буруу байна! Модел үүсгэх боломжгүй байна."
    );
  }

  return actualConnection.model("ajiltan", ajiltanSchema);
};
