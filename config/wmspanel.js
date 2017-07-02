module.exports = {
  base: process.env.WMS_BASE,
  key: process.env.WMS_API_KEY,
  id: process.env.WMS_CLIENT_ID,
  server: process.env.WMS_SERVER,
  reqConfig: {
    uri: process.env.WMS_BASE,
    qs: {
      api_key: process.env.WMS_API_KEY,
      client_id: process.env.WMS_CLIENT_ID
    }
  }
};
