import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactCompiler from 'eslint-plugin-react-compiler';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tsFilePatterns = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

const tsTypeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: tsFilePatterns,
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      projectService: true,
      tsconfigRootDir: __dirname,
    },
  },
}));

const disableTypeCheckedForJs = {
  ...tseslint.configs.disableTypeChecked,
  files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
};

export default [
  {
    ignores: [
      'dist',
      'public',
      'src-tauri/target',
      'src-tauri/gen',
      'src-tauri/out',
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  ...tsTypeCheckedConfigs,
  disableTypeCheckedForJs,
  eslintReact.configs['recommended-typescript'],
  reactHooks.configs['recommended-latest'],
  {
    files: tsFilePatterns,
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-throw-literal': 'off',
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: [{ from: 'lib', name: 'Response' }],
        },
      ],
    },
  },
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
