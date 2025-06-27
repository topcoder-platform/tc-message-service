
import HelperService from '../../services/helper';

const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Joi = require('joi');
const { EVENT } = require('../../constants');
const osClient = require('./../../openSearchConnection');
const uuidv1 = require('uuid/v1');
const DynamoService = require('../../services/dynamodbErrorLog');

/**
 * Delete a topic from Discourse and Postgresql
 * @param {Object} db sequelize db with all models loaded
 * @param {Object} m2m machine to machine token helper object
 * @return {object} response
 */
module.exports = (db, m2m) => (req, resp, next) => {
  const logger = req.log;
  const helper = HelperService(logger, db, m2m);

  // Validate request parameters
  Joi.assert(req.params, {
    topicId: Joi.number().required(),
  });
  const topicId = req.params.topicId;
  const userId = req.authUser.userId.toString();
  return db.topics.findById(topicId)
  .then((topic) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["topic"] }] */
    if (!topic) {
      const err = new errors.HttpStatusError(404, 'Topic does not exist');
      return next(err);
    }

    return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, topic.referenceId)
    .then(async (hasAccessResp) => {
      const hasAccess = await helper.userHasAccessToEntity(userId, hasAccessResp, topic.tags, topic.reference);
      if (!hasAccess && !helper.isAdmin(req)) {
        throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
      }

      if (((topic.createdBy !== userId) && (!helper.isAdmin(req)))) {
        const err = errors.HttpStatusError(403, 'You are not allowed to perform this action');
        return next(err);
      }

      return db.posts.getTopicPostsCount(topic.id)
      .then((totalPosts) => {
        if (totalPosts > 1) {
          throw new errors.HttpStatusError(422, 'Topic has comments and can not be deleted');
        }
        topic.deletedAt = new Date();
        topic.deletedBy = userId;
        topic.save().then(() => {
          // update elastic search index
          osClient.delete({
            index: config.get('elasticsearchConfig.indexName'),
            id: topic.id,
          }, (err) => {
            if (err) {
              DynamoService.save(uuidv1(), topic.id, 'topic', topic, JSON.stringify(err));
            }
          });
          req.app.emit(EVENT.TOPIC_DELETED, { topic, req });
          resp.status(200).send(util.wrapResponse(req.id));
        });
      });
    });
  })
  .catch((error) => {
    logger.error(error);
    next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error deleting topic'));
  });
};
