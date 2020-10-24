const r = require("rethinkdb");
const request = require("request");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

async function ls() {
  r.connect({ db: "main" })
    .then(conn => {
      console.log("connection made");
      return;
    })
    .catch(async err => {
      console.log(err, "error getting connection");
      const { stdout, stderr } = await exec("service rethinkdb restart");
    });

  request.get("https://api.pulpmx.com/livestatus").on("response", async res => {
    const status = res.statusCode;
    if (status !== 200) {
      const { stdout, stderr } = await exec("pm2 reload api");
    }
  });

  //   console.log("stdout:", stdout);
  //   console.log("stderr:", stderr);
}

ls();

setInterval(() => {
  ls();
}, 300000);
