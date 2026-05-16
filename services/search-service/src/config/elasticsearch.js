const { Client } = require('@elastic/elasticsearch');
const config = require('./index');
const logger = require('../utils/logger');

let client = null;

const createEsClient = () => {
  const esConfig = {
    node: config.elasticsearch.node,
    maxRetries: config.elasticsearch.maxRetries,
    requestTimeout: config.elasticsearch.requestTimeout,
    sniffOnStart: config.elasticsearch.sniffOnStart,
  };

  if (config.elasticsearch.username && config.elasticsearch.password) {
    esConfig.auth = {
      username: config.elasticsearch.username,
      password: config.elasticsearch.password,
    };
  }

  return new Client(esConfig);
};

const getEsClient = () => {
  if (!client) {
    client = createEsClient();
  }
  return client;
};

const closeEsClient = async () => {
  if (client) {
    await client.close();
    client = null;
    logger.info('Elasticsearch client closed');
  }
};

const pingElasticsearch = async () => {
  try {
    const esClient = getEsClient();
    const response = await esClient.ping();
    logger.info('Elasticsearch connected successfully');
    return response;
  } catch (error) {
    logger.error('Elasticsearch connection failed:', error.message);
    throw error;
  }
};

module.exports = {
  getEsClient,
  closeEsClient,
  pingElasticsearch,
};
