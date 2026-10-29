const expoPreset = require('jest-expo/jest-preset');

// @noble/curves ships only ES modules, so Jest has to transform it like the Expo packages.
// The pattern is jest-expo's own list with @noble added, so it follows jest-expo upgrades.
const [expoNodeModules, ...expoRest] = expoPreset.transformIgnorePatterns;
if (!expoNodeModules.includes('(?!(')) throw new Error('jest-expo changed transformIgnorePatterns');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [expoNodeModules.replace('(?!(', '(?!(@noble|'), ...expoRest],
  // Reanimated 4 and worklets need their resolver to run in Jest.
  resolver: 'react-native-reanimated/jest/resolver',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.gen.ts', '!src/**/__catalog__/**'],
};
