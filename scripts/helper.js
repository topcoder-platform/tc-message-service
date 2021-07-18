const Confirm = require('prompt-confirm');

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

module.exports = {
  promptUser,
  getParamFromCliArgs,
};
