module.exports = {
  apps: [
    {
      name: 'sukaczev-user',
      cwd: '/root/sukaczev/services/user-service',
      script: 'src/server.js',
      instances: 1,
      env: {
        PORT: 3001,
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        JWT_SECRET: process.env.JWT_SECRET || 'sukaczev_jwt_secret_change_me',
        JWT_ACCESS_EXPIRATION: '15m',
        JWT_REFRESH_EXPIRATION: '7d',
        BCRYPT_ROUNDS: '12',
        API_RATE_LIMIT: '100',
        API_RATE_WINDOW: '60000'
      }
    },
    {
      name: 'sukaczev-video',
      cwd: '/root/sukaczev/services/video-service',
      script: 'src/server.js',
      instances: 1,
      env: {
        PORT: 3002,
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        API_RATE_LIMIT: '100',
        API_RATE_WINDOW: '60000',
        MAX_VIDEO_SIZE: '1073741824',
        ALLOWED_VIDEO_TYPES: 'video/mp4,video/webm,video/ogg',
        THUMBNAIL_WIDTH: '640',
        THUMBNAIL_HEIGHT: '360'
      }
    },
    {
      name: 'sukaczev-search',
      cwd: '/root/sukaczev/services/search-service',
      script: 'src/server.js',
      instances: 1,
      env: {
        PORT: 3003,
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        ELASTICSEARCH_URL: 'http://localhost:9200',
        ES_INDEX_NAME: 'sukaczev_videos',
        API_RATE_LIMIT: '100',
        API_RATE_WINDOW: '60000',
        SEARCH_SUGGESTION_LIMIT: '10',
        TRENDING_UPDATE_INTERVAL: '600000'
      }
    },
    {
      name: 'sukaczev-danmaku',
      cwd: '/root/sukaczev/services/danmaku-service',
      script: 'src/server.js',
      instances: 1,
      env: {
        PORT: 3004,
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        API_RATE_LIMIT: '200',
        API_RATE_WINDOW: '60000',
        DANMAKU_MAX_LENGTH: '100',
        DANMAKU_DENSITY_LIMIT: '100',
        WS_HEARTBEAT_INTERVAL: '30000',
        WS_MAX_CONNECTIONS: '10000'
      }
    },
    {
      name: 'sukaczev-comment',
      cwd: '/root/sukaczev/services/comment-service',
      script: 'src/server.js',
      instances: 1,
      env: {
        PORT: 3005,
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        API_RATE_LIMIT: '100',
        API_RATE_WINDOW: '60000',
        COMMENT_MAX_LENGTH: '2000',
        COMMENT_MAX_DEPTH: '5',
        COMMENT_PAGE_SIZE: '20'
      }
    },
    {
      name: 'sukaczev-notify',
      cwd: '/root/sukaczev/services/notification-service',
      script: 'src/server.js',
      instances: 1,
      env: {
        PORT: 3006,
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        API_RATE_LIMIT: '100',
        API_RATE_WINDOW: '60000',
        NOTIFICATION_BATCH_SIZE: '50',
        NOTIFICATION_RETENTION_DAYS: '30',
        WS_HEARTBEAT_INTERVAL: '30000',
        WS_MAX_CONNECTIONS: '10000'
      }
    }
  ]
};
