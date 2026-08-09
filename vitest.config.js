import path from 'path'
import { loadEnv } from 'payload/node'
import { fileURLToPath } from 'url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default defineConfig(() => {
  loadEnv(path.resolve(dirname, './dev'))

  return {
    plugins: [
      tsconfigPaths({
        ignoreConfigErrors: true,
      }),
    ],
    test: {
      env: {
        // A scratch database for the suite, so tests never read or corrupt
        // dev.db from a running dev server. int.spec.ts deletes this file
        // before booting Payload. An explicit DATABASE_URI still wins.
        DATABASE_URI: process.env.DATABASE_URI || 'file:./dev/int-test.db',
      },
      environment: 'node',
      hookTimeout: 30_000,
      // dev/e2e.spec.ts is a Playwright test; vitest's default glob would
      // collect it and fail on Playwright's test() being called outside its
      // own runner.
      include: ['dev/int.spec.ts'],
      testTimeout: 30_000,
    },
  }
})
