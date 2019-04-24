import formidable from 'express-formidable';
import compression from 'compression';

const router = require('express').Router();
const config = require('config');
const util = require('tc-core-library-js').util(config);
const tcCoreLib = require('tc-core-library-js');

const adminUpdateOwnershipHandler = require('./admin/update-ownership');
const adminCreateUserStatsHandler = require('./admin/user-stats');
const adminUpdatePostHandler = require('./admin/post-update');
const adminUpdateTopicHandler = require('./admin/topic-update');

const createAttachmentHandler = require('./attachments/create');
const getAttachmentHandler = require('./attachments/get');
const deleteAttachmentHandler = require('./attachments/delete');

const getTopicHandler = require('./topics/get');
const topicListHandler = require('./topics/list');

const getTopicDbHandler = require('./topics/getDb');
const topicListDbHandler = require('./topics/listDb');

const topicCreateHandler = require('./topics/create');
const topicUpdateHandler = require('./topics/update');
const topicDeleteHandler = require('./topics/delete');

const createPostHandler = require('./posts/create');
const listPostsHandler = require('./posts/list');
const getPostHandler = require('./posts/get');
const updatePostHandler = require('./posts/update');
const deletePostHandler = require('./posts/delete');

const webhookPostHandler = require('./sendgrid/webhook');
const discourseWebhookPostHandler = require('./discourse/webhook');

const elasticSearchIndexHandler = require('./indexing/indexing');

const SecurityHelper = require('../services/security');


const jwt = require('jsonwebtoken');

/**
 * Loads and configures all sub routes of this api
 * @param {Object} logger: logger
 * @param {Object} db sequelize db object containing all models
 * @param {Object} m2m machine to machine token helper object
 * @return {Object} response
 */
