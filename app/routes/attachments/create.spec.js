/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, jwts, prepareDB } from '../../tests';

const request = require('supertest');
const models = require('../../models');
const AWS = require('aws-sdk');
const sinon = require('sinon');
const config = require('config');


require('should-sinon');

describe('POST /v5/topics/attachments', () => {
  const apiPath = `/${config.apiVersion}/topics/attachments/create`;
  let sandbox;
  const validBody = { filename: 'test.txt', bucket: 'test' };
  let server;
  let s3;
  let db;


  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    if (!s3) {
      try {
        s3 = {
          moveObject: sinon.stub().callsArgWith(1, null, true),
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
      server = require('../../app'); // eslint-disable-line
      db = models(server, server.logger);
    }

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

  describe('with valid jwt token and payload', () => {
    it('should return 200 response', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .send(validBody)
        .expect(200)
        .end(done);
    });

    it('should return no url attribute', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .send(validBody)
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
        .send(validBody)
        .expect(200)
        .end((err) => {
          if (err) {
            return done(err);
          }
          // we start from an empty database, so having a non null result from this means that it works correctly
          return db.post_attachments.findOne()
            .then((postAttachment) => {
              // check the s3 upload mock function to know where this url comes from
              postAttachment.url.should.match(/.*test.txt/g);
              return done();
            });
        });
    });
  });
});
