const express   = require("express");
const router    = express.Router();
const rdb       = require("../lib/rethink");
const Memcached = require('memcached');
const memcached = new Memcached('localhost:11211', { maxValue: 2097152 });

const get = (req, res) => {
  const type = req.params.type;

  memcached.get(`info::${type}`, (err, data) => {
    if (data) res.send(data);
    else {
      rdb.get("info", type).then(result => {
        memcached.del(`info::${type}`);
        memcached.set(`info::${type}`, result, 1800)
        res.send(result);
      });
    }
  })
}

const post = (req, res) => {
  const type = req.params.type;
  const val = req.body;

  if (type === 'liveSchedule') {
    rdb.update('info', type, 'schedule', val).then(result => {
      res.send(result);
    })
  } else {
    rdb.update('info', type, type, val).then(result => {
      memcached.del(`info::${type}`);
      memcached.set(`info::${type}`, val, 1800);
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