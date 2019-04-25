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
const Adapter = require('../../services/adapter');
const config = require('config');

const adminPrefix = config.adminPrefix;
const m2m = server.m2m;

const db = models(server, server.logger);
const adapter = new Adapter(server.logger, db);

describe('POST /v5/topics/admin/posts/:postId/edit ', () => {
  const postId = 1;
  const apiPath = `${adminPrefix}/posts/${postId}/edit`;
  const nonExistingTopicPath = `${adminPrefix}/posts/500/edit`;
  let expectedTopicPosts = null;
  const testBody = {
    topicId: 1,
    post: {
      raw: 'post body - updated',
    },
  };

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(new Date().getDate() - 1);
  const testBody2 = {
    topicId: 1,
    post: {
      cooked: 'discourse post body',
      discoursePostId: 123456789,
      topicId: 2,
      postNumber: 2,
      viaEmail: true,
      rawEmail: 'test@test.com',
      hidden: true,
      hiddenReason: 'hidden reason',
      createdAt: yesterday.toISOString(),
      createdBy: getDecodedToken(jwts.manager).userId,
      updatedAt: today.toISOString(),
      updatedBy: getDecodedToken(jwts.manager).userId,
      deletedAt: null,
      deletedBy: null,
    },
  };

  const testBody3 = {
    topicId: 1,
    post: {
      raw: 'post body - updated',
      deletedAt: today.toISOString(),
      deletedBy: getDecodedToken(jwts.admin).userId,
    },
  };

  const convert = (data) => {
    const newData = _.assign({}, {
      id: data.id !== undefined ? data.id : undefined,
      date: data.createdAt !== undefined ? data.createdAt : undefined,
      updatedDate: data.updatedAt !== undefined ? data.updatedAt : undefined,
      userId: data.userId !== undefined ? data.userId : undefined,
      read: true,
      body: data.raw !== undefined ? data.raw : undefined,
      rawContent: data.raw !== undefined ? data.raw : undefined,
      type: 'post',
    });
    return _.omit(newData, _.isUndefined);
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
      .send(testBody)
      .expect(404)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 200 response for admin with valid jwt token and payload (body update)', (done) => {
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
        const expectedCreatedBy = Number(expectedTopicPosts[0].createdBy);
        const expectedPostJson = _.assign({}, {
          id: expectedTopicPosts[0].id,
          date: res.body.result.content.date,
          updatedDate: res.body.result.content.updatedDate,
          userId: Number(expectedTopicPosts[0].createdBy),
          read: true,
          body: expectedTopicPosts[0].raw,
          rawContent: res.body.result.content.rawContent,
          topicId: 1,
          attachments: [],
          type: 'post',
        });
        // unchanged elements keys
        const keys = _.keys(_.omit(res.body.result.content, _.keys(convert(testBody.post))));
        keys.forEach((key) => {
          res.body.should.have.propertyByPath('result', 'content', key).eql(expectedPostJson[key]);
        });
        res.body.result.content.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        res.body.should.have.propertyByPath('result', 'content', 'body').eql(testBody.post.raw);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(expectedCreatedBy);
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
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
        const expectedPost = expectedTopicPosts[0];
        // find updated post
        return db.posts.findPost(db, adapter, {
          topicId: testBody2.post.topicId,
          postId: res.body.result.content.id,
        }, { raw: true })
          .then((updatedPost) => {
            // changed elements keys
            const keys = _.keys(_.omit(testBody2.post, ['cooked', 'topicId', 'deletedAt', 'deletedBy']));
            keys.forEach((key) => {
              updatedPost[key].should.not.eql(expectedPost[key]);
            });
            res.body.result.content.should.not.be.null;
            res.body.should.have.propertyByPath('result', 'content', 'id').should.not.be.eql(postId);
            // udpatedBy should be null originally for the test data
            should.not.exist(expectedTopicPosts[0].updatedBy);
            // updatedDate should be null originally for the test data
            should.not.exist(expectedTopicPosts[0].updatedDate);
            new Date(res.body.result.content.updatedDate).should.be.above(now);
            return done();
          });
      });
  });

  it('should return 200 response for manager with valid jwt token and payload (admin)', (done) => {
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
        const expectedCreatedBy = Number(expectedTopicPosts[0].createdBy);
        const expectedPostJson = _.assign({}, {
          id: expectedTopicPosts[0].id,
          date: res.body.result.content.date,
          updatedDate: res.body.result.content.updatedDate,
          userId: Number(expectedTopicPosts[0].createdBy),
          read: true,
          body: expectedTopicPosts[0].raw,
          rawContent: res.body.result.content.rawContent,
          topicId: 1,
          attachments: [],
          type: 'post',
        });
        // unchanged elements keys
        const keys = _.keys(_.omit(res.body.result.content, _.keys(convert(testBody.post))));
        keys.forEach((key) => {
          res.body.should.have.propertyByPath('result', 'content', key).eql(expectedPostJson[key]);
        });
        res.body.result.content.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        res.body.should.have.propertyByPath('result', 'content', 'body').eql(testBody.post.raw);
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(expectedCreatedBy);
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
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
    // const now = new Date();
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
        // find updated post
        return db.posts.findPost(db, adapter, {
          topicId: testBody3.topicId,
          postId: res.body.result.content.id,
        }, { raw: true })
          .then((updatedPost) => {
            should.not.exist(updatedPost);
            return done();
          });
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

  it('should return 500 response with error in finding the post to be updated', (done) => {
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findPostStub = sandbox.stub(db.posts, 'findPost').rejects();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        // should call findPost on posts model
        findPostStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error updating post');
        return done();
      });
  });
});
