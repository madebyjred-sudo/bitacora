// El CLI de punta a punta sobre los fixtures.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { montar, cli } from './ayuda.mjs'

const m = montar()

test('hoy: el día por proyecto, con commits y lo que quedó solo leído', () => {
  const r = cli(m, ['hoy', '--dia', '2026-03-03'])
  assert.equal(r.codigo, 0, r.error)
  assert.match(r.salida, /^mar 3 mar · 2 sesiones\n/)
  assert.match(r.salida, /blog · 1 commit · 1 sesión/)
  assert.match(r.salida, /Post hola/)
  assert.doesNotMatch(r.salida, /Arreglo de otra persona/)
  assert.match(r.salida, /notas · 1 sesión/)
})

test('escribir --sin-modelo deja un avance con fuentes, y la segunda vez solo agrega lo nuevo', () => {
  const carpeta = join(m.raiz, 'avances')
  const r = cli(m, ['escribir', '--dia', '2026-03-02', '--sin-modelo', '--carpeta', carpeta])
  assert.equal(r.codigo, 0, r.error)
  const t = readFileSync(join(carpeta, 'tienda', '2026-03-02.md'), 'utf8')
  assert.match(t, /^# tienda · 2 mar 2026 · Pago con tarjeta\n/)
  assert.match(t, /- Carrito suma bien los descuentos \[commit [0-9a-f]{7}\]/)
  assert.match(t, /## Fuentes\n- Sesiones de Claude Code: TIENDA \(a1111111\), b2222222 \(b2222222\)/)
  const r2 = cli(m, ['escribir', '--dia', '2026-03-02', '--sin-modelo', '--carpeta', carpeta])
  assert.match(r2.salida, /tienda · sin novedades/)
})

test('escribir con un modelo que responde [SILENT] y hay commits: usa el avance sin modelo', () => {
  const resp = join(m.raiz, 'silencio.md')
  writeFileSync(resp, '[SILENT]')
  writeFileSync(m.archivoConfig, JSON.stringify({ ...m.config, modelo: { via: 'archivo', nombre: resp } }))
  const r = cli(m, ['escribir', '--dia', '2026-03-03', '--proyecto', 'blog', '--ensayo'])
  assert.match(r.salida, /- Post hola \[commit/)
  writeFileSync(m.archivoConfig, JSON.stringify(m.config))
})

test('horas --semana: CSV propuesto, sin cargar nada', () => {
  const r = cli(m, ['horas', '--semana', '2026-03-04'])
  assert.equal(r.codigo, 0, r.error)
  const filas = r.salida.trim().split('\n')
  assert.equal(filas[0], 'fecha,dia,proyecto,horas,confianza,commits,sesiones,evidencia')
  assert.ok(filas.some(f => f.startsWith('2026-03-02,lun,tienda,0.50,A')), r.salida)
})

test('retomar: dónde quedó y qué falta', () => {
  const carpeta = join(m.raiz, 'avances-r')
  cli(m, ['escribir', '--dia', '2026-03-04', '--sin-modelo', '--carpeta', carpeta])
  const r = cli(m, ['retomar', 'blog', '--carpeta', carpeta, '--dia', '2026-03-05'])
  assert.equal(r.codigo, 0, r.error)
  assert.match(r.salida, /Último avance · 2026-03-04/)
  assert.match(r.salida, /Riesgo para revisar primero\n- 1 archivo escrito hoy sin commit: config.js/)
  assert.match(r.salida, /Sin commit en .*blog · 1 archivo/)
  assert.match(cli(m, ['retomar', 'nada', '--dia', '2026-03-05']).error, /No vi «nada»/)
})

test('comando desconocido: ayuda y código 1', () => {
  const r = cli(m, ['volar'])
  assert.equal(r.codigo, 1)
  assert.match(r.salida, /bitacora hoy/)
})
