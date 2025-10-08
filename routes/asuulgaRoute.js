const express = require("express");
const router = express.Router();
const Asuult = require("../models/asuult");
const Khariult = require("../models/khariult");
const Irts = require("../models/irts");
const TulkhuurUg = require("../models/tulkhuurUg");
const Ajiltan = require("../models/ajiltan");
const Tokhirgoo = require("../models/tokhirgoo");
const Zardal = require("../models/zardal");
const request = require("request");
const jwt = require("jsonwebtoken");
const {
  tokenShalgakh,
  khuudaslalt,
  crud,
  UstsanBarimt,
  Segment,
} = require("zevback");

const QRCode = require("qrcode");
const archiver = require("archiver");
const fs = require("fs");

crud(router, "asuult", Asuult, UstsanBarimt);
crud(router, "khariult", Khariult, UstsanBarimt);
crud(router, "irts", Irts, UstsanBarimt);
crud(router, "tulkhuurUg", TulkhuurUg, UstsanBarimt);
crud(router, "tokhirgoo", Tokhirgoo, UstsanBarimt);
crud(router, "zardal", Zardal, UstsanBarimt);

router.get("/public/khariult/:id", async (req, res, next) => {
  try {
    const khariult = await Khariult.findById(req.params.id);

    if (!khariult) {
      return res.status(404).json({
        success: false,
        aldaa: "Сэтгэгдэл олдсонгүй",
      });
    }

    res.json({
      success: true,
      data: khariult,
    });
  } catch (error) {
    console.error("Error fetching public khariult:", error);
    res.status(500).json({
      success: false,
      aldaa: "Серверийн алдаа",
    });
  }
});

router.get("/public/tulkhuurUg", async (req, res, next) => {
  try {
    const tulkhuurUg = await TulkhuurUg.find({});
    res.json({
      success: true,
      data: tulkhuurUg,
    });
  } catch (error) {
    console.error("Error fetching public tulkhuur ug:", error);
    res.status(500).json({
      success: false,
      aldaa: "Серверийн алдаа",
    });
  }
});

router.get("/chartDataAvya", async (req, res, next) => {
  try {
    const now = new Date();

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const currMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    var dateFilter = {};
    if (req.query.ekhlekhOgnoo || req.query.duusakhOgnoo) {
      if (req.query.ekhlekhOgnoo) {
        const startDate = new Date(req.query.ekhlekhOgnoo);
        startDate.setHours(0, 0, 0, 0);
        dateFilter["$gte"] = startDate;
      }
      if (req.query.duusakhOgnoo) {
        const endDate = new Date(req.query.duusakhOgnoo);
        endDate.setHours(23, 59, 59, 999);
        dateFilter["$lte"] = endDate;
      }
    }

    const query = [
      {
        $facet: {
          umnukhNiit: [
            {
              $match: {
                createdAt: { $gte: prevMonthStart, $lt: prevMonthEnd },
              },
            },
            {
              $count: "count",
            },
          ],
          odooNiit: [
            {
              $match: {
                createdAt: { $gte: currMonthStart, $lt: currMonthEnd },
              },
            },
            {
              $count: "count",
            },
          ],
          surug: [
            {
              $match: {
                surugEsekh: true,
                ...(Object.keys(dateFilter).length > 0
                  ? { createdAt: dateFilter }
                  : {}),
              },
            },
            {
              $count: "count",
            },
          ],
          eyreg: [
            {
              $match: {
                surugEsekh: false,
                ...(Object.keys(dateFilter).length > 0
                  ? { createdAt: dateFilter }
                  : {}),
              },
            },
            {
              $count: "count",
            },
          ],
          ajiltanSanal: [
            {
              $group: {
                _id: "$ajiltan._id",
                ajiltan: { $first: "$ajiltan" },
                surveyCount: { $sum: 1 },
              },
            },
            {
              $match: {
                surveyCount: { $gte: 1, $lte: 5 },
              },
            },
            {
              $sort: { surveyCount: 1 },
            },
          ],
          ajiltanSanalHighest: [
            {
              $group: {
                _id: "$ajiltan._id",
                ajiltan: { $first: "$ajiltan" },
                surveyCount: { $sum: 1 },
              },
            },
            {
              $match: {
                surveyCount: { $gte: 40 },
              },
            },
            {
              $sort: { surveyCount: -1 },
            },
          ],
        },
      },
    ];

    const result = await Khariult.aggregate(query);

    res.json({
      success: true,
      data: {
        umnukhNiit: result[0].umnukhNiit[0]?.count || 0,
        odooNiit: result[0].odooNiit[0]?.count || 0,
        surug: result[0].surug[0]?.count || 0,
        eyreg: result[0].eyreg[0]?.count || 0,
        ajiltanSanal: result[0].ajiltanSanal || [],
        ajiltanSanalHighest: result[0].ajiltanSanalHighest || [],
      },
    });
  } catch (error) {
    console.error("Error fetching chart data:", error);
    res.status(500).json({
      success: false,
      aldaa: "Серверийн алдаа",
    });
  }
});

