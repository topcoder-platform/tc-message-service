/* eslint-disable no-unused-expressions, newline-per-chained-call */

const { clearDB, getDecodedToken, jwts, prepareDB } = require('../../tests');

const axios = require('axios');
const request = require('supertest');
const models = require('../../models');
const AWS = require('aws-sdk');
const sinon = require('sinon');
const config = require('config');


require('should-sinon');

describe('DELETE /v4/topics/attachments/:attachmentId', () => {
  const apiPath = `/${config.apiVersion}/topics/attachments/1/delete`;
  const privateTopicAttachmentPath = `/${config.apiVersion}/topics/attachments/2/delete`;
  const nonExistingAttachmentPath = `/${config.apiVersion}/topics/attachments/10/delete`;
  const memberUser = {
    handle: getDecodedToken(jwts.member).handle,
    userId: parseInt(getDecodedToken(jwts.member).userId, 10),
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  const otherMember = {
    handle: getDecodedToken(jwts.otherMember).handle,
    userId: parseInt(getDecodedToken(jwts.otherMember).userId, 10),
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
      data: {
        result: {
          status: 200,
          content: { members: [{ userId: memberUser.userId }, { userId: otherMember.userId }] },
        },
      },
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
        createdBy: auth.userId,
        updatedBy: auth.userId,
      }, {
        id: 2,
        postId: 3,
        originalFileName: 'aFileName.jpg',
        url: 'https://s3.com/1/12123123-aFileName.jpg',
        createdBy: auth.userId,
        updatedBy: auth.userId,
      }]).then(() => done()).catch(done);
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

  it('should return 403 response when not having access to the project', (done) => {
    stubWithNoAccessToProject();
    request(server)
      .delete(apiPath)
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
      .delete(privateTopicAttachmentPath)
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
      .delete(apiPath)
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

    describe('for a non existing attachment', () => {
      it('should return a not found error', (done) => {
        request(server)
          .delete(nonExistingAttachmentPath)
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
      describe('when a non admin that isn\'t the attachment uploader tries to delete the attachment', () => {
        it('should not be able to do that', (done) => {
          request(server)
            .delete(`${apiPath}`)
            .set({
              Authorization: `Bearer ${jwts.otherMember}`,
            })
            .expect(403)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.should.have.propertyByPath('result', 'content', 'message')
                .eql('User doesn\'t have delete access to the attachment');
              return done();
            });
        });
      });

      describe('when an admin that isn\'t the attachment uploader tries to delete the attachment', () => {
        it('should be able to do that', (done) => {
          request(server)
            .delete(`${apiPath}`)
            .set({
              Authorization: `Bearer ${jwts.otherAdmin}`,
            })
            .expect(200)
            .end(done);
        });
      });

      it('should return 200 response', (done) => {
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
            res.body.result.status.should.equal(200);
            return done();
          });
      });

      it('should return a wrapped response with no content attribute', (done) => {
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
            res.body.result.should.not.have.property('content');
            return done();
          });
      });

      it('should soft delete a record in the post_attachments table', (done) => {
        request(server)
          .delete(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(200)
          .end((err) => {
            if (err) {
              return done(err);
            }
            return db.post_attachments.findOne({ where: { id: 1 } })
              .then((postAttachment) => {
                // check the s3 upload mock function to know where this url comes from
                postAttachment.deletedAt.should.exist;
                done();
              });
          });
      });
    });

    describe('for a deleted existing attachment', () => {
      beforeEach(done => db.post_attachments.update({
        deletedAt: db.sequelize.fn('NOW'), deletedBy: 'deletingUser',
      }, {
        where: { id: 1 },
      }).then(() => done()).catch(done));

      it('should return a not found error', (done) => {
        request(server)
          .delete(apiPath)
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
  });
});
