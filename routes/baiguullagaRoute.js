const express = require("express");
const router = express.Router();
const Ajiltan = require("../models/ajiltan");
const Baiguullaga = require("../models/baiguullaga");

router.post("/baiguullagaBurtgekh", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    
    // Debug: log the structure of db.erunkhiiKholbolt
    console.log("db.erunkhiiKholbolt structure:", {
      hasKholbolt: !!db.erunkhiiKholbolt?.kholbolt,
      hasModel: typeof db.erunkhiiKholbolt?.model === 'function',
      keys: db.erunkhiiKholbolt ? Object.keys(db.erunkhiiKholbolt) : 'null/undefined'
    });

    const baiguullaga = new Baiguullaga(db.erunkhiiKholbolt)(req.body);

    console.log("------------->" + JSON.stringify(baiguullaga));

    baiguullaga.isNew = !baiguullaga.zasakhEsekh;

    baiguullaga.barilguud = [
      {
        ner: baiguullaga.ner,
        khayag: baiguullaga.khayag,
        register: baiguullaga.register,
      },
    ];

    baiguullaga
      .save()
      .then((result) => {
        // Try to register the connection, but don't fail if it doesn't work
        Promise.resolve(db.kholboltNemye(
          baiguullaga._id,
          req.body.baaziinNer,
          "127.0.0.1:27017",
          "admin",
          "Br1stelback1"
        )).catch((kholboltError) => {
          console.error("⚠️ kholboltNemye error (non-critical):", kholboltError.message);
          // Continue execution even if connection registration fails
        });
        
        if (req.body.ajiltan) {
          let ajiltan = new Ajiltan(db.erunkhiiKholbolt)(req.body.ajiltan);
          ajiltan.erkh = "Admin";
          ajiltan.baiguullagiinId = result._id;
          ajiltan.baiguullagiinNer = result.ner;

          ajiltan
            .save()
            .then((result1) => {
              res.send("Amjilttai");
            })
            .catch((err) => {
              next(err);
            });
        } else res.send("Amjilttai");
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

