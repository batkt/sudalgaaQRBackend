const express = require("express");
const app = express();
const mongoose = require("mongoose");
const http = require("http");
const cors = require("cors");
const server = http.Server(app);
const io = require("socket.io")(server);
const dotenv = require("dotenv");
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });
const { zuragPack } = require("zuragpack");

const asuulgaRoute = require("./routes/asuulgaRoute");
const ajiltanRoute = require("./routes/ajiltanRoute");
const tailanRoute = require("./routes/tailanRoute");
const baiguullagaRoute = require("./routes/baiguullagaRoute");
const aldaaBarigch = require("./middleware/aldaaBarigch");

const dbUrl =
  "mongodb://admin:Br1stelback1@localhost:27017/qrSudalgaa?authSource=admin";
mongoose
  .connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((result) => {
    console.log("xolbogdson");
    
    // Initialize zevbackv2 database connection
    try {
      const { db } = require("zevbackv2");
      db.kholboltUusgey(
        app,
        "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin"
      );
      console.log("zevbackv2 connection initialized");
    } catch (zevbackError) {
      console.error("⚠️ zevbackv2 initialization error:", zevbackError.message);
      // Continue even if zevbackv2 initialization fails
    }
    
    server.listen(8085);
  })
  .catch((err) => console.log(err));

process.env.TZ = "Asia/Ulaanbaatar";

app.set("socketio", io);
app.use(cors());
app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(asuulgaRoute);
app.use(ajiltanRoute);
app.use(tailanRoute);
app.use(baiguullagaRoute);

zuragPack(app);
app.use(aldaaBarigch);
io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });
  socket.on("disconnect", () => {});
});
