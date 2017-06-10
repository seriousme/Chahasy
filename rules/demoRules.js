// an example rule

const rules = {
  "groups/g1": (topic, payload) => {
    const actions = {
      "lamps/l1": "off",
      "lamps/l2": "0",
      "lamps/l3": "off",
      "lamps/l4": "off"
    };
    return actions;
  }
};

module.exports = rules;
