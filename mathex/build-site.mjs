// Empaqueta el juego en UN solo archivo HTML (dist-site/index.html), sin dependencias ni servidor.
import { stripTypeScriptTypes } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

const files = { app: 'site/app.js' }
for (const d of ['math', 'questions', 'game', 'services']) for (const f of readdirSync(`src/${d}`)) if (f.endsWith('.ts')) files[`${d}/${f.slice(0, -3)}`] = `src/${d}/${f}`
const resolve = (from, spec) => normalize(join(dirname(from), spec)).replace(/\.ts$/, '').replace(/\\/g, '/')
const defs = Object.entries(files).map(([key, path]) => {
  let code = readFileSync(path, 'utf8')
  if (path.endsWith('.ts')) code = stripTypeScriptTypes(code, { mode: 'strip' })
  code = code.replace(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'\s*;?/g, (_, names, spec) => {
    const n = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^(\S+)\s+as\s+(\S+)$/, '$1: $2'))
    return `const { ${n.join(', ')} } = __r('${key === 'app' ? resolve('app/x', spec).replace(/^app\//, '') : resolve(key, spec)}');`
  })
  const names = [...code.matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)].map((m) => m[1])
  code = code.replace(/^export\s+\{[^}]*\}\s*$/gm, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, '')
  return `__d('${key}', function(){\n${code}\nreturn { ${names.join(', ')} }\n});`
})
const runtime = `const __defs={},__cache={};function __d(k,f){__defs[k]=f}function __r(k){if(!__cache[k]){if(!__defs[k])throw new Error('Módulo no encontrado: '+k);__cache[k]=__defs[k]()}return __cache[k]}`
const bundle = `${runtime}\n${defs.join('\n')}\n__r('app')`
const html = `<!doctype html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#070a14"><title>MATHEX ARENA</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%94%3C/text%3E%3C/svg%3E">
<style>${readFileSync('site/style.css', 'utf8').replace(/@import\s+url\([^;]+\);?/g, '/* Fuentes del sistema: sin dependencias externas. */')}</style></head><body><div id="app"></div><script>\n${bundle}\n</script></body></html>`
mkdirSync('dist-site', { recursive: true })
writeFileSync('dist-site/index.html', html)
writeFileSync('dist-site/_bundle.js', bundle)
console.log('OK dist-site/index.html', Math.round(html.length / 1024) + ' KB')
