import { defineConfig, globalIgnores } from 'eslint/config';
import tsParser from '@typescript-eslint/parser';

const eslintConfig = defineConfig([
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ['lib/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message: 'Functional core cannot depend on Electron APIs.',
            },
            {
              name: 'sqlite3',
              message: 'Functional core cannot depend on database drivers.',
            },
            {
              name: 'fs',
              message: 'Functional core cannot depend on file system APIs.',
            },
            {
              name: 'node:fs',
              message: 'Functional core cannot depend on file system APIs.',
            },
            {
              name: 'react',
              message: 'Functional core cannot depend on UI libraries.',
            },
          ],
          patterns: ['@/electron/*', '@/components/*', '@/app/*'],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Functional core must stay runtime-agnostic.',
        },
        {
          name: 'fetch',
          message: 'Functional core cannot perform network IO.',
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'electron/dist/**', 'node_modules/**', 'dist/**']),
]);

export default eslintConfig;
