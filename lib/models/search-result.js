'use strict'

const inherits = require('inherits')
const AdBase = require('./ad-base')
const Ad = require('./ad')

module.exports = SearchResult
inherits(SearchResult, AdBase)

function SearchResult(finn, raw) {
  AdBase.call(this, finn, raw)
}

SearchResult.prototype.ad = function (cb) {
  this._finn.get(this.href, { model: Ad }, cb)
}
