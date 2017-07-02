const express   = require("express");
const router    = express.Router();
const rdb       = require("../lib/rethink");
const Memcached = require('memcached');
const memcached = new Memcached('localhost:11211', { maxValue: 2097152 });

const get = (req, res) => {
  const pod       = req.params.pod;
  const pluckval  = req.params.pluckval;
  const limit     = parseInt(req.query.limit);

  console.log('Getting show feed');

  memcached.get(pod, (err, data) => {
    if (data) res.send(data);
    else 
      if (pluckval) {
        return rdb
          .getPluckLimit("feeds", pod, pluckval, limit)
          .then(response =>  response ? res.send(response) : res.sendStatus(204));
      } else {
        rdb
          .get("feeds", pod)
          .then(response => {
            if (response) {
              // memcached.del(pod);
              memcached.set(pod, response, 300, (err, result) => {})
              res.send(response);
            } else {
              res.sendStatus(204);
            }
          })
          .catch(err => res.send(err));
      }
    }
  )
}

router
  .route('/:pod/:pluckval?')
  .get(get);

//////////

module.exports = router;