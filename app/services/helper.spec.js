import { prepareDB, clearDB } from '../tests';

const server = require('../app');
const models = require('../models');
const helperFactory = require('./helper');

const db = models(server, server.logger);

const helper = helperFactory(server.logger, db, server.m2m);

describe('TEST userHasAccessToEntity method', () => {
  const userId = 40051331;
  const membersProject1 = [{ userId: 40051331 }];
  const membersProject2 = [{ userId: 40051333 }];
  const membersProject3 = [{ userId: 40051331, role: 'customer' }];
  const hasAccessRespProject1 = [true, { members: membersProject1 }];
  const hasAccessRespProject2 = [true, { members: membersProject2 }];
  const hasAccessRespProject3 = [true, { members: membersProject3 }];
  beforeEach((done) => {
    prepareDB(done);
  });
  afterEach((done) => {
    clearDB(done);
  });

  it('should return TRUE if the user is a member of the project', done =>
    helper.userHasAccessToEntity(userId, hasAccessRespProject1, [], 'project')
      .then((hasAccess) => {
        if (hasAccess) {
          done();
        }
      }));

  it('should return FALSE if the user is a customer of the project and topic is private', done =>
    helper.userHasAccessToEntity(userId, hasAccessRespProject3, ['MESSAGES'], 'project')
      .then((hasAccess) => {
        if (!hasAccess) {
          done();
        }
      }));

  it('should return TRUE if the user is a customer of the project and topic is public', done =>
    helper.userHasAccessToEntity(userId, hasAccessRespProject3, [], 'project')
      .then((hasAccess) => {
        if (hasAccess) {
          done();
        }
      }));

  it('should return FALSE if the user is not a member of the project', done =>
    helper.userHasAccessToEntity(userId, hasAccessRespProject2, [], 'project')
      .then((hasAccess) => {
        if (!hasAccess) {
          done();
        }
      }));

  it('should return FALSE if reference is invalid', done =>
    helper.userHasAccessToEntity(userId, hasAccessRespProject1, [], 'invalid_reference')
      .then((hasAccess) => {
        if (!hasAccess) {
          done();
        }
      }));
});
