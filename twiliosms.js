const express = require("express");
const router = express.Router();
const http = require("http");
const https = require("https");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
var sockio = require("socket.io");
const rdb = require("./lib/rethink");
const r = require("rethinkdb");
const dbConfig = require("./config/database");
var unirest = require("unirest");

require("dotenv").load();

const accountSid = process.env.TWILIO_ACC_SID; // Your Account SID from www.twilio.com/console
const authToken = process.env.TWILIO_AUTH_TOKEN; // Your Auth Token from www.twilio.com/console
const twilio = require("twilio")(accountSid, authToken);
const sparkpostApi = 'https://api.sparkpost.com/api/v1';

const app = require("express")();
const server = require("http").createServer(app);
server.listen(42320);

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

const newsletterTestData = {
  content: {
    template_id: "pulpmx-newsletter"
  },
  recipients: {
    list_id: "internal-pulp-mx-newsletter-testers"
  }
};
const newsletterProdData = {
  content: {
    template_id: "pulpmx-newsletter"
  },
  recipients: {
    list_id: "5k"
  }
};

let newsletterStatus = 0;
let newsletterLists;

app.post("/twilio/handler", (request, response) => {
  const msg = request.body.Body;
  const stream = /stream/i,
    isNewsletter = msg.match(/newsletter/i),
    test = msg.match(/test/i),
    moto60 = msg.match(/moto ?60/i),
    pulp = msg.match(/pulp ?m?x?/i),
    send = msg.match(/send/i),
    listNum = msg.match(/^\d{1}$/),
    fromNumber = request.body.From;


  if (isNewsletter && send) {
    newsletterStatus++;

    if (newsletterStatus === 1) {
      unirest.get('https://api.pulpmx.com/mail/lists').end(res => {
        newsletterLists = res.body.body.results;
        // console.log(res.body.body.results, 'GET LIST RES');
        let textBody = formatListOptions(newsletterLists);
        twilio.messages.create({
          body: textBody,
          to: fromNumber,
          from: process.env.TWILIO_NUM
        });
        response.send();
      });
    }
  } else if (listNum) {
    // newsletterStatus = 0;
    // console.log(newsletterLists[listNum].id, 'list num');
    if (newsletterStatus === 1) {
      unirest
        .post(`${sparkpostApi}/transmissions`)
        .headers({
          "Content-Type": "application/json",
          Authorization: process.env.SPARKPOST_KEY
        })
        .send({
          content: {
            template_id: "pulpmx-newsletter"
          },
          recipients: {
            list_id: newsletterLists[listNum].id
          }
        })
        .end(
          res => {
            // console.log(res, 'unirest post res');
            // response.send(res);
            twilio.messages.create({
              body: `Status: ${res.statusCode}
Accepted: ${res.body.results.total_accepted_recipients}
Rejected: ${res.body.results.total_rejected_recipients}`,
              to: fromNumber,
              from: process.env.TWILIO_NUM
            });
            newsletterStatus = 0;
            response.send(res);
          },
          err => {
            // console.log(err, 'error');
            response.send(err);
          }
        );
    } else {
      twilio.messages.create({
        body: `To send newsletter, please text 'Send newsletter' first to ensure list number assignments are correct`,
        to: fromNumber,
        from: process.env.TWILIO_NUM
      });
      response.status(400);
    }
  }
});

app.use("/test", (request, response) => {
  const postData = {
    content: {
      template_id: "pulpmx-newsletter"
    },
    recipients: {
      list_id: "trav-only"
    }
  };

  unirest
    .post("https://api.sparkpost.com/api/v1/transmissions")
    .headers({
      "Content-Type": "application/json",
      Authorization: process.env.SPARKPOST_KEY
    })
    .send(postData)
    .end(
      res => {
        // console.log(res, 'unirest post res');
        response.send(res);
      },
      err => {
        // console.log(err, 'error');
        response.send(err);
      }
    );
});

app.post("/unsub", (request, response) => {
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

const formatListOptions = (lists) => {
  let newListOptions = 'Respond with the number assigned to list you would like to send to\n';

  for (let i = 0; i < lists.length; i++) {
    let list = lists[i];

    newListOptions = newListOptions.concat(`${i} - ${list.id}\n`);
  }
  return newListOptions;
}