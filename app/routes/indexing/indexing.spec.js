import { jwts } from '../../tests';

require('should');
const request = require('supertest');

const axios = require('axios');
const sinon = require('sinon');
const config = require('config');

describe('index', () => {
  const server = require('../../app'); // eslint-disable-line
  let sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    done();
  });
  afterEach((done) => {
    sandbox.restore();
    done();
  });

  it('GET /index should return 200 response', (done) => {
    sandbox.stub(axios, 'get').resolves({
      status: 200,
      data: {
        result: {},
      },
    });
    request(server)
      .post(`/${config.apiVersion}/topics/esindex?from=1&to=2`)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(200, done);
  });

  it('GET /index should return 403 response', (done) => {
    sandbox.stub(axios, 'get').resolves({
      status: 200,
      data: {
        result: {},
      },
    });
    request(server)
      .post(`/${config.apiVersion}/topics/esindex?from=1&to=2`)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(403, done);
  });
});
