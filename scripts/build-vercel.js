import esbuild from 'esbuild'

esbuild.buildSync({
  entryPoints: ['api/entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/index.js',
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`
  },
  external: ['node:sqlite']
})

console.log('Successfully bundled api/index.js')
