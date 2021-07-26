

// Dependencies
const express = require('express');
const config = require('config');
const _ = require('lodash');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const expressRequestId = require('express-request-id');
const cors = require('cors');
const busApi = require('./events/busApi');

const coreLib = require('tc-core-library-js');
const Routes = require('./routes');
const models = require('./models');

const tcCoreLibAuth = coreLib.auth;
const m2m = tcCoreLibAuth.m2m(config);

// Define and configure app
const app = express();

// init logger
let appName = 'tc-message-service';
// let domain = 'topcoder-dev.com';
if (process.env.NODE_ENV) {
  switch (process.env.NODE_ENV.toLowerCase()) {
    case 'local':
      appName += '-local';
      // domain = 'topcoder-dev.com';
      break;
    case 'development':
      appName += '-dev';
      // domain = 'topcoder-dev.com';
      break;
    case 'qa':
      appName += '-qa';
      // domain = 'topcoder-qa.com';
      break;
    case 'production':
    default:
      appName += '-prod';
      // domain = 'topcoder.com';
      break;
  }
}

const logger = coreLib.logger({
  name: appName,
  level: _.get(config, 'logLevel', 'debug').toLowerCase(),
  captureLogs: config.get('captureLogs'),
  logentriesToken: _.get(config, 'logentriesToken', null),
});
app.logger = logger;
const db = models(app, logger);

// adds m2m module of tc core lib to the app
app.m2m = m2m;
const routes = Routes(logger, db, m2m);

// add request Id
const addRequestId = expressRequestId();
app.use(addRequestId);

// =======================
// CORS ================
// =======================
// const whitelist = [`*.${domain}`];
// const corsOptions = {
//   origin: (origin, callback) => {
//     const originIsWhitelisted = whitelist.indexOf(origin) !== -1;
//     callback(null, originIsWhitelisted);
//   },
// };
// app.use(cors(corsOptions));
// app.options('*', cors());
app.use(cors());
app.use(coreLib.middleware.logger(null, logger));
app.use(bodyParser.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));
app.use(cookieParser());
app.use(routes);

// =======================
// Event listener for Bus Api
// =======================
busApi(app, db, logger);

// Queues
app.services = {};
if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'test') {
  // TODO add test mocks
} else {
  // TODO add any required services like kafka consumer service etc.
}

module.exports = app;
