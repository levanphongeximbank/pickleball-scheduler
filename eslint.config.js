import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // react-hooks v7 — rules mới quá nghiêm cho codebase hiện tại; refactor dần v3.6+
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/use-memo': 'warn',
    },
  },
  {
    files: [
      'src/context/**/*.{js,jsx}',
      'tests/**/*.{js,jsx}',
      'src/components/tournament/MatchCard.jsx',
      'src/components/tournament/animation/shared/**/*.{js,jsx}',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['tests/**/*.{js,jsx}', 'src/features/integrations/config/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
