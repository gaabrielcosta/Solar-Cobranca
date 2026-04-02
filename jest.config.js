/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: false,
        esModuleInterop: true,
        paths: {
          '../../database/data-source': ['./src/database/data-source.ts'],
          '../../modules/*': ['./src/modules/*'],
        },
      },
    }],
  },
  clearMocks: true,
}