import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Counts every file under dir. Accepts a path or a file: URL — path.join
// throws on a URL, which once failed the deploy after a green build.
export function countFiles(dir) {
  const root = dir instanceof URL ? fileURLToPath(dir) : dir
  let files = 0
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(d, entry.name))
      else files++
    }
  }
  walk(root)
  return files
}
