module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  moduleDirectories: [
    'node_modules',
    'src'
  ],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 30000
};
