const express = require("express");
const router = express.Router();
const r = require("rethinkdb");
const request = require("request");
const moment = require("moment");
const _collection = require("lodash/collection");
// const redis = require("../lib/redis");
// const redis = require('ioredis');
var Redis = require("ioredis");
var redis = new Redis();

const Memcached = require("memcached");
const memcached = new Memcached("localhost:11211", {
  maxValue: 2097152
});
// const redis     = require('../lib/redis');
// const Redis = require("redis");
// const redis = Redis.createClient();
const dbConfig = require("../config/database");
const rdb = require("../lib/rethink");
const wms = require("../config/wmspanel");
const { getStatus, setStatus, liveStatus } = require("../liveStatus");

const defaultStatus = { status: "offline", show: null };

let status = defaultStatus;

const getLiveStatus = () => {
  // console.log("Getting live status");
  try {
    request.get(wms.reqConfig, (err, resp, body) => {
      if (err) {
        setStatus(defaultStatus);
        return defaultStatus;
      }

      r.connect({ db: "main" }).then(c => {
        r.table("live_status")
          .insert({ body: body })
          .run(c);
      });

      // console.log(body, "body!");
      if (body && isGoodApiResponse(body)) {
        let _streams = JSON.parse(body).streams;
        let statusObj = {};

        for (let i = 0; i < _streams.length; i++) {
          let stream = _streams[i];

          if (stream.status === "online") {
            return r.connect({ db: "main" }).then(connection => {
              r.table("info")
                .get("liveSchedule")("schedule")
                .filter({ epPodAbbr: stream.application })
                .run(connection)
                .then(matchedShows => {
                  let currentTime = moment()
                    .utcOffset(-8, true)
                    .format("X");
                  matchedShows = matchedShows.sort((a, b) => {
                    return Math.abs(currentTime - a.unix) - Math.abs(currentTime - b.unix);
                  });

                  statusObj = {
                    status: "online",
                    show: stream.application,
                    liveDetails: matchedShows[0]
                  };

                  // console.log(statusObj, "status obj 1");

                  setStatus(statusObj);
                  // redis.set("livestatus", JSON.stringify(statusObj), (err, data) => {
                  //   if (err) console.log(err, "error");
                  // });
                  // if (sendRes) res.send(statusObj);
                  connection.close();
                  // return statusObj;
                });
            });
          } else {
            const statusObj = {
              status: "offline",
              show: null
            };
            // console.log(statusObj, "status object 2");
            status = statusObj;
            setStatus(statusObj);
            // return statusObj;
          }
        }
      } else {
        statusObj = {
          status: "offline",
          show: null
        };
        status = statusObj;
        setStatus(statusObj);
      }
      // redis.set("livestatus", JSON.stringify(statusObj), (err, data) => {
      //   if (err) console.log(err, "error");
      // });
      // if (sendRes) res.send(statusObj);
      // return statusObj;
    });
  } catch (err) {
    // console.log(err, "error getting live status");
    status = defaultStatus;
    setStatus(defaultStatus);
    // return defaultStatus;
  }
};

const get = async (req, res) => {
  const status = getStatus();
  res.send(status);
  // redis.get("livestatus", (err, data) => {
  //   if (err) console.log(err, "Live Status memcache error");
  //   data ? res.send(JSON.parse(data)) : res.send(getLiveStatus());
  // });
  // res.send({
  //   status: "offline",
  //   show: null
  // });
  // res.send({
  //   status: "online",
  //   show: 'pulpmx',
  //   liveDetails:    {
  //     "cohost": "TBD",
  //     "end": "2017-02-13",
  //     "epDesc": "TBD",
  //     "epPodAbbr": "pulpmx",
  //     "epPodImg": "img/showthumbs/pulpmx.png",
  //     "epPodTitle": "The PulpMX Show Presented by BTOSports.com and Fly Racing",
  //     "guests": "TBD",
  //     "start": "2017-02-13",
  //     "title": "The PulpMX Show Presented by BTOSports.com and Fly Racing",
  //     "unix": 1487037600
  //   },
  // });
};

setInterval(() => {
  getLiveStatus();
}, 60000);

getLiveStatus();

router.route("/").get(get);

//////////

module.exports = router;

function isGoodApiResponse(body) {
  return JSON.parse(body)[0] !== "<";
}
