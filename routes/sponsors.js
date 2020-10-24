const express = require("express");
const router = express.Router();
const rdb = require("../lib/rethink");
const Redis = require("redis");
const redis = Redis.createClient();

const get = (req, res) => {

  rdb.getTable("sponsors").then(result => {
    res.send(result);
  });
};

const post = (req, res) => {
  const type = req.params.type;
  const val = req.body;

  rdb.update("info", type, "schedule", val).then(result => {
    redis.set(`info::${type}`, JSON.stringify(val));
    res.send(result);
  });
};

//////////

router.route("/").get(get).post(post);

module.exports = router;
