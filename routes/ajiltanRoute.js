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
  debugDepartmentMatching,
} = require("../controller/asuulgaController");
const multer = require("multer");
const Ajiltan = require("../models/ajiltan");
const { crud, UstsanBarimt } = require("zevback");

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
router.post("/debugDepartmentMatching", debugDepartmentMatching);

// Authentication
router.post("/ajiltanNevtrey", async (req, res, next) => {
  try {
    const ajiltan = await Ajiltan.findOne()
      .where("nevtrekhNer")
      .equals(req.body.nevtrekhNer)
      .select("+nuutsUg");

    if (!ajiltan) {
      throw new Error("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
    }

    const isValidPassword = await ajiltan.passwordShalgaya(req.body.nuutsUg);
    if (!isValidPassword) {
      throw new Error("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
    }

    const token = await ajiltan.tokenUusgeye();
    res.send({
      token,
      result: ajiltan,
      success: true
    });
  } catch (err) {
    next(err);
  }
});

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