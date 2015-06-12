'use strict'

const EventEmitter = require('events')
const request = require('request')
const LRU = require('lru-cache')
const inherits = require('inherits')
const xml2json = require('xml2json')
const bounds = require('binary-search-bounds')
const debug = require('debug')('finn:finn')
const ServiceDoc = require('./models/servicedoc')
const SearchStream = require('./search-stream')

const CERTIFICATE_FINGERPRINT =
  '5D:24:B1:E1:F1:E4:14:2D:F7:9B:F1:13:A1:D4:16:CB:E3:43:9B:99'

module.exports = Finn

inherits(Finn, EventEmitter)


function lruLength(value) {
  return value &&
         value.response &&
         value.response.body &&
         value.response.body.length ||
         1
}

function Finn(apiKey, options) {
  if (!(this instanceof Finn)) return new Finn(apiKey, options)

  this.apiKey = apiKey

  options = options || {}

  this.strictSSL = options.strictSSL === false ? false : true
  this.timeout = options.timeout || 30*1000

  const lruOptions =
    { length: lruLength
    , max: options.maxCacheSize || 0xfffff
    }
  this.cache = new LRU(lruOptions)
}

const reCacheControl = /^max\-age\=([1-9][0-9]+)$/

function parseBody(res) {
  let err = null
  let body = res.body

  try {
    switch (res.headers['content-type'].split(';', 1)[0]) {
    case 'application/xml':
    case 'application/atom+xml':
      body = xml2json.toJson(body, { object: true, arrayNotation: true })
      break

    case 'application/json':
      body = JSON.parse(body)
      break

    default:
      err = new Error('Unexpected Content-Type ' + res.headers['content-type'])
      break
    }
  } catch (e) {
    err = e
  }

  return [ err, body ]
}

Finn.prototype.get = function (href, options, cb) {
  if (typeof options === 'function') {
    cb = options
    options = {}
  }

  let hit = this.cache.get(href)
  if (hit) {
    if (hit.expires > Date.now()) {
      debug('request cache hit', href)
      process.nextTick(function () {
        cb(null, hit.body)
      })
      return
    }

    debug('request cache expired', href)
    this.cache.del(href)
  } else {
    debug('request cache miss', href)
  }

  this.once(href, cb)
  if (EventEmitter.listenerCount(this, href) > 1) return

  let self = this

  let req = request(
          { uri: href
          , strictSSL: false
          , headers:
            { 'X-Finn-Apikey': self.apiKey
            }
          , timeout: self.timeout
          }
        , callback
        )

  function callback(err, res) {
    if (!err && res.statusCode !== 200) {
      err = new Error('Unexpected status code from remote; ' + res.statusCode)
      err.response = res
    }

    if (err) return self.emit(href, err)


    let parseResult = parseBody(res)
    if (parseResult[0]) return self.emit(href, parseResult[0])
    let body = parseResult[1]

    if (options.transform) {
      try {
        body = options.transform(body)
      } catch (err) {
        cb(err)
        return
      }
    }

    if (options.model) body = new (options.model)(self, body)

    let match = (res.headers['cache-control'] || '').match(reCacheControl)
    if (match) {
      let maxAge = Number(match[1])
      self.cache.set(href, { expires: Date.now() + maxAge * 1000, body: body })
      debug('cache set', href, maxAge)
    }

    self.emit(href, null, body)
  }

  if (this.strictSSL) {
    req.on('socket', function (socket) {
      socket.on('secureConnect', function () {
        if (socket.authorized) return

        if ( socket.authorizationError === 'SELF_SIGNED_CERT_IN_CHAIN' &&
             socket.getPeerCertificate().fingerprint === CERTIFICATE_FINGERPRINT
           ) return

        req.abort()
        self.emit(href, new Error('TLS Error: ' + socket.authorizationError))
      })
    })
  }
}

Finn.prototype.servicedoc = function (cb) {
  this.get('https://cache.api.finn.no/iad/', { model: ServiceDoc }, cb)
}

Finn.prototype.search = function (type, params, options) {
  return new SearchStream(this, type, params, options)
}

Finn.prototype.imageSize = function (url, width, cb) {
  let self = this
  this.servicedoc(function (err, doc) {
    if (err) return cb(err)

    let href = doc['image-size']['atom:link'][0].href
    self.get(href, { transform: transformImageSizes }, function (err, result) {
      if (err) return cb(err)

      let index = bounds.gt( result.availableSizes
                           , { width: width }
                           , compareImageSizes
                           )
      if (index === result.availableSizes.length) index--
      let size = result.availableSizes[index]

      url = url.replace(result.pattern, size.replacement)

      cb(null, url)
    })
  })
}

function transformImageSizes(obj) {
  obj.availableSizes.sort(compareImageSizes)
  return obj
}

function compareImageSizes(a, b) {
  return a.width > b.width ? 1 : a.width < b.width ? -1 : 0
}
