///////////////////////////////////////////////////////////////
// chahasy.js
// all the logic is triggered by vuejs events.

// make it a module, see end of file
(function(exports) {

    var configTopic = "config/chahasy/ui/";
    var app, mqttClient, currentUrl, editableList, inited = false;
    var pages = [],
        pagesMessage = {},
        pageIdx = {},
        topicIdx = {},
        allItems = [],
        itemsMessage = {};

    function addSortable(id) {
        var obj = Sortable.create(document.getElementById(id), {
            animation: 150,
            disabled: false,
            ghostClass: 'sortable-ghost',
            filter: '.js-remove',
            onFilter: function(evt) {
                removePageItem(currentUrl, evt.item.getAttribute("data-id"));
            },
            onUpdate: function(evt) {
                updatePageItems(currentUrl, editableList.toArray());
            }
        });
        return obj;
    }

    // handle the UI "editMode" event
    function handleEditMode(val) {
        if (val == "start") {
            setEditMode(true);
            return;
        }
        if (val == "save") {
            savePageEdits();
        } else {
            discardPageEdits();
        }
        setEditMode(false);
    }

    function setEditMode(mode) {
        if (mode) {
            // prepare for edit mode
            editableList = addSortable('itemList');
        } else {
            // cleanup
            if (editableList) {
                editableList.destroy();
            }
        }
        app.editMode = mode;
        app.$forceUpdate();
    }

    function savePageEdits() {
        pages.forEach(function(page, i, arr) {
            if (page.items) {
                pagesMessage.pages[i].items = clone(page.items);
            }
        });
        var options = {
            "qos": 0,
            "retain": true
        };
        mqttClient.publish(configTopic + "pages", JSON.stringify(pagesMessage), options);
    }

    function discardPageEdits() {
        pages = clone(pagesMessage.pages);
        setPage(currentUrl);
    }

    function setPage(url) {
        var page = pageIdx[url];
        if (typeof(page != 'undefined')) {
            prepPage(page);
            app.pages = pages;
            app.page = page;
            currentUrl = url;
            app.$forceUpdate();
        }
    }

    function setVal(topic, value) {
        if (topicIdx[topic] != 'undefined') {
            topicIdx[topic].value = value;
            app.$forceUpdate();
        }
    }

    function publish(topic, value) {
        console.log('publishing topic:', topic, "value:", value);
        mqttClient.publish(topic, value);
    }

    function registerTopics() {
        // remove existing subscriptions
        var topics = Object.keys(topicIdx);
        if (topics.length) {
            mqttClient.unsubscribe(topics);
        }
        // reset the indexes
        topicIdx = {};
        // process the items
        allItems.forEach(function(item) {
            topicIdx[item.topic] = item;
        });
        // subscribe to all topics found
        mqttClient.subscribe(Object.keys(topicIdx));
    }

    function addPageItem(url, item) {
        var page = pageIdx[url];
        page.items.push(item);
        setPage(url);
    }

    function removePageItem(url, item) {
        var page = pageIdx[url];
        var index = page.items.indexOf(item);
        if (index > -1) {
          page.items.splice(index, 1);
        }
        setPage(url);
    }

    function updatePageItems(url, items) {
        var page = pageIdx[url];
        page.items = items;
        setPage(url);
    }

    // Prepare page for viewing by setting linkedItems and for editing by setting unusedItems
    function prepPage(page) {
        var itemIdx = {};
        if (page.items) {
            page.unusedItems = [];
            page.linkedItems = [];
            // build up the index
            allItems.forEach(function(item) {
                itemIdx[item.id] = item;
            });
            // link the page to the items
            page.linkedItems = page.items.map(function(item, i, arr) {
                return itemIdx[item];
            });
            // all items that are not in the page
            allItems.forEach(function(item, i, arr) {
                if (page.items.indexOf(item.id) < 0) {
                    page.unusedItems.push(item);
                }
            });
            // set the default selected item
            if (typeof(page.unusedItems[0]) == 'object') {
                page.selectedItem = page.unusedItems[0].id;
            }
        }
    }

    // index Pages by URL
    function indexPages() {
        // and index the pages
        pages.forEach(function(page) {
            pageIdx[page.url] = page;
        });
    }

    // deep clone helper
    // should use ES6 Object.assign instead
    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }


    // start the UI
    function initUI() {
        // we only get here if pages and items are both received via MQTT

        // start at page 0
        var currentPage = pages[0].url;
        // did the user jump directly to a specific page ?
        if (typeof pageIdx[location.hash] != 'undefined') {
            currentPage = location.hash;
        }
        // mark this page as active
        setPage(currentPage);
        // start in non-edit mode
        setEditMode(false);
        // listen for URL changes
        window.onhashchange = function() {
            setPage(location.hash);
        };
        // make sure we do this only once
        inited = true;
    }

    // handle incoming config messages
    function handleConfig(topic, message) {
        var data = JSON.parse(message);
        if (topic == (configTopic + "items")) {
            itemsMessage = data;
        }
        if (topic == (configTopic + "pages")) {
            pagesMessage = data;
        }
        // continue if we have both items and pages data
        if (itemsMessage.items && pagesMessage.pages) {
            // deep clone items so we keep the original messages
            allItems = clone(itemsMessage.items);
            pages = clone(pagesMessage.pages);
            indexPages();

            registerTopics();
            if (!inited) {
                initUI();
            } else {
                setPage(currentUrl);
            }
        }
    }

    // polyfill for ES6 startsWith
    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function(searchString, position) {
            position = position || 0;
            return this.substr(position, searchString.length) === searchString;
        };
    }

    function init(el) {
        // create the app object
        app = new Vue({
            el: el,
            data: {
              editMode:false,
              pages:[],
              page:{}
            },
            methods:{
              publish: function(topic, value) {
                  // form wants to publish a value
                  publish(topic, value);
              },
              setEditMode: function(val) {
                  // form changes to/from edit mode
                  handleEditMode(val);
              },
              addPageItem: function(url, item) {
                // form wants to add an item to a page (in edit mode)
                // delete and move is handled by Sortable
                  addPageItem(url, item);
              }
            }
        });
        // start MQTT
        mqttClient = mqtt.connect();

        // setup the MQTT listener for connect messages
        mqttClient.on("connect", function() {
            mqttClient.subscribe(configTopic + "#");
        });

        // setup the MQTT listener for published messages
        mqttClient.on("message", function(topic, payload) {
            var message = payload.toString();
            if (topic.startsWith(configTopic)) {
                handleConfig(topic, message);
            } else {
                setVal(topic, message);
            }
        });
    }
    // end of module, this is our module interface to the world
    exports.init = init;
})(this.chahasy = {});


// if we have all required resources: start the show !
$(document).ready(function() {
    chahasy.init('#chahasy');
});
