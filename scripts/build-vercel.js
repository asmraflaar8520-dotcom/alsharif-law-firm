import esbuild from 'esbuild'

esbuild.buildSync({
  entryPoints: ['api/entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/index.js',
  banner: {
    js: `import { createRequire } from 'module'; globalThis.require = createRequire(import.meta.url); const require = globalThis.require;`
  },
  external: ['node:sqlite']
})

console.log('Successfully bundled api/index.js')
