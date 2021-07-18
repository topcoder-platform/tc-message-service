const _ = require('lodash');
const HelperService = require('../../services/helper');

const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');


/**
 * Create userstats
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
    postId: Joi.number().required(),
    userId: Joi.number().required(),
    topicId: Joi.number().required(),
    action: Joi.string().required(),
  });
  const { userId, postId, topicId, action } = req.body;
  return db.posts.findPost(db, adapter, { topicId, postId })
    .then((post) => {
      if (!post) {
        logger.error('Topic post not found');
        next(new errors.HttpStatusError(404, 'Topic post not found'));
      }
      _.assign(post, { topicId });
      const isAdmin = helper.isAdmin(req);
      if (!isAdmin) {
        throw new errors.HttpStatusError(403, 'Must have Administrator role');
      }
      // Initialize user stats
      db.post_user_stats.createStats(db, logger, { post, userId, action })
        .then((userStatsResp) => {
          resp.status(200).send(util.wrapResponse(req.id, userStatsResp));
        })
        .catch((error) => {
          logger.error(error);
          next(error instanceof errors.HttpStatusError ?
            error : new errors.HttpStatusError(500, 'Error initializing user stats'));
        });
    })
    .catch((err) => {
      logger.error(err);
      next(err instanceof errors.HttpStatusError ?
        err : new errors.HttpStatusError(500, 'Error initializing user stats'));
    });
};
