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
  globalIgnores(['.next/**', 'out/**', 'build/**', 'electron/dist/**', 'node_modules/**', 'dist/**']),
]);

export default eslintConfig;
