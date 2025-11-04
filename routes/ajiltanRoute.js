const express = require("express");
const router = express.Router();
const {
  ajiltanTatya,
  ajiltanZagvarAvya,
  ajiltanExport,
  ajiltanNemekh,
  getDepartmentHierarchy,
  getDepartmentsFlat,
  getDepartmentTemplates,
  downloadDepartmentTemplate,
} = require("../controller/asuulgaController");
const multer = require("multer");
const Ajiltan = require("../models/ajiltan");
const Baiguullaga = require("../models/baiguullaga");
const { crud, UstsanBarimt } = require("zevback");
const request = require("request");
const asyncHandler = require("express-async-handler");
const useragent = require("express-useragent");

const storage = multer.memoryStorage();
const uploadFile = multer({ storage });

crud(router, "ajiltan", Ajiltan, UstsanBarimt);

router.get("/ajiltanIdgaarAvya/:id", async (req, res, next) => {
  try {
    const employee = await Ajiltan.findById(req.params.id).populate('departmentAssignments.departmentId', 'ner desDugaar');
    res.send(employee);
  } catch (error) {
    next(error);
  }
});

router.get("/ajiltanBuhAvya", async (req, res, next) => {
  try {
    const employees = await Ajiltan.findWithDepartments();
    res.send(employees);
  } catch (error) {
    next(error);
  }
});

// Excel operations
router.get("/ajiltanZagvarAvya", ajiltanZagvarAvya);
router.get("/ajiltanExport", ajiltanExport);
router.post("/ajiltanTatya", uploadFile.single("file"), ajiltanTatya);
router.post("/ajiltanNemekh", ajiltanNemekh);

// Department routes
router.get("/departmentHierarchy", getDepartmentHierarchy);
router.get("/departmentsFlat", getDepartmentsFlat);
router.get("/departmentTemplates", getDepartmentTemplates);
router.get("/downloadTemplate/:departmentId", downloadDepartmentTemplate);

// Helper function
function duusakhOgnooAvya(ugugdul, onFinish, next) {
  request.get(
    "http://103.143.40.123:8282/baiguullagiinDuusakhKhugatsaaAvya",
    { json: true, body: ugugdul },
    (err, res1, body) => {
      if (err) next(err);
      else {
        onFinish(body);
      }
    }
  );
}

