const asyncHandler = require("express-async-handler");
const Ajiltan = require("../models/ajiltan");
const Baiguullaga = require("../models/baiguullaga");
const aldaa = require("../components/aldaa");
const request = require("request");
const axios = require("axios");

const useragent = require("express-useragent");
const { error } = require("console");

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

// async function nevtreltiinTuukhKhadgalya(tuukh, tukhainBaaziinKholbolt) {
//   var ipTuukh = await IpTuukh(tukhainBaaziinKholbolt).findOne({ ip: tuukh.ip });
//   if (ipTuukh) {
//     tuukh.bairshilUls = ipTuukh.bairshilUls;
//     tuukh.bairshilKhot = ipTuukh.bairshilKhot;
//   } else if (tuukh.ip) {
//     try {
//       var axiosKhariu = await axios.get(
//         "https://api.ipgeolocation.io/ipgeo?apiKey=8ee349f1c7304c379fdb6b855d1e9df4&ip=" +
//           tuukh.ip.toString()
//       );
//       ipTuukh = new IpTuukh(tukhainBaaziinKholbolt)();
//       ipTuukh.ognoo = new Date();
//       ipTuukh.medeelel = axiosKhariu.data;
//       ipTuukh.bairshilUls = axiosKhariu.data.country_name;
//       ipTuukh.bairshilKhot = axiosKhariu.data.city;
//       ipTuukh.ip = tuukh.ip;
//       tuukh.bairshilUls = ipTuukh.bairshilUls;
//       tuukh.bairshilKhot = ipTuukh.bairshilKhot;
//       await ipTuukh.save();
//     } catch (err) {}
//   }
//   await tuukh.save();
// }

