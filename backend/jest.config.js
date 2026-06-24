/**
 * Jest configuration for VeloManage backend.
 *
 * Project uses native ESM ("type": "module" in package.json). Tests are run
 * with `node --experimental-vm-modules` so Jest can load .js files as ESM
 * without a babel transform.
 *
 * For module mocking in ESM mode, tests use `jest.unstable_mockModule()` +
 * dynamic `await import()`. See tests/integration/*.test.js for examples.
 */
export default {
  testEnvironment: 'node',

  // Where Jest looks for tests and source files
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // Test file patterns: tests/**/*.test.js and inline src/**/*.{spec,test}.js
  testMatch: [
    '**/tests/**/*.test.js',
    '**/src/**/?(*.)+(spec|test).{js,jsx}',
  ],

  // File extensions Jest considers
  moduleFileExtensions: ['js', 'jsx', 'json'],

  // Global setup file — runs once per test file before any tests execute
  setupFiles: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'clover'],

  // Coverage thresholds — start low, raise as the suite grows
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },

  // Ignore these paths when looking for tests / source files
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],

  // Don't watch these directories in --watch mode
  watchPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/'],

  // Make Jest exit cleanly even if a timer / handle is still open
  forceExit: true,

  // Mongoose / Socket.io may register timers
  detectOpenHandles: false,

  // Verbose output so we can see each test name
  verbose: true,
};
