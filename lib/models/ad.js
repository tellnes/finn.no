'use strict'

const inherits = require('inherits')
const AdBase = require('./ad-base')

module.exports = Ad
inherits(Ad, AdBase)

function Ad(finn, raw) {
  AdBase.call(this, finn, raw.entry[0])
}
