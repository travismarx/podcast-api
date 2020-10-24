const express = require("express");
const router = express.Router();
const rdb = require("../lib/rethink");

const get = (req, res) => {
  return rdb
    .getTable("feeds")
    // .without("inactiveEpisodes")
    .then(feeds => {
      res.send(feeds);
    });
};

router.route("/").get(get);

module.exports = router;
