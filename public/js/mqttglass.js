function makeRegEx (topic) {
  var regEx = topic.replace(/\//g, '\\/')
  regEx = regEx.replace(/\+/g, '[^\\/]+')
  regEx = regEx.replace(/#/g, '.+')
  regEx = '^' + regEx + '$'
  var patt = new RegExp(regEx)
  return patt
}

function publish (form) {
  var topic = form.topic.value
  var qos = form.qos.value
  var rt = form.retain.checked
  if (! topic) {
    form.topic.focus()
  }

  var opts = {
    'qos': qos,
    'retain': rt
  }
  // console.log(opts)
  mqttClient.publish(topic, form.mesg.value, opts)
  return false
}

function subscribe (form) {
  var topic = form.topic.value
  var qos = parseInt(form.qos.value)
  if (! topic) {
    form.topic.focus()
  }else {
    mqttClient.subscribe(topic, { 'qos': qos})
    var subscription = {
      'topic': topic,
      'regEx': makeRegEx(topic),
      'qos': qos,
      'numMsg': 0,
      'maxMsg': 5,
      'visible': true,
      'messages': []

    }
    subscriptions.push(subscription)
    form.reset()
  }
  return false
}

function unsubscribe (idx) {
  mqttClient.unsubscribe(subscriptions[idx].topic)
  subscriptions.splice(idx, 1)
}

function showMessage (subscriptionID, id, raw) {
  var findMessageByID = function (el) {
    if (el.id == id) {
      if (raw) {
        alert(JSON.stringify(el.raw))
      }else {
        alert(el.mesg)
      }
    }
  }
  if (typeof subscriptions[subscriptionID] != 'undefined') {
    var subscription = subscriptions[subscriptionID]
    subscription.messages.forEach(findMessageByID)
  }
}
function toggle (item) {
  visible[item] = !(visible[item])
  ractive.update()
}

function toggleSub (idx) {
  subscriptions[idx].visible = !(subscriptions[idx].visible)
  ractive.update()
}

var visible = {
  'publish': true,
  'subscribe': true,
  'subscriptions': true
}

var subscriptions = []
var topicTrie = {}

// create the ractive object
var ractive = new Ractive({
  el: renderOutput,
  template: '#renderTemplate',
  data: {
    visible: visible,
    subscriptions: subscriptions,
    shorten: function (val, len) {
      if (typeof (val) == 'string') {
        if (val.length > len) {
          return val.substring(0, len - 2) + '..'
        }else {
          return val
        }
      }
    },
    hasDetail: function (val, len) {
      if (typeof (val) == 'string') {
        if (val.length > len) {
          return (true)
        }
      }
    }
  }
})

// start MQTT
var mqttClient = mqtt.connect()

// setup the listener for published messages
mqttClient.on('message', function (topic, payload, packet) {
  // find the matching subscription(s)
  for (var i = 0;i < subscriptions.length;i++) {
    var subscription = subscriptions[i]
    // console.log("Testing regex",subscription.regEx.toString(),"for topic",topic)
    if (subscription.regEx.test(topic)) {
      var message = {}
      var d = new Date()
      message.time = d.getHours() + ':' + d.getMinutes() + '.' + d.getSeconds() + '.' + d.getMilliseconds()
      message.id = subscription.numMsg
      message.topic = topic
      message.qos = packet.qos
      message.mesg = payload.toString()
      message.raw = packet
      subscription.messages.unshift(message)
      subscription.numMsg += 1
      if (subscription.messages.length > subscription.maxMsg) {
        subscription.messages.pop()
      }
    // console.log(JSON.stringify(subscription))
    }
  }
  ractive.update()
})
