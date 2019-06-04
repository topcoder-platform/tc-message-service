/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, getDecodedToken, jwts, prepareDB } from '../../tests';

const axios = require('axios');
const request = require('supertest');
const models = require('../../models');
const AWS = require('aws-sdk');
const sinon = require('sinon');
const config = require('config');


require('should-sinon');

describe('GET /v4/topics/attachments/:attachmentId', () => {
  const apiPath = `/${config.apiVersion}/topics/attachments/1/read`;
  const privateTopicAttachmentPath = `/${config.apiVersion}/topics/attachments/2/read`;
  const nonExistingAttachmentPath = `/${config.apiVersion}/topics/attachments/10/read`;
  const memberUser = {
    handle: getDecodedToken(jwts.member).handle,
    userId: parseInt(getDecodedToken(jwts.member).userId, 10),
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  let sandbox;
  let server;
  let s3;
  let db;
  let m2m;

  const stubWithNoAccessToProject = () => {
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    sandbox.stub(axios, 'get').withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 403, content: {} } },
    });
  };

  const stubWithCustomerToProject = () => {
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs('http://reftest/referenceId').resolves({
      data: {
        result: {
          status: 200,
          content: { members: [{ userId: memberUser.userId, role: 'customer' }] },
        },
      },
    });
    stub.withArgs('http://reftest/referenceId1').resolves({
      data: {
        result: {
          status: 200,
          content: { members: [{ userId: memberUser.userId, role: 'customer' }] },
        },
      },
    });
  };

  const stubWithAccessToProject = () => {
    // mocks the m2m token call
    sandbox.stub(m2m, 'getMachineToken').resolves('dummy_token');
    sandbox.stub(axios, 'get').withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
  };

  beforeEach((done) => {
    sandbox = sinon.sandbox.create();

    if (!s3) {
      try {
        s3 = {
          copyObject: sinon.stub().callsArgWith(1, null, true),
          deleteObject: () => ({
            promise: () => Promise.resolve(),
          }),
          getSignedUrl: () => 'https://s3.com/1/attachment.jpg?signedParam=true',
        };
        const aws = sinon.stub(AWS, 'S3');
        aws.returns(s3);
      } catch (ex) {
        // OK
      }
    }

    if (!server) {
      server = require('../../app');// eslint-disable-line
      m2m = server.m2m;
      db = models(server, server.logger);
    }


    prepareDB((err) => {
      if (err) {
        return done(err);
      }
      const auth = getDecodedToken(jwts.member);
      return db.post_attachments.bulkCreate([{
        id: 1,
        postId: 1,
        originalFileName: 'aFileName.jpg',
        url: 'https://s3.com/1/12123123-aFileName.jpg',
        createdBy: auth.handle,
        updatedBy: auth.handle,
      }, {
        id: 2,
        postId: 3,
        originalFileName: 'aFileName.jpg',
        url: 'https://s3.com/1/12123123-aFileName.jpg',
        createdBy: auth.handle,
        updatedBy: auth.handle,
      }]).then(() => done()).catch(done);
    });
  });

  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });

  it('should return 403 response without a jwt token', (done) => {
    request(server)
      .get(apiPath)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .get(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .expect(403, done);
  });

  it('should return 403 response when not having access to the project', (done) => {
    stubWithNoAccessToProject();
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(403)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('User doesn\'t have access to the project');
        return done();
      });
  });

  it('should return 403 response for customer and private topic', (done) => {
    stubWithCustomerToProject();
    request(server)
      .get(privateTopicAttachmentPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(403)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('User doesn\'t have access to the project');
        return done();
      });
  });

  it('should return 200 response for customer and public topic', (done) => {
    stubWithCustomerToProject();
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.status.should.equal(200);
        return done();
      });
  });

  describe('with valid jwt token and payload', () => {
    beforeEach(() => {
      stubWithAccessToProject();
    });

    describe('for a soft deleted existing attachment', () => {
      beforeEach(done => db.post_attachments.update({
        deletedAt: db.sequelize.fn('NOW'), deletedBy: 'deletingUser',
      }, {
        where: { id: 1 },
      }).then(() => done()).catch(done));

      it('should return a not found error', (done) => {
        request(server)
          .get(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(404)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.body.should.have.propertyByPath('result', 'content', 'message')
              .eql('Could not find the requested attachment');
            return done();
          });
      });
    });

    describe('for a non existing attachment', () => {
      it('should return a not found error', (done) => {
        request(server)
          .get(nonExistingAttachmentPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(404)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.body.should.have.propertyByPath('result', 'content', 'message')
              .eql('Could not find the requested attachment');
            return done();
          });
      });
    });

    describe('for an existing attachment', () => {
      it('should return a response that contains signed version of the url', (done) => {
        request(server)
          .get(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.body.should.have.propertyByPath('result', 'content', 'url')
            .eql('https://s3.com/1/attachment.jpg?signedParam=true');
            return done();
          });
      });
    });
  });
});
