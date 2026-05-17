module.exports = {
  apps: [
    {
      name: 'sukaczev-user',
      cwd: '/home/ubuntu/projects/sukaczev/services/user-service',
      script: './src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: 'Sukaczev416520!',
        DB_POOL_SIZE: 12,
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'sukaczev-jwt-secret-2024',
        RABBITMQ_URL: 'amqp://sukaczev:Sukaczev416520!@localhost:5672'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'sukaczev-video',
      cwd: '/home/ubuntu/projects/sukaczev/services/video-service',
      script: './src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: 'Sukaczev416520!',
        DB_POOL_SIZE: 12,
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'sukaczev-jwt-secret-2024',
        RABBITMQ_URL: 'amqp://sukaczev:Sukaczev416520!@localhost:5672'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'sukaczev-search',
      cwd: '/home/ubuntu/projects/sukaczev/services/search-service',
      script: './src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: 'Sukaczev416520!',
        DB_POOL_SIZE: 12,
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'sukaczev-jwt-secret-2024',
        RABBITMQ_URL: 'amqp://sukaczev:Sukaczev416520!@localhost:5672'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'sukaczev-danmaku',
      cwd: '/home/ubuntu/projects/sukaczev/services/danmaku-service',
      script: './src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: 'Sukaczev416520!',
        DB_POOL_SIZE: 12,
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'sukaczev-jwt-secret-2024',
        RABBITMQ_URL: 'amqp://sukaczev:Sukaczev416520!@localhost:5672'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'sukaczev-comment',
      cwd: '/home/ubuntu/projects/sukaczev/services/comment-service',
      script: './src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: 'Sukaczev416520!',
        DB_POOL_SIZE: 12,
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'sukaczev-jwt-secret-2024',
        RABBITMQ_URL: 'amqp://sukaczev:Sukaczev416520!@localhost:5672'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'sukaczev-notify',
      cwd: '/home/ubuntu/projects/sukaczev/services/notification-service',
      script: './src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'sukaczev',
        DB_USER: 'sukaczev',
        DB_PASSWORD: 'Sukaczev416520!',
        DB_POOL_SIZE: 12,
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'sukaczev-jwt-secret-2024',
        RABBITMQ_URL: 'amqp://sukaczev:Sukaczev416520!@localhost:5672'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s'
    }
  ]
};
