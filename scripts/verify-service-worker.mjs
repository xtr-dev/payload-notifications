#!/usr/bin/env node
// Fails when the built package is missing its service worker, or when that
// worker would not load as a classic (non-module) script — the form
// `navigator.serviceWorker.register('/sw.js')` requires. Run after `pnpm build`
// as part of `test:published-exports`, so CI catches a build that stopped
// emitting dist/sw.js even if build:sw itself was skipped or removed.
import { existsSync, readFileSync } from 'node:fs'
import { Script } from 'node:vm'

for (const relativePath of ['dist/sw.js', 'dist/client/service-worker.js']) {
  const file = new URL(`../${relativePath}`, import.meta.url)
  if (!existsSync(file)) {
    throw new Error(`${relativePath} is missing - run pnpm build (build:sw writes it)`)
  }
  const code = readFileSync(file, 'utf8')
  // Throws a SyntaxError for import/export statements or TypeScript syntax.
  new Script(code, { filename: relativePath })
  if (!code.includes("self.addEventListener('push'")) {
    throw new Error(`${relativePath} does not register a push event listener`)
  }
}
console.log('dist/sw.js and dist/client/service-worker.js are classic service worker scripts.')
