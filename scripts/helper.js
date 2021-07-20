const Confirm = require('prompt-confirm');
const esClient = require('../app/elasticSearchConnection');

/**
 * Prompt the user with a y/n query and call a callback function based on the answer
 * @param {string} promptQuery the query to ask the user
 * @param {function} cb the callback function
 * @returns {undefined}
 */
async function promptUser(promptQuery, cb) {
  if (process.argv.includes('--force')) {
    await cb();
    return;
  }

  const prompt = new Confirm(promptQuery);
  prompt.ask(async (answer) => {
    if (answer) {
      await cb();
    }
  });
}

/**
 * Get the first parameter from cli arguments
 * @returns {undefined}
 */
function getParamFromCliArgs() {
  const filteredArgs = process.argv.filter(arg => !arg.includes('--'));

  if (filteredArgs.length > 2) {
    return filteredArgs[2];
  }

  return null;
}

/**
 * Create index in elasticsearch
 * @param {Object} index the index name
 * @param {Object} logger the logger object
 */
 async function createIndex (index, logger) {
  await esClient.indices.create({ index })
  logger.info({
    component: 'createIndex',
    message: `ES Index ${index} creation succeeded!`
  })
}

/**
 * Delete index in elasticsearch
 * @param {Object} index the index name
 * @param {Object} logger the logger object
 */
 async function deleteIndex (index, logger) {
  await esClient.indices.delete({ index })
  logger.info({
    component: 'deleteIndex',
    message: `ES Index ${index} deletion succeeded!`
  })
}

module.exports = {
  promptUser,
  getParamFromCliArgs,
  deleteIndex,
  createIndex,
};
