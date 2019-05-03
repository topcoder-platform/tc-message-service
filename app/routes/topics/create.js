
const config = require('config');
const Sequelize = require('sequelize');
const util = require('tc-core-library-js').util(config);
const HelperService = require('../../services/helper');
const errors = require('common-errors');
const Joi = require('joi');
const Adapter = require('../../services/adapter');
const { EVENT } = require('../../constants');
const esIndex = require('./../indexing/indexing');

/**
 * Handles creation of topics
 * @param {Object} db sequelize db with all models loaded
 * @return {Object} response object
 * @param {Object} m2m machine to machine token helper object
 */
module.exports = (db, m2m) =>

  /**
   * Create a new topic for the specified entity.
   *  - Verify if the user has access to the entity (callReferenceEndpoint function), if the user doesn't have access return 403;
   *  - Try to create a private message in Discourse (createPrivatePost in discourse.js);
   *  - If it fails, check if the user exists in Discourse, if the user doesn't exist, provision it, and try to create the private message again;
   *  - Set system, and the current user as the users in the post;
   *  - Return the newly created topic.
   * params: standard express parameters
   */
  (req, resp, next) => {
    const logger = req.log;
    const helper = HelperService(logger, db, m2m);
    const adapter = new Adapter(logger, db);

    const params = req.body;

    // Validate request parameters
    Joi.assert(params, {
      reference: Joi.string().required(),
      referenceId: Joi.string().required(),
      attachmentIds: Joi.array().items(Joi.number()).optional(),
      tag: Joi.string().required(),
      title: Joi.string().required(),
      body: Joi.string().required(),
    });

    const userId = req.authUser.isMachine ? config.get('coderBotUserId') : req.authUser.userId.toString();
    return helper.callReferenceEndpoint(req.authToken, req.id, params.reference, params.referenceId)
      .then(async (hasAccessResp) => {
        const hasAccess = await helper.userHasAccessToEntity(userId, hasAccessResp, params.reference);
        if (!hasAccess && !helper.isAdmin(req)) {
          logger.info('should return after here');
          throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
        }
        const tags = params.tag.split(',');
        const pgTopic = {
          reference: params.reference,
          referenceId: params.referenceId,
          title: params.title,
          tags,
        };

        logger.info('should return befor here');
        const database = new Sequelize(config.get('dbConfig.masterUrl'), {
          logging: false,
        });
        return database.transaction(trans =>
          db.topics.createTopic(db, pgTopic, userId, trans).then((savedTopic) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["savedTopic"] }] */
            logger.debug('topic saved in Postgres: ', savedTopic);
            return db.posts.createPost(db, params.body, savedTopic, null, userId, trans).then((savedPost) => {
              logger.info('post saved in Postgres', savedPost);
              const topic = savedTopic.dataValues;
              const post = savedPost.dataValues;
              topic.posts = [post];

              // update postIds of attachments with the id of created post
              if (params.attachmentIds) {
                db.post_attachments.update({
                  postId: post.id,
                }, {
                  where: {
                    id: params.attachmentIds,
                    postId: null,
                  },
                });
              }

              req.app.emit(EVENT.TOPIC_CREATED, { topic, req, userId });

              // creates an entry in post_user_stats table for tracking user actions against this post
              // right now it only creates entry for 'READ' action, in future we may create more entries
              // when we support more actions e.g. 'LIKE', 'BOOKMARK', 'FAVORITE' etc
              db.post_user_stats.createStats(db, logger, {
                post: savedPost,
                userId,
                action: 'READ',
              }).then(() => {
                logger.debug('post_user_stats entry created for post: ', savedPost.id);
                // update elastic search index
                esIndex.updateElasticSearchIndex(db, adapter, savedTopic.id, savedTopic.id);
                return resp.status(200).send(util.wrapResponse(
                  req.id,
                  adapter.adaptTopic({ dbTopic: topic, totalPosts: 1 })));
              });
            });
          }));
      }).catch((error) => {
        logger.error('Failed to create topic', error);
        next(error instanceof errors.HttpStatusError ? error :
          new errors.HttpStatusError(500, 'Error creating topic'));
      });
  };
