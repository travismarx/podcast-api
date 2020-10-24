// Load environment variables first
require("dotenv").load();
require("newrelic");

const pmx = require("pmx").init({
  http: true, // HTTP routes logging (default: true)
  errors: true, // Exceptions logging (default: true)
  network: true, // Network monitoring at the application level
  ports: true, // Shows which ports your app is listening on (default: false)
  transactions: true
});
const probe = pmx.probe();
const counter = probe.counter({
  name: "Processed requests",
  agg_type: "sum"
});

const express = require("express");
const router = express.Router();
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const app = require("express")();

let connectionCount = 0;

// Routes
const liveStatus = require("./routes/liveStatus");
const showFeed = require("./routes/showFeed");
const xmlFeed = require("./routes/xmlFeed");
const appInfo = require("./routes/appInfo");
const logStats = require("./routes/logstats.js");
const sponsors = require("./routes/sponsors.js");
const drops = require("./routes/drops.js");
const schedule = require("./routes/schedule.js");
const info = require("./routes/info.js");
const allArchives = require("./routes/allArchives.js");
// const chat = require("./routes/chatMessage");

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
app.use(function(req, res, next) {
  // Custom keymetrics request counter
  counter.inc();
  next();
});

// Routes
app.use("/showfeed", showFeed);
app.use("/xmlfeed", xmlFeed);
app.use("/livestatus", liveStatus);
app.use("/appinfo", appInfo);
app.use("/logstats", logStats);
app.use("/drops", drops);
app.use("/schedule", schedule);
app.use("/sponsors", sponsors);
app.use("/info", info);
app.use("/archives", allArchives);
// app.use('/chat', chat);

app.listen(42316);