router.get("/asuultIdgaarAvya/:id", async (req, res, next) => {
  try {
    var asuult = await Asuult.findById(req.params.id);
    res.send(asuult);
  } catch (error) {
    next(error);
  }
});

router.get("/asuultIdevkhteiIAvya", async (req, res, next) => {
  try {
    var asuult = await Asuult.findOne({ idevkhteiEsekh: true });
    res.send(asuult);
  } catch (error) {
    next(error);
  }
});

router.get("/asuultIdevkhjuulye/:id", async (req, res, next) => {
  try {
    await Asuult.updateMany(
      { idevkhteiEsekh: true },
      { $set: { idevkhteiEsekh: false } }
    );
    await Asuult.findByIdAndUpdate(req.params.id, {
      $set: { idevkhteiEsekh: true },
    });
    res.send("Amjilttai");
  } catch (error) {
    next(error);
  }
});

router.get("/idevkhteiAsuultIdAvya", async (req, res, next) => {
  try {
    var a = await Asuult.findOne({ idevkhteiEsekh: true });
    res.send(a ? a._id : null);
  } catch (error) {
    next(error);
  }
});

router.get("/asuultiinJagsaaltAvya", async (req, res, next) => {
  try {
    var asuult = await Asuult.find({});
    res.send(asuult);
  } catch (error) {
    next(error);
  }
});

router.post("/khariultKhadgalya", async (req, res, next) => {
  try {
    var khariult = new Khariult(req.body);
    var ajiltan = await Ajiltan.findOne({ utas: khariult.utas });
    if (!!ajiltan)
      throw new Error("Алба хаагчын утаснаас санал өгөх боломжгүй!");
    await khariult.save();

    if (req.body.surugEsekh) {
      try {
        const msgConfig = await Tokhirgoo.findOne({ turul: "msgTokhirgoo" });
        console.log("------------msgConfig", JSON.stringify(msgConfig));
        if (
          msgConfig &&
          msgConfig.utas &&
          msgConfig.utas.length > 0 &&
          msgConfig.msgIlgeekhKey &&
          msgConfig.msgIlgeekhDugaar
        ) {
          const text = `Surug setgegdel ilerlee. Kholboos: https://sudalgaa.zevtabs.mn/setgegdel/${khariult._id}`;

          console.log("SMS Debug - Text being sent:", text);
          console.log("SMS Debug - khariult._id:", khariult._id);

          const msgnuud = [];
          for (const phoneNumber of msgConfig.utas) {
            msgnuud.push({ to: phoneNumber, text: text });
          }

          if (msgnuud.length > 0) {
            console.log("SMS Debug - Calling msgIlgeeye function");
            msgIlgeeye(
              msgnuud,
              msgConfig.msgIlgeekhKey,
              msgConfig.msgIlgeekhDugaar,
              [],
              0,
              next,
              req,
              res
            );
          } else {
            console.log("SMS Debug - No phone numbers to send SMS to");
          }
        }
      } catch (smsError) {
        console.error("Error sending SMS:", smsError);
      }
    }

    var io = req.app.get("socketio");
    io.emit("sudalgaaBugluw");
    res.send("Amjilttai");
  } catch (error) {
    console.log("------------>", error);
    next(error);
  }
});

