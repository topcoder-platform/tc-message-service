// const elasticsearch = require('elasticsearch');
// const config = require('config');
const util = require('./util');

const client = util.getElasticSearchClient();

module.exports = client;

