import errors from 'common-errors';
import config from 'config';
import HelperService from '../../services/helper';

const util = require('tc-core-library-js').util(config);
const esClient = require('./../../elasticSearchConnection');
const Adapter = require('../../services/adapter');
const esIndex = require('./../indexing/indexing');
const _ = require('lodash');

/**
 * Get specific topic
 * @param {Object} db sequelize db with all models loaded
 * @return {Object} response
 */
module.exports = db =>

  /**
   * Gets topic from elasticsearch for the specified entity, and in the process it does:
   *  - Checks if topic exists in the elasticsearch, throws error if not
   *  - Checks if the user has access to the referred entity, throws error if not
   * params: standard express parameters
   */
  (req, resp, next) => {
    const logger = req.log;
    const helper = HelperService(logger, db);
    const adapter = new Adapter(logger, db);
    const topicId = req.params.topicId;
    const userId = req.authUser.userId.toString();

    return esClient.search({
      index: config.get('elasticsearchConfig.indexName'),
      type: 'topic',
      body: { query: { match: { id: topicId } } },
    }).then((dbTopicElastic) => {
      if (dbTopicElastic.hits.hits.length === 0) {
        const err = new errors.HttpStatusError(404, 'Topic does not exist');
        return next(err);
      }
      const dbTopic = dbTopicElastic.hits.hits[0]._source;

      if (!dbTopic) {
        const err = new errors.HttpStatusError(404, 'Topic does not exist');
        return next(err);
      }

      // check read flag based on requested user id
      _.each(dbTopic.posts, (post) => {
        post.read = post.readUserIds ? post.readUserIds.indexOf(userId.toString()) !== -1 : false;
        delete post.readUserIds;
      });
      dbTopic.read = _.every(dbTopic.posts, post => post.read);
      const unreadPosts = _.filter(dbTopic.posts, post => !post.read);
      logger.debug(`length ${unreadPosts.length}`);
      if (unreadPosts.length > 0) {
        // marks unread posts as read for the requested user
        db.post_user_stats.updateUserStats(db, logger, unreadPosts, userId, 'READ');
        // update elastic search index only if user read is changed
        esIndex.updateElasticSearchIndex(db, adapter, dbTopic.id, dbTopic.id);
      }

      return helper.callReferenceEndpoint(req.authToken, req.id, dbTopic.reference, dbTopic.referenceId)
        .then((hasAccessResp) => {
          const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, dbTopic.reference);
          if (!hasAccess && !helper.isAdmin(req)) {
            throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
          }
          logger.debug('returning topic');
          return dbTopic;
        })
        .then(result => resp.status(200).send(util.wrapResponse(req.id, result))).catch((error) => {
          next(error instanceof errors.HttpStatusError
            ? error : new errors.HttpStatusError(500, 'Error fetching topics'));
        });
    }, (error) => {
      next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error fetching topics'));
    });
  };
