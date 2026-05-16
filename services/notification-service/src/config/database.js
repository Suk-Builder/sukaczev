const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('../utils/logger');

let sequelize = null;

const createSequelize = () => {
  return new Sequelize(
    config.database.name,
    config.database.user,
    config.database.password,
    {
      host: config.database.host,
      port: config.database.port,
      dialect: config.database.dialect,
      pool: {
        max: config.database.poolSize,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      logging: config.database.logging ? (msg) => logger.debug(msg) : false,
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
      },
    }
  );
};

const getSequelize = () => {
  if (!sequelize) {
    sequelize = createSequelize();
  }
  return sequelize;
};

const closeDatabase = async () => {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
    logger.info('Database connection closed');
  }
};

const pingDatabase = async () => {
  try {
    const db = getSequelize();
    await db.authenticate();
    logger.info('Database connected successfully');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    throw error;
  }
};

const syncDatabase = async (force = false) => {
  try {
    const db = getSequelize();
    await db.sync({ force, alter: !force });
    logger.info(`Database synchronized${force ? ' (forced)' : ''}`);
  } catch (error) {
    logger.error('Database sync error:', error.message);
    throw error;
  }
};

module.exports = {
  getSequelize,
  closeDatabase,
  pingDatabase,
  syncDatabase,
  createSequelize,
};
