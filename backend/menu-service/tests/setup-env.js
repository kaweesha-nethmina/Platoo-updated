/**
 * Jest setup file - runs before any test module is imported.
 * Points services at a DEDICATED TEST database so the developer's
 * dev database (platoo_menu) is never touched by the test suites.
 */
process.env.NODE_ENV = 'test';
process.env.TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/platoo_menu_test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI;
process.env.PORT = '0';