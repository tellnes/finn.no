'use strict'

const Readable = require('stream').Readable
const querystring = require('querystring')
const inherits = require('inherits')
const debug = require('debug')('finn:search')
const SearchResult = require('./models/search-result')

module.exports = SearchStream
inherits(SearchStream, Readable)

function SearchStream(finn, type, params, options) {
  if (!(this instanceof SearchStream))
    return new SearchStream(finn, type, params, options)

  options = options || {}
  let batchSize = options.batchSize || 10

  this.params = {}
  for (let key in params) this.params[key] = params[key]
  this.params.page = 0
  this.params.rows = batchSize

  this.type = type
  this._finn = finn

  this._service = null
  this._fetching = false
  this._countPushed = 0

  Readable.call(this
    , { objectMode: true
      , highWaterMark: options.highWaterMark || batchSize
      }
    )
}

SearchStream.prototype._read = function () {
  debug('_read called')

  if (!this._service) {
    let self = this
    self._finn.servicedoc(function (err, doc) {
      if (err) return self.emit('error', err)
      self._service = doc.searches.collection[self.type]
      self._fetchMore()
    })
    return
  }

  if (!this._fetching)
    this._fetchMore()
}

SearchStream.prototype._fetchMore = function () {
  this._fetching = true

  this.params.page++
  let href = this._service.href + '?' + querystring.stringify(this.params)

  debug('fetch more', href)

  let self = this
  this._finn.get(href, function (err, result) {
    if (err) return self.emit('error', err)
    let feed = result.feed[0]

    debug('got result')
    self.emit('result', feed)

    let wantsMore

    for (let i = 0; i < feed.entry.length; i++) {
      wantsMore = self.push(new SearchResult(self._finn, feed.entry[i]))
    }

    self._countPushed += feed.entry.length
    if (Number(feed['os:totalResults']) === self._countPushed) {
      debug('no more results')
      self.push(null)
      return
    }

    self._fetching = false
    debug('finish pushing result', wantsMore)

    if (wantsMore) self._fetchMore()
  })
}
