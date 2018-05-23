
import _ from 'lodash';
import HelperService from '../../services/helper';

const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const { EVENT } = require('../../constants');
const Promise = require('bluebird');

/**
 * Update post details
 * @param {Object} db sequelize db with models loaded
 * @return {object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const adapter = new Adapter(logger, db);
  const helper = HelperService(logger, db);

  // Validate request parameters
  Joi.assert(req.body, {
    topicId: Joi.number().required(),
    post: Joi.object().keys({
      raw: Joi.string(),
      cooked: Joi.string(),
      discoursePostId: Joi.number(),
      topicId: Joi.number(),
      postNumber: Joi.number(),
      viaEmail: Joi.boolean(),
      rawEmail: Joi.string(),
      hidden: Joi.boolean(),
      hiddenReason: Joi.string(),
      createdAt: Joi.date(),
      createdBy: Joi.number(),
      updatedAt: Joi.date(),
      updatedBy: Joi.number(),
      deletedAt: Joi.date().allow(null),
      deletedBy: Joi.number().allow(null),
    }),
  });

  const { topicId } = req.body;
  const postId = req.params.postId;
  const userId = parseInt(req.authUser.userId.toString(), 10);
  const content = req.body;

  const promises = [
    db.topics.findTopic(db, adapter, { topicId, raw: true }),
    db.posts.findPost(db, adapter, { topicId, postId }, { raw: true }),
    db.topics.findById(req.body.post.topicId),
  ];
  return Promise.all(promises)
    .then(([topic, post, dbTopic]) => {
      if (!topic) {
        const err = new errors.HttpStatusError(404, 'Topic does not exist');
        return next(err);
      }
      if (!post) {
        const err = new errors.HttpStatusError(404, 'Post does not exist');
        return next(err);
      }
      return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, topic.referenceId)
        .then((hasAccessResp) => {
          const isAdmin = helper.isAdmin(req);
          let promise;
          if (!isAdmin) {
            throw new errors.HttpStatusError(403, 'Must have Administrator role');
          }
          // If user has access
          const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, topic.reference);
          if (!hasAccess) {
            throw new errors.HttpStatusError(403, 'User doesn\'t have access to entity');
          }
          if (_.has(req.body.post, ['deletedBy', 'deletedAt'])) {
            throw new errors.HttpStatusError(403, 'Not allowed, please use a different http method');
          }
          if (_.has(req.body.post, ['topicId'])) {
            const lastPost = post;
            promise = db.posts.update({
              deletedAt: new Date(),
              deletedBy: userId,
            }, { where: { id: postId } })
              .then(() => {
                logger.info('updating topic post');
                // create new post
                return db.posts.createPost(db, lastPost.raw, dbTopic, null, userId)
                  .then((createdTopicPost) => {
                    if (!createdTopicPost) {
                      return next(new errors.HttpStatusError(500, 'Error updating topic post'));
                    }
                    db.post_user_stats.createStats(db, logger, {
                      post: createdTopicPost,
                      userId,
                      action: 'READ',
                    }).then(() => logger.debug('post_user_stats entry created for post: ', createdTopicPost.id));
                    delete req.body.post.topicId;
                    const postUpdate = _.omit(req.body.post, ['topicId']);
                    // update with new post values
                    return db.posts.updatePost(db, adapter, postUpdate, { postId: createdTopicPost.id }, userId);
                  })
                  .catch(Promise.reject);
              });
          } else {
            promise = db.posts.updatePost(db, adapter, content.post, { postId }, userId);
          }
          return Promise.all([promise])
            .then(([updatedPost]) => {
              req.app.emit(EVENT.POST_UPDATED, { post, req, topic });
              resp.status(200).send(util.wrapResponse(req.id, updatedPost));
            });
        });
    })
    .catch((error) => {
      logger.error(error);
      next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error updating post'));
    });
};
