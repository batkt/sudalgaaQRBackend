const express = require("express");
const router = express.Router();
const Asuult = require("../models/asuult");
const Khariult = require("../models/khariult");
const Ajiltan = require("../models/ajiltan");
const { tokenShalgakh } = require("zevback");

const unguud = [
  "rgba(255, 99, 132, 0.2)",
  "rgba(54, 162, 235, 0.2)",
  "rgba(255, 206, 86, 0.2)",
  "rgba(75, 192, 192, 0.2)",
  "rgba(153, 102, 255, 0.2)",
  "rgba(255, 159, 64, 0.2)",
];

router.post("/tailanAvya", tokenShalgakh, async (req, res, next) => {
  try {
    var match = {};
    if (req.body.ekhlekhOgnoo || req.body.duusakhOgnoo) {
      var ognoo = {};
      if (req.body.ekhlekhOgnoo)
        ognoo["$gte"] = new Date(req.body.ekhlekhOgnoo);
      if (req.body.duusakhOgnoo)
        ognoo["$lte"] = new Date(req.body.duusakhOgnoo);
      match["createdAt"] = ognoo;
    }
    if (req.body.ajiltniiId) match["ajiltan._id"] = req.body.ajiltniiId;
    if (req.body.tasag) match["ajiltan.tasag"] = req.body.tasag;
    var id = "";
    if (req.body.turul == "tasag") id = { tasag: "$ajiltan.tasag" };
    var khariu = await Khariult.aggregate([
      { $match: match },
      { $unwind: "$khariultuud" },
      {
        $project: {
          "khariultuud.khariult": {
            $substr: ["$khariultuud.khariult", 0, 1],
          },
        },
      },
      {
        $group: {
          _id: id,
          dundaj: {
            $round: [
              {
                $avg: {
                  $toInt: "$khariultuud.khariult",
                },
              },
              2,
            ],
          },
        },
      },
    ]);
    res.send(khariu);
  } catch (error) {
    next(error);
  }
});

router.post("/graphicTailanAvya", tokenShalgakh, async (req, res, next) => {
  try {
    var match = {};
    if (req.body.ekhlekhOgnoo || req.body.duusakhOgnoo) {
      var ognoo = {};
      if (req.body.ekhlekhOgnoo)
        ognoo["$gte"] = new Date(req.body.ekhlekhOgnoo);
      if (req.body.duusakhOgnoo)
        ognoo["$lte"] = new Date(req.body.duusakhOgnoo);
      match["createdAt"] = ognoo;
    }
    if (req.body.ajiltniiId) match["ajiltan._id"] = req.body.ajiltniiId;
    if (req.body.tasag) match["ajiltan.tasag"] = req.body.tasag;
    var khariu = await Khariult.aggregate([
      { $match: match },
      { $unwind: "$khariultuud" },
      {
        $project: {
          "khariult": {
            $substrCP: ["$khariultuud.khariult", 0, 1],
          },
          "khariultuud.asuult": "$khariultuud.asuult",
        },
      },
      {
        $group: {
          _id: "$khariultuud.asuult",
          dundaj: {
            $avg: {
              $toInt: { $cond: [
                {
                  $or: [
                    {
                      $eq: ["$khariult", "1"],
                    },
                    {
                      $eq: ["$khariult", "2"],
                    },
                    {
                      $eq: ["$khariult", "3"],
                    },
                    {
                      $eq: ["$khariult", "4"],
                    },
                    {
                      $eq: ["$khariult", "5"],
                    },
                  ]
                } ,
                "$khariult", "5"
              ] },
            },
          },
        },
      },
    ]);
    var data = {
      labels: [],
      datasets: [],
    };
    if (khariu && khariu.length > 0) {
      var labels = [];
      var unelgee = [];
      for await (const x of khariu) {
        labels.push(x._id);
        unelgee.push(x.dundaj);
      }
      console.log(" labels -------------------" + JSON.stringify(labels));
      console.log(" unelgee -------------------" + JSON.stringify(unelgee));
      var data = {
        labels,
        datasets: [
          {
            label: "Үнэлгээ",
            data: unelgee,
            backgroundColor: "rgba(255, 99, 132, 0.3)",
            borderColor: "rgba(255, 99, 132, 0.3)",
            fill: false,
            lineWidth: 10,
            borderWidth: 2,
            animation: {
              animateRotate: false,
              animateScale: true,
            },
            hoverBorderWidth: 3,
          },
        ],
      };
    }
    res.send(data);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/tailanKhugatsaagaarAvya",
  tokenShalgakh,
  async (req, res, next) => {
    try {
      var unuudur = new Date();
      unuudur.setHours(0, 0, 0, 0);
      var umnukhUdur = new Date(unuudur.getTime() - 10 * 24 * 60 * 60 * 1000);
      var khariu = await Khariult.aggregate([
        {
          $match: {
            createdAt: {
              $gte: umnukhUdur,
              $gte: umnukhUdur,
            },
          },
        },
        {
          $project: {
            udur: { $dateToString: { format: "%Y-%m-%d", date: "$ognoo" } },
          },
        },
        {
          $group: {
            _id: "$udur",
            too: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);
      res.send(khariu);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
