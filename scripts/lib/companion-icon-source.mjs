import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Where an app's launcher icon lives under the React Native folder. Most Expo
 * projects sit at `<slug>/`; Masareef is a monorepo and its app sits at
 * `masareef/masareef-app/`, so the first guess alone threw for it and
 * `pnpm apps:icons` never finished. Returns the first layout that exists, or
 * null with every path tried so the caller can say where it looked.
 */
export function findIconSource(root, slug, exists = existsSync) {
  const tried = [
    join(root, slug, 'assets', 'images', 'icon.png'),
    join(root, slug, `${slug}-app`, 'assets', 'images', 'icon.png'),
  ]
  return { src: tried.find((p) => exists(p)) ?? null, tried }
}