module.exports = (logger, db, m2m) => {
  const apiVersion = config.apiVersion;
  const adminPrefix = config.adminPrefix;
  // health check
  router.get(`/${apiVersion}/topics/health`, (req, res, next) => { // eslint-disable-line
    // TODO check if database connection is alive
    res.status(200).send({ message: 'All-is-well' });
  });

  // all project service endpoints need authentication
  const jwtAuth = tcCoreLib.middleware.jwtAuthenticator;

  // discourse webhook with custom auth logic
  router.route(`/${apiVersion}/topics/webhooks/discourse`).post((req, res, next) => {
    const markUnauthorized = (request, response, message) => {
      logger.warn(message);
      response.status(403).json(util.wrapErrorResponse(request.id, 403, 'Invalid token issuer.'));
      response.send();
    };
    const discourseToken = req.header('x-discourse-event-signature');
    const discourseEvent = req.header('x-discourse-event');
    const allowedEvents = ['post_created', 'post_edited', 'topic_created', 'topic_edited'].indexOf(discourseEvent) >= 0;

    if (discourseToken) {
      const token = SecurityHelper.calculateHmac(req.rawBody || '', 'sha256=');
      if (discourseToken === token) {
        if (allowedEvents) {
          discourseWebhookPostHandler(db)(req, res, next);
        } else {
          logger.info(`Discourse Webhook Event Ignored: { event: ${discourseEvent} }`);
          res.status(200).send();
        }
      } else {
        markUnauthorized(req, res, 'Invalid token.');
      }
    } else {
      markUnauthorized(req, res, 'Missing token.');
    }
  });

  router.all(RegExp(`\\/${apiVersion}\\/topics\\/|\\/topics\\/admin\\/(?!webhooks|!health).*`), (req, res, next) => {
    if (`${process.env.TC_MESSAGE_SERVICE_AUTH_LOOSE}` !== 'true') {
      jwtAuth(config)(req, res, next);
      return;
    }
    try {
      const decoded = jwt.decode(req.headers.authorization.split(' ')[1]);
      const issuer = `https://api.${config.get('authDomain')}`;
      if (!decoded) {
        res.status(403)
          .json(util.wrapErrorResponse(req.id, 403, 'No token provided.'));
        res.send();
      } else if (decoded.iss !== issuer) {
        // verify issuer
        res.status(403)
          .json(util.wrapErrorResponse(req.id, 403, 'Invalid token issuer.'));
        res.send();
      } else {
        // if everything is good, save to request for use in other routes
        req.authUser = decoded;
        req.authUser.userId = parseInt(req.authUser.userId, 10);
        next();
      }
    } catch (err) {
      logger.error(err);
      res.status(403)
        .json(util.wrapErrorResponse(req.id, 403, 'Failed to authenticate token.'));
      res.send();
    }
  }, (req, res, next) => {
    req.authToken = req.get('authorization').split(' ')[1]; // eslint-disable-line
    next();
  });

  // Admin routes
  router.route(`${adminPrefix}/ownership/edit`)
    .post(adminUpdateOwnershipHandler(db, m2m));
  router.route(`${adminPrefix}/posts/:postId/stats/create`)
    .post(adminCreateUserStatsHandler(db, m2m));
  router.route(`${adminPrefix}/posts/:postId/edit`)
    .post(adminUpdatePostHandler(db, m2m));
  router.route(`${adminPrefix}/topics/:topicId/edit`)
    .post(adminUpdateTopicHandler(db, m2m));

  // Register all the routes
  router.use(`/${apiVersion}/topics/list`, compression());
  router.route(`/${apiVersion}/topics/list`)
    .get(topicListHandler(db, m2m));
  router.use(`/${apiVersion}/topics/list/db`, compression());
  router.route(`/${apiVersion}/topics/list/db`)
    .get(topicListDbHandler(db, m2m));
  router.route(`/${apiVersion}/topics/create`)
    .post(topicCreateHandler(db, m2m));
  router.route(`/${apiVersion}/topics/:topicId/read`)
    .get(getTopicHandler(db, m2m));
  router.route(`/${apiVersion}/topics/:topicId/read/db`)
    .get(getTopicDbHandler(db, m2m));
  router.route(`/${apiVersion}/topics/:topicId/edit`)
    .post(topicUpdateHandler(db, m2m));
  router.route(`/${apiVersion}/topics/:topicId/remove`)
    .delete(topicDeleteHandler(db, m2m));


  router.use(`/${apiVersion}/topics/:topicId/posts/list`, compression());
  router.route(`/${apiVersion}/topics/:topicId/posts/list`)
    .get(listPostsHandler(db, m2m));
  router.route(`/${apiVersion}/topics/:topicId/posts/create`)
    .post(createPostHandler(db, m2m));
  router.route(`/${apiVersion}/topics/:topicId/posts/:postId/read`)
    .get(getPostHandler(db, m2m));
  router.route(`/${apiVersion}/topics/:topicId/posts/:postId/edit`)
    .post(updatePostHandler(db, m2m));
  router.route(`/${apiVersion}/topics/:topicId/posts/:postId/remove`)
    .delete(deletePostHandler(db, m2m));

  router.route(`/${apiVersion}/topics/attachments`)
    .post(createAttachmentHandler(db, m2m));
  router.route(`/${apiVersion}/topics/attachments/:attachmentId`)
    .get(getAttachmentHandler(db, m2m));
  router.route(`/${apiVersion}/topics/attachments/:attachmentId`)
    .delete(deleteAttachmentHandler(db, m2m));

  router.use(`/${apiVersion}/topics/webhooks/sendgrid`, formidable());
  router.route(`/${apiVersion}/topics/webhooks/sendgrid`)
    .post(webhookPostHandler(db, m2m));
  router.route(`/${apiVersion}/topics/esindex`)
  .post(elasticSearchIndexHandler(db, m2m));


  // register error handler
  router.use((err, req, res, next) => { // eslint-disable-line
    req.log.error(err);

    let httpStatus = err.status || 500;
    let message;

    // specific for validation errors
    if (err.isJoi && err.details && err.details.length > 0) {
      req.log.debug(err.message);
      req.log.debug(err.details);
      message = `Validation error: ${err.details.map(error => error.message).join(', ')}`;
      httpStatus = 400;
    } else {
      message = err.message;
    }

    const body = util.wrapErrorResponse(req.id, httpStatus, message);

    // add stack trace if development environment
    if (process.env.ENVIRONMENT in ['development', 'test', 'qa']) {
      body.result.debug = err.stack;
    }

    res.status(httpStatus).send(body);
  });

  // catch 404 and forward to error handler
  // router.use((req, res, next) => {
  // const err = new Error('Not Found');
  // //err.status = 404;
  // next(err);
  // })

  return router;
};
