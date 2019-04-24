/* eslint-disable no-unused-expressions, newline-per-chained-call */

import _ from 'lodash';
import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const config = require('config');
const Adapter = require('../../services/adapter');
const models = require('../../models');

const adminPrefix = config.adminPrefix;
const m2m = server.m2m;

require('should-sinon');
const should = require('should');

const db = models(server, server.logger);
const adapter = new Adapter(server.logger, db);

describe('POST /v5/topics/admin/topics/:topicId/edit ', () => {
  const topicId = 1;
  const apiPath = `${adminPrefix}/topics/${topicId}/edit`;
  const nonExistingTopicPath = `${adminPrefix}/topics/500/edit`;
  let expectedTopic = null;
  const testBody = {
    topic: {
      title: 'title-updated',
    },
  };

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(new Date().getDate() - 1);
  const testBody2 = {
    topic: {
      reference: 'submission',
      referenceId: 'referenceId2',
      discourseTopicId: 123456789,
      tag: 'tag2',
      createdAt: yesterday.toISOString(),
      createdBy: getDecodedToken(jwts.manager).userId,
      updatedAt: today.toISOString(),
      updatedBy: getDecodedToken(jwts.manager).userId,
      highestPostNumber: 500,
      title: 'Test title2',
      closed: true,
      hidden: true,
      archived: true,
      hiddenReason: 'test hidden reason',
      deletedAt: null,
      deletedBy: getDecodedToken(jwts.manager).userId,
    },
  };
  const testBody3 = {
    topic: {
      title: 'Test title3',
      deletedAt: today.toISOString(),
      deletedBy: getDecodedToken(jwts.manager).userId,
    },
  };

  const memberUser = {
    handle: getDecodedToken(jwts.admin).handle,
    userId: getDecodedToken(jwts.admin).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  let sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB()
      .then(({ topic }) => {
        expectedTopic = topic;
        done();
      });
  });
  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });
  it('should return 403 response without a jwt token', (done) => {
    request(server)
      .post(apiPath)
      .send(testBody)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .post(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .send(testBody)
      .expect(403, done);
  });

  it('should return 403 response when user does not have access', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        // should make GET to reference lookup endpoint on posts model
        getStub.should.have.be.calledOnce;
        return done();
      });
  });


  it('should return 403 response for non-admin members', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        // should make GET to reference lookup endpoint on posts model
        getStub.should.have.be.calledOnce;
        return done();
      });
  });

  it('should return 404 response with non existing topic', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .post(nonExistingTopicPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(404)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        // should call findById on posts model
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Topic does not exist');
        return done();
      });
  });

  it('should return 200 response for admin with valid jwt token and payload', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    const userId = parseInt(expectedTopic.createdBy, 10);
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        const expectedTopicJson = _.assign({}, {
          id: expectedTopic.id,
          reference: expectedTopic.reference,
          referenceId: expectedTopic.referenceId,
          tag: expectedTopic.tags[0],
          tags: expectedTopic.tags,
          date: res.body.result.content.date,
          updatedDate: res.body.result.content.updatedDate,
          lastActivityAt: res.body.result.content.lastActivityAt,
          userId: Number(expectedTopic.createdBy),
          retrievedPosts: 0, // Number(expectedTopic.highestPostNumber),
        });
        // unchanged elements keys
        const keys = _.keys(_.omit(res.body.result.content,
          _.keys(testBody.post).concat(['posts', 'postIds', 'title'])));
        keys.forEach((key) => {
          res.body.should.have.propertyByPath('result', 'content', key).eql(expectedTopicJson[key]);
        });
        res.body.result.content.should.not.be.null;
        res.body.result.content.id.should.not.be.null;
        res.body.result.content.reference.should.not.be.null;
        res.body.result.content.referenceId.should.not.be.null;
        res.body.result.content.tag.should.not.be.null;
        res.body.result.content.date.should.not.be.null;
        res.body.result.content.lastActivityAt.should.not.be.null;
        res.body.result.content.posts.should.not.be.null;
        // id of the updated topic should be same as of id passed in API path
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(topicId);
        res.body.should.have.propertyByPath('result', 'content', 'title').eql(testBody.topic.title);
        // Topic owner should not change
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(userId);
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 200 response for admin with valid jwt token and payload (bulk update)', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody2)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        return db.topics.findTopic(db, adapter, {
          topicId: res.body.result.content.id,
          raw: true,
        })
          .then((updatedTopic) => {
            // changed elements keys
            const keys = _.keys(_.omit(testBody2.topic,
              ['discourseTopicId',
                'updatedAt',
                'updatedBy',
                'deletedAt',
                'deletedBy',
                'tag',
              ])).concat(['tags']);
            keys.forEach((key) => {
              updatedTopic[key].should.not.be.eql(expectedTopic[key]);
            });
            res.body.result.content.should.not.be.null;
            // id of the updated topic should be same as of id passed in API path
            res.body.should.have.propertyByPath('result', 'content', 'id').eql(topicId);
            new Date(res.body.result.content.updatedDate).should.be.above(now);
            return done();
          });
      });
  });

  it('should return 200 response for admin with valid jwt token and payload (update deletedAt & deletedBy)', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody3)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        return db.topics.findTopic(db, adapter, {
          topicId: res.body.result.content.id,
          raw: true,
        })
          .then((updatedTopic) => {
            should.not.exist(updatedTopic);
            return done();
          });
      });
  });

  it('should return 200 response for manager with valid jwt token and payload', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    const userId = Number(expectedTopic.createdBy);
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        const expectedTopicJson = _.assign({}, {
          id: expectedTopic.id,
          reference: expectedTopic.reference,
          referenceId: expectedTopic.referenceId,
          tag: expectedTopic.tags[0],
          tags: expectedTopic.tags,
          date: res.body.result.content.date,
          updatedDate: res.body.result.content.updatedDate,
          lastActivityAt: res.body.result.content.lastActivityAt,
          userId: Number(expectedTopic.createdBy),
          retrievedPosts: 0, //Number(expectedTopic.highestPostNumber),
        });
        // unchanged elements keys
        const keys = _.keys(_.omit(res.body.result.content,
          _.keys(testBody.post).concat(['posts', 'postIds', 'title'])));
        keys.forEach((key) => {
          res.body.should.have.propertyByPath('result', 'content', key).eql(expectedTopicJson[key]);
        });
        res.body.result.content.should.not.be.null;
        res.body.result.content.id.should.not.be.null;
        res.body.result.content.reference.should.not.be.null;
        res.body.result.content.referenceId.should.not.be.null;
        res.body.result.content.tag.should.not.be.null;
        res.body.result.content.date.should.not.be.null;
        res.body.result.content.lastActivityAt.should.not.be.null;
        res.body.result.content.posts.should.not.be.null;
        // id of the updated topic should be same as of id passed in API path
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(topicId);
        res.body.should.have.propertyByPath('result', 'content', 'title').eql(testBody.topic.title);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopic.updatedBy);
        // Topic owner should not change
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(userId);
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });
});
