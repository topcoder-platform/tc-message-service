const _ = require('lodash');
const Helper = require('./helper.js');
const Promise = require('bluebird');
const config = require('config');

const CODERBOT_USERNAME = config.get('coderBotUsername');

// storing a reference to handle to userId lookup
// FIXME: (parth) this map will grow eventually as more users are added,
// consider using external cache instead
const handleMap = { system: 'system' };
handleMap[CODERBOT_USERNAME] = CODERBOT_USERNAME;

function Adapter(logger, db, _discourseClient = null) {// eslint-disable-line
  const helper = Helper(logger);

  this.userIdLookup = function userIdLookup(handle) {
    return new Promise((resolve, reject) => { // eslint-disable-line
      if (handleMap[handle]) {
        resolve(handleMap[handle]);
      } else {
        return helper.getTopcoderUser(handle).then((result) => {
          if (result && result.userId) {
            handleMap[handle] = result.userId;
            resolve(result.userId);
          } else {
            resolve(null);
          }
        }).catch(() =>
          resolve(null));
      }
    });
  };

  function convertPost(input) {
    let userId = input.createdBy;
    userId = userId !== 'system' && userId !== CODERBOT_USERNAME ? parseInt(userId, 10) : userId;
    const post = {
      id: input.id,
      topicId: input.topicId,
      date: input.createdAt,
      updatedDate: input.updatedAt,
      userId,
      read: true,
      body: input.raw,
      rawContent: input.raw,
      attachments: [],
      type: 'post',
    };
    _.each(input.postAttachments, (postAttachment) => {
      const attachment = {
        id: postAttachment.id,
        date: postAttachment.createdAt,
        updatedDate: postAttachment.updatedAt,
        originalFileName: postAttachment.originalFileName,
        createdBy: postAttachment.createdBy,
      };
      post.attachments.push(attachment);
    });
    return post;
  }

  this.adaptPosts = function a(posts) {
    // Promise is justed for avoiding too much refactoring needed after removing user mention handling
    // in post content in convertPost method which actually used to return promise as it used to call
    // member API to get the member data
    return Promise.resolve(posts.map(post => convertPost(post)));
  };

  this.adaptPost = function a(input) {
    // Promise is justed for avoiding too much refactoring needed after removing user mention handling
    // in post content in convertPost method which actually used to return promise as it used to call
    // member API to get the member data
    return Promise.resolve(convertPost(input));
  };

  this.adaptTopic = function a({ dbTopic, totalPosts, reqUserId }) {
    const topicsPostsCount = [{ topicId: dbTopic.id, totalPosts }];
    const topics = this.adaptTopics({ dbTopics: [dbTopic], topicsPostsCount, reqUserId });
    return topics && topics.length > 0 ? topics[0] : dbTopic;
  };

  this.adaptTopics = function a({ dbTopics, topicsPostsCount, reqUserId, includeReadUserIds }) {
    logger.info('adaptTopics - Enter');
    const topics = _.map(dbTopics, (dbTopic) => {
      let userId = dbTopic.createdBy;
      userId = userId !== 'system' && userId !== CODERBOT_USERNAME ? parseInt(userId, 10) : userId;
      const totalPosts = (_.find(topicsPostsCount, tpc => tpc.topicId === dbTopic.id) || { totalPosts: 0 }).totalPosts;
      const topic = {
        id: dbTopic.id,
        reference: dbTopic.reference,
        referenceId: dbTopic.referenceId,
        tag: dbTopic.tags != null ? dbTopic.tags.join(',') : '',
        date: dbTopic.createdAt,
        updatedDate: dbTopic.updatedAt,
        lastActivityAt: dbTopic.updatedAt,
        title: dbTopic.title,
        userId,
        totalPosts,
        retrievedPosts: dbTopic.posts ? dbTopic.posts.length : 0,
        postIds: _.map(dbTopic.posts, p => p.id),
        posts: [],
      };
      _.each(dbTopic.posts, (dbPost) => {
        const userStats = dbPost.userStats;
        const readStats = userStats ? _.find(userStats, s => s.action === 'READ') : null;
        let postUserId = dbPost.createdBy;
        if (['system', CODERBOT_USERNAME].indexOf(postUserId) === -1) {
          postUserId = Number(postUserId);
        }
        const topicDetail = {
          id: dbPost.id,
          date: dbPost.createdAt,
          updatedDate: dbPost.updatedAt,
          userId: postUserId,
          read: readStats ? readStats.userIds.indexOf(reqUserId) !== -1 : false,
          body: dbPost.raw,
          rawContent: dbPost.raw,
          attachments: [],
          type: 'post',
        };

        _.each(dbPost.postAttachments, (postAttachment) => {
          const attachment = {
            id: postAttachment.id,
            date: postAttachment.createdAt,
            updatedDate: postAttachment.updatedAt,
            originalFileName: postAttachment.originalFileName,
            createdBy: postAttachment.createdBy,
          };
          topicDetail.attachments.push(attachment);
        });
        if (includeReadUserIds) {
          topicDetail.readUserIds = readStats ? readStats.userIds : [];
        }
        topic.posts.push(topicDetail);
      });
      logger.debug(topic.posts, 'topic.posts');
      if (topic.posts && topic.posts.length > 0) {
        topic.posts = _.orderBy(topic.posts, ['date', 'id'], ['asc', 'asc']);
        topic.read = _.every(topic.posts, post => post.read);
        const lastPost = topic.posts[topic.posts.length - 1];
        topic.lastActivityAt = lastPost.updatedDate ? lastPost.updatedDate : lastPost.date;
      }
      return topic;
    });
    logger.info('adaptTopics - Exit');
    return topics;
  };

  return this;
}

module.exports = Adapter;
