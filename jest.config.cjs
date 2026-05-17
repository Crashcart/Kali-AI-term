module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['server.js', 'plugins/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/public/'],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 10000,
  // Several suites mutate shared global state (the SQLite singleton via
  // process.env.DB_PATH, the plugin manager, the file manager). Running them
  // across parallel workers caused intermittent failures, so execute serially.
  maxWorkers: 1,
};
