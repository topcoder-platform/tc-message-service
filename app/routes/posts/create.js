
const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const HelperService = require('../../services/helper');
const Joi = require('joi');
const { EVENT } = require('../../constants');

/**
 * Creates a new post to a topic in Discourse
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
    post: Joi.string().required(),
    attachmentIds: Joi.array().items(Joi.number()).optional(),
  });
  const postBody = req.body.post;
  const topicId = req.params.topicId;
  const attachmentIds = req.body.attachmentIds;
  const userId = req.authUser.isMachine ? config.get('coderBotUserId') : req.authUser.userId.toString();
  let savedPost;
  return db.topics.findById(topicId)
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

      return db.posts.createPost(db, postBody, topic, null, userId).then((updatedPost) => {
        logger.info('post created');
        savedPost = updatedPost;

        // update postIds of attachments with the id of created post
        if (attachmentIds) {
          await db.post_attachments.update({
            postId: savedPost.id,
          }, {
            where: {
              id: { $in: attachmentIds },
              postId: null,
            },
          });
        }

        topic.highestPostNumber += 1;
        topic.save().then(() => logger.debug('topic updated async for post: ', savedPost.id));
        // creates an entry in post_user_stats table for tracking user actions against this post
        // right now it only creates entry for 'READ' action, in future we may create more entries
        // when we support more actions e.g. 'LIKE', 'BOOKMARK', 'FAVORITE' etc
        db.post_user_stats.createStats(db, logger, {
          post: savedPost,
          userId,
          action: 'READ',
        }).then(() => logger.debug('post_user_stats entry created for post: ', savedPost.id));

        return db.post_attachments.findAll({ where: { postId: savedPost.id } }).then((att) => {
          savedPost.postAttachments = att;
        }).then(() => adapter.adaptPost(savedPost))
        .then((post) => {
          // emit post creation event
          req.app.emit(EVENT.POST_CREATED, { post: savedPost, topic, req, userId });
          return resp.status(200).send(util.wrapResponse(req.id, post));
        });
      });
    });
  })
  .catch((error) => {
    logger.error(error);
    next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error creating post'));
  });
};
