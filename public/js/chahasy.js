

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
	indexPages();
	setPage(currentUrl);
}

function setPage(url){
	var newPageId = pageIdx[url];
	if (typeof(newPageId) != 'undefined'){
		currentUrl= url;
		var linkedItems=pages[newPageId].linkedItems;
		var unusedItems=pages[newPageId].unusedItems;
		var selectedItem= unusedItems.length ? unusedItems[0].id : undefined;
		ractive.set({
			pages:pages,
			linkedItems:linkedItems,
			unusedItems:unusedItems,
			selectedItem: selectedItem,
			currentUrl: currentUrl
		});
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

function indexItems(){
	// remove existing subscriptions
	var topics= Object.keys(topicIdx);
	if (topics.length){
		mqttClient.unsubscribe(topics);
	}
	// reset the indexes
	itemIdx={};
	topicIdx={};
	// process the items
	allItems.forEach(function (item){
		itemIdx[item.id] = item;
		topicIdx[item.topic] = item;
	});
	// subscribe to all topics found
	mqttClient.subscribe(Object.keys(topicIdx));
}

function addPageItem(url,item){
	var pageId=pageIdx[url];
	var page=pages[pageId];
	page.items.push(item);
	indexPage(page,pageId);
	setPage(url);
}

function updatePageItems(url,items){
	var pageId=pageIdx[url];
	var page=pages[pageId];
	page.items=items;
	indexPage(page,pageId);
	setPage(url);
}


// Index pages by URL and replace items by links to items (if any)
// create a list of items not used on the page so users can add them
function indexPage(page,i){
	 var seenItem={};
	 pageIdx[page.url] = i;
	 if ( page.items ){
		page.unusedItems=[];
		page.linkedItems=[];
		page.items.forEach( function (item,i,arr){
			seenItem[ item ] = true;
			page.linkedItems.push(itemIdx[ item ]);
			});
		allItems.forEach( function (item, i, arr){
			if (! seenItem[item.id]){
				page.unusedItems.push(item);
			}
		});
	 }
}

function indexPages(){
	// and index the pages
	pages.forEach(indexPage);
}

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

var pages=[], pagesMessage={}, pageIdx={}, topicIdx={}, allItems=[], itemsMessage={}, itemIdx={}, currentUrl, editableList, inited=false;

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

ractive.on('addItem',function (event,item){
	addPageItem(currentUrl,item);	
});

// start MQTT
var mqttClient = mqtt.connect();

// setup the listener for connect messages
mqttClient.on("connect", function(){
	mqttClient.subscribe("config/chahasy/ui/#");
});

// setup the listener for published messages
mqttClient.on("message", function(topic, payload) {
	var message = payload.toString();
	if (topic.startsWith("config/chahasy/ui/")){
		var data = JSON.parse(message);
		
		if (topic == "config/chahasy/ui/items"){
			itemsMessage = data;
		}
		if (topic == "config/chahasy/ui/pages"){
			pagesMessage = data;
		}
		// continue if we have both items and pages data
		if (itemsMessage.items && pagesMessage.pages){
			// deep clone items so we keep the original messages
			allItems = clone( itemsMessage.items );
			pages = clone( pagesMessage.pages );
			indexItems();
			indexPages();
			if (! inited){
				initUI();
			}
			else{
				setPage(currentUrl);
			}
		}
	}
	else{
		setVal(topic,message);
	}
});


