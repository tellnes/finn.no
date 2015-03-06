'use strict'

module.exports = Result

function Result(finn, raw) {
  Object.defineProperties(this
    , { '_finn': { value: finn }
      , '_raw': { value: raw }
      }
    )
}
