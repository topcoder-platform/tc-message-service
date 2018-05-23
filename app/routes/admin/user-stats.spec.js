/* eslint-disable no-unused-expressions, newline-per-chained-call */

import _ from 'lodash';
import { prepareDB, clearDB, jwts, getDecodedToken } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
require('should-sinon');
const models = require('../../models');
const config = require('config');

const adminPrefix = config.adminPrefix;

const db = models(server, server.logger);

describe('POST /v5/topics/admin/posts/{postId}/stats/create ', () => {
  const postId = 1;
  const apiPath = `${adminPrefix}/posts/${postId}/stats/create`;
  const nonExistingTopicPath = `${adminPrefix}/posts/500/stats/create`;

  const memberUser = {
    handle: getDecodedToken(jwts.admin).handle,
    userId: getDecodedToken(jwts.admin).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  const nonExistingPostBody = {
    postId: 20,
    action: 'post.user',
    userId: memberUser.userId,
    topicId: 1,
  };
  const nonExistingTopicBody = {
    postId: 1,
    action: 'post.user',
    userId: memberUser.userId,
    topicId: 20,
  };
  const testBody = {
    postId: 1,
    action: 'post.user',
    userId: memberUser.userId,
    topicId: 1,
  };

  let sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB()
      .then(() => {
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

  it('should return 403 response when user is not member of the project', (done) => {
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
      .expect(403, done);
  });

  it('should return 404 response if no matching topic', (done) => {
    request(server)
      .post(nonExistingTopicPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(nonExistingTopicBody)
      .expect(404)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 404 resonse if no matching post', (done) => {
    request(server)
      .post(nonExistingTopicPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(nonExistingPostBody)
      .expect(404)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 200 response for admin, creating user stats with valid jwt token and payload', (done) => {
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
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        res.body.result.content.should.not.be.null;
        res.body.result.content.postId.should.not.be.null;
        res.body.result.content.topicId.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'action').eql(testBody.action);
        res.body.should.have.propertyByPath('result', 'content', 'postId').eql(postId);
        res.body.result.content.userIds[0].should.eql(testBody.userId);
        return done();
      });
  });

  it('should return 200 response for manager, creating user stats with valid jwt token and payload', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.manager}`,
      })
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        res.body.result.content.should.not.be.null;
        res.body.result.content.postId.should.not.be.null;
        res.body.result.content.topicId.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'action').eql(testBody.action);
        res.body.should.have.propertyByPath('result', 'content', 'postId').eql(postId);
        res.body.result.content.userIds[0].should.eql(testBody.userId);
        return done();
      });
  });

  it('should return 400 response with error creating user stats with uncomplete body parameters', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findTopicStub = sandbox.stub(db.topics, 'findTopic').rejects();
    const body = _.cloneDeep(testBody);
    delete body.userId;
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(body)
      .expect(400)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call findTopic on posts model
        findTopicStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Validation error: "userId" is required');
        return done();
      });
  });
});
