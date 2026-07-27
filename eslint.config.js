// Flat-config ESLint for the renderer (React) and the Electron main/preload processes.
// Deliberately NOT type-checked linting: the two tsconfig projects (app + electron) already run in
// `npm run build` via `tsc -b`, so lint stays fast and does not need a second program build.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-electron/**', 'release/**', 'node_modules/**', '.playwright-mcp/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Renderer: browser globals, React hook rules (exhaustive-deps is an error here on purpose -
  // stale-closure bugs in the MIDI/audio hooks are exactly what it catches).
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Stale-closure / missing-cleanup bugs are the expensive class here, so this is a hard error.
      'react-hooks/exhaustive-deps': 'error',
      // These two are the newer React-Compiler-derived diagnostics. They flag real smells but also
      // some legitimate existing patterns, so they warn rather than gate until the code catches up.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Electron main/preload and build scripts run in Node.
  {
    files: ['electron/**/*.{ts,cts}', 'scripts/**/*.{js,mjs,cjs}', '*.config.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
