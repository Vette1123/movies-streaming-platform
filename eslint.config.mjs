import nextConfig from 'eslint-config-next/core-web-vitals'
import prettierConfig from 'eslint-config-prettier/flat'
import tailwindPlugin from 'eslint-plugin-tailwindcss'

export default [
  {
    // `.next` / `.open-next` / `.wrangler` are generated build output: linting
    // them reports errors in code we never wrote (and pulls in rules the flat
    // config doesn't even define). They only exist after a build, so a repo
    // that has never run `build:worker` lints clean without this.
    ignores: [
      'dist/**',
      '.cache/**',
      'public/**',
      'node_modules/**',
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      // The bundled Worker (scripts/build-worker.mjs output). Same class as
      // the generated dirs above — it only exists after `pnpm build:cf`.
      '.cloudflare/**',
      '**/*.esm.js',
    ],
  },
  ...nextConfig,
  ...tailwindPlugin.configs['flat/recommended'],
  prettierConfig,
  {
    settings: {
      tailwindcss: {
        callees: ['cn'],
        cssFiles: ['./styles/globals.css'],
      },
      next: {
        rootDir: ['./'],
      },
    },
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'react/jsx-key': 'off',
      'tailwindcss/no-custom-classname': 'off',
    },
  },
]
