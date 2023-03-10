const express = require("express");
const router = express.Router();
const rdb = require("../lib/rethink");
const Memcached = require("memcached");
const memcached = new Memcached("localhost:11211", { maxValue: 2097152 });
const redis = require('../lib/redis');
// const Redis     = require('redis');
// const redis     = Redis.createClient();

const get = (req, res) => {
  const pod = req.params.pod;
  const pluckval = req.params.pluckval;
  const limit = parseInt(req.query.limit);

  if (!pod) {
    return rdb.getTable("feeds").then(result => {
      console.log(result, 'result');
      return result ? res.send(result) : res.status(204);
    });
  } else if (pluckval) {
    // redis.get(`showfeed::${pod}`, (err, data) => {
    // if (data) res.send(JSON.parse(data));
    // else
    return rdb
      .getPluckLimit("feeds", pod, pluckval, limit)
      .then(response => (response ? res.send(response) : res.status(204)));
  } else {
    rdb
      .get("feeds", pod)
      .then(response => {
        if (response) {
          // redis.set(`showfeed::${pod}`, JSON.stringify(response));
          res.send(response);
        } else {
          res.status(204);
        }
      })
      .catch(err => res.send(err));
  }
  // }
  // )
};

router.route("/:pod?/:pluckval?").get(get);

//////////

module.exports = router;
