/**
 * @fileoverview Jest configuration for user-service.
 * Configures test environment, coverage settings, and test patterns.
 */

module.exports = {
  /**
   * Test environment - Node.js for server-side testing.
   */
  testEnvironment: 'node',

  /**
   * Root directories for test discovery.
   */
  roots: ['<rootDir>/tests', '<rootDir>/src'],

  /**
   * Test file patterns to match.
   */
  testMatch: [
    '**/tests/**/*.test.js',
    '**/src/**/*.test.js',
  ],

  /**
   * Setup files to run after Jest is initialized.
   */
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  /**
   * Module file extensions to resolve.
   */
  moduleFileExtensions: ['js', 'json'],

  /**
   * Coverage configuration.
   */
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

  /**
   * Verbose output for detailed test information.
   */
  verbose: true,

  /**
   * Global test timeout in milliseconds.
   */
  testTimeout: 30000,

  /**
   * Automatically clear mock calls between tests.
   */
  clearMocks: true,

  /**
   * Reset mocks between tests.
   */
  resetMocks: false,

  /**
   * Restore mocks between tests.
   */
  restoreMocks: false,

  /**
   * Detect open handles that prevent Jest from exiting cleanly.
   */
  detectOpenHandles: true,

  /**
   * Force exit after all tests complete.
   */
  forceExit: true,

  /**
   * Maximum workers for test execution.
   */
  maxWorkers: 1,

  /**
   * Run tests sequentially to avoid database conflicts.
   */
  runInBand: true,

  /**
   * Transform configuration.
   */
  transform: {},

  /**
   * Module name mapper for path aliases.
   */
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  /**
   * Coverage path ignore patterns.
   */
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
  ],

  /**
   * Watch plugins for interactive mode.
   */
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  /**
   * Global setup module.
   */
  globalSetup: undefined,

  /**
   * Global teardown module.
   */
  globalTeardown: undefined,

  /**
   * Reporters configuration.
   */
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './reports',
        outputName: 'junit.xml',
      },
    ],
  ],
};
