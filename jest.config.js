module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2018',
        strict: true,
        esModuleInterop: true,
        // Inline TS emit helpers — the production build (esbuild) supplies its
        // own, but ts-jest emits real JS and would otherwise require('tslib'),
        // which is not a dependency. Without this, any test importing main.ts
        // (the only default-export module) fails to resolve tslib.
        importHelpers: false,
      },
    }],
  },
};