// Authentication
router.post("/ajiltanNevtrey", asyncHandler(async (req, res, next) => {
  const io = req.app.get("socketio");
  const { db, NevtreltiinTuukh, nevtreltiinTuukhKhadgalya } = require("zevbackv2");

  // Get Ajiltan model from the connection
  const connection = db.erunkhiiKholbolt.kholbolt;
  let AjiltanModel;
  try {
    AjiltanModel = connection.model('ajiltan');
  } catch (err) {
    // Schema not registered, register it now
    const ajiltanSchema = require('../models/ajiltan').schema;
    AjiltanModel = connection.model('ajiltan', ajiltanSchema);
  }

  const ajiltan = await AjiltanModel
    .findOne()
    .select("+nuutsUg")
    .where("nevtrekhNer")
    .equals(req.body.nevtrekhNer)
    .catch((err) => {
      console.error("❌ Error finding employee:", err);
      next(err);
    });

  if (!ajiltan) {
    console.log("❌ Employee not found, throwing error");
    throw new Error("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
  }

  var ok = await ajiltan.passwordShalgaya(req.body.nuutsUg);
  if (!ok) {
    throw new Error("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
  }

  var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
    ajiltan.baiguullagiinId
  );

  // If baiguullaga not found, try fallback: match by register = nevtrekhNer
  if (!baiguullaga) {
    if (!ajiltan.baiguullagiinId) {
      console.error("❌ Employee missing baiguullagiinId:", ajiltan._id);
      throw new Error("Ажилтны байгууллагын мэдээлэл олдсонгүй!");
    }

    const baiguullagaByRegister = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      register: ajiltan.nevtrekhNer,
    });

    if (baiguullagaByRegister) {
      await AjiltanModel.updateOne(
        { _id: ajiltan._id },
        {
          $set: {
            baiguullagiinId: baiguullagaByRegister._id.toString(),
            baiguullagiinNer: baiguullagaByRegister.ner,
          },
        }
      );
      baiguullaga = baiguullagaByRegister;
    } else {
      const allBaiguullaguud = await Baiguullaga(db.erunkhiiKholbolt).find({}, { _id: 1, ner: 1, register: 1 })
        .limit(10)
        .lean();

      console.error(
        "📋 Available organizations:",
        allBaiguullaguud.map((b) => ({
          _id: b._id.toString(),
          ner: b.ner,
          register: b.register,
        }))
      );

      throw new Error(
        `Байгууллагын мэдээлэл олдсонгүй! (ID: ${ajiltan.baiguullagiinId}). Ажилтны бүртгэлийг шалгана уу.`
      );
    }
  }

  var butsaakhObject = {
    result: ajiltan,
    success: true,
  };

  if (ajiltan.nevtrekhNer !== "CAdmin1") {
    io.emit(`ajiltan${ajiltan._id}`, {
      ip: req.headers["x-real-ip"],
      type: "logout",
    });
  }

  console.log("🔍 Calling duusakhOgnooAvya with:", {
    register: baiguullaga.register,
    system: "sukh",
  });

  duusakhOgnooAvya(
    { register: baiguullaga.register, system: "sukh" },
    async (khariu) => {
      try {
        console.log("🔍 duusakhOgnooAvya response:", khariu);
        if (khariu.success) {
          console.log("✅ duusakhOgnooAvya successful, processing branches...");
          if (!!khariu.salbaruud) {
            var butsaakhSalbaruud = [];
            butsaakhSalbaruud.push({
              salbariinId: baiguullaga?.barilguud?.[0]?._id,
              duusakhOgnoo: khariu.duusakhOgnoo,
            });

            for await (const salbar of khariu.salbaruud) {
              var tukhainSalbar = baiguullaga?.barilguud?.find((x) => {
                return (
                  !!x.licenseRegister && x.licenseRegister == salbar.register
                );
              });

              if (!!tukhainSalbar) {
                butsaakhSalbaruud.push({
                  salbariinId: tukhainSalbar._id,
                  duusakhOgnoo: salbar.license?.duusakhOgnoo,
                });
              }
            }
            butsaakhObject.salbaruud = butsaakhSalbaruud;
          }

          console.log("🔍 Generating JWT token...");
          const jwt = await ajiltan.tokenUusgeye(
            khariu.duusakhOgnoo,
            butsaakhObject.salbaruud
          );
          console.log("🔍 JWT token generated:", jwt ? "SUCCESS" : "FAILED");
          butsaakhObject.duusakhOgnoo = khariu.duusakhOgnoo;

          if (!!butsaakhObject.result) {
            butsaakhObject.result = JSON.parse(
              JSON.stringify(butsaakhObject.result)
            );
            butsaakhObject.result.salbaruud = butsaakhObject.salbaruud;
            butsaakhObject.result.duusakhOgnoo = khariu.duusakhOgnoo;
          }

          butsaakhObject.token = jwt;

          //doorxiig zogsooliinPos-d zoriulj oruulaw
          if (!!baiguullaga?.tokhirgoo?.zogsoolNer)
            butsaakhObject.result.zogsoolNer =
              baiguullaga?.tokhirgoo?.zogsoolNer;
          else butsaakhObject.result.zogsoolNer = baiguullaga.ner;

          var source = req.headers["user-agent"];
          var ua = useragent.parse(source);
          var tuukh = new NevtreltiinTuukh(db.erunkhiiKholbolt)();
          tuukh.ajiltniiId = ajiltan._id;
          tuukh.ajiltniiNer = ajiltan.ner;
          tuukh.ognoo = new Date();
          tuukh.uildliinSystem = ua.os;
          tuukh.ip = req.headers["x-real-ip"];

          if (tuukh.ip && tuukh.ip.substr(0, 7) == "::ffff:") {
            tuukh.ip = tuukh.ip.substr(7);
          }

          ua = Object.keys(ua).reduce(function (r, e) {
            if (ua[e]) r[e] = ua[e];
            return r;
          }, {});

          tuukh.browser = ua.browser;
          tuukh.useragent = ua;
          tuukh.baiguullagiinId = ajiltan.baiguullagiinId;
          tuukh.baiguullagiinRegister = baiguullaga.register;

          console.log("🔍 Saving login history...");
          await nevtreltiinTuukhKhadgalya(tuukh, db.erunkhiiKholbolt);
          console.log("✅ Login history saved successfully");

          console.log(
            "✅ ajiltanNevtrey completed successfully, sending response"
          );
          res.status(200).json(butsaakhObject);
        } else {
          console.log("❌ duusakhOgnooAvya failed:", khariu.msg);
          throw new Error(khariu.msg);
        }
      } catch (err) {
        console.error("❌ ajiltanNevtrey callback error:", err);
        next(err);
      }
    },
    next
  );
}));

router.post("/nuutsUgSoliyo/:id", async (req, res, next) => {
  try {
    const ajiltan = await Ajiltan.findById(req.params.id);
    ajiltan.isNew = false;
    ajiltan.nuutsUg = req.body.nuutsUg;
    await ajiltan.save();
    res.send("Amjilttai");
  } catch (err) {
    next(err);
  }
});

module.exports = router;