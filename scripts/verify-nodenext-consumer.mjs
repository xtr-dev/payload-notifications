#!/usr/bin/env node
// Type-checks the PACKED package's emitted .d.ts files as a NodeNext
// consumer would resolve them. `test:published-exports` only proves the
// emitted .js resolves under native ESM (`node --input-type=module`), which
// never reads .d.ts at all; tsc under the repo's own moduleResolution:"node"
// (tsconfig.json, used by `build:types`) accepts extensionless specifiers
// that a NodeNext/node16 consumer's resolver rejects. This script closes
// that gap by installing the tarball `pnpm pack` would publish into a
// scratch project and compiling a consumer of every documented subpath
// under module/moduleResolution: "nodenext".
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), 'payload-notifications-nodenext-'))

try {
  execFileSync('pnpm', ['pack', '--pack-destination', scratch], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const tarballName = readdirSync(scratch).find((name) => name.endsWith('.tgz'))
  if (!tarballName) {
    throw new Error('pnpm pack did not produce a .tgz in the scratch directory')
  }

  const consumer = join(scratch, 'consumer')
  const pkgDir = join(consumer, 'node_modules', '@xtr-dev', 'payload-notifications')
  mkdirSync(pkgDir, { recursive: true })
  execFileSync('tar', ['-xf', join(scratch, tarballName), '-C', pkgDir, '--strip-components=1'])

  // The public declaration graph only names types from these two peers
  // (CollectionConfig/Field/Config/Payload/PayloadRequest/Endpoint from
  // `payload`, RequestOptions from `web-push`). Stubbing just those symbols
  // isolates the check to this package's own emitted specifiers instead of
  // tripping over unrelated strictness issues inside payload's own types.
  writeStub(join(consumer, 'node_modules', 'payload'), {
    'package.json': JSON.stringify({ name: 'payload', version: '0.0.0', types: 'index.d.ts' }),
    'index.d.ts': [
      'export interface CollectionConfig { [key: string]: any }',
      'export interface Field { [key: string]: any }',
      'export interface Config { [key: string]: any }',
      'export interface Payload { [key: string]: any }',
      'export interface PayloadRequest { [key: string]: any }',
      'export interface Endpoint { [key: string]: any }',
      '',
    ].join('\n'),
  })

  // Mirrors @types/web-push's shape: plain named exports with no explicit
  // default. `src/utils/webPush.ts` does `import webpush from 'web-push'`
  // and then references `webpush.RequestOptions`/`webpush.SendResult` as
  // types — that only resolves under esModuleInterop's synthetic default,
  // which requires the module to have no real default export, same as here.
  writeStub(join(consumer, 'node_modules', 'web-push'), {
    'package.json': JSON.stringify({ name: 'web-push', version: '0.0.0', types: 'index.d.ts' }),
    'index.d.ts': [
      'export interface RequestOptions { [key: string]: any }',
      'export interface SendResult { [key: string]: any }',
      'export function sendNotification(...args: any[]): Promise<SendResult>',
      '',
    ].join('\n'),
  })

  // The emitted declarations reference the ambient `Buffer` global, which
  // only exists with @types/node in scope — copy the repo's own copy so the
  // scratch consumer resolves it exactly as a real consumer project would.
  cpSync(
    join(repoRoot, 'node_modules', '@types', 'node'),
    join(consumer, 'node_modules', '@types', 'node'),
    { recursive: true },
  )

  writeStub(consumer, {
    'package.json': JSON.stringify({ name: 'nodenext-consumer', version: '0.0.0', private: true, type: 'module' }),
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        module: 'nodenext',
        moduleResolution: 'nodenext',
        target: 'ES2022',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: false,
        noEmit: true,
        types: ['node'],
      },
      include: ['consumer.ts'],
    }),
    // Exercises every value and type export from every documented subpath
    // (README.md / WEBPUSH.md name '.', './client', './rsc') so a missing
    // export map entry or a broken specifier in any of the three fails here.
    'consumer.ts': [
      "import notificationsPlugin, { notificationsPlugin as named } from '@xtr-dev/payload-notifications'",
      "import type { NotificationsPluginOptions, NotificationChannel, WebPushConfig } from '@xtr-dev/payload-notifications'",
      "import { ClientPushManager, serviceWorkerCode, usePushNotifications } from '@xtr-dev/payload-notifications/client'",
      "import type { PushSubscriptionData } from '@xtr-dev/payload-notifications/client'",
      "import { WebPushManager, createPushNotificationEndpoints, createPushSubscriptionsCollection } from '@xtr-dev/payload-notifications/rsc'",
      "import type { PushSubscription } from '@xtr-dev/payload-notifications/rsc'",
      '',
      "const options: NotificationsPluginOptions = { channels: [{ id: 'default', name: 'Default' }] }",
      'notificationsPlugin(options)',
      'named(options)',
      'void serviceWorkerCode',
      'void usePushNotifications',
      "new ClientPushManager('key')",
      'void (undefined as unknown as PushSubscriptionData)',
      'void WebPushManager',
      'void createPushNotificationEndpoints',
      'void createPushSubscriptionsCollection',
      'void (undefined as unknown as PushSubscription)',
      'void (undefined as unknown as NotificationChannel)',
      'void (undefined as unknown as WebPushConfig)',
      '',
    ].join('\n'),
  })

  execFileSync(join(repoRoot, 'node_modules', '.bin', 'tsc'), ['--noEmit', '-p', join(consumer, 'tsconfig.json')], {
    cwd: consumer,
    stdio: 'inherit',
  })

  console.log('NodeNext consumer type-check passed against the packed declaration graph.')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

function writeStub(dir, files) {
  mkdirSync(dir, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
  }
}
