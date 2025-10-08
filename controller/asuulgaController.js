const asyncHandler = require("express-async-handler");
const excel = require("exceljs");
const Ajiltan = require("../models/ajiltan");
const xlsx = require("xlsx");

function usegTooruuKhurvuulekh(useg) {
  if (!!useg) return useg.charCodeAt() - 65;
  else return 0;
}

function toogUsegruuKhurvuulekh(too) {
  if (!!too) {
    if (too < 26) return String.fromCharCode(too + 65);
    else {
      var orongiinToo = Math.floor(too / 26);
      var uldegdel = too % 26;
      return (
        String.fromCharCode(orongiinToo + 64) +
        String.fromCharCode(uldegdel + 65)
      );
    }
  } else return 0;
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

exports.ajiltanTatya = asyncHandler(async (req, res, next) => {
  try {
    const workbook = xlsx.read(req.file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jagsaalt = [];
    var tolgoinObject = {};
    var data = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      range: 1,
    });
    if (workbook.SheetNames[0] != "Ажилтан")
      throw new Error("Буруу файл байна!");
    if (
      !worksheet["A1"]?.v?.includes("Дүүрэг") ||
      !worksheet["B1"]?.v?.includes("Хэлтэс") ||
      !worksheet["C1"]?.v?.includes("Тасаг") ||
      !worksheet["D1"]?.v?.includes("Албан тушаал") ||
      !worksheet["E1"]?.v?.includes("Цол") ||
      !worksheet["F1"]?.v?.includes("Овог") ||
      !worksheet["G1"]?.v?.includes("Нэр") ||
      !worksheet["H1"]?.v?.includes("Регистр") ||
      !worksheet["I1"]?.v?.includes("Хувийн дугаар") ||
      !worksheet["J1"]?.v?.includes("Утас") ||
      !worksheet["K1"]?.v?.includes("Нэр дуудлага")
    ) {
      throw new Error("Та загварын дагуу бөглөөгүй байна!");
    }
    for (let cell in worksheet) {
      const cellAsString = cell.toString();
      if (
        cellAsString[1] === "1" &&
        cellAsString.length == 2 &&
        !!worksheet[cellAsString].v
      ) {
        if (worksheet[cellAsString].v === "Дүүрэг")
          tolgoinObject.duureg = cellAsString[0];
        else if (worksheet[cellAsString].v === "Хэлтэс")
          tolgoinObject.kheltes = cellAsString[0];
        else if (worksheet[cellAsString].v === "Тасаг")
          tolgoinObject.tasag = cellAsString[0];
        else if (worksheet[cellAsString].v === "Албан тушаал")
          tolgoinObject.albanTushaal = cellAsString[0];
        else if (worksheet[cellAsString].v === "Цол")
          tolgoinObject.tsol = cellAsString[0];
        else if (worksheet[cellAsString].v === "Овог")
          tolgoinObject.ovog = cellAsString[0];
        else if (worksheet[cellAsString].v === "Нэр")
          tolgoinObject.ner = cellAsString[0];
        else if (worksheet[cellAsString].v === "Регистр")
          tolgoinObject.register = cellAsString[0];
        else if (worksheet[cellAsString].v === "Хувийн дугаар")
          tolgoinObject.nevtrekhNer = cellAsString[0];
        else if (worksheet[cellAsString].v === "Утас")
          tolgoinObject.utas = cellAsString[0];
        else if (worksheet[cellAsString].v === "Нэр дуудлага")
          tolgoinObject.porool = cellAsString[0];
      }
    }
    var aldaaniiMsg = "";
    var muriinDugaar = 1;

    for await (const mur of data) {
      muriinDugaar++;
      let object = new Ajiltan();
      object.duureg = mur[usegTooruuKhurvuulekh(tolgoinObject.duureg)];
      object.kheltes = mur[usegTooruuKhurvuulekh(tolgoinObject.kheltes)];
      object.tasag = mur[usegTooruuKhurvuulekh(tolgoinObject.tasag)];
      object.albanTushaal =
        mur[usegTooruuKhurvuulekh(tolgoinObject.albanTushaal)];
      object.tsol = mur[usegTooruuKhurvuulekh(tolgoinObject.tsol)];
      object.ovog = mur[usegTooruuKhurvuulekh(tolgoinObject.ovog)];
      object.ner = mur[usegTooruuKhurvuulekh(tolgoinObject.ner)];
      object.register = mur[usegTooruuKhurvuulekh(tolgoinObject.register)];
      object.utas = mur[usegTooruuKhurvuulekh(tolgoinObject.utas)];
      object.nevtrekhNer =
        mur[usegTooruuKhurvuulekh(tolgoinObject.nevtrekhNer)];
      object.porool = mur[usegTooruuKhurvuulekh(tolgoinObject.porool)];
      jagsaalt.push(object);
    }
    if (aldaaniiMsg) throw new aldaa(aldaaniiMsg);
    Ajiltan.insertMany(jagsaalt)
      .then((result) => {
        res.status(200).send("Amjilttai");
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

exports.ajiltanZagvarAvya = asyncHandler(async (req, res, next) => {
  let workbook = new excel.Workbook();
  let worksheet = workbook.addWorksheet("Ажилтан");
  var baganuud = [
    {
      header: "Дүүрэг",
      key: "Дүүрэг",
      width: 20,
    },
    {
      header: "Хэлтэс",
      key: "Хэлтэс",
      width: 20,
    },
    {
      header: "Тасаг",
      key: "Тасаг",
      width: 20,
    },
    {
      header: "Албан тушаал",
      key: "Албан тушаал",
      width: 20,
    },
    {
      header: "Цол",
      key: "Цол",
      width: 30,
    },
    {
      header: "Овог",
      key: "Овог",
      width: 30,
    },
    {
      header: "Нэр",
      key: "Нэр",
      width: 20,
    },
    {
      header: "Регистр",
      key: "Регистр",
      width: 20,
    },
    {
      header: "Хувийн дугаар",
      key: "Хувийн дугаар",
      width: 20,
    },
    {
      header: "Утас",
      key: "Утас",
      width: 20,
    },
    {
      header: "Нэр дуудлага",
      key: "Нэр дуудлага",
      width: 20,
    },
  ];
  worksheet.columns = baganuud;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
});

exports.ajiltanNemekh = asyncHandler(async (req, res, next) => {
  try {
    const {
      duureg,
      kheltes,
      tasag,
      albanTushaal,
      tsol,
      ovog,
      ner,
      register,
      utas,
      nevtrekhNer,
      porool,
      zurgiinId
    } = req.body;

    const existingEmployee = await Ajiltan.findOne({ register });
    if (existingEmployee) {
      throw new Error("Энэ регистрийн дугаартай ажилтан бүртгэгдсэн байна!");
    }

    const existingUsername = await Ajiltan.findOne({ nevtrekhNer });
    if (existingUsername) {
      throw new Error("Энэ нэвтрэх нэртэй ажилтан бүртгэгдсэн байна!");
    }

    const newEmployee = new Ajiltan({
      duureg,
      kheltes,
      tasag,
      albanTushaal,
      tsol,
      ovog,
      ner,
      register,
      utas,
      nevtrekhNer,
      porool,
      zurgiinId,
      nuutsUg: "123" 
    });

    const savedEmployee = await newEmployee.save();
    
    res.status(201).json({
      success: true,
      message: "Ажилтан амжилттай бүртгэгдлээ",
      data: savedEmployee
    });
  } catch (error) {
    next(error);
  }
});