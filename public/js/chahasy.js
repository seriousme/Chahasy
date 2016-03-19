

function addSortable(id){
	var obj = Sortable.create(document.getElementById(id), {
		animation: 150,
		disabled: false,
		ghostClass: 'sortable-ghost',
		filter: '.js-remove',
		onFilter: function (evt) {
			evt.item.parentNode.removeChild(evt.item);
			updatePageItems(currentUrl,editableList.toArray());
		},
		onUpdate: function (evt){
			updatePageItems(currentUrl,editableList.toArray());
		}
	});
	return obj;
}

function setEditMode(mode){
	if (mode){
		// prepare for edit mode
		editableList = addSortable('itemList');
	}
	else{
		// cleanup
		if (editableList){
			editableList.destroy();
		}
	}
	ractive.set({editMode:mode});
}

function savePageEdits(){
	pages.forEach(function(page,i,arr){
		if (page.items){
			pagesMessage.pages[i].items=clone(page.items);
		}
	});
	var options = { "qos":0,"retain": true };
	mqttClient.publish("config/chahasy/ui/pages",JSON.stringify(pagesMessage),options);
}

function discardPageEdits(){
	pages = clone( pagesMessage.pages );
	setPage(currentUrl);
}

function setPage(url){
	var page = pageIdx[url];
	if (typeof(page != 'undefined')){
		prepPage(page);
		ractive.set({
			pages:pages,
			page:page
		});
		currentUrl= url;
	}
}

function setVal(topic,value){
	if (topicIdx[topic] != 'undefined'){
			topicIdx[topic].value = value;
			ractive.update();
		}
}

function publish(topic,value){
	console.log('publishing topic:',topic,"value:",value);
	mqttClient.publish(topic, value);
}

function registerTopics(){
	// remove existing subscriptions
	var topics= Object.keys(topicIdx);
	if (topics.length){
		mqttClient.unsubscribe(topics);
	}
	// reset the indexes
	topicIdx={};
	// process the items
	allItems.forEach(function (item){
		topicIdx[item.topic] = item;
	});
	// subscribe to all topics found
	mqttClient.subscribe(Object.keys(topicIdx));
}

function addPageItem(url,item){
	var page=pageIdx[url];
	page.items.push(item);
	setPage(url);
}

function updatePageItems(url,items){
	var page=pageIdx[url];
	page.items=items;
	setPage(url);
}

// Prepare page for viewing by setting linkedItems and for editing by setting unusedItems
function prepPage(page){
	var itemIdx={};
	if ( page.items ){
		page.unusedItems=[];
		page.linkedItems=[];
		// build up the index
		allItems.forEach(function (item){
			itemIdx[item.id] = item;
		});
		// link the page to the items
		page.linkedItems = page.items.map( function (item,i,arr){
			return itemIdx[ item ];
			});
		// all items that are not in the page
		allItems.forEach( function (item, i, arr){
				if (page.items.indexOf(item.id) <0){
					page.unusedItems.push(item);
				};
			});
		// set the default selected item
		if (typeof(page.unusedItems[0]) == 'object'){
			page.selectedItem = page.unusedItems[0].id;
		}
	}
}

// index Pages by URL
function indexPages(){
	// and index the pages
	pages.forEach(function(page){
		pageIdx[page.url] = page;
	});
}

// deep clone helper
function clone(obj){
	return JSON.parse(JSON.stringify(obj));
}


// start the UI
function initUI(){
	// we only get here if pages and items are both received via MQTT

	// start at page 0
	var currentPage = pages[0].url;
	// did the user jump directly to a specific page ?
	if (typeof pageIdx[location.hash] != 'undefined'){
		currentPage = location.hash;
	}
	// mark this page as active
	setPage(currentPage);
	// start in non-edit mode
	setEditMode(false);
	// listen for URL changes
	window.onhashchange = function(){ setPage(location.hash);};
	// make sure we do this only once
	inited=true;
}

// handle incoming config messages
function handleConfig(topic,message){
	var data = JSON.parse(message);
	if (topic ==  (configTopic + "items")){
		itemsMessage = data;
	}
	if (topic == (configTopic + "pages")){
		pagesMessage = data;
	}
	// continue if we have both items and pages data
	if (itemsMessage.items && pagesMessage.pages){
		// deep clone items so we keep the original messages
		allItems = clone( itemsMessage.items );
		pages = clone( pagesMessage.pages );
		indexPages();
		
		registerTopics();
		if (! inited){
			initUI();
		}
		else{
			setPage(currentUrl);
		}
	}
}


var pages=[], pagesMessage={}, pageIdx={}, topicIdx={}, allItems=[], itemsMessage={}, currentUrl, editableList, inited=false;
var configTopic = "config/chahasy/ui/";

// polyfill for ES6 startsWith
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}

// create the ractive object
var ractive = new Ractive({
	el: renderOutput,
	template: '#renderTemplate'
});

// define event listeners
ractive.on('publish',function (event,topic,value){
	publish(topic,value);	
});

ractive.on('editMode',function (event,val){
	if (val == "start"){
		setEditMode(true);
	}
	else{
		if (val == "save"){
			savePageEdits();
		}
		else {
			discardPageEdits();
		}
		setEditMode(false);
	}
});

ractive.on('addPageItem',function (event,url,item){
	addPageItem(url,item);	
});

// start MQTT
var mqttClient = mqtt.connect();

// setup the listener for connect messages
mqttClient.on("connect", function(){
	mqttClient.subscribe(configTopic+"#");
});

// setup the listener for published messages
mqttClient.on("message", function(topic, payload) {
	var message = payload.toString();
	if (topic.startsWith(configTopic)){
		handleConfig(topic,message);
	}
	else{
		setVal(topic,message);
	}
});


