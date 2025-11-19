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

// For crud, use default model (no connection specified)
crud(router, "ajiltan", Ajiltan.default, UstsanBarimt);

router.get("/ajiltanIdgaarAvya/:id", async (req, res, next) => {
  try {
    const employee = await Ajiltan.default.findById(req.params.id).populate('departmentAssignments.departmentId', 'ner desDugaar');
    res.send(employee);
  } catch (error) {
    next(error);
  }
});

router.get("/ajiltanBuhAvya", async (req, res, next) => {
  try {
    const employees = await Ajiltan.default.findWithDepartments();
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
  const url = new URL("http://103.143.40.123:8282/baiguullagiinDuusakhKhugatsaaAvya");
  url.searchParams.append("register", ugugdul.register);
  url.searchParams.append("system", ugugdul.system || "Turees");
  
  request.get(
    url.toString(),
    { json: true },
    (err, res1, body) => {
      if (err) {
        next(err);
      } else {
        onFinish(body);
      }
    }
  );
}

// Authentication
router.post("/ajiltanNevtrey", asyncHandler(async (req, res, next) => {
  const io = req.app.get("socketio");
  const { db, NevtreltiinTuukh, nevtreltiinTuukhKhadgalya } = require("zevbackv2");

  const ajiltan = await Ajiltan(db.erunkhiiKholbolt)
    .findOne()
    .select("+nuutsUg")
    .where("nevtrekhNer")
    .equals(req.body.nevtrekhNer)
    .catch((err) => {
      next(err);
    });

  if (!ajiltan) throw new Error("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");

  var ok = await ajiltan.passwordShalgaya(req.body.nuutsUg);
  if (!ok) throw new Error("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");

  var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
    ajiltan.baiguullagiinId
  );

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

  if (!baiguullaga) {
    throw new Error("Байгууллагын мэдээлэл олдсонгүй!");
  }

  duusakhOgnooAvya(
    { register: baiguullaga.register, system: "Turees" },
    async (khariu) => {
      try {
        if (khariu.success) {
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

          const jwt = await ajiltan.tokenUusgeye(
            khariu.duusakhOgnoo,
            butsaakhObject.salbaruud
          );
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
            butsaakhObject.result.zogsoolNer = baiguullaga?.tokhirgoo?.zogsoolNer;
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

          await nevtreltiinTuukhKhadgalya(tuukh, db.erunkhiiKholbolt);

          res.status(200).json(butsaakhObject);
        } else throw new Error(khariu.msg);
      } catch (err) {
        next(err);
      }
    },
    next
  );
}));

router.post("/nuutsUgSoliyo/:id", async (req, res, next) => {
  try {
    const ajiltan = await Ajiltan.default.findById(req.params.id);
    ajiltan.isNew = false;
    ajiltan.nuutsUg = req.body.nuutsUg;
    await ajiltan.save();
    res.send("Amjilttai");
  } catch (err) {
    next(err);
  }
});

module.exports = router;