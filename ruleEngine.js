// experiment to create a simple rule engine.

// allow the mqtt server to connect to to be specified as environment variable
var mqttUrl = process.env.mqttUrl || 'mqtt://localhost';

// or as commandline option
if (process.argv[2]) {
  mqttUrl = process.argv[2];
}

var rules = require('./rules/demoRules.js');

function publish(topic, value) {
  console.log('publishing topic:', topic, 'value:', value);
  mqttClient.publish(topic, value);
}

var mqtt = require('mqtt');
console.log('Starting rule engine, trying to connect to:', mqttUrl);

var mqttClient = mqtt.connect(mqttUrl);

mqttClient.on('connect', function () {

  // subscribe to events that trigger rules
  var ruleTopics = Object.keys(rules);
  ruleTopics.forEach(function (topic) {
    console.log('Subscribing to:', JSON.stringify(topic));
  });

  mqttClient.subscribe(ruleTopics);
});

mqttClient.on('message', function (topic, payload) {

  // convert the payload to a string
  var message = payload.toString();

  // fire the rule for this topic and pickup the resulting actions (if any)
  var actions = rules[topic](topic, message);

  //  execute the resulting actions
  var actionTopics = Object.keys(actions);
  actionTopics.forEach(function (topic) {
    publish(topic, actions[topic]);
  });
});

