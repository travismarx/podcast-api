const r = require("rethinkdb");
const dbConfig = require("../config/database");

const count = tableName => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r.table(tableName).count().run(connection).then(res => {
      connection.close();
      return res;
    });
  });
};

const decrement = (tableName, id, field, val) => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r
      .table(tableName)
      .get(id)
      .update({
        field: r.row(field).sub(val).default(0)
      })
      .run(connection)
      .then(res => {
        connection.close();
        return res
      });
  });
};

const find = (tableName, id) => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r.table(tableName).get(id).run(connection).then(res => {
      connection.close();
      return res
    });
  });
};

const get = (tableName, key) => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r.table(tableName).get(key).run(connection).then(res => {
      connection.close();
      return res
    });
  });
};

const getLimit = (tableName, limit) => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r.table(tableName).limit(limit).changes().run(connection).then(res => {
      connection.close();
      return res
    });
  });
};

const getPluckLimit = (tableName, key, pluckval, limit) => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r.table(tableName).get(key)(pluckval).limit(limit).run(connection).then(res => {
      connection.close();
      return res
    });
  });
};

const increment = (tableName, id, field, val) => {
  console.log("Running incrementer");
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r
      .table(tableName)
      .get(id)
      .update({
        [field]: r.row(field).add(val)
      }, {
        returnChanges: true,
        durability: "soft",
        nonAtomic: false
      })
      .run(connection)
      .then(resp => {
        connection.close();
        return resp
      });
  });
};

const insertChat = (tableName, document) => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(conn => {
    return r
      .table(tableName)
      .insert({
        id: r.now().toEpochTime(),
        user: document.user,
        message: document.message
      })
      .run(conn)
      .then(res => {
        connection.close();
        return res
      });
  });
};

const insert = (tableName, document, conflict = "error") => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r
      .table(tableName)
      .insert(document, {
        conflict: conflict
      })
      .run(connection)
      .then(res => {
        connection.close();
        return res;
      });
  });
};

const update = (tableName, id, field, val) => {
  return r.connect({
    db: process.env.DB_NAME
  }).then(connection => {
    return r.table(tableName).get(id).update({
      [field]: val
    }).run(connection).then(res => {
      connection.close();
      return res
    });
  });
};

module.exports = {
  count,
  decrement,
  find,
  get,
  getLimit,
  getPluckLimit,
  increment,
  insert,
  insertChat,
  update
};