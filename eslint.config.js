// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'PublishHtmlReport/node_modules/**',
      '*.vsix',
    ],
  },
  {
    files: ['*.js', 'scripts/**/*.js', 'PublishHtmlReport/**/*.js'],
    extends: [eslint.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      complexity: ['error', 10],
      'linebreak-style': ['error', 'unix'],
      'max-depth': ['error', 3],
      'max-lines-per-function': [
        'error',
        {
          max: 30,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'no-control-regex': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'explicit',
          overrides: {
            constructors: 'no-public',
          },
        },
      ],
      '@typescript-eslint/member-ordering': 'off',
      complexity: ['error', 10],
      'linebreak-style': ['error', 'unix'],
      'max-depth': ['error', 3],
      'max-lines-per-function': [
        'error',
        {
          max: 30,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'no-duplicate-imports': 'error',
      'no-undef': 'off',
      'preserve-caught-error': 'off',
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: true,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: false,
        },
      ],
    },
  },
]);
