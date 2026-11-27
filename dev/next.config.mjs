import { withPayload } from '@payloadcms/next/withPayload'
import { fileURLToPath } from 'url'
import path from 'path'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 otherwise writes an AGENTS.md into dev/ on every `next dev` start.
  agentRules: false,
  // The extensionAlias below is what resolves the plugin source's `./x.js`
  // import specifiers to their `.ts` files. Turbopack has no equivalent, so
  // the `dev` script runs Next with `--webpack`.
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  serverExternalPackages: ['mongodb-memory-server'],
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
