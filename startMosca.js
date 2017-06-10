// Startup Script for Mosca
// start this using "node run mosca"
// if you want to run the rule engine as well use "node run rules"
// see package.json for details

const mosca = require("mosca");
const server = new mosca.Server({
  http: {
    port: 8080,
    bundle: true,
    static: "./public"
  },
  logger: {
    level: 30
  }
});
const db = new mosca.persistence.LevelUp({ path: "mqttdb" });
db.wire(server);
