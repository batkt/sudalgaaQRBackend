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
const aldaaBarigch = require("./middleware/aldaaBarigch");

// Initialize zevbackv2 database with MongoDB URL
console.log("🔗 [ZEVBACKV2] Initializing zevbackv2 database...");
const { db } = require("zevbackv2");

// Wait for zevbackv2 database to be ready
const waitForZevbackv2 = async (mongoUrl) => {
  return new Promise((resolve) => {
    console.log(
      "🔗 [ZEVBACKV2] Initializing with URL:",
      mongoUrl.replace(/\/\/.*@/, "//***:***@")
    );
    db.kholboltUusgey(null, mongoUrl)
      .then(() => {
        const checkConnection = () => {
          if (
            db.erunkhiiKholbolt &&
            Object.keys(db.erunkhiiKholbolt).length > 0
          ) {
            console.log("✅ [ZEVBACKV2] zevbackv2 database connection ready");
            resolve();
          } else {
            console.log("⏳ [ZEVBACKV2] Waiting for database connection...");
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      })
      .catch((err) => {
        console.error("❌ [ZEVBACKV2] Database initialization failed:", err);
        resolve(); // Continue anyway
      });
  });
};

const dbUrl =
  process.env.MONGODB_URL ||
  "mongodb://admin:Br1stelback1@localhost:27017/qrSudalgaa?authSource=admin";

console.log("🔗 Attempting to connect to MongoDB...");
console.log("📍 Database URL:", dbUrl.replace(/\/\/.*@/, "//***:***@")); // Hide credentials in logs

mongoose
  .connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async (result) => {
    console.log("✅ Main MongoDB connection successful!");
    console.log("📊 Connected to database:", result.connection.name);

    // Wait for zevbackv2 database to be ready
    console.log("⏳ Waiting for zevbackv2 database connection...");
    await waitForZevbackv2(dbUrl);

    console.log("🌐 Server starting on port 8085...");
    server.listen(8085, () => {
      console.log("🚀 Server is running on http://localhost:8085");
    });
  })
  .catch((err) => {
    console.error("❌ Main MongoDB connection failed:");
    console.error("🔍 Error details:", err.message);
    console.error("📋 Full error:", err);
  });

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

zuragPack(app);
app.use(aldaaBarigch);
io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });
  socket.on("disconnect", () => {});
});
