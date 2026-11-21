// ESLint flat config for the Fynk mobile app.
// Module boundaries (CLAUDE.md, Conflict rules):
//   * a module imports only @shared/* and other modules through their index.ts (@modules/<name>);
//   * shared never imports modules or the app;
//   * the app shell reaches modules only through their index.ts.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const boundaries = require('eslint-plugin-boundaries');

const sameModule = { type: 'module', captured: { name: '{{from.element.captured.name}}' } };

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'coverage/**', 'android/**', 'ios/**', '.expo/**', '**/*.gen.ts'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'module', pattern: 'src/modules/*', capture: ['name'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        2,
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { types: { anyOf: ['module', 'app'] } } } },
              message: 'shared cannot import modules or the app shell.',
            },
            {
              from: { element: { type: 'module' } },
              disallow: { to: { element: { types: { anyOf: ['module', 'app'] } } } },
              message:
                'Module {{from.element.captured.name}} may import other modules only through @modules/<name> (their index.ts).',
            },
            {
              from: { element: { type: 'module' } },
              allow: { to: { element: sameModule } },
            },
            {
              from: { element: { types: { anyOf: ['module', 'app'] } } },
              allow: { to: { element: { type: 'module', fileInternalPath: 'index.ts' } } },
            },
            {
              from: { element: { type: 'app' } },
              disallow: { to: { element: { type: 'module', fileInternalPath: '!index.ts' } } },
              message:
                'The app shell reaches modules only through @modules/<name> (their index.ts).',
            },
          ],
        },
      ],
    },
  },
  {
    // Light and dark (shared contracts 3.6): screens read colors from useTheme(), never from a
    // fixed palette, so every screen follows the phone or the Apariencia choice.
    files: ['src/app/**/*.{ts,tsx}', 'src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        2,
        {
          paths: [
            {
              name: '@shared/ui',
              importNames: ['lightColors', 'darkColors', 'palettes', 'shadows', 'makeShadows'],
              message:
                'Read colors and shadows with useTheme() or useThemedStyles() from @shared/ui.',
            },
          ],
        },
      ],
    },
  },
]);
