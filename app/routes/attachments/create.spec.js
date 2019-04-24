/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, jwts, prepareDB } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const models = require('../../models');
const aws = require('aws-sdk');
const s3UploadMock = require('./create.s3.upload.mock');
const sinon = require('sinon');
const config = require('config');


const db = models(server, server.logger);

require('should-sinon');

describe('POST /v5/topics/attachments', () => {
  const apiPath = `/${config.apiVersion}/topics/attachments`;
  let sandbox;

  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    const uploadStub = sandbox.stub(aws.S3.prototype, 'upload');
    uploadStub.callsFake(s3UploadMock);
    prepareDB(done);
  });

  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });

  it('should return 403 response without a jwt token', (done) => {
    request(server)
      .post(apiPath)
      .attach('file', 'app/tests/test.png')
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .post(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .attach('file', 'app/tests/test.png')
      .expect(403, done);
  });

  it('should return 400 response when missing file', (done) => {
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(400)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Missing file');
        return done();
      });
  });

  describe('with valid jwt token and payload', () => {
    it('should return 200 response', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .attach('file', 'app/tests/test.png')
        .expect(200)
        .end(done);
    });

    it('should return no url attribute', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .attach('file', 'app/tests/test.png')
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          res.body.result.content.should.not.have.property('url');
          return done();
        });
    });

    it('should create a record in the post_attachments table with the correct url', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .attach('file', 'app/tests/test.png')
        .expect(200)
        .end((err) => {
          if (err) {
            return done(err);
          }
          // we start from an empty database, so having a non null result from this means that it works correctly
          return db.post_attachments.findOne()
            .then((postAttachment) => {
              // check the s3 upload mock function to know where this url comes from
              postAttachment.url.should.equal('mock-location');
              done();
            });
        });
    });
  });
});
