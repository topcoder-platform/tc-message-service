/* eslint-disable no-unused-expressions, newline-per-chained-call */

import _ from 'lodash';
import { prepareDB, clearDB, jwts, getDecodedToken } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
require('should-sinon');
const should = require('should');
const models = require('../../models');
const config = require('config');

const adminPrefix = config.adminPrefix;
const m2m = server.m2m;

const db = models(server, server.logger);

describe('POST /v5/topics/admin/ownership/edit ', () => {
  const postId = 1;
  const apiPath = `${adminPrefix}/ownership/edit`;
  const nonExistingTopicPath = `${adminPrefix}/ownership/edit`;
  let expectedTopicPosts = null;

  const memberUser = {
    handle: getDecodedToken(jwts.admin).handle,
    userId: parseInt(getDecodedToken(jwts.admin).userId, 10),
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  const nonExistingPostBody = {
    topicId: 10,
    userId: memberUser.userId,
    postId: 20,
  };
  const nonExistingTopicBody = {
    topicId: 10,
    userId: memberUser.userId,
  };
  const privateTopicBody = {
    topicId: 2,
    userId: memberUser.userId,
  };
  const testBody = {
    topicId: 1,
    userId: memberUser.userId,
  };

  let sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB()
      .then(({ posts }) => {
        expectedTopicPosts = posts;
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
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(403, done);
  });

  it('should return 403 response when we try to make a customer user as an owner of a private topic', (done) => {
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId1').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId, role: 'customer' }] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(privateTopicBody)
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

  it('should return 200 response for admin, change topic ownership with valid jwt token and payload', (done) => {
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
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        res.body.result.content.should.not.be.null;
        res.body.result.content.title.should.not.be.null;
        res.body.result.content.tag.should.not.be.null;
        res.body.result.content.reference.should.not.be.null;
        res.body.result.content.referenceId.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        // verify change of ownership
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(Number(testBody.userId));
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 200 response for admin, change post ownership with valid jwt token and payload', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    const body = _.assign(testBody, {
      postId: expectedTopicPosts.id,
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(body)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        res.body.result.content.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        // verify change of ownership
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(Number(testBody.userId));
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 200 response for manager, change topic ownership with valid jwt token and payload', (done) => {
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
        Authorization: `Bearer ${jwts.manager}`,
      })
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        res.body.result.content.should.not.be.null;
        res.body.result.content.title.should.not.be.null;
        res.body.result.content.tag.should.not.be.null;
        res.body.result.content.reference.should.not.be.null;
        res.body.result.content.referenceId.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        // verify change of ownership
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(Number(testBody.userId));
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 200 response for manager, change post ownership with valid jwt token and payload', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    const body = _.assign(testBody, {
      postId: expectedTopicPosts.id,
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.manager}`,
      })
      .send(body)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        res.body.result.content.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        // verify change of ownership
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(Number(testBody.userId));
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 200 response for customer, change post ownership for public topic', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId, role: 'customer' }] } } },
    });
    const now = new Date();
    const body = _.assign(testBody, {
      postId: expectedTopicPosts.id,
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.manager}`,
      })
      .send(body)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        res.body.result.content.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        // verify change of ownership
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(Number(testBody.userId));
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 500 response with error in finding the topic of the post to be updated', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findTopicStub = sandbox.stub(db.topics, 'findTopic').rejects();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        // should call findTopic on posts model
        findTopicStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error updating post');
        return done();
      });
  });
});
