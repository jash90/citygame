import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFiles: ['./test-setup.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/*.module.ts', '!main.ts', '!prisma/seed.ts', '!test-setup.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@citygame/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^expo-server-sdk$': '<rootDir>/__mocks__/expo-server-sdk.ts',
  },
};

export default config;
