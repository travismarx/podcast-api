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

const dbConfig = require("../config/database");
const rdb      = require("../lib/rethink");
const wms      = require("../config/wmspanel");

const get = (req, res) => {
    memcached.get('livestatus', (err, data) => {
    if (err) console.log(err, 'Live Status memcache error');
    if (data) return res.send(data);
    else
        request.get(wms.reqConfig, (err, resp, body) => {
            if (err) console.log(err, "Error on the request");
            let streams = JSON.parse(body).streams;
            let statusObj = {};

            for (let i = 0; i < streams.length; i++) {
                let stream = streams[i];

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
                            memcached.set('livestatus', statusObj, 300, (err, data) => {
                                if (err) console.log(err, 'error');
                            });
                            res.send(statusObj);
                            connection.close();
                        });
                    });
                }
            }

            statusObj = {
                status: "offline",
                show: null
            };
            memcached.set('livestatus', statusObj, 300, (err, data) => {
                if (err) console.log(err, 'error');
            });
            res.send(statusObj);
        });
    })
}

router
    .route('/')
    .get(get);

//////////

module.exports = router;