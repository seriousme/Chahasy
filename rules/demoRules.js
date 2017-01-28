// an example rule

var rules = {
  'groups/g1': function (topic, payload) {
    var actions = {
      'lamps/l1': 'off',
      'lamps/l2': '0',
      'lamps/l3': 'off',
      'lamps/l4': 'off'
    }
    return actions
  }
}

module.exports = rules
