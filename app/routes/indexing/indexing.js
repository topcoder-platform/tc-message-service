
const _ = require('lodash');
const config = require('config');
const Joi = require('joi');
const Adapter = require('../../services/adapter');
const esClient = require('./../../elasticSearchConnection');
const Sequelize = require('sequelize');
const uuidv1 = require('uuid/v1');
const errors = require('common-errors');
const HelperService = require('../../services/helper');

const DynamoService = require('../../services/dynamodbErrorLog');


function updateElasticSearchIndex(db, adapter, from, to, reference, referenceId) {
  const filter = {};
  if (from && to) {
    filter.id = {};

    filter.id = {
      [Sequelize.Op.between]: [from, to],
    };
  }
  if (reference) {
    filter.reference = {};
    filter.reference = {
      [Sequelize.Op.eq]: reference,
    };
  }
  if (referenceId) {
    filter.referenceId = {};
    filter.referenceId = {
      [Sequelize.Op.eq]: referenceId,
    };
  }


  return db.topics.findTopics(db, adapter, { filters: filter, numberOfPosts: -1, includeReadUserIds: true })
    .then((dbTopics) => {
      if (!dbTopics || dbTopics.length === 0) {
        // returning empty list
        return [];
      }

      // const adaptedTopics = adapter.adaptTopics({ topics : dbTopics });
      _.each(dbTopics, (dbTopic) => {
        esClient.index({
          index: config.get('elasticsearchConfig.indexName'),
          id: dbTopic.id,
          type: 'topic',
          body: dbTopic,
        }, (err) => {
          if (err) {
            DynamoService.save(uuidv1(), dbTopic.id, 'topic', dbTopic, JSON.stringify(err));
          }
        });
      });

      return dbTopics;
    });
}

/**
 * Update the topics from database to elasticsearch
 * @param {Object} db sequelize db with all models loaded
 * @return {Objet} response
 */
module.exports = db =>
  /**
   * Gets topics from database and update the elasticsearch index, and in the process it does:
   *  - Checks if the user is admin user
   *  - Update the elasticsearch index
   * params: standard express parameters
   */
  (req, resp, next) => { // eslint-disable-line
    const logger = req.log;
    const adapter = new Adapter(logger, db);
    const helper = HelperService(logger, db);


    // Validate request parameters
    Joi.assert(req.query,
      Joi.alternatives().try(
        Joi.object({
          reference: Joi.string(),
          referenceId: Joi.string(),
          from: Joi.string().required(),
          to: Joi.string().required(),
        }),
        Joi.object({
          reference: Joi.string(),
          referenceId: Joi.string().required(),
        }),
      ),
    );
    // Parse filter

    if (!helper.isAdmin(req)) {
      throw new errors.HttpStatusError(403, 'User doesn\'t have access to this operation');
    }
    // Get topics from the Postgres database
    updateElasticSearchIndex(db, adapter, req.query.from, req.query.to, req.query.reference, req.query.referenceId);
    resp.status(200).send('ok');
  };
module.exports.updateElasticSearchIndex = updateElasticSearchIndex;
