
import HelperService from '../../services/helper';

const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const { EVENT } = require('../../constants');

/**
 * Update topic details
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
    topic: Joi.object().keys({
      reference: Joi.string(),
      referenceId: Joi.string(),
      discourseTopicId: Joi.number(),
      tag: Joi.string(),
      createdAt: Joi.date(),
      createdBy: Joi.number(),
      updatedAt: Joi.date(),
      updatedBy: Joi.number(),
      highestPostNumber: Joi.number(),
      title: Joi.string(),
      closed: Joi.boolean(),
      hidden: Joi.boolean(),
      archived: Joi.boolean(),
      hiddenReason: Joi.string(),
      deletedAt: Joi.date().allow(null),
      deletedBy: Joi.number(),
    }),
  });
  const topicId = req.params.topicId;
  const userId = req.authUser.userId.toString();
  const content = req.body;

  return db.topics.findTopic(db, adapter, { topicId, raw: true })
    .then((topic) => {
      if (!topic) {
        const err = new errors.HttpStatusError(404, 'Topic does not exist');
        return next(err);
      }
      return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, topic.referenceId)
        .then((hasAccessResp) => {
          const isAdmin = helper.isAdmin(req);
          if (!isAdmin) {
            throw new errors.HttpStatusError(403, 'Must have Administrator role');
          }
          // If user has access to entity
          const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, topic.reference);
          if (!hasAccess) {
            throw new errors.HttpStatusError(403, 'User doesn\'t have access to entity');
          }
          return db.topics.updateTopic(db, adapter, content.topic, { topicId, userId })
            .then((updatedTopic) => {
              req.app.emit(EVENT.TOPIC_UPDATED, { topic, req });
              resp.status(200).send(util.wrapResponse(req.id, updatedTopic));
            });
        });
    })
    .catch((error) => {
      logger.error(error);
      next(error instanceof errors.HttpStatusError ?
        error : new errors.HttpStatusError(500, 'Error updating post'));
    });
};
