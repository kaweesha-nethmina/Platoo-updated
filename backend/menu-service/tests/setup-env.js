/**
 * Jest setup file - runs before any test module is imported.
 * Points services at a DEDICATED TEST database so the developer's
 * dev database (platoo_menu) is never touched by the test suites.
 *
 * SAFETY GUARD: refuses to run if the resolved MONGO_URI database name does
 * not end in "_test". This is a hard stop, not a warning: it has already
 * prevented an accidental drop of the production (Atlas) database during
 * development.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const testEnvPath = path.join(__dirname, '..', '.env.test');
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath });
}

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '0';

// TEST_MONGO_URI env override > MONGO_URI from .env.test > local default.
const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/platoo_menu_test';
process.env.TEST_MONGO_URI = TEST_MONGO_URI;
process.env.MONGO_URI = TEST_MONGO_URI;

const dbName = String(TEST_MONGO_URI).split('?')[0].split('/').pop() || '';
if (!dbName.endsWith('_test')) {
  // eslint-disable-next-line no-console
  console.error(
    `[setup-env] REFUSING TO RUN TESTS: MONGO_URI database "${dbName}" ` +
      'does not end with "_test". Never run the suites against a dev/prod ' +
      'database. Set TEST_MONGO_URI to e.g. ' +
      'mongodb://127.0.0.1:27017/platoo_menu_test'
  );
  process.exit(1);
}