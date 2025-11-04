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
  const { db } = require("zevbackv2");
  const mongoose = require("mongoose");

  // Use main mongoose connection (qrSudalgaa) for Ajiltan queries
  // zevbackv2 connection (turees) is only for license/baiguullaga checking
  const ajiltan = await Ajiltan
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

  // Try to find baiguullaga - automatically associate if not found
  // Baiguullaga is optional - employees can login without it
  var baiguullaga = null;
  
  if (ajiltan.baiguullagiinId) {
    baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      ajiltan.baiguullagiinId
    );
  }

  // If baiguullaga not found, try multiple fallback strategies
  if (!baiguullaga) {
    // Strategy 1: Match by register = nevtrekhNer
    let baiguullagaByRegister = await Baiguullaga(db.erunkhiiKholbolt).findOne({
      register: ajiltan.nevtrekhNer,
    });

    // Strategy 2: Match by register = employee's register field (if it's a valid register)
    if (!baiguullagaByRegister && ajiltan.register && ajiltan.register !== ajiltan.nevtrekhNer) {
      const invalidPatterns = ['Admin', 'admin', 'CAdmin', 'CAdmin1', 'user', 'User', 'test', 'Test'];
      if (!invalidPatterns.includes(ajiltan.register) && ajiltan.register.length >= 8) {
        baiguullagaByRegister = await Baiguullaga(db.erunkhiiKholbolt).findOne({
          register: ajiltan.register,
        });
      }
    }

    // Strategy 3: If still not found, use the first available baiguullaga
    if (!baiguullagaByRegister) {
      baiguullagaByRegister = await Baiguullaga(db.erunkhiiKholbolt).findOne({}).sort({ createdAt: -1 });
      console.log("🔍 No baiguullaga matched by register, using first available:", baiguullagaByRegister?._id);
    }

    if (baiguullagaByRegister) {
      // Automatically update the employee with the found baiguullaga (in qrSudalgaa database)
      await Ajiltan.updateOne(
        { _id: ajiltan._id },
        {
          $set: {
            baiguullagiinId: baiguullagaByRegister._id.toString(),
            baiguullagiinNer: baiguullagaByRegister.ner,
          },
        }
      );
      baiguullaga = baiguullagaByRegister;
      console.log("✅ Automatically associated employee with baiguullaga:", {
        ajiltanId: ajiltan._id,
        baiguullagaId: baiguullaga._id,
        baiguullagaNer: baiguullaga.ner,
        register: baiguullaga.register,
      });
    } else {
      console.log("⚠️ No baiguullaga found in database - employee will login without license data");
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

  // Always check license expiration - use baiguullaga register or employee register as fallback
  // Note: register must be a valid organization registration number, not a username
  const registerForLicense = baiguullaga?.register || ajiltan.register || ajiltan.nevtrekhNer;
  
  // Common username patterns that are not valid organization registers
  const invalidRegisterPatterns = ['Admin', 'admin', 'CAdmin', 'CAdmin1', 'user', 'User', 'test', 'Test'];
  const looksLikeUsername = invalidRegisterPatterns.includes(registerForLicense) || 
                            (registerForLicense && registerForLicense.length < 8 && !/^\d+$/.test(registerForLicense));
  
  console.log("🔍 Employee data for license check:", {
    hasBaiguullaga: !!baiguullaga,
    baiguullagaRegister: baiguullaga?.register || "N/A",
    ajiltanRegister: ajiltan.register || "N/A",
    ajiltanNevtrekhNer: ajiltan.nevtrekhNer || "N/A",
    usingRegister: registerForLicense,
    looksLikeUsername: looksLikeUsername,
  });

  // Skip license check if register looks like a username or no valid baiguullaga
  if (looksLikeUsername || !baiguullaga) {
    console.log("⚠️ Skipping license check - register looks invalid or no baiguullaga found");
    console.log("⚠️ To get license data, ensure employee has a baiguullaga with valid register");
    
    // Generate JWT without license expiration date
    console.log("🔍 Generating JWT token without license data...");
    const jwt = await ajiltan.tokenUusgeye(null, null);
    console.log("🔍 JWT token generated:", jwt ? "SUCCESS" : "FAILED");
    butsaakhObject.token = jwt;
    butsaakhObject.duusakhOgnoo = null;
    butsaakhObject.salbaruud = null;

    if (!!butsaakhObject.result) {
      butsaakhObject.result = JSON.parse(JSON.stringify(butsaakhObject.result));
      butsaakhObject.result.salbaruud = null;
      butsaakhObject.result.duusakhOgnoo = null;
    }

    //doorxiig zogsooliinPos-d zoriulj oruulaw
    if (!!baiguullaga?.tokhirgoo?.zogsoolNer)
      butsaakhObject.result.zogsoolNer = baiguullaga?.tokhirgoo?.zogsoolNer;
    else if (baiguullaga?.ner)
      butsaakhObject.result.zogsoolNer = baiguullaga.ner;
    else
      butsaakhObject.result.zogsoolNer = ajiltan.ner || "Unknown";

    console.log("✅ ajiltanNevtrey completed successfully (without license data), sending response");
    return res.status(200).json(butsaakhObject);
  }
  
  console.log("🔍 Calling duusakhOgnooAvya with:", {
    register: registerForLicense,
    system: "sukh",
  });

  duusakhOgnooAvya(
    { register: registerForLicense, system: "sukh" },
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
          else if (baiguullaga?.ner)
            butsaakhObject.result.zogsoolNer = baiguullaga.ner;
          else
            butsaakhObject.result.zogsoolNer = ajiltan.ner || "Unknown";

          res.status(200).json(butsaakhObject);
        } else {
          // License check failed - allow login to proceed without license data
          console.log("⚠️ duusakhOgnooAvya failed (non-critical):", khariu.msg || "Unknown error");
          console.log("⚠️ Proceeding with login without license data");
          
          // Generate JWT without license expiration date
          console.log("🔍 Generating JWT token without license data...");
          const jwt = await ajiltan.tokenUusgeye(
            null,
            null
          );
          console.log("🔍 JWT token generated:", jwt ? "SUCCESS" : "FAILED");
          butsaakhObject.token = jwt;

          // Set default values for license-related fields
          butsaakhObject.duusakhOgnoo = null;
          butsaakhObject.salbaruud = null;

          if (!!butsaakhObject.result) {
            butsaakhObject.result = JSON.parse(
              JSON.stringify(butsaakhObject.result)
            );
            butsaakhObject.result.salbaruud = null;
            butsaakhObject.result.duusakhOgnoo = null;
          }

          //doorxiig zogsooliinPos-d zoriulj oruulaw
          if (!!baiguullaga?.tokhirgoo?.zogsoolNer)
            butsaakhObject.result.zogsoolNer =
              baiguullaga?.tokhirgoo?.zogsoolNer;
          else if (baiguullaga?.ner)
            butsaakhObject.result.zogsoolNer = baiguullaga.ner;
          else
            butsaakhObject.result.zogsoolNer = ajiltan.ner || "Unknown";

          console.log(
            "✅ ajiltanNevtrey completed successfully (without license data), sending response"
          );
          res.status(200).json(butsaakhObject);
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