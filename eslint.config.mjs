import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Lint is a correctness gate, not a style guide. TypeScript strict mode and
 * the design-system contract already own style; ESLint owns the classes of
 * bug the compiler cannot see — above all hook misuse in a UI whose state
 * writes go straight to IndexedDB.
 */
export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // A missing effect dependency is a stale-closure bug against live
      // engagement data, not a style preference.
      'react-hooks/exhaustive-deps': 'error',
    },
  },
);
