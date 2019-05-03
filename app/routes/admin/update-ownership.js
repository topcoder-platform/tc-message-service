
import HelperService from '../../services/helper';

const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const { EVENT } = require('../../constants');
const Promise = require('bluebird');

/**
 * Update topic/post ownership(createdBy)
 * @param {Object} db sequelize db with models loaded
 * @param {Object} m2m machine to machine token helper object
 * @return {object} response
 */
module.exports = (db, m2m) => (req, resp, next) => {
  const logger = req.log;
  const adapter = new Adapter(logger, db);
  const helper = HelperService(logger, db, m2m);

  // Validate request parameters
  Joi.assert(req.body, {
    topicId: Joi.number().required(),
    postId: Joi.number().optional(),
    userId: Joi.number().required(),
  });
  const { userId, topicId, postId } = req.body;
  const content = req.body;
  let promise;

  const promises = postId ? [
    db.topics.findTopic(db, adapter, { topicId, raw: true }),
    db.posts.findPost(db, adapter, { topicId, postId }, { raw: true }),
  ] :
  [
    db.topics.findTopic(db, adapter, { topicId, raw: true }),
  ];
  return Promise.all(promises)
    .then(([topic, post]) => {
      if (!topic) {
        const err = new errors.HttpStatusError(404, 'Topic does not exist');
        return next(err);
      }
      if (postId && !post) {
        const err = new errors.HttpStatusError(404, 'Post does not exist');
        return next(err);
      }
      return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, topic.referenceId)
        .then(async (hasAccessResp) => {
          const isAdmin = helper.isAdmin(req);
          if (!isAdmin) {
            throw new errors.HttpStatusError(403, 'Must have Administrator role');
          }
          // If asignee exist and has access
          const asigneeId = content.userId;
          const hasAccess = await helper.userHasAccessToEntity(asigneeId, hasAccessResp, topic.reference);
          if (!hasAccess) {
            throw new errors.HttpStatusError(403, 'Asignee doesn\'t have access to entity');
          }

          if (topic && !post) {
            promise = db.topics.updateTopic(db, adapter, { createdBy: content.userId }, { topicId }, userId)
              .then((udpatedTopic) => {
                req.app.emit(EVENT.TOPIC_UPDATED, { post, req, topic });
                resp.status(200).send(util.wrapResponse(req.id, udpatedTopic));
              });
          }

          if (post) {
            promise = db.posts.updatePost(db, adapter, { createdBy: content.userId }, { postId }, userId)
              .then((updatedPost) => {
                req.app.emit(EVENT.POST_UPDATED, { post, req, topic });
                resp.status(200).send(util.wrapResponse(req.id, updatedPost));
              });
          }
          return Promise.resolve(promise);
        });
    })
    .catch((error) => {
      logger.error(error);
      next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error updating post'));
    });
};
