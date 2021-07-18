
const _ = require('lodash');
// const config = require('config');
const Promise = require('bluebird');
// const { USER_ROLE } = require('../../constants');

/**
 * Retrieves topics
 * @param {Object} logger logging
 * @param {Object} dbTopics topics retrieved from db
 * @param {String} userId id of the user which should be used for fetching topic
 * @param {Object} discourseClient client to invoke calls to discourse
 */
const retrieveTopics = Promise.coroutine(function* a(logger, dbTopics, userId, discourseClient) {
  // attempt to retrieve discourse Topic
  let topics = null;
  try {
    topics = yield discourseClient.getTopics(_.map(dbTopics, t => t.discourseTopicId), userId);
    logger.debug(topics);
    _.each(topics, (t) => {
      t.tags = _.find(dbTopics, { discourseTopicId: t.id }).tags; // eslint-disable-line
    });
  } catch (error) {
    logger.info('Failed to get topics');
    logger.error(error);
    topics = null;
  }
  return topics;
});

module.exports = {
  retrieveTopics,
};
