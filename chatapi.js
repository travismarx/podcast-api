// const rdb = require("lib/rethink");
const rethink = require("rethinkdbdash")({ db: "chat" });
const sockio = require("socket.io");
// const dbConfig = require("../config/database");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const crypto = require("crypto");
const Redis = require("redis");
const redis = Redis.createClient();
const authUtils = require("./utilities/authUtils");
const moment = require("moment");
// const express = require("express");

let socketid;
let connectionCount = 0;

var app = require("express")();
var server = require("http").Server(app);
var chatio = require("socket.io")(server);

//prettier-ignore
rethink.table("users").filter({ active: true }).pluck("username", 'id', 'socket_id').changes().run().then(docs => {
    docs.each((err, change) => {
      chatio.emit("activeusers", change);
    });
  });

// var chatio = io.of("/chat");
chatio.on("connection", async socket => {
  console.log("Connected");
  socket.on("message added", data => messageAdded(data, socket));

  // socket.on("user joined", data => {
  // console.log(data, "data!");
  // delete data.token;
  // socket.broadcast.emit("user joined", data);
  // });

  socket.on("connectcheck", async data => {
    const dbUser = await rethink.table("users").get(rethink.expr(data.username).downcase());
    if (!dbUser) {
      socket.emit("connectstatus", false);
    } else {
      const expired = (await rethink.now().toEpochTime()) > dbUser.expires;
      if (!expired) {
        const updatedDoc = await updateUserDoc(dbUser);
        const data = {
          username: dbUser.username,
          id: dbUser.id,
          token: updatedDoc.changes[0].new_val.token
        };
        socket.emit("connectstatus", data);
      } else {
        socket.emit("connectstatus");
      }
      //   expired ? socket.emit("connectstatus", false) : socket.emit("connectstatus", true);
    }
  });

  socket.on("tokenconnect", data => {
    console.log(data, "DATA ON TOKEN CONNECT");
    //prettier-ignore
    rethink.table('users').get(rethink.expr(data.username).downcase()).update({
        socket_id: socket.id
    }).run();
  });

  socket.on("new:message", async data => {
    if (data.message !== "botbro! mystats") {
      socket.broadcast.emit("new:message", data);
      const recentMsgs = await rethink
        .table("messages")
        .filter({ userId: data.id })
        .orderBy(rethink.desc("id"))
        .limit(3)
        .run();
      console.log(recentMsgs, "recent messages for user");
      logUserMessage(data, socket.handshake);
    } else {
      const stats = await getUserStats(data);
      const currentConnection = await rethink.table('connections').get(socket.handshake.issued).run(); //prettier-ignore
      const currentTime = Math.round(parseInt(moment().format("x")) - currentConnection.id) / 1000;
      stats.current = currentTime;
      stats.total = Math.round(stats.total + currentTime);
      for (let i in stats) {
        stats[i] = moment.duration(stats[i], "seconds").humanize();
      }
      stats.messageCount = await rethink.table('messages').filter({username: data.username}).count().run(); //prettier-ignore
      const statsMsg = newStatsMessage(stats);
      const statsObj = {
        type: "chat",
        username: "botbro",
        message: statsMsg
      };
      socket.emit("stats msg", statsObj);
    }
  });

  socket.on("disconnect", async data => handleDisconnect(data, socket));
  // console.log("user disconnected");
  // console.log(socket.id, "socket id on disconnect");
  // const activeUser = await rethink.table("users").filter({ socket_id: socket.id });
  // if (activeUser.length) {
  //   rethink.table('users').get(activeUser[0].id).update({active: false}).run(); //prettier-ignore
  // }
  // console.log(activeUser, "active user on disconnect");
  // if ()
  // connectionCount--;
  // chatio.emit("connectionCount", connectionCount);
  // const connection = await rethink.table("connections").get(socket.handshake.id).run(); //prettier-ignore
  // const diff = Math.round((parseInt(moment().format("x")) - connection.id) / 1000);
  // const connectedUser = await rethink.table('users').filter({socket_id: socket.id}).update({
  //     active: false,
  //     session_timers: rethink.row('session_timers').append(diff)
  // }).run(); //prettier-ignore
  // });
});

const handleDisconnect = async (data, socket) => {
  console.log("user disconnected");
  console.log(socket.id, "socket id on disconnect");

  //prettier-ignore
  const activeUser = await rethink.table("users").filter({ socket_id: socket.id }).run();
  console.log(activeUser, "active user on disconnect");

  if (activeUser.length) {
    const sessionStart = activeUser[0].session_start;
    const sessionLen = (parseInt(moment().format("x")) - sessionStart) / 1000;
    rethink.table('users').get(activeUser[0].id).update({
      active: false,
      session_timers: rethink.row('session_timers').append(sessionLen),
      session_start: null 
    }).run(); //prettier-ignore
  }
};

