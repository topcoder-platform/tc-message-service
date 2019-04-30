import { clearDB } from '../tests';

const server = require('../app');
const models = require('../models');
const helperFactory = require('./helper');

const db = models(server, server.logger);

const helper = helperFactory(server.logger, db, server.m2m);

describe('TEST userHasAccessToEntity method', () => {
  const userId = 40051331;
  const membersProject1 = [{ userId: 40051331 }];
  const membersProject2 = [{ userId: 40051333 }];
  const hasAccessRespProject1 = [true, { members: membersProject1 }];
  const hasAccessRespProject2 = [true, { members: membersProject2 }];
  beforeEach(done => db.reference_lookups.create({
    id: 1,
    reference: 'project',
    endpoint: 'http://reftest/{id}', // eslint-disable-line
    accessCondition: 'members contains \'{"userId":{userId}}\'',
  }).then(() => {
    done();
  }));
  afterEach((done) => {
    clearDB(done);
  });

  it('should return TRUE if the user is a member of the project', done =>
    helper.userHasAccessToEntity(userId, hasAccessRespProject1, 'project')
      .then((hasAccess) => {
        if (hasAccess) {
          done();
        }
      }));

  it('should return FALSE if the user is not a member of the project', done =>
    helper.userHasAccessToEntity(userId, hasAccessRespProject2, 'project')
      .then((hasAccess) => {
        if (!hasAccess) {
          done();
        }
      }));

  it('should return FALSE if reference is invalid', done =>
    helper.userHasAccessToEntity(userId, hasAccessRespProject1, 'invalid_reference')
      .then((hasAccess) => {
        if (!hasAccess) {
          done();
        }
      }));
});
