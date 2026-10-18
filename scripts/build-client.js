import esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Production Bundler Pipeline for Client ES Modules
 * Compiles and minifies modular frontend scripts into a unified, high-performance production bundle.
 */
async function buildClient() {
  const root = process.cwd()
  const entry = path.resolve(root, 'public', 'static', 'js', 'main.js')
  const outDir = path.resolve(root, 'dist', 'client')
  const staticDir = path.resolve(root, 'public', 'static')

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const startTime = Date.now()

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: 'esm',
    target: ['es2022'],
    outfile: path.join(outDir, 'bundle.min.js'),
    metafile: true,
  })

  // Copy bundle and source map to public/static for direct runtime serving
  const bundleDest = path.join(staticDir, 'bundle.min.js')
  const mapDest = path.join(staticDir, 'bundle.min.js.map')

  fs.copyFileSync(path.join(outDir, 'bundle.min.js'), bundleDest)
  if (fs.existsSync(path.join(outDir, 'bundle.min.js.map'))) {
    fs.copyFileSync(path.join(outDir, 'bundle.min.js.map'), mapDest)
  }

  const stat = fs.statSync(bundleDest)
  const duration = Date.now() - startTime
  const kbSize = (stat.size / 1024).toFixed(2)

  console.log(`✓ Client production bundle generated in ${duration}ms:`)
  console.log(`  - File: public/static/bundle.min.js`)
  console.log(`  - Size: ${stat.size} bytes (${kbSize} KB)`)
  console.log(`  - HTTP Roundtrips reduced from ~16 requests to 1 bundled request.`)
}

buildClient().catch((err) => {
  console.error('Client bundling failed:', err)
  process.exit(1)
})
