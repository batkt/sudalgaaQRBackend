const express = require("express");
const router = express.Router();
const Ajiltan = require("../models/ajiltan");
const Baiguullaga = require("../models/baiguullaga");

router.post("/baiguullagaBurtgekh", async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    
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
          // Get Ajiltan model from the connection
          // Register schema if not already registered, then get the model
          const connection = db.erunkhiiKholbolt.kholbolt;
          let AjiltanModel;
          try {
            AjiltanModel = connection.model('ajiltan');
          } catch (err) {
            // Schema not registered, register it now using the schema from the model file
            const ajiltanSchema = require('../models/ajiltan').schema;
            AjiltanModel = connection.model('ajiltan', ajiltanSchema);
          }
          let ajiltan = new AjiltanModel(req.body.ajiltan);
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

