import errors from 'common-errors';
import config from 'config';
import HelperService from '../../services/helper';
// import _  from require('lodash');

const util = require('tc-core-library-js').util(config);
const esClient = require('./../../elasticSearchConnection');


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
