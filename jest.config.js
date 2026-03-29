module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'server.js',
    'plugins/**/*.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/public/',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  verbose: true,
  testTimeout: 10000,
};
