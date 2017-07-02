const express   = require("express");
const router    = express.Router();
const rdb       = require("../lib/rethink");
const Memcached = require('memcached');
const memcached = new Memcached('localhost:11211', { maxValue: 2097152 });
// const Redis     = require('redis');
// const redis     = Redis.createClient();
// const redis     = require('../lib/redis');


const get = (req, res) => {
  const type = req.params.type;

  // redis.get(`info::${type}`, (data) => {
    // if (data) return res.send(JSON.parse(data));
    // else {
      rdb.get("info", type).then(result => {
        // redis.set(`info::${type}`, JSON.stringify(result));
        res.send(result);
      });
    // }
  // })
}

const post = (req, res) => {
  const type = req.params.type;
  const val = req.body;

  if (type === 'liveSchedule') {
    // rdb.update('info', type, 'schedule', val).then(result => {
      // redis.set(`info::${type}`, JSON.stringify(val));
      res.send(result);
    // })
  } else {
    rdb.update('info', type, type, val).then(result => {
      // redis.set(`info::${type}`, JSON.stringify(val));
      res.send(result);
    })
  }
}

//////////

router
  .route("/:type")
  .get(get)
  .post(post)

module.exports = router;