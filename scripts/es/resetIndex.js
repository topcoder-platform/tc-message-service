/**
 * Reset (delete if exists and re-creates) index in Elasticsearch
 */
const config = require('config')
const _ = require('lodash')
const coreLib = require('tc-core-library-js')
const helper = require('../helper')

const logger = coreLib.logger({
  name: 'tc-message-service',
  level: _.get(config, 'logLevel', 'debug').toLowerCase(),
  captureLogs: config.get('captureLogs'),
  logentriesToken: _.get(config, 'logentriesToken', null),
});

const indices = [config.get('elasticsearchConfig.indexName')]
const userPrompt = `WARNING: Are you sure want to reset (delete and re-create) the following elasticsearch indices: ${indices}?`

async function createIndex () {
  await helper.promptUser(userPrompt, async () => {
    for (const index of indices) {
      try {
        await helper.deleteIndex(index, logger)
      } catch (err) {}
      try {
        await helper.createIndex(index, logger)
      } catch (err) {
        logger.error(err, { component: 'createIndex' })
        process.exit(1)
      }
    }
    process.exit(0)
  })
}

createIndex()
