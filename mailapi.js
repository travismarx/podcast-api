const express = require("express");
const router = express.Router();
const http = require("http");
const https = require("https");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const sockio = require("socket.io");
const rdb = require("./lib/rethink");
const r = require("rethinkdb");
const dbConfig = require("./config/database");
const querystring = require('querystring');
const unirest = require('unirest');
const Memcached = require('memcached');
const memcached = new Memcached('localhost:11211', {
  maxValue: 2097152,
  poolSize: 15
});

// memcached.del('maillists');

memcached.touch('maillists', 0, (err) => {
  if (err) console.log(err, 'error touching maillists key');
});

// memcached.gets('maillists', (err, data) => {
//   console.log(data, 'data for get maillists');
// });

// memcached.set('maillists', 'hello', 2419200, (err, data) => {
//   if (err) console.log(err, 'error setting maillists key');
//   console.log(data, 'data setting maillists key');
// })

// memcached.get('maillists', (err, data) => {
//   if (err) console.log(err, 'error getting maillists key');

//   console.log(data, 'data for getting maillists');
// });

require("dotenv").load();

const app = require("express")();
const server = require("http").createServer(app);
const io = module.exports = require("socket.io")(server);

server.listen(42319);

// Routes
// const chatMessage = require("./routes/chatMessage");

app.use(logger("dev"));

app.use(
  bodyParser.urlencoded({
    extended: false
  })
);
app.use(
  bodyParser.json({
    limit: "5mb"
  })
);
app.use(cors());
app.use(helmet());

app.use((error, request, response, next) => {
  response.status(error.status || 500);
  response.json({
    error: error.message
  });
  // request.io = io;
  next();
});

// app.use('/', (req, res) => {
//   console.log('Empty');
//   res.send(req.url);
// })

app.use("/test", (request, response) => {

  const postData = {
    "content": {
      "template_id": "pulpmx-newsletter"
    },
    "recipients": {
      "list_id": "internal-pulp-mx-newsletter-testers"
    }
  }

  unirest.post('https://api.sparkpost.com/api/v1/transmissions')
    .headers({
      'Content-Type': 'application/json',
      'Authorization': process.env.SPARKPOST_KEY
    })
    .send(postData).end(res => {
      // console.log(res, 'unirest post res');
      response.send(res);
    }, err => {
      // console.log(err, 'error');
      response.send(err);
    })
});

app.get('/mail/lists/:id?', (req, res) => {
  const baseUrl = 'https://api.sparkpost.com/api/v1/recipient-lists';
  const url = req.params.id ? baseUrl + `/${req.params.id}?show_recipients=true` : baseUrl;

  // if (!req.params.id) {
  // memcached.get(!req.params.id ? 'maillists' : req.params.id, (err, data) => {
  //   if (err) console.log(err, 'Error getting mail lists');

  //   // console.log(data, 'data');

  //   if (data) {
  //     res.send(data);
  //   } else {
  unirest.get(url).headers({
    'Content-Type': 'application/json',
    'Authorization': process.env.SPARKPOST_KEY
  }).end(result => {
    // memcached.touch(!req.params.id ? 'maillists' : req.params.id)
    // memcached.add(!req.params.id ? 'maillists' : req.params.id, result, 10, (err, result) => {
    //   if (err) console.log(err, 'memcached set error');
    //   console.log(result, 'result for new set');
    // })
    res.send(result);
  });
  // }
});
// }
// })

app.put('/mail/lists/:id', (req, res) => {
  // delete req.body.id;
  // delete req.body.total_accepted_recipients;
  req.body.recipients.forEach((i) => {
    delete i.return_path
  });
  const baseUrl = 'https://api.sparkpost.com/api/v1/recipient-lists';
  const url = baseUrl + `/${req.params.id}`;
  unirest.put(url)
    .headers({
      'Content-Type': 'application/json',
      'Authorization': process.env.SPARKPOST_KEY
    })
    .send(req.body)
    .end(result => {
      // reassignListValue(result.id);
      res.send(result);
    })
})

app.post("/mail/unsub", (request, response) => {
  response.send(request.body);
  // const postData = {
  //   "recipients": {
  //     "template_id": "pulpmx-newsletter"
  //   }
  // }

  // unirest.put('https://api.sparkpost.com/api/v1/suppression-list')
  //   .headers({
  //     'Content-Type': 'application/json',
  //     'Authorization': process.env.SPARKPOST_KEY
  //   })
  //   .send(postData).end(res => {
  //     // console.log(res, 'unirest post res');
  //     response.send(res);
  //   }, err => {
  //     // console.log(err, 'error');
  //     response.send(err);
  //   })
});

function reassignListValue(id) {
  unirest.get(`https://api.sparkpost.com/api/v1/recipient-lists/${id}?show_recipients=true`).headers({
    'Content-Type': 'application/json',
    'Authorization': process.env.SPARKPOST_KEY
  }).end(res => {
    memcached.replace(res.results.id, res, 604800, (err, result) => {
      if (err) console.log(err, 'memcache replace error');
      console.log(result, 'result for memcache replace');
    })
  })
}