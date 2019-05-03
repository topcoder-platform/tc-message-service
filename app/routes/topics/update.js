import _ from 'lodash';
import HelperService from '../../services/helper';

const config = require('config');
const Sequelize = require('sequelize');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const Promise = require('bluebird');
const esIndex = require('./../indexing/indexing');

/**
 * Save a topic in Discourse
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
    title: Joi.string().required(),
    postId: Joi.number().required(),
    content: Joi.string().required(),
    attachmentIds: Joi.array().items(Joi.number()).optional(),
  });
  const topicId = req.params.topicId;
  const postId = req.body.postId;
  const title = req.body.title;
  const attachmentIds = req.body.attachmentIds;
  const content = req.body.content;
  const userId = req.authUser.userId.toString();

  const database = new Sequelize(config.get('dbConfig.masterUrl'), {
    logging: true,
  });
  logger.debug('attachmentIds ', attachmentIds);
  return database.transaction(trans =>
    db.topics.findTopic(db, adapter, { topicId, numberOfPosts: -1, reqUserId: userId })
      .then((topic) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["topic"] }] */
        if (!topic) {
          const err = new errors.HttpStatusError(404, 'Topic does not exist');
          return next(err);
        }
        return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, topic.referenceId)
          .then(async (hasAccessResp) => {
            const hasAccess = await helper.userHasAccessToEntity(userId, hasAccessResp, topic.reference);
            if (!hasAccess && !helper.isAdmin(req)) {
              throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
            }
            const contentPost = _.get(topic, 'posts[0]', null);
            if (!contentPost || contentPost.id !== Number(postId)) {
              throw new errors.HttpStatusError(404, 'Post does not exist');
            }
            return db.posts.updatePostAttachments(db, postId, attachmentIds).then(() => {
              const promises = [
                db.topics.updateTopic(db, adapter, { title }, { topicId, reqUserId: userId }, trans)
                  .then((updatedTopic) => {
                    logger.debug('Topic saved', updatedTopic);
                    return updatedTopic;
                  }),
                db.posts.updatePost(db, adapter, { raw: content }, { postId }, userId, trans)
                  .then((updatedPost) => {
                    logger.info('Topic Post saved', updatedPost);
                    return updatedPost;
                  }),
              ];

              return Promise.all(promises)
                .then((response) => {
                  const t = response[0];
                  const p = response[1];
                  t.posts = topic.posts;
                  // update elastic search index
                  esIndex.updateElasticSearchIndex(db, adapter, topicId, topicId);
                  // TODO should get rid of post as seprate field in response
                  resp.status(200).send(util.wrapResponse(req.id, { topic: t, post: p }));
                });
            });
          });
      })).catch((error) => {
        logger.error(error);
        next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error updating topic'));
      });
};