router.post("/unelgeeKhadgalya", async (req, res, next) => {
  try {
    var umnukhKhariu = await Khariult.findOne({
      asuultiinId: "654a406e943e5ca31352edb1",
      "ajiltan._id": req.body.ajiltan._id,
    });
    if (!!umnukhKhariu) throw new Error("Таны үнэлгээ илгээгдсэн байна!");
    var khariult = new Khariult(req.body);
    await khariult.save();
    var io = req.app.get("socketio");
    io.emit("unelgeeUguw");
    res.send("Amjilttai");
  } catch (error) {
    next(error);
  }
});

router.post("/irtsUgye", async (req, res, next) => {
  try {
    var ajiltniiId = req.body.ajiltniiId;
    var ekhlekhOgnoo = new Date(Date.now());
    var duusakhOgnoo = new Date(Date.now());
    ekhlekhOgnoo.setHours(0, 0, 0, 0);
    duusakhOgnoo.setHours(23, 59, 59, 999);
    var oldsonIrts = await Irts.findOne({
      ajiltniiId: ajiltniiId,
      ognoo: { $lt: duusakhOgnoo, $gt: ekhlekhOgnoo },
    });
    if (!oldsonIrts) {
      var ajiltan = await Ajiltan.findById(ajiltniiId);
      var irts = new Irts({
        ajiltniiId: ajiltan._id,
        ovog: ajiltan.ovog,
        ner: ajiltan.ner,
        albanTushaal: ajiltan.albanTushaal,
        tsol: ajiltan.tsol,
        ognoo: new Date(),
      });
      await irts.save();
      var io = req.app.get("socketio");
      io.emit("irtsBugluw", ajiltan);
      res.send("Амжилттай бүртгэгдлээ!");
    } else {
      res.send("Ирц бүртгэгдсэн байна!");
    }
  } catch (error) {
    next(error);
  }
});

router.post("/zipAvya", async (req, res, next) => {
  try {
    var jagsaalt = await Ajiltan.find().sort({ createdAt: -1 }).limit(64);
    if (!!jagsaalt) {
      const zipFileName = "qrcodes.zip";

      const archive = archiver("zip", {
        zlib: { level: 9 },
      });

      const output = fs.createWriteStream(zipFileName);

      output.on("close", () => {
        console.log(archive.pointer() + " total bytes");
        res.download(zipFileName);
      });

      archive.pipe(output);

      for (let i = 0; i < jagsaalt.length; i++) {
        const qrCodeFileName = jagsaalt[i].ovog + "_" + jagsaalt[i].ner;
        await generateQRCode(
          `http://feedback.transportation.police.gov.mn/uilAjillagaa/${jagsaalt[i]._id}`,
          qrCodeFileName
        );
        archive.file(qrCodeFileName, { name: `${qrCodeFileName}.png` });
      }

      archive.finalize();
    }
  } catch (error) {
    next(error);
  }
});

function msgIlgeeye(jagsaalt, key, dugaar, khariu, index, next, req, res) {
  try {
    let url =
      process.env.MSG_SERVER +
      "/send" +
      "?key=" +
      key +
      "&from=" +
      dugaar +
      "&to=" +
      jagsaalt[index].to.toString() +
      "&text=" +
      jagsaalt[index].text.toString();
    url = encodeURI(url);

    console.log("SMS Debug - Sending SMS to:", jagsaalt[index].to);
    console.log("SMS Debug - SMS URL:", url);

    request(url, { json: true }, (err1, res1, body) => {
      if (err1) {
        console.log("SMS Debug - Error sending SMS:", err1);
        next(err1);
      } else {
        console.log("SMS Debug - SMS Response:", JSON.stringify(body));
        if (jagsaalt.length > index + 1) {
          khariu.push(body[0]);
          msgIlgeeye(jagsaalt, key, dugaar, khariu, index + 1, next, req, res);
        } else {
          khariu.push(body[0]);
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

function generateQRCode(data, filename) {
  return new Promise((resolve, reject) => {
    QRCode.toFile(filename, data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

module.exports = router;
