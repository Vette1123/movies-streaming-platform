import nextConfig from 'eslint-config-next/core-web-vitals'
import prettierConfig from 'eslint-config-prettier/flat'
import tailwindPlugin from 'eslint-plugin-tailwindcss'

export default [
  {
    ignores: ['dist/**', '.cache/**', 'public/**', 'node_modules/**', '**/*.esm.js'],
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
