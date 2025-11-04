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
  // Build URL with query parameters for GET request
  // The API returns paginated results, so we need to include pagination params
  const url = new URL("http://103.143.40.123:8282/baiguullagiinDuusakhKhugatsaaAvya");
  
  // Add register filter if provided
  if (ugugdul.register) {
    url.searchParams.append("register", ugugdul.register);
  }
  
  // Add system parameter
  url.searchParams.append("system", ugugdul.system || "qrShuukh");
  
  // Add pagination parameters to get all results
  url.searchParams.append("khuudasniiDugaar", "1");
  url.searchParams.append("khuudasniiKhemjee", "100");
  
  console.log("📡 duusakhOgnooAvya API call:", {
    url: url.toString(),
    method: "GET",
    params: ugugdul,
  });
  
  // Use GET request with query parameters
  request.get(
    url.toString(),
    { json: true },
    (err, res1, body) => {
      if (err) {
        console.error("❌ duusakhOgnooAvya request error:", err);
        next(err);
      } else {
        console.log("📡 duusakhOgnooAvya API response:", {
          statusCode: res1?.statusCode,
          statusMessage: res1?.statusMessage,
          body: body,
        });
        onFinish(body);
      }
    }
  );
}

// Authentication
router.post("/ajiltanNevtrey", asyncHandler(async (req, res, next) => {
  const io = req.app.get("socketio");
  const { db } = require("zevbackv2");

  // Ajiltan is in qrSudalgaa (main connection), use default Ajiltan model
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

  var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
    ajiltan.baiguullagiinId
  );

  // If baiguullaga not found, try fallback: match by register = nevtrekhNer
  if (!baiguullaga) {
    if (!ajiltan.baiguullagiinId) {
      console.error("❌ Employee missing baiguullagiinId:", ajiltan._id);
      throw new Error("Ажилтны байгууллагын мэдээлэл олдсонгүй!");
    }

    const baiguullagaByRegister = await Baiguullaga(
      db.erunkhiiKholbolt
    ).findOne({
      register: ajiltan.nevtrekhNer,
    });

    if (baiguullagaByRegister) {
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
    } else {
      const allBaiguullaguud = await Baiguullaga(db.erunkhiiKholbolt)
        .find({}, { _id: 1, ner: 1, register: 1 })
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
    system: "qrShuukh",
  });

  duusakhOgnooAvya(
    { register: baiguullaga.register, system: "qrShuukh" },
    async (khariu) => {
      try {
        console.log("🔍 duusakhOgnooAvya response:", khariu);
        
        // Check for success field first (old API format), then jagsaalt array (new format)
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

          console.log(
            "✅ ajiltanNevtrey completed successfully, sending response"
          );
          res.status(200).json(butsaakhObject);
        } else if (khariu.jagsaalt && Array.isArray(khariu.jagsaalt) && khariu.jagsaalt.length > 0) {
          // Handle jagsaalt format (new API format)
          console.log("✅ duusakhOgnooAvya successful, processing jagsaalt...");
          
          // Find the matching baiguullaga in jagsaalt by register
          const matchingJagsaal = khariu.jagsaalt.find(
            (j) => j.register === baiguullaga.register
          ) || khariu.jagsaalt[0]; // Fallback to first if no match
          
          const duusakhOgnoo = matchingJagsaal?.license?.duusakhOgnoo;
          
          if (duusakhOgnoo) {
            console.log("✅ Found license expiration date:", duusakhOgnoo);
            
            // Process branches (salbaruud) from jagsaalt
            var butsaakhSalbaruud = [];
            if (matchingJagsaal) {
              butsaakhSalbaruud.push({
                salbariinId: baiguullaga?.barilguud?.[0]?._id,
                duusakhOgnoo: duusakhOgnoo,
              });
            }

            // Process other branches from jagsaalt
            for await (const jagsaal of khariu.jagsaalt) {
              if (jagsaal.register !== baiguullaga.register && jagsaal.license?.duusakhOgnoo) {
                var tukhainSalbar = baiguullaga?.barilguud?.find((x) => {
                  return (
                    !!x.licenseRegister && x.licenseRegister == jagsaal.register
                  );
                });

                if (!!tukhainSalbar) {
                  butsaakhSalbaruud.push({
                    salbariinId: tukhainSalbar._id,
                    duusakhOgnoo: jagsaal.license.duusakhOgnoo,
                  });
                }
              }
            }
            butsaakhObject.salbaruud = butsaakhSalbaruud;

            console.log("🔍 Generating JWT token...");
            const jwt = await ajiltan.tokenUusgeye(
              duusakhOgnoo,
              butsaakhObject.salbaruud
            );
            console.log("🔍 JWT token generated:", jwt ? "SUCCESS" : "FAILED");
            butsaakhObject.duusakhOgnoo = duusakhOgnoo;

            if (!!butsaakhObject.result) {
              butsaakhObject.result = JSON.parse(
                JSON.stringify(butsaakhObject.result)
              );
              butsaakhObject.result.salbaruud = butsaakhObject.salbaruud;
              butsaakhObject.result.duusakhOgnoo = duusakhOgnoo;
            }

            butsaakhObject.token = jwt;

            //doorxiig zogsooliinPos-d zoriulj oruulaw
            if (!!baiguullaga?.tokhirgoo?.zogsoolNer)
              butsaakhObject.result.zogsoolNer =
                baiguullaga?.tokhirgoo?.zogsoolNer;
            else butsaakhObject.result.zogsoolNer = baiguullaga.ner;

            console.log("✅ ajiltanNevtrey completed successfully with license data");
            res.status(200).json(butsaakhObject);
          } else {
            throw new Error("License expiration date not found in response");
          }
        } else if (khariu.success === false) {
          // Handle error response format (like {success: false, msg: "..."})
          console.log("⚠️ duusakhOgnooAvya failed (non-critical):", khariu.msg || "License check failed");
          console.log("⚠️ Proceeding with login without license data");
          
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

          console.log("✅ ajiltanNevtrey completed successfully (without license data)");
          res.status(200).json(butsaakhObject);
        } else {
          // Unknown response format
          console.log("⚠️ Unknown response format from license API, proceeding without license data");
          console.log("⚠️ Response:", JSON.stringify(khariu));
          
          // Generate JWT without license expiration date
          const jwt = await ajiltan.tokenUusgeye(null, null);
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

          console.log("✅ ajiltanNevtrey completed successfully (unknown response format)");
          res.status(200).json(butsaakhObject);
        }
      } catch (err) {
        // If any error occurs, proceed with login without license data
        console.error("❌ Error processing license data:", err);
        console.log("⚠️ Proceeding with login without license data");
        
        try {
          // Generate JWT without license expiration date
          const jwt = await ajiltan.tokenUusgeye(null, null);
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

          console.log("✅ ajiltanNevtrey completed successfully (error handled)");
          res.status(200).json(butsaakhObject);
        } catch (jwtError) {
          console.error("❌ Error generating JWT:", jwtError);
          next(jwtError);
        }
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