/**
 * Export data to a json file
 */
const fs = require('fs');
const config = require('config');
const _ = require('lodash');
const coreLib = require('tc-core-library-js');
const models = require('../app/models');
const helper = require('./helper');

const logger = coreLib.logger({
  name: 'tc-message-service',
  level: _.get(config, 'logLevel', 'debug').toLowerCase(),
  captureLogs: config.get('captureLogs'),
  logentriesToken: _.get(config, 'logentriesToken', null),
});

const filePath = helper.getParamFromCliArgs() || config.DEFAULT_DATA_FILE_PATH;

const userPrompt = 'WARNING: are you sure you want to export all data in the database'
 + ` to a json file with the path ${filePath}? This will overwrite the file.`;

const dataModels = ['topics', 'posts', 'post_attachments', 'post_user_stats', 'email_logs', 'reference_lookups'];

const db = models(null, logger);
/**
 * Export data from the database into a json file
 * @returns {undefined}
 */
async function exportModelData() {
  logger.info({
    component: 'exportData',
    message: `Start Saving data to file with path ${filePath}....`,
  });

  const allModelsRecords = {};
  for (let index = 0; index < dataModels.length; index += 1) {
    const modelName = dataModels[index];
    // eslint-disable-next-line no-await-in-loop
    const modelRecords = await db[modelName].findAll();
    const rawRecords = _.map(modelRecords, r => r.toJSON());
    allModelsRecords[modelName] = rawRecords;
    logger.info({
      component: 'exportData',
      message: `Records loaded for model: ${modelName} = ${rawRecords.length}`,
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(allModelsRecords));
  logger.info({
    component: 'exportData',
    message: 'End Saving data to file....',
  });
}

async function exportData() {
  await helper.promptUser(userPrompt, async () => {
    try {
      await exportModelData();
      process.exit(0);
    } catch (err) {
      logger.error(err, { component: 'exportData' });
      process.exit(1);
    }
  });
}

exportData();
