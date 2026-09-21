/**
 * Jest configuration for menu-service security assessment (SE4030).
 * - Uses ts-jest to run the TypeScript source directly.
 * - Tests run against a dedicated test database (platoo_menu_test), NEVER the dev DB.
 * - maxWorkers=1 avoids concurrent mongoose connection/drop races across suites.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  collectCoverageFrom: ['src/**/*.{ts,js}'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  maxWorkers: 1,
  verbose: true,
};