const messageAdded = async (data, socket) => {
  if (data.message === "/mystats") {
    getUserStats(data, socket);
  } else {
    console.log(data, "data on message added");
    socket.broadcast.emit("message added", data);
    data.id = parseInt(moment().format("x"));
    data.user_id = data.user.id;
    rethink.table("messages").insert(data).run(); //prettier-ignore
  }
};

async function logUserMessage(data, handshake) {
  const obj = {
    username: data.username,
    userId: data.id,
    message: data.message,
    id: parseInt(moment().format("x")),
    address: handshake.address
  };
  rethink.table('messages').insert(obj).run(); //prettier-ignore
}

const getUserStats = async (data, socket) => {
  const userId = data.user.id;
  console.log(data, "data on get user stats request");
  //prettier-ignore
  const userData = await rethink.table('users').get(userId).run();
  const currentTime =
    parseInt(moment().format("x")) - (await rethink.expr(userData.session_start)) / 1000;
  //prettier-ignore
  const userStats = {
    total: moment().startOf('day').seconds(await rethink.expr(userData.session_timers).sum().default(0) + currentTime).format('H:mm:ss'),
    avg: moment().startOf('day').seconds(await rethink.expr(userData.session_timers).avg().default(0)).format('H:mm:ss'),
    max: moment().startOf('day').seconds(await rethink.expr(userData.session_timers).max().default(0)).format('H:mm:ss'),
    current: moment().startOf('day').seconds((parseInt(moment().format("x")) - (await rethink.expr(userData.session_start))) / 1000).format('H:mm:ss'),
    messageCount: await rethink.table('messages').filter({user_id: userId}).count().run() //prettier-ignore
  };
  // const msg = newStatsMessage(userStats);
  // let timeToMin = moment()
  //   .startOf("day")
  //   .seconds(userStats.avg)
  //   .format("H:mm:ss");
  // console.log(timeToMin, "time to minutes");
  console.log(userStats, "user stats");
  const message = {
    message: newStatsMessage(userStats),
    user: { username: "botbro", id: "botbro" }
  };
  socket.emit("message added", message);
  // return userStats;
};

const newStatsMessage = stats =>
  ` 
    Messages sent: ${stats.messageCount} | 
    Total time logged in: ${stats.total} | 
    Average time logged in: ${stats.avg} | 
    Longest session: ${stats.max} | 
    Current session: ${stats.current} `;

server.listen(42314);

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

app.post("/chat/user", async (req, res) => {
  const body = req.body;
  const username = body.user.username;
  const password = body.user.password;
  const userDoc = await rethink.table("users").get(rethink.expr(username).downcase()).run(); // prettier-ignore

  if (body.user.type === "login") {
    const passwordsMatch = await authUtils.verifyHash(password, userDoc.password);
    if (passwordsMatch) {
      const updatedDoc = await updateUserDoc(body);
      console.log(updatedDoc, "updated doc");
      res.send({
        OK: true,
        user: {
          username: username,
          id: await rethink.expr(username).downcase().run(), //prettier-ignore
          token: updatedDoc.changes[0].new_val.token,
          socketId: body.socketId
        }
      });
    } else {
      res.send({
        OK: false,
        message: "Incorrect credentials"
      });
    }
  } else if (body.user.type === "create") {
    if (userDoc) {
      res.send({
        OK: false,
        message: "Username already exists"
      });
    } else {
      //prettier-ignore
      const userObj = {
        id: rethink.expr(username).downcase(),
        username: username,
        password: await authUtils.hashPassword(password),
        created: rethink.now().toEpochTime(),
        expires: rethink.now().toEpochTime().add(14400),
        token: await authUtils.randomBytes(16),
        active: true,
        session_timers: []
      };

      const userCreate = await rethink.table("users").insert(userObj).run(); //prettier-ignore
      if (!userCreate.errors && userCreate.inserted) {
        res.send({
          OK: true,
          user: {
            username: username,
            id: userObj.id,
            token: userObj.token
          }
        });
      } else {
        res.send({
          OK: false,
          message: userCreate.errors
        });
      }
    }
  }
});

const updateUserDoc = async user => {
  //prettier-ignore
  return await rethink
    .table('users')
    .get(rethink.expr(user.user.username).downcase())
    .update({
        expires: rethink.now().toEpochTime().add(14400),
        token: await authUtils.randomBytes(16),
        socket_id: user.socketId,
        session_start: parseInt(moment().format('x')),
        active: true,
    }, {
        returnChanges: true
    }).run();
};

app.put("/chat/user", (req, res) => {
  let username = req.body.username;
  let id = req.body.id;

  //prettier-ignore
  rethink
    .table("users")
    .get(id) 
    .update({ 
        socketid: socketid, 
        expires: r.now().toEpochTime().add(28800),
        active: true
      },{ 
        returnChanges: true
      })
    .run()
    .then(result => {
      // chatio.emit('user:add', username);
      res.send(result);
    });
});
