// experiment to create a simple rule engine.

const mqtt = require("mqtt");
const rules = require("./rules/demoRules.js");

// allow the mqtt server to connect to to be specified as
// - a commandline option
// - an environment variable

const mqttUrl = process.argv[2] || process.env.mqttUrl || "mqtt://localhost";

console.log("Starting rule engine, trying to connect to:", mqttUrl);
const mqttClient = mqtt.connect(mqttUrl);

mqttClient.on("connect", () => {
  // subscribe to events that trigger rules
  const ruleTopics = Object.keys(rules);
  console.log("Subscribing to:", ruleTopics);
  mqttClient.subscribe(ruleTopics);
});

mqttClient.on("message", (topic, payload) => {
  // convert the payload to a string
  const message = payload.toString();

  // fire the rule for this topic and pickup the resulting actions (if any)
  const actions = rules[topic](topic, message);

  //  execute the resulting actions
  const actionTopics = Object.keys(actions);
  actionTopics.forEach(topic => {
    const value = actions[topic];
    console.log("publishing topic:", topic, "value:", value);
    mqttClient.publish(topic, value);
  });
});
