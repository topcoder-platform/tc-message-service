

// Dependencies
import express from 'express';
import config from 'config';
import _ from 'lodash';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import expressRequestId from 'express-request-id';
import cors from 'cors';
import busApi from './events/busApi';

const autoReap = require('multer-autoreap');
const coreLib = require('tc-core-library-js');
const Routes = require('./routes');
const db = require('./models');
const rabbitMQService = require('./services/rabbitmq');
const Discourse = require('./services/discourse');

// Define and configure app
const app = express();

// init logger
let appName = 'tc-message-service';
if (process.env.NODE_ENV) {
  switch (process.env.NODE_ENV.toLowerCase()) {
    case 'local':
      appName += '-local';
      app.use(cors());
      break;
    case 'development':
      appName += '-dev';
      break;
    case 'qa':
      appName += '-qa';
      break;
    case 'production':
    default:
      appName += '-prod';
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

const routes = Routes(logger, db);

// add request Id
const addRequestId = expressRequestId();
app.use(addRequestId);

app.use(coreLib.middleware.logger(null, logger));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(autoReap);
app.use(routes);

// =======================
// Event listener for Bus Api
// =======================
busApi(app, db, logger);


// Set Discourse Webhooks
function initWebhooks() {
  const discourseClient = Discourse(logger);

  // webhook payload
  const requestBody = {
    payload_url: `${config.get('webhookPayloadBaseUrl')}/v4/webhooks`,
    content_type: 0,
    secret: '',
    wildcard_web_hook: true,
    verify_certificate: true,
    active: true,
    web_hook_event_type_ids: ['post_created'],
    category_ids: [],
    group_ids: [],
  };

  discourseClient.createWebhook(requestBody).then(response => response)
    .catch((err) => {
      throw new Error({
        message: 'Error creating webhook endpoint',
        httpError: err,
      });
    });
}

initWebhooks();

// Queues
app.services = {};
if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'test') {
    // TODO add test mocks
} else {
  app.services.pubSub = rabbitMQService(logger);
  app.services.pubSub.init(
    config.get('rabbitmqUrl'),
    config.get('pubSubExchangeName'),
    config.get('pubSubQueueName'))
  .then(() => {
    logger.info('RabbitMQ service initialized');
  })
  .catch((err) => {
    logger.error(err);
    logger.error('Error initializing services', err);
  });
}

module.exports = app;
