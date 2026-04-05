import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    rules: {
      // NestJS uses empty constructors for DI and any for decorators
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow console.log in backend (logger preferred but not enforced yet)
      'no-console': 'off',
    },
  },
];
