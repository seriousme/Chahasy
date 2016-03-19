// Initialize Mosca's retained message store
// Only required once if the store is persisted to disk

var mqtt = require('mqtt');
var items = require('./demodata/items.json');
var pages = require('./demodata/pages.json');
var data = require('./demodata/values.json');

function loadData(){
	var options = { "qos":0,"retain": true };
	client.publish("config/chahasy/ui/items",JSON.stringify(items),options);
	client.publish("config/chahasy/ui/pages",JSON.stringify(pages),options);
	for( var i = 0; i < data.values.length ; i++) {
		var item = data.values[i];
		client.publish(item.topic, item.value,options);
	}
	client.end();
}

var client = mqtt.connect();

client.on('connect', function() { loadData() })


