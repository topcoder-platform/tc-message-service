module.exports = {
  // the server api version
  apiVersion: 'v5',
  aws: {
    config: {
      // AWS access key id
      accessKeyId: '*******',
      // AWS region
      region: 'eu-west-1',
      // AWS access secret key
      secretAccessKey: '********',
    },
    dynamodb: {
      // Table name of es index logs
      elasticSearchIndexingLogsTable: 'MessageServiceESIndexingLogs',
      // The local url if using Amazon DynamoDB Local
      url: '',
    },
    S3: {
      // AWS s3 bucket name
      targetBucket: 'topcoder-dev-media',
      // AWS s3 storage dir
      storageDir: 'tc-message-service',
    },
  },
  attachmentConfig: {
    // Attachment delete after
    deleteAfter: '1 day',
  },
  elasticsearchConfig: {
    // ElasticSearch host url
    host: 'http://localhost:9200',
    // ElasticSearch api version
    apiVersion: '6.2',
    // The index name of message in es
    indexName: 'messages',
    // The default pageSize of es
    pageSize: 1000,
  },
  // The coder bot user name
  coderBotUsername: 'system',
  // The coder bot user id
  coderBotUserId: 'system',
  // The member service url
  memberServiceUrl: 'http://local.topcoder-dev.com:3001/members',
  // The prefix of admin endpoint
  adminPrefix: '/v5/topics/admin',
  // The auth secret key
  AUTH_SECRET: 'secret',
  // The auth domain
  authDomain: 'topcoder.com',
  // The capture logs set
  captureLogs: 'false',
  dbConfig: {
    // The postgres url
    masterUrl: 'postgres://coder:mysecretpassword@local.topcoder-dev.com:5432/messages',
  },
  // The reference lookup timeout
  referenceLookupTimeout: 3000,
  // The response version
  version: 'v5',
  // The identity service url
  identityServiceEndpoint: 'http://local.topcoder-dev.com:3001/',
  // The system user client id
  systemUserClientId: '',
  // The system user client secret
  systemUserClientSecret: '',
  // The valid issuer of tokens, a json array contains valid issuer.
  VALID_ISSUERS: '["https://topcoder-newauth.auth0.com/","https://api.topcoder-dev.com"]',
  // The bus api url
  busApiUrl: 'https://api.topcoder-dev.com',
  // The topic service url
  topicServiceUrl: 'http://api.topcoder-dev.com/v4/topics',
  // Auth0 client id, used to get TC M2M token
  AUTH0_CLIENT_ID: '',
  // Auth0 client secret, used to get TC M2M token
  AUTH0_CLIENT_SECRET: '',
  // Auth0 audience, used to get TC M2M token
  AUTH0_AUDIENCE: '',
  // Auth0 URL, used to get TC M2M token
  AUTH0_URL: '',
  // Auth0 token cache time, used to get TC M2M token
  TOKEN_CACHE_TIME: '',
  // Proxy Auth0 URL, used to get TC M2M token
  AUTH0_PROXY_SERVER_URL: '',
  // The maximum unassigned attachments
  maximumUnassignedAttachments: 20,
  // the default path for importing and exporting data
  DEFAULT_DATA_FILE_PATH: './data/demo-data.json',
};
