const express = require("express");
const router = express.Router();
const r = require("rethinkdb");
const request = require("request");
const moment = require("moment");
const _collection = require("lodash/collection");

const Memcached = require('memcached');
const memcached = new Memcached('localhost:11211', {
    maxValue: 2097152
});
// const redis     = require('../lib/redis');
const Redis     = require('redis');
const redis     = Redis.createClient();
const dbConfig  = require("../config/database");
const rdb       = require("../lib/rethink");
const wms       = require("../config/wmspanel");

const getLiveStatus = () => {

    request.get(wms.reqConfig, (err, resp, body) => {
        if (err) console.log(err, "Error on the request");
        let _streams = JSON.parse(body).streams;
        let statusObj = {};

        for (let i = 0; i < _streams.length; i++) {
            let stream = _streams[i];

            if (stream.status === "online") {
                return r.connect({ db: 'main' })
                .then(connection => {
                    r
                    .table("info")
                    .get("liveSchedule")("schedule")
                    .filter({ epPodAbbr: stream.application })
                    .run(connection)
                    .then(matchedShows => {
                        let currentTime = moment().utcOffset(-8, true).format("X");
                        matchedShows = matchedShows.sort((a, b) => {
                            return Math.abs(currentTime - a.unix) - Math.abs(currentTime - b.unix);
                        });

                        statusObj = {
                            status: "online",
                            show: stream.application,
                            liveDetails: matchedShows[0]
                        };
                        redis.set('livestatus', JSON.stringify(statusObj), (err, data) => {
                            if (err) console.log(err, 'error');
                        });
                        // if (sendRes) res.send(statusObj);
                        connection.close();
                        return statusObj;
                    });
                });
            }
        }

        statusObj = {
            status: "offline",
            show: null
        };
        redis.set('livestatus', JSON.stringify(statusObj), (err, data) => {
            if (err) console.log(err, 'error');
        });
        // if (sendRes) res.send(statusObj);
        return statusObj;
    });
}

const get = (req, res) => {
    redis.get('livestatus', (err, data) => {
        if (err) console.log(err, 'Live Status memcache error');
        data ? res.send(JSON.parse(data)) : res.send(getLiveStatus());
    })
}

setInterval(() => {
    getLiveStatus()
}, 60000)

getLiveStatus();

router
    .route('/')
    .get(get);

//////////

module.exports = router;