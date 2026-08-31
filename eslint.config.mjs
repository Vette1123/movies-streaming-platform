import nextConfig from 'eslint-config-next/core-web-vitals'
import prettierConfig from 'eslint-config-prettier/flat'
import tailwindPlugin from 'eslint-plugin-tailwindcss'

const config = [
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
  tailwindPlugin.configs.recommended,
  prettierConfig,
  {
    settings: {
      tailwindcss: {
        // Tailwind 4 keeps its theme in CSS, not in a JS config, and the
        // plugin has to be told where. Without it every lint run printed
        // "Cannot resolve default tailwindcss config path" once per file and
        // sorted classes against stock Tailwind rather than ours. `cn` needs
        // no declaring here — v4 parses it by default.
        cssConfigPath: './styles/globals.css',
      },
      next: {
        rootDir: ['./'],
      },
    },
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'react/jsx-key': 'off',
      'tailwindcss/no-custom-classname': 'off',
      // Off because its autofix writes CSS that does not exist. MEASURED
      // 2026-08-31: it rewrote `scale-[1.03]` to `scale-1.03`, and Tailwind's
      // `scale-<number>` is a PERCENTAGE, so 1.03 is not a smaller number, it
      // is not a class at all — the utility compiled to nothing and the hover
      // zoom on every poster silently stopped. Same for `scale-y-[1.35]` and
      // `scale-[0.97]`. The rule's other rewrites (rem and px values that have
      // a spacing-scale equivalent) are correct and are already applied; what
      // it cannot be trusted with is a fractional value.
      'tailwindcss/no-unnecessary-arbitrary-value': 'off',
    },
  },
]

export default config
