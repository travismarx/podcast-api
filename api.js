let pmx = require('pmx').init({
  http: true, // HTTP routes logging (default: true)
  errors: true, // Exceptions logging (default: true)
  // custom_probes : true, // Auto expose JS Loop Latency and HTTP req/s as custom metrics
  network: true, // Network monitoring at the application level
  ports: true, // Shows which ports your app is listening on (default: false)
  // transactions         : true 
});
let probe = pmx.probe();
const counter = probe.counter({
  name: 'Processed requests',
  agg_type: 'sum'
});
require('newrelic');

const express = require("express");
const router = express.Router();
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
var sockio = require("socket.io");
const rdb = require("./lib/rethink");
const r = require("rethinkdb");
const dbConfig = require("./config/database");

let http = require("http");

require("dotenv").load();

const app = require("express")();
// const server = require("http").createServer(app);
// const io = module.exports = require("socket.io")(server);

let connectionCount = 0;


// io.on("connection", function(socket) {
//   connectionCount++;
//   socket.emit("connectionCount", connectionCount);
//   // socket.on("chatmessage", require("./routes/chatMessage"));
//   socket.on("user:join", data => {
//     // socket.emit("user:join", data);
//   });
//   socket.on("user:leave", data => {
//     // console.log(data, "user has left the building");
//   });
//   socket.on("disconnect", data => {
//     connectionCount--;
//     socket.emit("connectionCount", connectionCount);
//   });
// });

// Routes
const liveStatus = require("./routes/liveStatus");
const showFeed = require("./routes/showFeed");
const xmlFeed = require("./routes/xmlFeed");
const appInfo = require("./routes/appInfo");
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

app.use(function(req, res, next) {
  counter.inc();
  next();
});

app.use("/showfeed", showFeed);
app.use("/xmlfeed", xmlFeed);
app.use("/livestatus", liveStatus);
app.use("/appinfo", appInfo);

app.listen(42316);
// app.use("/chat", chatMessage);
// const server = app.listen(42316, () => {
//   const host = server.address().address;
//   const port = server.address().port;
//   console.log("App is listening on http://%s:%s", host, port);
// });
////////////////////
// const SwaggerExpress = require('swagger-express-mw');
// const app = require('express')();
// const bodyParser = require('body-parser');
// module.exports = app; // for testing
// let config = {
//   appRoot: __dirname // required config
// };
// console.log('Running...');
// SwaggerExpress.create(config, function (err, swaggerExpress) {
//   if (err) {
//     throw err;
//   }
//   app.use(bodyParser.json({
//     limit: '5mb'
//   }));
//   app.use(bodyParser.urlencoded({
//     limit: "50mb",
//     extended: true,
//     parameterLimit: 50000
//   }));
//   // install middleware
//   swaggerExpress.register(app);
//   let port = process.env.PORT || 42316;
//   app.listen(port);
// });