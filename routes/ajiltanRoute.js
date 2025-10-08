const express = require("express");
const router = express.Router();
const {
  ajiltanTatya,
  ajiltanZagvarAvya,
  ajiltanNemekh,
} = require("../controller/asuulgaController");
const excel = require("exceljs");
const multer = require("multer");
const mimetype = require("mime");
const storage = multer.memoryStorage();
const Ajiltan = require("../models/ajiltan");
const {
  tokenShalgakh,
  khuudaslalt,
  crud,
  UstsanBarimt,
  Segment,
  sudalgaaDuusakhOgnooAvya,
} = require("zevback");

const fs = require("fs");
const filter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/png"
  )
    cb(null, true);
  else cb(null, false);
};
const upload = multer({
  storage: storage,
  fileFilter: filter,
});
const uploadFile = multer({
  storage: storage,
});
crud(router, "ajiltan", Ajiltan, UstsanBarimt);

router.get("/ajiltanIdgaarAvya/:id", async (req, res, next) => {
  try {
    var asuult = await Ajiltan.findById(req.params.id);
    res.send(asuult);
  } catch (error) {
    next(error);
  }
});
router.get("/ajiltanZagvarAvya", ajiltanZagvarAvya);
router.post("/ajiltanTatya", uploadFile.single("file"), ajiltanTatya);
router.post("/ajiltanNemekh", ajiltanNemekh);

router.post("/ajiltanNevtrey", async (req, res, next) => {
  try {
    const ajiltan = await Ajiltan.findOne()
      .where("nevtrekhNer")
      .equals(req.body.nevtrekhNer)
      .select("+nuutsUg")
      .catch((err) => {
        next(err);
      });
    console.log(ajiltan);
    if (!ajiltan)
      throw new Error("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
    var ok = await ajiltan.passwordShalgaya(req.body.nuutsUg);
    if (!ok) throw new Error("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
    sudalgaaDuusakhOgnooAvya(
      res,
      async (khariu, res1) => {
        try {
          if (khariu.success) {
            const jwt = await ajiltan.tokenUusgeye();
            var butsaakhObject = {
              token: jwt,
              result: ajiltan,
              success: true,
            };
            res1.send(butsaakhObject);
          }
        } catch (err1) {
          next(err1);
        }
      },
      next
    );
  } catch (err) {
    next(err);
  }
});

router.post("/nuutsUgSoliyo/:id", tokenShalgakh, async (req, res, next) => {
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
