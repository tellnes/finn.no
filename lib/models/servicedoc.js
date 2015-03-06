'use strict'

const inherits = require('inherits')
const Result = require('./result')

module.exports = ServiceDoc
inherits(ServiceDoc, Result)

function ServiceDoc(finn, raw) {
  Result.call(this, finn, raw)

  atomTitleArrayToObject(raw.service[0].workspace, this)

  this.searches.collection =
    atomTitleArrayToObject(this.searches.collection, {})
}

function atomTitleArrayToObject(arr, obj) {
  for (let i = 0; i < arr.length; i++) {
    let item = arr[i]
    obj[item['atom:title'][0]] = item
    delete item['atom:title']
  }
  return obj
}
