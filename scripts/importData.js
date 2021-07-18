/**
 * Import data from a json file into the db
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
 const userPrompt = `WARNING: this would remove existing data. Are you sure you want to import data from a json file with the path ${filePath}?`;

 const dataModels = ['topics', 'posts', 'post_attachments', 'post_user_stats', 'email_logs', 'reference_lookups'];

 const db = models(null, logger);

/**
 * Import data from a json file into the database
 * @returns {undefined}
 */
 async function importModelData() {
  // check if file exists
   if (!fs.existsSync(filePath)) {
     throw new Error(`File with path ${filePath} does not exist`);
   }

  // clear database
   logger.info({ component: 'importData', message: 'Clearing database...' });
   await db.sequelize.sync({ force: true });

   let transaction = null;
   const currentModelName = null;
   try {
    // Start a transaction
     transaction = await db.sequelize.transaction();
     const jsonData = JSON.parse(fs.readFileSync(filePath).toString());

     for (let index = 0; index < dataModels.length; index += 1) {
       const modelName = dataModels[index];
       const model = db[modelName];
       const modelRecords = jsonData[modelName];

       if (modelRecords && modelRecords.length > 0) {
         logger.info({
           component: 'importData',
           message: `Importing data for model: ${modelName}`,
         });

        // eslint-disable-next-line no-await-in-loop
         await model.bulkCreate(modelRecords, { transaction });
         if (!_.includes(['reference_lookups', 'post_user_stats'], modelName)) {
           await db.sequelize.query(`ALTER SEQUENCE ${modelName}_id_seq RESTART WITH ${modelRecords.length + 1}`);
         }
         logger.info({
           component: 'importData',
           message: `Records imported for model: ${modelName} = ${modelRecords.length}`,
         });
       } else {
         logger.info({
           component: 'importData',
           message: `No records to import for model: ${modelName}`,
         });
       }
     }
    // commit transaction only if all things went ok
     logger.info({
       component: 'importData',
       message: 'committing transaction to database...',
     });
     await transaction.commit();
   } catch (error) {
     logger.error({
       component: 'importData',
       message: `Error while writing data of model: ${currentModelName}`,
     });
    // rollback all insert operations
     if (transaction) {
       logger.info({
         component: 'importData',
         message: 'rollback database transaction...',
       });
       transaction.rollback();
     }
     if (error.name && error.errors && error.fields) {
      // For sequelize validation errors, we throw only fields with data that helps in debugging error,
      // because the error object has many fields that contains very big sql query for the insert bulk operation
       throw new Error(
        JSON.stringify({
          modelName: currentModelName,
          name: error.name,
          errors: error.errors,
          fields: error.fields,
        }),
      );
     } else {
       throw error;
     }
   }
 }

 async function importData() {
   await helper.promptUser(userPrompt, async () => {
     try {
       await importModelData(filePath, dataModels, logger);
       process.exit(0);
     } catch (err) {
       logger.error(err, { component: 'importData' });
       process.exit(1);
     }
   });
 }

 importData();
