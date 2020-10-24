const express = require("express");
const router = express.Router();
const rdb = require("../lib/rethink");
const Redis = require("redis");
const redis = Redis.createClient();
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
};

const post = (req, res) => {
  const type = req.params.type;
  const val = req.body;

  console.log(type, "type");
  console.log(val, "val");
};

//////////

router.route("/:type").get(get).post(post);

module.exports = router;
