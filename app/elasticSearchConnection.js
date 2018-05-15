const elasticsearch = require('elasticsearch');
const config = require('config');

const client = new elasticsearch.Client({
  hosts:
    config.get('elasticSearchUrls').split(',')
  ,
});

module.exports = client;

