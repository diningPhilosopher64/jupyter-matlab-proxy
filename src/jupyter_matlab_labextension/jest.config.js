// Copyright 2025 The MathWorks, Inc.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/src/__tests__/jest-setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@jupyterlab)/)' // Transform @jupyterlab packages
  ],
  moduleNameMapper: {
    // Mock @jupyterlab/ui-components to avoid ES modules issues
    '@jupyterlab/ui-components': '<rootDir>/src/__tests__/mocks/ui-components.js'
  }
};