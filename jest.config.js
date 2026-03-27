module.exports = {
  clearMocks: true,
  collectCoverageFrom: [
    'src/publishTab/**/*.{ts,tsx}',
    '!src/publishTab/models/**/*.ts',
    '!src/publishTab/models/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 67,
      functions: 90,
      lines: 84,
      statements: 84,
    },
  },
  coverageReporters: ['text', 'text-summary', 'json-summary', 'html', 'lcov'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  roots: ['<rootDir>/__tests__'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
};
