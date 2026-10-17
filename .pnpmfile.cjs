// The project compiles on TypeScript 7, which no longer ships the classic JS
// compiler API: `typescript`'s main export is a version string. typescript-
// eslint parses every .ts/.tsx through that API, even with no type-aware rule
// on, and refuses to load at all on 7 ("typescript-eslint does not support TS
// 7.0") — so on the project's TypeScript, `pnpm lint` reads nothing.
//
// Its packages take `typescript` as a PEER, which pnpm resolves from the
// project (7). Adding it as a dependency as well does not help: when a name is
// both, the peer wins (measured — packageExtensions left the variant pnpm
// actually used linked to 7.0.2). So the peer is turned into a dependency
// here, pinned to the last TypeScript the linter supports, and only for the
// linter's packages. Everything else — tsc, the editor, `next build` (via
// experimental.useTypeScriptCli) — runs on 7.
//
// ponytail: delete this file once typescript-eslint's peer range admits
// TypeScript 7; `pnpm lint` passing without it is the check.
const LINTER_TYPESCRIPT = '6.0.3'

const usesTypeScriptApi = (name) =>
  name.startsWith('@typescript-eslint/') ||
  name === 'typescript-eslint' ||
  name === 'ts-api-utils'

function readPackage(pkg) {
  if (usesTypeScriptApi(pkg.name) && pkg.peerDependencies?.typescript) {
    delete pkg.peerDependencies.typescript
    if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.typescript
    pkg.dependencies = { ...pkg.dependencies, typescript: LINTER_TYPESCRIPT }
  }
  return pkg
}

module.exports = { hooks: { readPackage } }
