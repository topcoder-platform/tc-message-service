import elasticsearch from 'elasticsearch';
// import AWS from 'aws-sdk';

const _ = require('lodash');
const config = require('config');
const jwt = require('jsonwebtoken');


let token = null;
/**
 * verify if token has not expired
 * @param  {[type]}  _token [description]
 * @return {Boolean}        [description]
 */
function isValid(_token) {
  const decoded = jwt.decode(_token, { complete: true });
  const now = (Date.now() / 100) - 100;
  if (decoded) {
    return decoded.payload.exp > now;
  }
  return false;
}

const util = _.cloneDeep(require('tc-core-library-js').util(config));
// the client modifies the config object, so always passed the cloned object
let esClient = null;

_.assign(util, {
  /**
   * Retrieve valid system user token
   * @param  {Object} logger [description]
   * @param  {String} _id     [description]
   * @return {Promise}       promise that resolves auth token
   */
  getSystemUserToken: (logger, _id) => {
    if (token && isValid(token)) {
      return Promise.resolve(token);
    }

    const id = _id || 'system';
    const httpClient = util.getHttpClient({ id, log: logger });
    const url = `${config.get('identityServiceEndpoint')}authorizations/`;
    // eslint-disable-next-line
    const formData = `clientId=${config.get('systemUserClientId')}&secret=${encodeURIComponent(config.get('systemUserClientSecret'))}`;
    // logger.debug(url, formData)
    return httpClient.post(url, formData,
      {
        timeout: 4000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    .then((res) => {
      token = res.data.result.content.token;
      return token;
    });
  },

  /**
   * Return the initialized elastic search client
   * @return {Object}           the elasticsearch client instance
   */
  getElasticSearchClient: () => {
    if (esClient) return esClient;
    const esHost = config.get('elasticsearchConfig.host');
    if (/.*amazonaws.*/.test(esHost)) {
      esClient = elasticsearch.Client({
        apiVersion: config.get('elasticsearchConfig.apiVersion'),
        hosts: esHost,
        connectionClass: require('http-aws-es'), // eslint-disable-line global-require
        // amazonES: {
        //   region: 'us-east-1',
        //   credentials: new AWS.EnvironmentCredentials('AWS'),
        // },
      });
    } else {
      esClient = new elasticsearch.Client(_.cloneDeep(config.elasticsearchConfig));
    }
    return esClient;
  },
});

module.exports = util;