exports.ajiltanNevtrey = asyncHandler(async (req, res, next) => {
  const io = req.app.get("socketio");
  const { db } = require("zevbackv2");
  const ajiltan = await Ajiltan(db.erunkhiiKholbolt)
    .findOne()
    .select("+nuutsUg")
    .where("nevtrekhNer")
    .equals(req.body.nevtrekhNer)
    .catch((err) => {
      next(err);
    });

  if (!ajiltan) throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
  var ok = await ajiltan.passwordShalgaya(req.body.nuutsUg);
  if (!ok) throw new aldaa("Хэрэглэгчийн нэр эсвэл нууц үг буруу байна!");
  var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
    ajiltan.baiguullagiinId
  );
  console.log("--------->Baiguullagiin id" + baiguullaga);

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

  console.log("----------------->ajiltan.nevtrekhNer " + ajiltan);
  duusakhOgnooAvya(
    { register: baiguullaga.register, system: "sukh" },
    async (khariu) => {
      try {
        if (khariu.success) {
          if (!!khariu.salbaruud) {
            var butsaakhSalbaruud = [];
            butsaakhSalbaruud.push({
              salbariinId: baiguullaga?.barilguud?.[0]?._id,
              duusakhOgnoo: khariu.duusakhOgnoo,
            });
            console.log("------>duusahOgnoo" + khariu.duusakhOgnoo);
            for await (const salbar of khariu.salbaruud) {
              var tukhainSalbar = baiguullaga?.barilguud?.find((x) => {
                console.log("tukhainSalbar" + tukhainSalbar);

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
          console.log("butsaahobject" + JSON.stringify(butsaakhObject));

          const jwt = await ajiltan.tokenUusgeye(
            khariu.duusakhOgnoo,
            butsaakhObject.salbaruud
          );

          console.log("--------------->token" + jwt);

          butsaakhObject.duusakhOgnoo = khariu.duusakhOgnoo;
          if (!!butsaakhObject.result) {
            butsaakhObject.result = JSON.parse(
              JSON.stringify(butsaakhObject.result)
            );
            butsaakhObject.result.salbaruud = butsaakhObject.salbaruud;
            butsaakhObject.result.duusakhOgnoo = khariu.duusakhOgnoo;
          }
          butsaakhObject.token = jwt;
          if (!!baiguullaga?.tokhirgoo?.zogsoolNer)
            butsaakhObject.result.zogsoolNer =
              baiguullaga?.tokhirgoo?.zogsoolNer;
          else butsaakhObject.result.zogsoolNer = baiguullaga.ner;
          var source = req.headers["user-agent"];
          var ua = useragent.parse(source);
          //   var tuukh = new NevtreltiinTuukh(db.erunkhiiKholbolt)();
          //   console.log("------->" + tuukh);
          //   tuukh.ajiltniiId = ajiltan._id;
          //   tuukh.ajiltniiNer = ajiltan.ner;
          //   tuukh.ognoo = new Date();
          //   tuukh.uildliinSystem = ua.os;
          //   tuukh.ip = req.headers["x-real-ip"];
          //   if (tuukh.ip && tuukh.ip.substr(0, 7) == "::ffff:") {
          //     tuukh.ip = tuukh.ip.substr(7);
          //   }
          //   ua = Object.keys(ua).reduce(function (r, e) {
          //     if (ua[e]) r[e] = ua[e];
          //     return r;
          //   }, {});
          //   tuukh.browser = ua.browser;
          //   tuukh.useragent = ua;
          //   tuukh.baiguullagiinId = ajiltan.baiguullagiinId;
          //   tuukh.baiguullagiinRegister = baiguullaga.register;
          //   await nevtreltiinTuukhKhadgalya(tuukh, db.erunkhiiKholbolt);
          res.status(200).json(butsaakhObject);
        } else throw new Error(khariu.msg);
      } catch (err) {
        next(err);
        console.log("------------>aldaaaa" + err);
      }
    },
    next
  );
});

exports.backAvya = asyncHandler(async (req, res, next) => {
  try {
    var tukhainBaaziinKholbolt = req.body.tukhainBaaziinKholbolt;
    const { exec } = require("child_process");
    try {
      fs.unlinkSync("dump.tar");
    } catch (err) {
      throw err;
    }
    const { db } = require("zevbackv2");
    var backupDB = exec(
      "mongodump --host=" +
        "localhost" +
        " --port=" +
        "27017" +
        " --db=" +
        tukhainBaaziinKholbolt.baaziinNer +
        " --archive=dump.tar" +
        "  --gzip",
      (err, stdout, stderr) => {
        if (err) {
          res.send(err);
        }
        if (stdout) {
          if (stdout.includes("error"))
            res.send(new Error("Back авах боломжгүй байна!"));
          else {
            if (!fs.existsSync("file/tmp/dump.tar"))
              res.send(new Error("Back авах боломжгүй байна!"));
            var path = require("path");
            res.sendFile(path.resolve("file/tmp/dump.tar"), function (err) {
              if (err) {
                next(err);
              } else {
                next();
              }
            });
          }
        }
        if (stderr) {
          if (stderr.includes("error"))
            res.send(new Error("Back авах боломжгүй байна!"));
          else {
            if (!fs.existsSync("dump.tar"))
              res.send(new Error("Back авах боломжгүй байна!"));
            var path = require("path");
            var stats = fs.statSync("dump.tar");
            var fileSizeInBytes = stats.size;
            var fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);
            var source = req.headers["user-agent"];
            var ua = useragent.parse(source);
            var tuukh = new BackTuukh(db.erunkhiiKholbolt)();
            tuukh.ajiltniiId = req.body.nevtersenAjiltniiToken.id;
            tuukh.ajiltniiNer = req.body.nevtersenAjiltniiToken.ner;
            tuukh.ognoo = new Date();
            tuukh.ip = req.ip;
            if (tuukh.ip.substr(0, 7) == "::ffff:") {
              tuukh.ip = tuukh.ip.substr(7);
            }
            ua = Object.keys(ua).reduce(function (r, e) {
              if (ua[e]) r[e] = ua[e];
              return r;
            }, {});
            tuukh.useragent = ua;
            tuukh.khemjee = fileSizeInMegabytes;
            tuukh.baiguullagiinId = req.body.baiguullagiinId;
            tuukh.save();
            res.sendFile(path.resolve("dump.tar"), function (err) {
              if (err) {
                next(err);
              } else {
                next();
              }
            });
          }
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

exports.tokenoorAjiltanAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    if (!req.headers.authorization) {
      next(new Error("Энэ үйлдлийг хийх эрх байхгүй байна!", 401));
    }
    const token = req.headers.authorization.split(" ")[1];
    const tokenObject = jwt.verify(token, process.env.APP_SECRET, 401);
    if (tokenObject.id == "zochin")
      next(new Error("Энэ үйлдлийг хийх эрх байхгүй байна!", 401));
    Ajiltan(db.erunkhiiKholbolt)
      .findById(tokenObject.id)
      .then((urDun) => {
        var urdunJson = urDun.toJSON();
        urdunJson.duusakhOgnoo = tokenObject.duusakhOgnoo;
        urdunJson.salbaruud = tokenObject.salbaruud;
        res.send(urdunJson);
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

exports.nuutsUgShalgakhAjiltan = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    const ajiltan = await Ajiltan(db.erunkhiiKholbolt)
      .findById(req.body.id)
      .select("+nuutsUg");
    const ok = await ajiltan.passwordShalgaya(req.body.nuutsUg);
    if (ok) res.send({ success: true });
    else
      res.send({
        success: false,
        message: "Хэрэглэгчийн одоо ашиглаж буй нууц үг буруу байна!",
      });
  } catch (error) {
    next(error);
  }
});

exports.zochiniiTokenAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var zochin = new Ajiltan(db.erunkhiiKholbolt)();
    res.send(zochin.zochinTokenUusgye(req.params.baiguullagiinId));
  } catch (error) {
    next(error);
  }
});

exports.khugatsaaguiTokenAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    if (!req.headers.authorization) {
      throw new Error("Энэ үйлдлийг хийх эрх байхгүй байна!", 401);
    }
    const token = req.headers.authorization.split(" ")[1];
    const tokenObject = jwt.verify(token, process.env.APP_SECRET, 401);
    if (tokenObject.id == "zochin")
      throw new Error("Энэ үйлдлийг хийх эрх байхгүй байна!", 401);
    Ajiltan(db.erunkhiiKholbolt)
      .findById(tokenObject.id)
      .then(async (urDun) => {
        const jwt = await urDun.khugatsaaguiTokenUusgeye();
        res.send(jwt);
      })
      .catch((err) => {
        next(err);
      });
  } catch (error) {
    next(error);
  }
});

exports.erkhiinMedeelelAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      req.body.baiguullagiinId
    );
    if (!baiguullaga) throw new Error("Байгууллагын мэдээлэл олдсонгүй!");
    request.post(
      "http://103.143.40.123:8282/erkhiinMedeelelAvya",
      {
        json: true,
        body: { system: "Turees", register: baiguullaga.register },
      },
      (err, res1, body) => {
        if (err) next(err);
        else {
          res.send(body);
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

exports.baiguullagaIdgaarAvya = asyncHandler(async (req, res, next) => {
  try {
    const { db } = require("zevbackv2");
    var baiguullaga = await Baiguullaga(db.erunkhiiKholbolt).findById(
      req.body.baiguullagiinId
    );
    if (!baiguullaga) throw new Error("Байгууллагын мэдээлэл олдсонгүй!");
    res.send(baiguullaga);
  } catch (error) {
    next(error);
  }
});
