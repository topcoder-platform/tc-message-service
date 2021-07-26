const server = require('../app');
const models = require('../models');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');

const db = models(server, server.logger);

const esClient = require('./../elasticSearchConnection');

const config = require('config');


const jwts = {
  // userId = 40051331
  // eslint-disable-next-line
  member: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJUb3Bjb2RlciBVc2VyIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJ0ZXN0MSIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzEiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdEB0b3Bjb2Rlci5jb20iLCJqdGkiOiJiMzNiNzdjZC1iNTJlLTQwZmUtODM3ZS1iZWI4ZTBhZTZhNGEifQ.pDtRzcGQjgCBD6aLsW-1OFhzmrv5mXhb8YLDWbGAnKo',
  // eslint-disable-next-line
  otherMember: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJUb3Bjb2RlciBVc2VyIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJvdGhlclVzZXIiLCJleHAiOjI1NjMwNzY2ODksInVzZXJJZCI6IjQwMDUxMzcxIiwiaWF0IjoxNDYzMDc2MDg5LCJlbWFpbCI6Im90aGVyX3VzZXJAdG9wY29kZXIuY29tIiwianRpIjoiYzMzYjc3Y2QtYjUyZS00MGZlLTgzN2UtYmViOGUwYWU2YTRhIn0.tqCteP3BWtWWhilsON0E6jaLx8hL_snJUHcy9MAn5FQ',
  // userId = 40051333
  // eslint-disable-next-line
  admin: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJ0ZXN0MSIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzMiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdEB0b3Bjb2Rlci5jb20iLCJqdGkiOiJiMzNiNzdjZC1iNTJlLTQwZmUtODM3ZS1iZWI4ZTBhZTZhNGEifQ.2RqIjs8KYGUZNEaNYF8b4FOPLyUwW1bV_HTEFSOCzQ0',
  // eslint-disable-next-line
  otherAdmin: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJ0ZXN0MiIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzkiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdDJAdG9wY29kZXIuY29tIiwianRpIjoiYjMzYjc3Y2QtYjUyZS00MGZlLTgzN2UtYmViOGUwYWU2YTRhIn0.QfjhFB34i6QN3Fgd4vLc0iO_Ff7GhuaifK2nraI8Ers',
  // userId = 40051334
  // eslint-disable-next-line
  manager: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJDb25uZWN0IE1hbmFnZXIiXSwiaXNzIjoiaHR0cHM6Ly9hcGkudG9wY29kZXItZGV2LmNvbSIsImhhbmRsZSI6InRlc3QxIiwiZXhwIjoyNTYzMDc2Njg5LCJ1c2VySWQiOiI0MDA1MTMzNCIsImlhdCI6MTQ2MzA3NjA4OSwiZW1haWwiOiJ0ZXN0QHRvcGNvZGVyLmNvbSIsImp0aSI6ImIzM2I3N2NkLWI1MmUtNDBmZS04MzdlLWJlYjhlMGFlNmE0YSJ9.YTYWbA5JmjdC_dVA1kQjcWtpKIeWs7FwDa8B-xsnhN0',
};

const userIds = {
  member: '40051331',
  otherMember: '40051371',
  admin: '40051333',
  otherAdmin: '40051339',
  manager: '40051334',
};

function getDecodedToken(token) {
  return jwt.decode(token);
}

function clearDBPromise() {
  return db.sequelize.sync()
    .then(() => db.topics.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => db.posts.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => db.post_user_stats.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => db.post_attachments.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => db.reference_lookups.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => {
      esClient.deleteByQuery(
        {
          index: config.get('elasticsearchConfig.indexName'),
          type: 'topic',
          conflicts: 'proceed',
          body: { query: {
            match_all: {},
          } },
        }).then(() => {}).then(() => {
        });
    });
}

function clearDB(done) {
  return clearDBPromise()
    .then(() => done());
}

function prepareDB(done) {
  return clearDBPromise()
    .then(() => db.sequelize.query('ALTER SEQUENCE topics_id_seq RESTART WITH 1;'))
    .then(() => db.sequelize.query('ALTER SEQUENCE posts_id_seq RESTART WITH 1;'))
    .then(() => db.topics.bulkCreate([{
      // id: 1,
      reference: 'project',
      referenceId: 'referenceId',
      tags: ['tag'],
      title: 'Mock topic title',
      createdBy: userIds.member,
    },
    {
      // id: 1,
      reference: 'project',
      referenceId: 'referenceId1',
      tags: ['tag', 'MESSAGES'],
      title: 'Mock topic title2',
      createdBy: userIds.admin,
    }], { returning: true }))
    .then(
      topics => db.reference_lookups.create({
        id: 1,
        reference: 'project',
        endpoint: 'http://reftest/{id}', // eslint-disable-line
        accessCondition:
          '((!(tags contains \'MESSAGES\')) && (members contains (\'{"userId":\' + userId + \'}\'))) ' +
          '|| ((tags contains \'MESSAGES\') && (members contains (\'{"userId":\' + userId + \'}\')) &&' +
          ' (!(members contains (\'{"userId":\' + userId + \',"role":"customer"}\'))))',
      }).then(() => Promise.resolve(topics)))
    .then((topics) => {
      const topic = topics.length > 0 ? topics[0] : null;
      return db.posts.bulkCreate([{
        raw: 'Mock topic body',
        topicId: topic.id,
        createdBy: userIds.member,
        postNumber: 1,
      },
      {
        raw: 'Mock topic post - logically first post',
        topicId: topic.id,
        createdBy: userIds.member,
        postNumber: 2,
      },
      {
        raw: 'Mock topic post2',
        topicId: 2,
        createdBy: userIds.member,
        postNumber: 3,
      }], { returning: true })
      .then(posts => ({ topic, topics, posts }));
    })
    .then((responses) => {
      if (responses) {
        const tpc1 = JSON.parse(JSON.stringify(responses.topics[0]));
        const tpc2 = JSON.parse(JSON.stringify(responses.topics[1]));
        tpc1.tag = tpc1.tags.join(',');
        delete tpc1.tags;
        tpc2.tag = tpc2.tags.join(',');
        delete tpc2.tags;
        esClient.index({
          index: config.get('elasticsearchConfig.indexName'),
          id: tpc1.id,
          type: 'topic',
          body: tpc1,
        }, () => {
          esClient.index({
            index: config.get('elasticsearchConfig.indexName'),
            id: tpc2.id,
            type: 'topic',
            body: tpc2,
          }, () => {
            if (done && typeof done === 'function') {
              done();
            }
          });
        });
      }
      return responses;
    });
}

function findLast(model) {
  return new Promise((resolve, reject) => {
    model.findAll({
      limit: 1,
      order: [['createdAt', 'DESC']],
    }).then((entries) => {
      resolve(entries[0]);
    }).catch((e) => {
      reject(e);
    });
  });
}

module.exports = {
  prepareDB,
  clearDB,
  jwts,
  userIds,
  getDecodedToken,
  findLast,
};
