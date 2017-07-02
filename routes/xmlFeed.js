const express = require("express");
const router = express.Router();
const moment = require("moment");
const rdb = require("../lib/rethink");

const Memcached = require('memcached');
const memcached = new Memcached('localhost:11211', {
  maxValue: 2097152
});

module.exports = router;

router.route("/").get((req, res) => {
  rdb.get("xmlfeeds", "moto60").then(response => {
    if (response) res.send(response);
    else res.sendStatus(204);
    // res.send('Show feed sending');
  });
});

router
  .route("/:pod")
  .get((req, res) => {
    let pod = req.params.pod;

    rdb
      .get("xmlfeeds", pod)
      .then(response => {
        if (response) res.send(response.data);
        else res.sendStatus(204);
      })
      .catch(err => {
        res.send(err);
      });
  })
  .post((req, res) => {
    let show = req.params.pod;
    let data = req.body;

    if (!data.inactiveEpisodes) data.inactiveEpisodes = [];
    let i = data.episodes.length;

    // while (i--) {
    //   let episode = data.episodes[i];
    //   console.log(episode, 'EPISODE');

    //   if (episode.inactive) {
    //     data.inactiveEpisodes.push(episode);
    //     data.episodes.splice(i, 1);
    //     i--;
    //   }
    // }

    // data.episodes.forEach(episode => {
    //   if (episode.inactive) 
    // })

    rdb
      .insert("xmlfeeds", {
        id: show,
        data: data
      }, "replace")
      .then(resp1 => {
        if (!resp1.errors) {
          rdb
            .insert("xmlfeedshistory", {
              id: `${show}_${moment().format("YYMMDD_HHmmss")}`,
              data: data
            })
            .then(resp2 => {
              if (resp2.inserted === 1) {
                let apiPodFeed = formatFeedJson(data, show);
                rdb.insert("feeds", apiPodFeed, "replace").then(resp3 => {
                  //   console.log(resp3, "resp3");
                  memcached.del(show);
                  memcached.set(show, apiPodFeed, 300);

                  if (!resp3.errors) {
                    res.sendStatus(200);
                  } else {
                    res.sendStatus(400);
                  }
                });
                // res.sendStatus(200);
              } else {
                // console.log(resp1, "resp1 error");
                res.sendStatus(409);
              }
            });
        } else {
          res.sendStatus(409);
        }
      })
      .catch(err => {
        res.send(err);
      });
  });

/*
 * HELPERS
 */

function formatFeedJson(data, show) {
  let feedJson = {
    id: show,
    title: data.title.textContent,
    titleAbbr: show,
    description: data.description.textContent,
    image: data.image.url.textContent,
    lastModified: data.lastModified,
    sortOrder: determineSort(show),
    episodes: [],
    // inactiveEpisodes: []
  };

  for (let i = 0, len = data.episodes.length; i < len; i++) {
    let episode = data.episodes[i];

    let episodeObj = {
      epTitle: episode.title.textContent,
      epDescription: episode.description.textContent,
      epStreamUrl: episode.enclosure.attributes.url,
      epFileSize: episode.enclosure.attributes.length,
      // epFileSizeMB: episode.enclosure.attributes.length).replace((/,/g, ""), 10)) / 1048576,
      epFileSizeMB: (parseInt(episode.enclosure.attributes.length.replace(/,/g, "")) /
        1024 /
        1024).toFixed(2),
      epDate: episode.pubDate.textContent,
      epPodTitle: feedJson.title,
      epPodTitleAbbr: show,
      epPodImage: data.image.url.textContent,
      epIndex: i,
      lastModified: episode.lastModified || moment().format("X")
    };
    // if (episode.inactive === true) episodeObj.inactive = true;
    // episodeObj.lastModified = episodeObj.lastModified ? episodeObj.lastModified : moment().format('x');

    // !episodeObj.inactive ?
    //   feedJson.episodes.push(episodeObj) :
    //   feedJson.inactiveEpisodes.push(episodeObj);
    feedJson.episodes.push(episodeObj);
  }

  return feedJson;
}

function determineSort(pod) {
  switch (pod) {
    case "pulpmx":
      return 1;
    case "steveshow":
      return 2;
    case "moto60":
      return 3;
    case "keefer":
      return 4;
    case "hockey":
      return 9;
    case "exclusives":
      return 5;
    case "classics3":
      return 6;
    case "classics2":
      return 7;
    case "classics1":
      return 8;
  }
}

function hashGen(n) {
  let r = "";
  while (n--)
    r += String.fromCharCode((r = Math.random() * 62 | 0, r += r > 9 ? r < 36 ? 55 : 61 : 48));
  return r;
}