function setPage(url){
	var newPage = pageIdx[url];
	if (typeof(newPage) != 'undefined'){
		var items=pages[newPage].items;
		//console.log(JSON.stringify(items));
		ractive.set({
			pages:pages,
			items:items,
			currentPage: url
		}).then ( function(){
			// remove existing handlers if any
			$('.btn-toggle').unbind('click');
			// and add a click handler
			$('.btn-toggle').click(function() {
				var topic = $(this).data('topic');
				// setting the value should not be done in the user interface,
				// the ui should send the command and pickup the result
				// for now we do this in the browser

				if (topicIdx[topic].value == "on"){
					topicIdx[topic].value = "off";
				}
				else{
					topicIdx[topic].value = "on";
				}
				// publish the result via MQTT
				publish(topic, topicIdx[topic].value);
				// and update the UI
				ractive.update();
			});
		});
	}
}

function setVal(topic,value){
	if (topicIdx[topic] != 'undefined'){
			console.log("Setting value for topic ", topic, " to ", value);
			topicIdx[topic].value = value;
			ractive.update();
		}
}

function publish(topic,value){
	console.log('publishing topic:',topic,"value:",value);
	mqttClient.publish(topic, value);
}

function initUI(data){
	var itemIdx={};

	// Index items
	function indexItems(item){
		itemIdx[item.id] = item;
		topicIdx[item.topic] = item;
	}
	data.items.forEach(indexItems);

	// Index pages by URL and replace items by links to items (if any)
	
	function linkItemData(item,i,arr){
		arr[i] = itemIdx[ item ];
	}
	
	function indexPages(page,i){
		 pageIdx[page.url] = i;
		 if ( page.items ){
			 page.items.forEach(linkItemData);
		 }
		 return page;
	 }
	pages = data.pages.map(indexPages);
	// lets see what we got
	//console.log(JSON.stringify(pages));
	//console.log(JSON.stringify(pageIdx));
	//console.log(JSON.stringify(itemIdx));

	// start at page 0
	var currentPage = pages[0].url;
	// did the user jump directly to a specific page ?
	if (typeof pageIdx[location.hash] != 'undefined'){
		currentPage = location.hash;
	}
	// mark this page as active
	setPage(currentPage);
	// listen for URL changes
	window.onhashchange = function(){ setPage(location.hash);};
	// subscribe to all topics found
	mqttClient.subscribe(Object.keys(topicIdx));
}

var pages=[], pageIdx={}, topicIdx={};

// create the ractive object
var ractive = new Ractive({
	el: renderOutput,
	template: '#renderTemplate',
	data: {
		formatTemp: function(val){ if (val) { return val + '°';}},
		publishDimmer: function(topic){ if (topic) { return 'publish("'+topic+'",value)';}},
		publishClick: function(topic){ if (topic) { return 'publish("'+topic+'","clicked")';}}
	}
});

// start MQTT
var mqttClient = mqtt.connect();

// setup the listener for connect messages
mqttClient.on("connect", function(){
	mqttClient.subscribe("config/chahasy/ui");
});

// setup the listener for published messages
mqttClient.on("message", function(topic, payload) {
	var message = payload.toString();
	if (topic == "config/chahasy/ui"){
		console.log("Received config message:", message);
		var configData= JSON.parse(message);
		initUI(configData);
	}
	else{
		setVal(topic,message);
	}
});
