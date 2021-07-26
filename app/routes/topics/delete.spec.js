/* eslint-disable no-unused-expressions, newline-per-chained-call */

const { jwts, userIds, prepareDB, clearDB, getDecodedToken } = require('../../tests');

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const models = require('../../models');
const config = require('config');

require('should-sinon');

const db = models(server, server.logger);

const m2m = server.m2m;

describe('DELETE /v4/topics/:topicId ', () => {
  const topicId = 1;
  const apiPath = `/${config.apiVersion}/topics/${topicId}/remove`;
  const privateTopicPath = `/${config.apiVersion}/topics/2/remove`;
  const nonExistingTopicPath = `/${config.apiVersion}/topics/2000/remove`;
  // let expectedTopic = null;
  // let expectedTopicPosts = null;

  const memberUser = {
    handle: getDecodedToken(jwts.member).handle,
    userId: parseInt(getDecodedToken(jwts.member).userId, 10),
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  let sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB()
      .then(() => {
        // expectedTopic = topic;
        // expectedTopicPosts = posts;
        done();
      });
  });
  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });
  it('should return 403 response without a jwt token', (done) => {
    request(server)
      .delete(apiPath)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .delete(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .expect(403, done);
  });

  it('should return 403 response when non-admin user is not creator of the topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: userIds.otherMember }] } } },
    });
    return db.sequelize.query(`Update posts SET "deletedAt"=now() where "topicId"=${topicId};`)
      .then(() => {
        request(server)
          .delete(apiPath)
          .set({
            Authorization: `Bearer ${jwts.otherMember}`,
          })
          .expect(403, done);
      });
  });

  it('should return 403 response when user is not member of the project', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(403, done);
  });

  it('should return 403 response when customer tries to access private topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId1').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId, role: 'customer' }] } } },
    });
    request(server)
      .delete(privateTopicPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(403, done);
  });

  it('should return 200 response when customer tries to access public topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId, role: 'customer' }] } } },
    });
    return db.sequelize.query(`Update posts SET "deletedAt"=now() where "topicId"=${topicId};`)
      .then(() => {
        request(server)
          .delete(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(200, done);
      });
  });

  it('should return 200 response with valid jwt token and payload', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    return db.sequelize.query(`Update posts SET "deletedAt"=now() where "topicId"=${topicId};`)
      .then(() => {
        request(server)
          .delete(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            // should call m2m.getMachineToken
            m2mStub.should.have.be.calledOnce;
            res.body.result.success.should.eql(true);
            return db.topics.findAll({
              where: { deletedAt: { [db.Sequelize.Op.eq]: null } },
              raw: true,
            }).then((topics) => {
              topics.should.length(1);
              return done();
            });
          });
      });
  });

  it('should return 200 response with valid jwt token and payload (admin)', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{}] } } },
    });
    return db.sequelize.query(`Update posts SET "deletedAt"=now() where "topicId"=${topicId};`)
      .then(() => {
        request(server)
          .delete(apiPath)
          .set({
            Authorization: `Bearer ${jwts.admin}`,
          })
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            // should call m2m.getMachineToken
            m2mStub.should.have.be.calledOnce;
            res.body.result.success.should.eql(true);
            return db.topics.findAll({
              where: { deletedAt: { [db.Sequelize.Op.eq]: null } },
              raw: true,
            }).then((topics) => {
              topics.should.length(1);
              return done();
            });
          });
      });
  });

  it('should return 422 response if topic has comments', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(422)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Topic has comments and can not be deleted');
        return db.topics.findAll({
          where: { deletedAt: { [db.Sequelize.Op.eq]: null } },
          raw: true,
        }).then((topics) => {
          topics.should.length(2);
          return done();
        });
      });
  });

  it('should return 404 response if topic does not exist', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .delete(nonExistingTopicPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(404)
      .end((err, res) => {
        if (err) {
          throw done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Topic does not exist');
        return done();
      });
  });

  it('should return 500 response if error getting topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findByIdStub = sandbox.stub(db.topics, 'findById').rejects();
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        // should call findById on topics model
        findByIdStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error deleting topic');
        return done();
      });
  });

  it('should return 500 response if error deleting topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // mocks the m2m token call
    const m2mStub = sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const getTopicPostsCountStub = sandbox.stub(db.posts, 'getTopicPostsCount').rejects();
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call m2m.getMachineToken
        m2mStub.should.have.be.calledOnce;
        // should call getTopicPostsCount on topics model
        getTopicPostsCountStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error deleting topic');
        return done();
      });
  });
});
