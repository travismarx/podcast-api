const express = require("express");
const router = express.Router();
const rdb = require("../lib/rethink");

const Memcached = require('memcached');
const memcached = new Memcached('localhost:11211', {
  maxValue: 2097152
});

router.route("/").get((req, res) => {
  rdb.get("feeds", "moto60").then(response => {
    if (response) res.send(response);
    else res.sendStatus(204);
    // res.send('Show feed sending');
  });
});

router.route("/:pod/:pluckval?").get((req, res) => {
  let pod = req.params.pod;
  let pluckval = req.params.pluckval;
  let limit = parseInt(req.query.limit);

  memcached.del(pod);

  memcached.get(pod, (err, data) => {
    if (data) {
      res.send(data);
    } else {
      if (pluckval) {
        return rdb.getPluckLimit("feeds", pod, pluckval, limit).then(response => {
          if (response) res.send(response);
          else res.sendStatus(204);
        });
      } else {
        rdb
          .get("feeds", pod)
          .then(response => {
            if (response) {
              memcached.set(pod, response, 300, (err, result) => {})
              res.send(response);
            } else {
              res.sendStatus(204);
            }
          })
          .catch(err => {
            res.send(err);
          });
      }
    }
  })
});

// router.route("/:pod/:pluckval").get((req, res) => {
//   let pod = req.params.pod;
//   let pluckval = req.params.pluckval;
//   let limit = req.query.limit;

//   rdb.getPluckLimit("feeds", pod, pluckval, limit).then(response => {
//     if (response) res.send(response);
//     else res.sendStatus(204);
//   });
// });

module.exports = router;