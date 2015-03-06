'use strict'

const inherits = require('inherits')
const he = require('he')
const Result = require('./result')

module.exports = Ad
inherits(Ad, Result)

const singular =
  [ 'id'
  , 'title'
  , 'updated'
  , 'published'
  , 'dc:dateSubmitted'
  , 'app:edited'
  , 'dc:identifier'
  , 'georss:point'
  , 'finn:location'
  , 'author'
  , 'finn:contact'
  ]

const singularAuthorFields =
  [ 'name'
  , 'uri'
  , 'finn:externalref'
  ]

const dateFields =
  [ 'updated'
  , 'published'
  , 'dc:dateSubmitted'
  , 'age:expires'
  , 'app:edited'
  ]

function Ad(finn, raw) {
  Result.call(this, finn, raw)
  for (let key in raw) this[key] = raw[key]

  for (let i = 0; i < singular.length; i++) {
    let field = singular[i]
    if (field in this) {
      this[field] = this[field][0]
    }
  }

  for (let i = 0; i < dateFields.length; i++) {
    let field = dateFields[i]
    if (field in this) {
      this[field] = new Date(this[field])
    }
  }

  for (let i = 0; i < raw.category.length; i++) {
    let scheme = raw.category[i].scheme
    let key = stripIfStartsWith(scheme, 'urn:finn:ad:')
    this[key] = raw.category[i].term
  }
  delete this.category

  convertLink(this)

  objectStripArray(this['finn:location'])


  convertLink(this['author'])
  objectStripArray(this['author'], singularAuthorFields)

  convertLink(this['finn:contact'])
  objectStripArray(this['finn:contact'])


  this.model = this['finn:adata']['model']
  this.field = convertFinnField(this['finn:adata'][0]['finn:field'])
  this.price = raw['finn:adata'][0]['finn:price'][0].value
  delete this['finn:adata']
}

function stripIfStartsWith(str, needle) {
  if (str.substr(0, needle.length) === needle)
    str = str.substr(needle.length)
  return str
}

function convertLink(obj) {
  if (!obj || !Array.isArray(obj.link)) return
  let arr = obj.link
  obj.link = {}
  for (let i = 0; i < arr.length; i++) {
    obj.link[arr[i].rel] = arr[i]
  }
  if (obj.link.self) obj.href = obj.link.self.href
}

function objectStripArray(obj, fields) {
  for (let field in obj) {
    if ( fields ?
         ~fields.indexOf(field) :
         Array.isArray(obj[field]) && obj[field].length === 1
       ) {
      obj[field] = obj[field][0]
    }
  }
}

function convertFinnField(arr) {
  let field = {}
  for (let i = 0; i < arr.length; i++) {
    let obj = arr[i]
    let value
    if ('value' in obj) {
      value = obj['value']
    } else if ('finn:field' in obj) {
      value = convertFinnField(obj['finn:field'])
    } else if ('$t' in obj) {
      value = he.decode(he.decode(obj['$t']))
    } else {
      throw new Error('Unexpected finn:field')
    }

    if (value) {
      field[obj.name] = value
    }
  }
  return field
}
