#!/usr/bin/env node
// Writes the push service worker shipped in the package as plain JS files,
// from the `serviceWorkerCode` string exported by `/client`, so the two can
// never drift apart:
//
// - dist/sw.js                   the documented file, exported as
//                                `@xtr-dev/payload-notifications/sw.js`
// - dist/client/service-worker.js the path where earlier releases emitted a
//                                compiled TypeScript worker ending in
//                                `export {}`; hosts that copy it from there
//                                now get the same classic worker.
//
// Runs after build:swc, because it imports the compiled client entry.
// Fails the build if the code is not valid as a classic (non-module) script,
// which is what `navigator.serviceWorker.register('/sw.js')` requires.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))
const { serviceWorkerCode } = await import(new URL('../dist/exports/client.js', import.meta.url).href)

if (typeof serviceWorkerCode !== 'string' || serviceWorkerCode.trim() === '') {
  throw new Error('dist/exports/client.js does not export a serviceWorkerCode string')
}

// Throws a SyntaxError for `import`/`export` or TypeScript syntax.
new Script(serviceWorkerCode, { filename: 'sw.js' })

const contents = `${serviceWorkerCode.trim()}\n`
for (const relativePath of ['sw.js', 'client/service-worker.js']) {
  const target = join(distDir, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
  console.log(`Wrote classic service worker to dist/${relativePath}`)
}
