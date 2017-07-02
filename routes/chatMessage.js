const express = require("express");
const router = express.Router();
const rdb = require("../lib/rethink");
const r = require("rethinkdb");
// var sockio = require("socket.io");
const dbConfig = require("../config/database");
const io = require("../app");
let socketid;

io.on("connection", function(socket) {
  socketid = socket.id;

  socket.on("user:join", data => {
    console.log("User has joined chat");
    io.emit("user:join", data);
  });

  // socket.on("user:leave", data => {
  //   console.log(data, "Data on user has left IN MESSAGES");
  // });

  socket.on("disconnect", data => {
    console.log('User disconnected');
    
    r.connect({ db: process.env.DB_NAME }).then(conn => {
      r.table("chat_users").filter({ socketid: socketid }).coerceTo("array").run(conn).then(res => {
          if (res.length) {
            io.emit("user:leave", res[0].username);
            r.branch(r.table("chat_users").get(res[0].id)("expires").gt(r.now().toEpochTime()), true, false).run(conn).then(result => {
                if (result) {
                  r.table("chat_users").get(res[0].id).update({ active: false, lastActivity: r.now().toEpochTime() }).run(conn);
                } else {
                  r.table("chat_users").get(res[0].id).delete().run(conn);
                }
              });
          }
        });
    });
  });
});

r.connect({ db: process.env.DB_NAME }).then(function(c) {
  r.table("chat").changes().run(c).then(function(cursor) {
    cursor.each(function(err, item) {
      if (item.new_val && !item.old_val) {
        io.emit("chat:message", item.new_val);
        r.table("chat_users").getAll(true, {index: "active"}).pluck('username').run(c).then(cursor => {
          cursor.toArray((err, result) => {
            console.log(result, 'my result');
          });
        });
      }
    });
  });
});

router.route("/")
  .get((req, res) => {
    r.connect({ db: process.env.DB_NAME }).then(connection => {
      r.table("chat").limit(50).run(connection).then(cursor => {
        cursor.toArray((err, results) => {
          res.send(results);
        });
      });
    });
  })
  .post((req, res) => {
    console.log(req.body, "request body");
    let document = {
      user: req.body.user,
      message: req.body.message,
      type: req.body.type,
      ts: r.now().toEpochTime()
    };
    r.connect({ db: process.env.DB_NAME }).then(c => {
      r.table("chat").insert(document).run(c).then(result => {
        res.send(result);
      });
    });
  });

router.route("/user/update")
  .post((req, res) => {
    let username = req.body.username;
    let id = req.body.id;

    r.connect({ db: process.env.DB_NAME }).then(conn => {
      r.table("chat_users").get(id).update({ socketid: socketid, expires: r.now().toEpochTime().add(28800), active: true }, { returnChanges: true }).run(conn).then(result => {
          res.send(result);
        });
    });
});

router.route("/user/delete")
  .post((req, res) => {
    let id = req.body.id;
    r.connect({ db: process.env.DB_NAME }).then(c => {
      r.table("chat_users").get(id).delete().run(c).then(result => {
        res.send(result, "result");
      });
    });
});

router.route("/user/create").post((req, res) => {
  let username = req.body.username;

  r.connect({ db: process.env.DB_NAME }).then(connection => {
    r
      .table("chat_users")
      .filter({ username: r.expr(username).downcase() })
      .run(connection)
      .then(resp => {
        let userResp = resp.toArray((err, results) => {
          console.log(results, "my filter results");
          if (!results.length) {
            r.table("chat_users").insert(r.object(
              "id", r.uuid(), 
              "socketid", socketid, 
              "username", username, 
              "created", r.now().toEpochTime(),
              "expires", r.now().toEpochTime().add(28800),
              "active", true
            ), { 
              returnChanges: true 
            }).run(connection).then(insResp => {
                console.log(insResp, "my insert response");
                io.emit("user:join", username);
                res.send(insResp);
              });
          } else {
            res.send(results);
          }
        });
      });
  });
});

// Clean up expired users
setTimeout(() => {
  r.connect({ db: process.env.DB_NAME }).then(function(c) {
    r.table("chat_users").filter(r.row('expires').gt(r.now().toEpochTime())).run(c).then(cursor => {
      cursor.each((err, item) => {
        r.table("chat_users").get(item.id).delete().run(c);
      });
    });
  });
}, 300000)

module.exports = router;
