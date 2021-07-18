/**
 * Sync the database models to db tables.
 */
const config = require('config');
const _ = require('lodash');
const fs = require('fs');
const coreLib = require('tc-core-library-js');
const models = require('../app/models');
const helper = require('./helper');

const logger = coreLib.logger({
  name: 'tc-message-service',
  level: _.get(config, 'logLevel', 'debug').toLowerCase(),
  captureLogs: config.get('captureLogs'),
  logentriesToken: _.get(config, 'logentriesToken', null),
});

const db = models(null, logger);
// the directory at which migration scripts are located
const MigrationsDirPath = './migrations';

const userPrompt = 'WARNING: this would remove existing data and recreate schema. Are you sure you want to recreate schema?';
/**
 * List the filenames of the migration files.
 *
 * @returns {Array} the list of filenames
 */
function listMigrationFiles() {
  const filenames = fs.readdirSync(MigrationsDirPath);
  return filenames;
}

const initDB = async () => {
  await helper.promptUser(userPrompt, async () => {
    try {
      await db.sequelize.dropSchema('public');
      await db.sequelize.createSchema('public');
      // define SequelizeMeta table
      const SequelizeMeta = await db.sequelize.define('SequelizeMeta', {
        name: {
          type: db.Sequelize.STRING(255),
          allowNull: false,
          primaryKey: true,
        },
      }, { timestamps: false });
      // re-init all tables including the SequelizeMeta table
      await db.sequelize.sync({ force: true });
      // add filenames of existing migration scripts to the SequelizeMeta table
      await SequelizeMeta.bulkCreate(listMigrationFiles().map(filename => ({ name: filename })));
      logger.info({
        component: 'resetDb',
        message: 'Reset db success',
      });
      process.exit(0);
    } catch (err) {
      logger.error(err, { component: 'resetDb' });
      process.exit(1);
    }
  });
};

if (!module.parent) {
  initDB();
}

module.exports = {
  initDB,
};
