import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // docs/google-apps-script 內是 Google Apps Script 環境腳本（DriveApp、Logger 為 GAS 全域），不適用瀏覽器規則
  globalIgnores(['dist', 'docs/google-apps-script']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // 列印模板與 JSX 文字中的全形空白（U+3000）是刻意排版（如「　　年　　月　　日」），不是錯誤
      'no-irregular-whitespace': ['error', {
        skipTemplates: true,
        skipJSXText: true,
        skipComments: true,
      }],
    },
  },
])
