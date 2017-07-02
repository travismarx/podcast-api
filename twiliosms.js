// Load environment variables first
require("dotenv").load();

const express       = require("express");
const router        = express.Router();
const logger        = require("morgan");
const bodyParser    = require("body-parser");
const cors          = require("cors");
const helmet        = require("helmet");
const rdb           = require("./lib/rethink");
const r             = require("rethinkdb");
const dbConfig      = require("./config/database");
const unirest       = require("unirest");
const consts        = require('./constants/twilio');
const twilio        = require("twilio")(accountSid, authToken);
const accountSid    = process.env.TWILIO_ACC_SID;
const authToken     = process.env.TWILIO_AUTH_TOKEN;
const sparkpostApi  = 'https://api.sparkpost.com/api/v1';
const app           = require("express")();
const server        = require("http").createServer(app);

let newsletterStatus = 0;
let newsletterLists;

server.listen(42320);

app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "5mb" }));
app.use(cors());
app.use(helmet());
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.json({ err: err.message });
  next();
});

app.post("/twilio/handler", (request, response) => {
  const msg           = request.body.Body;
  const stream        = /stream/i,
        isNewsletter  = msg.match(/newsletter/i),
        test          = msg.match(/test/i),
        moto60        = msg.match(/moto ?60/i),
        pulp          = msg.match(/pulp ?m?x?/i),
        send          = msg.match(/send/i),
        listNum       = msg.match(/^\d{1}$/),
        fromNumber    = request.body.From;


  if (isNewsletter && send) {
    newsletterStatus++;

    if (newsletterStatus === 1) {
      unirest.get('https://api.pulpmx.com/mail/lists').end(res => {
        newsletterLists = res.body.body.results;
        const textBody = formatListOptions(newsletterLists);

        twilio.messages.create({
          body: textBody,
          to: fromNumber,
          from: process.env.TWILIO_NUM
        });

        response.send();
      });
    }
  } else if (listNum) {

    if (newsletterStatus === 1) {
      unirest
        .post(`${sparkpostApi}/transmissions`)
        .headers({
          "Content-Type": "application/json",
          Authorization: process.env.SPARKPOST_KEY
        })
        .send({
          content: { template_id: "pulpmx-newsletter" },
          recipients: { list_id: newsletterLists[listNum].id }
        })
        .end(res => {
          twilio.messages.create({
            body: `Status: ${res.statusCode}
Accepted: ${res.body.results.total_accepted_recipients}
Rejected: ${res.body.results.total_rejected_recipients}`,
            to: fromNumber,
            from: process.env.TWILIO_NUM
          });
          newsletterStatus = 0;
          response.send(res);
        }, err => response.send(err)
      );  
    } else {
      twilio.messages.create({
        body: consts.SEND_LIST_MSG,
        to: fromNumber,
        from: process.env.TWILIO_NUM
      });
      response.status(400);
    }
  }
});

const formatListOptions = (lists) => {
  let newListOptions = consts.RESPOND_LIST_ID_MSG;

  for (let i = 0; i < lists.length; i++) {
    let list = lists[i];
    newListOptions = newListOptions.concat(`${i} - ${list.id}\n`);
  }
  return newListOptions;
}