const aws = require('aws-sdk');
const config = require('config');
const Promise = require('bluebird');


let adapter = null;

/*
*  Lazily instantiate the dynamodb adapter.
*/
const getAdapter = () => {
  if (!adapter) {
    const tableName = config.get('aws.dynamodb.elasticSearchIndexingLogsTable');

    let dynamodb;
    if (config.get('aws.dynamodb.url')) {
      dynamodb = new aws.DynamoDB({ endpoint: config.get('aws.dynamodb.url') });
    } else {
      dynamodb = new aws.DynamoDB(config.get('aws.config'));
    }
    const putItem = Promise.promisify(dynamodb.putItem.bind(dynamodb));


    const save = ({ id, topicId, type, payload, errorMessage }) =>
      putItem({
        Item: {
          Id: { S: id.toString() },
          TopicId: { S: topicId.toString() },
          Type: { S: type },
          Payload: { S: JSON.stringify(payload) },
          ErrorMessage: { S: errorMessage },
          TimeStamp: { S: new Date().toISOString() },
        },
        ReturnConsumedCapacity: 'TOTAL',
        TableName: tableName,
      });

    adapter = {
      save,

    };
  }
  return adapter;
};

/**
 * Save record in the dynamodb.
 *
 * @param {String} id unique id to identify this object
 * @param {Number} topicId topic id associated with this object
 * @param {String} type type of object this is
 * @param {Object} payload object to save in the dynamodb
 * @param {String} errorMessage Message from ES Sync
 * @returns {Object} promise from save
 */
const save = (id, topicId, type, payload, errorMessage) =>
  getAdapter()
    .save({ id, topicId, type, payload, errorMessage });


module.exports = {
  save,
};
