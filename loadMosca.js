// Initialize Mosca's retained message store
// Only required once if the store is persisted to disk

const mqtt = require("mqtt");
const items = require("./demodata/items.json");
const pages = require("./demodata/pages.json");
const data = require("./demodata/values.json");

const client = mqtt.connect();

client.on("connect", () => {
  const options = { qos: 0, retain: true };
  client.publish("config/chahasy/ui/items", JSON.stringify(items), options);
  client.publish("config/chahasy/ui/pages", JSON.stringify(pages), options);

  data.values.forEach(item => {
    client.publish(item.topic, item.value, options);
  });

  client.end();
});
