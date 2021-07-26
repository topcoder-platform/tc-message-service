const _ = require('lodash');
const { EVENT, BUS_API_EVENT } = require('../constants');
const { createEvent } = require('../services/busApi');

module.exports = (app, db, logger) => {
  app.on(EVENT.TOPIC_CREATED, ({ topic, userId }) => {
    logger.debug('receive TOPIC_CREATED event');

    if (topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.TOPIC_CREATED, {
        topicId: topic.id,
        topicTitle: topic.title,
        postContent: _.get(topic, 'posts[0].raw', ''),
        userId,
        projectId: topic.referenceId,
        initiatorUserId: userId,
        migration: true,
        tags: topic.tags,
      }, logger);
    }
  });

  app.on(EVENT.TOPIC_UPDATED, ({ req, topic }) => {
    logger.debug('recieve TOPIC_UPDATED event');
    if (topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.TOPIC_UPDATED, {
        topicId: topic.id,
        topicTitle: topic.title,
        postContent: _.get(topic, 'posts[0].raw', ''),
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
        migration: true,
        tags: topic.tags,
      }, logger);
    }
  });

  app.on(EVENT.TOPIC_DELETED, ({ req, topic }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.TOPIC_DELETED, {
        topicId: topic.id,
        topicTitle: topic.title,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
        migration: true,
        tags: topic.tags,
      }, logger);
    }
  });

  app.on(EVENT.POST_CREATED, ({ post, topic, userId }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.POST_CREATED, {
        topicId: post.topicId,
        topicTitle: topic.title,
        postId: post.id,
        postContent: post.raw,
        userId,
        projectId: topic.referenceId,
        initiatorUserId: userId,
        migration: true,
        tags: topic.tags,
      }, logger);
    }
  });

  app.on(EVENT.POST_DELETED, ({ req, topic }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.POST_DELETED, {
        topicId: topic.id,
        topicTitle: topic.title,
        postId: req.params.postId,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
        migration: true,
        tags: topic.tags,
      }, logger);
    }
  });

  app.on(EVENT.POST_UPDATED, ({ req, post, topic }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.POST_UPDATED, {
        topicId: topic.id,
        topicTitle: topic.title,
        postId: post.id,
        postContent: post.raw ? post.raw : post.rawContent,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
        migration: true,
        tags: topic.tags,
      }, logger);
    }
  });
};
