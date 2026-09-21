import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

const jestGlobals = {
  describe: 'readonly',
  test: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  jest: 'readonly',
};

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.semgrep/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...jestGlobals, console: 'readonly', process: 'readonly', Buffer: 'readonly' } },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      ...security.configs.recommended.rules,
      // We do NOT change fs filenames from user input, keep rule off:
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    plugins: { 'no-unsanitized': noUnsanitized },
    rules: {
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
    },
  }
);