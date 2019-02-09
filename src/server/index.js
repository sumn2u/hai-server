import express from 'express';

const haijsServer = {
  create: () => express().set('json spaces', 2),
  defaults: require('./defaults'),
  router: require('./router'),
  rewriter: require('./rewriter'),
  bodyParser: require('./body-parser')
}

export { haijsServer }