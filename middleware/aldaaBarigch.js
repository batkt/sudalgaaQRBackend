const http = require("http");

function aldaagIlgeeye(aldaa, req) {
  const data = new TextEncoder().encode(
    JSON.stringify({
      system: "Hicar",
      aldaa: aldaa,
      aldaaniiMsg: aldaa.message,
      ognoo: new Date(),
      body: req.body,
      baiguullagiinId: req.body.baiguullagiinId,
      burtgesenAjiltaniiId: req.body.nevtersenAjiltniiToken.id,
      burtgesenAjiltaniiNer: req.body.nevtersenAjiltniiToken.ner,
    })
  );
  const options = {
    hostname: "127.0.0.1",
    port: 8282,
    path: "/aldaa",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };
  const request = http.request(options, (response) => {
    response.on("data", (d) => {
      if (response.statusCode == 200) {
        console.log("aldaag shidlee!");
      }
    });
  });
  request.on("error", (error) => {
    console.log("aldaa barigch deer aldaa", error);
  });

  request.write(data);
  request.end();
}
const aldaaBarigch = (err, req, res, next) => {
  console.log(err);
  if (req.body.nevtersenAjiltniiToken) aldaagIlgeeye(err, req);
  if (err.message)
    if (err.message.includes("register_1 dup key"))
      err.message = "Регистрийн дугаараар ажилтан бүртгэлтэй байна!";
    else if (err.message.includes("zakhialgiinDugaar_1 dup key"))
      err.message = "Захиалгийн дугаар давхардаж байна!";
    else if (err.message.includes("utas_1 dup key"))
      err.message = "Утасны дугаар давхардаж байна!";
    else if (err.message.includes("mail_1 dup key"))
      err.message = "Мэйл хаяг давхардаж байна!";
    else if (err.message.includes("davtagdashguiId_1 dup key")) {
      err.message =
        err.keyValue.davtagdashguiId.replace(req.body.baiguullagiinId, "") +
        " кодтой бараа бүртгэгдсэн байна!";
    } else if (err.message.includes("connect ECONNREFUSED 127.0.0.1:8282")) {
      err.message = " Лицензийн хэсэгтэй холбогдоход алдаа гарлаа!";
    }

  res.status(err.kod || 500).json({
    success: false,
    aldaa: err.message,
  });
};

module.exports = aldaaBarigch;
