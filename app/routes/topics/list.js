import HelperService from '../../services/helper';

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Promise = require('bluebird');
const errors = require('common-errors');
const Joi = require('joi');
const esClient = require('./../../elasticSearchConnection');
const Adapter = require('../../services/adapter');
const esIndex = require('./../indexing/indexing');


/**
 * Handles listing of topics
 * @param {Object} db sequelize db with all models loaded
 * @param {Object} m2m machine to machine token helper object
 * @return {Objet} response
 */
module.exports = (db, m2m) =>
  /**
   * Gets topics from Discourse for the specified entity, and in the process it does:
   *  - Checks if the user has access to the referred entity
   *  - Checks if a user exists in Discourse, if not, it creates one
   *  - Checks if a topic associated with this entity exists in Discourse, if not creates one
   *  - If the topic already exists, checks if the user has access, if not gives access
   * params: standard express parameters
   */
  (req, resp, next) => { // eslint-disable-line
    const logger = req.log;
    const helper = HelperService(logger, db, m2m);
    const adapter = new Adapter(logger, db);

    // Validate request parameters
    Joi.assert(req.query, {
      filter: Joi.string().required(),
    });

    // Parse filter
    const parsedFilter = (req.query.filter || '').split('&');
    let filter = {};
    _(parsedFilter).each((value) => {
      const parts = value.split('=');
      if (parts.length === 2) {
        filter[parts[0]] = parts[1];
      }
    });
    // allowed filters
    const filterTerm = _.pick(filter, ['reference', 'referenceId', 'tag']);
    _.forEach(filterTerm, (singleValue, singleKey) => {
      const term = {};
      if (singleKey === 'tag') {
        term.regexp = {};
        term.regexp.tag = `.*${singleValue.toLowerCase()}.*`;
      } else {
        term.term = {};
        term.term[singleKey] = singleValue.toLowerCase();
      }
      esFilter.query.bool.filter.push(term);
    });

    // Verify required filters are present
    if (!filter.reference || !filter.referenceId) {
      return next(new errors.HttpStatusError(400, 'Please provide reference and referenceId filter parameters'));
    }

    const userId = req.authUser.userId.toString();
    return helper.callReferenceEndpoint(req.authToken, req.id, filter.reference, filter.referenceId)
      .then((hasAccessResp) => {
        const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, filter.reference);
        if (!hasAccess && !helper.isAdmin(req)) {
          throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
        }
        // Get topics from the Elastic Search
        return esClient.search({
          index: config.get('elasticsearchConfig.indexName'),
          type: 'topic',
          body: esFilter,
        })
          .then((dbTopicElastic) => {
            const dbTopics = [];
            _.forEach(dbTopicElastic.hits.hits, (source) => {
              dbTopics.push(source._source);
            });
            if (!dbTopics || dbTopics.length === 0) {
              // returning empty list
              return [];
            }

            // check read flag based on requested user id
            _.each(dbTopics, (topic) => {
              _.each(topic.posts, (post) => {
                post.read = post.readUserIds ? post.readUserIds.indexOf(userId) !== -1 : false;
                delete post.readUserIds;
              });
              topic.read = _.every(topic.posts, post => post.read);
            });

            // Mark all unread topics as read.
            Promise.all(dbTopics.filter(topic => !topic.read).map((topic) => {
              const unreadPosts = _.filter(topic.posts, post => !post.read);
              if (unreadPosts.length > 0) {
                // marks unread posts as read for the requested user
                db.post_user_stats.updateUserStats(db, logger, unreadPosts, userId, 'READ');
                // update elastic search index only if user read is changed
                esIndex.updateElasticSearchIndex(db, adapter, topic.id, topic.id);
              }
              return Promise.resolve();
            }));
            const adaptedTopics = dbTopics;
            return adaptedTopics;
          })
          .then(result => resp.status(200).send(util.wrapResponse(req.id, result)));
      })
      .catch((error) => {
        logger.error(error);
        next(error instanceof errors.HttpStatusError ?
          error : new errors.HttpStatusError(500, 'Error fetching topics'));
      });
  };
