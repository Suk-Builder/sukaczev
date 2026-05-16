/**
 * @fileoverview Jest configuration for video-service.
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/src/**/*.test.js',
  ],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  verbose: true,
  testTimeout: 30000,
  clearMocks: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1,
  runInBand: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
  ],
};
