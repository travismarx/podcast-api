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
const sparkpostApi  = require('https://api.sparkpost.com/api/v1')

server.listen(42319);

app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "5mb" }));
app.use(helmet());
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.json({ err: err.message });
  next();
});

const get = (req, res) => {
  const baseUrl =  `${sparkpostApi}/recipient-lists`
  const url = req.params.id ? baseUrl + `/${req.params.id}?show_recipients=true` : baseUrl;

  unirest
    .get(url)
    .headers({
      'Content-Type': 'application/json',
      'Authorization': process.env.SPARKPOST_KEY
    })
    .end(result => {
      res.send(result);
    });
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
      res.send(result);
    })
}

const post = (req, res) => {
  res.send(req.body);
}

//////////

app.get('/mail/lists/:id?', get);
app.put('/mail/lists/:id', put);
app.post("/mail/unsub", post);