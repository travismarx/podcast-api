require("dotenv").load();

const express       = require("express");
const logger        = require("morgan");
const bodyParser    = require("body-parser");
const cors          = require("cors");
const helmet        = require("helmet");
const querystring   = require('querystring');
const unirest       = require('unirest');
const app           = require("express")();
const consts        = require('./constants/twilio')
const server        = require("http").createServer(app);
const sparkpostApi  = 'https://api.sparkpost.com/api/v1';
const Redis         = require('redis');
const redis         = Redis.createClient();
// const redis = require('./lib/redis');

server.listen(42319);

app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "5mb" }));
app.use(helmet());
app.use(cors())
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.json({ err: err.message });
  next();
});

const updateMailLists = (id) => {
  const baseUrl = `${sparkpostApi}/recipient-lists`;
  const url = baseUrl + `/${id}?show_recipients=true`;

  unirest
    .get(url)
    .headers({
      'Content-Type': 'application/json',
      'Authorization': process.env.SPARKPOST_KEY
    })
    .end(res => {
      redis.set(`maillists::${id}`, JSON.stringify(res));
    })
}

const get = (req, res) => {
  const baseUrl =  `${sparkpostApi}/recipient-lists`;
  const url = req.params.id ? baseUrl + `/${req.params.id}?show_recipients=true` : baseUrl;
  const redisKey = req.params.id ? `maillists::${req.params.id}` : 'maillists';
  redis.get(redisKey, (err, data) => {
    if (data) return res.send(JSON.parse(data));
    else
      unirest
        .get(url)
        .headers({
          'Content-Type': 'application/json',
          'Authorization': process.env.SPARKPOST_KEY
        })
        .end(result => {
          redis.set(redisKey, JSON.stringify(result));
          res.send(result);
        });
      })
}

const put = () => {
  req.body.recipients.forEach((i) => {
    delete i.return_path
  });
  const baseUrl = 'https://api.sparkpost.com/api/v1/recipient-lists';
  const url = baseUrl + `/${req.params.id}`;
  unirest
    .put(url)
    .headers({
      'Content-Type': 'application/json',
      'Authorization': process.env.SPARKPOST_KEY
    })
    .send(req.body)
    .end(result => {
      updateMailLists(result.id)
      res.send(result);
    });
}

const post = (req, res) => {
  res.send(req.body);
}

//////////

app.get('/mail/lists/:id?', get);
app.put('/mail/lists/:id', put);
app.post("/mail/unsub", post);