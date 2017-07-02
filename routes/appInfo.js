const express = require("express");
const router = express.Router();
const rdb = require("../lib/rethink");

const Memcached = require('memcached');
const memcached = new Memcached('localhost:11211', {
  maxValue: 2097152
});

router.route("/:type")
  .get((req, res) => {
    const type = req.params.type;

    memcached.get(`info::${type}`, (err, data) => {
      if (data) res.send(data);
      else {
        rdb.get("info", type).then(result => {
          memcached.set(`info::${type}`, result, 604800)
          res.send(result);
        });
      }
    })
  })
  .post((req, res) => {
    const type = req.params.type;
    const val = req.body;
    // console.log(val, 'VAL');

    if (type === 'liveSchedule') {
      rdb.update('info', type, 'schedule', val).then(result => {
        // console.log(result, 'results');
        res.send(result);
      })
    } else {
      rdb.update('info', type, type, val).then(result => {
        memcached.set(`info::${type}`, val, 604800);
        res.send(result);
      })
    }
  })

module.exports = router;