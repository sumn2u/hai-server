const express = require('express')
const methodOverride = require('method-override')
const _ = require('lodash')
const lodashId = require('lodash-id')
const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')
const FileSync = require('lowdb/adapters/FileSync')
const bodyParser = require('../body-parser')
const validateData = require('./validate-data')
const plural = require('./plural')
const nested = require('./nested')
const singular = require('./singular')
const mixins = require('../mixins')
// const authentication = require('../authentication')
const jwt = require('jsonwebtoken')

// Create a token from a payload 
function createToken(payload, SECRET_KEY, expiresIn) {
    return jwt.sign(payload, SECRET_KEY, { expiresIn })
}
  
// verify the token 
  function verifyToken(token, SECRET_KEY) {
    console(token, SECRET_KEY,"ghjkl")
    console.log(jwt.verify(token, SECRET_KEY, (err, decode) => decode !== undefined ?  decode : err ))
    return  jwt.verify(token, SECRET_KEY, (err, decode) => decode !== undefined ?  decode : err )
}

  // Check if the user exists in database
  function isAuthenticated (email, password, users) {
    console.log(email, password, users, "hgjkl")
    console.log(users.findIndex(user => user.email === email && user.password === password) !== -1)
    return users.findIndex(user => user.email === email && user.password === password) !== -1
  }


module.exports = (db, opts = { foreignKeySuffix: 'Id', _isFake: false }, auth ) => {
  if (typeof db === 'string') {
    db = low(new FileSync(db))
  } else if (!_.has(db, '__chain__') || !_.has(db, '__wrapped__')) {
    db = low(new Memory()).setState(db)
  }


  // Create router
  const router = express.Router()

  // Add middlewares
  router.use(methodOverride())
  
  validateData(db.getState())

  // Add lodash-id methods to db
  db._.mixin(lodashId)

  // Add specific mixins
  db._.mixin(mixins)

  // Expose database
  router.db = db
 
  // Expose render
  router.render = (req, res) => {
    res.jsonp(res.locals.data)
  }
  

  if (auth) {
    let authenticationURL = auth.authenticationURL || '/auth/login'
    let authenticatedUsers = auth.users || []
    let secretKey = auth.secretKey || ''
    let expiresIn = auth.expiresIn || '24h'
    // Use this for access token
    router.post(authenticationURL, (req, res) => {
      const { email, password } = req.body
      if (isAuthenticated( email, password , authenticatedUsers) === false) {
        const status = 401
        const message = 'Incorrect email or password'
        res.status(status).json({status, message})
        return
      }
      const access_token = createToken({email, password}, secretKey,expiresIn)
      res.status(200).json({access_token})
    })

  }

  // GET /db
  router.get('/db', (req, res) => {
    res.jsonp(db.getState())
  })
  
  // Handle /:parent/:parentId/:resource
  router.use(nested(opts))

  // Create routes
  db.forEach((value, key) => {
    if (_.isPlainObject(value)) {
      router.use(`/${key}`, singular(db, key, opts))
      return
    }

    if (_.isArray(value)) {
      router.use(`/${key}`, plural(db, key, opts))
      return
    }

    var sourceMessage = ''
    // if (!_.isObject(source)) {
    //   sourceMessage = `in ${source}`
    // }

    const msg =
      `Type of "${key}" (${typeof value}) ${sourceMessage} is not supported. ` +
      `Use objects or arrays of objects.`

    throw new Error(msg)
  }).value()
 

  // server.use(/^(?!\/auth).*$/,  (req, res, next) => {
  //   if (req.headers.authorization === undefined || req.headers.authorization.split(' ')[0] !== 'Bearer') {
  //     const status = 401
  //     const message = 'Error in authorization format'
  //     res.status(status).json({status, message})
  //     return
  //   }
  //   try {
  //      verifyToken(req.headers.authorization.split(' ')[1])
  //      next()
  //   } catch (err) {
  //     const status = 401
  //     const message = 'Error access_token is revoked'
  //     res.status(status).json({status, message})
  //   }
  // })

  router.use((req, res, next) => {
    if (!res.locals.data) {
      res.status(404)
      res.locals.data = {}
    }
    if (auth) {
      let authenticatedURL = auth.authenticatedURL || []
      let secretKey = auth.secretKey || ''
      if (authenticatedURL.includes(req.originalUrl)) {
        if (req.headers.authorization === undefined || req.headers.authorization.split(' ')[0] !== 'Bearer') {
          const status = 401
          const message = 'Error in authorization format'
          res.status(status).json({status, message})

        }
        jwt.verify(req.headers.authorization.split(' ')[1], secretKey, function(err, decoded) {
          // err
          if( decoded ){
              next()
          } else {
           const status = 401
           const message = 'Error access_token is revoked'
           res.status(status).json({status, message})
           
            return;
          }
          // decoded undefined
        })
      }
      // router.render(req, res)
    }

    router.render(req, res)
  })

  router.use((err, req, res) => {
    console.error(err.stack)
    res.status(500).send(err.stack)
  })

  return router
}
