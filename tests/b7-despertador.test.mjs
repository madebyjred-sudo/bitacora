// B7 · el despertador y el programador: sin sesiones no se gasta modelo; sin cambios tampoco.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { montar, cli } from './ayuda.mjs'
import { despertador, conTecho, esSilencio, huellaDe } from '../src/despertador.mjs'
import { plist, lineaCron, instalar } from '../src/programar.mjs'

test('despertador: cambio, guardar y silencio', () => {
  const d = despertador({ nombre: 'x', carpeta: mkdtempSync(join(tmpdir(), 'desp-')) })
  assert.equal(d.cambio({ a: 1 }), true)
  d.guardar({ a: 1 })
  assert.equal(d.cambio({ a: 1 }), false)
  assert.equal(d.cambio({ a: 2 }), true)
  assert.equal(huellaDe('x'), huellaDe('x'))
  assert.ok(esSilencio(' [SILENT]\n'))
  assert.ok(!esSilencio('[SILENT] pero algo más'))
})

test('despertador: un candado de un proceso muerto se recupera; uno vivo salta', async () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'desp-'))
  const d = despertador({ nombre: 'y', carpeta })
  mkdirSync(join(d.dir, 'candado'))
  writeFileSync(join(d.dir, 'candado', 'pid'), '999999')
  assert.equal(await d.conCandado(async () => 'corrió'), 'corrió')
  const r = await d.conCandado(() => d.conCandado(async () => 'no debería'))
  assert.deepEqual(r, { saltada: true })
})

test('techo de tiempo', async () => {
  await assert.rejects(conTecho(new Promise(r => setTimeout(r, 200)), 20), /techo/)
  assert.equal(await conTecho(Promise.resolve(3), 50), 3)
})

test('programado sin sesiones: no llama al modelo', () => {
  const m = montar()
  const vacia = join(m.raiz, 'vacia', '-x')
  mkdirSync(vacia, { recursive: true })
  // El modelo apunta a un archivo que no existe: si se llamara, fallaría.
  writeFileSync(m.archivoConfig, JSON.stringify({ ...m.config, modelo: { via: 'archivo', nombre: join(m.raiz, 'no-existe') } }))
  const r = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'bin', 'bitacora.mjs'), 'escribir', '--programado', '--config', m.archivoConfig, '--sesiones', join(m.raiz, 'vacia')], {
    encoding: 'utf8', env: { ...process.env, BITACORA_ESTADO_DIR: m.estado },
  })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Sin sesiones en la ventana\. No gasté modelo\./)
  assert.match(readFileSync(join(m.estado, 'escribir', 'corridas.log'), 'utf8'), /sin sesiones: no gasté modelo/)
})

test('programado con sesiones: la segunda corrida sin cambios no gasta modelo', () => {
  const m = montar()
  const args = ['escribir', '--programado', '--dia', '2026-03-02', '--sin-modelo', '--carpeta', join(m.raiz, 'avances')]
  const r1 = cli(m, args)
  assert.equal(r1.codigo, 0, r1.error)
  assert.match(r1.salida, /OK tienda · markdown creado/)
  const r2 = cli(m, args)
  assert.match(r2.salida, /Sin cambios desde la última corrida\. No gasté modelo\./)
  assert.ok(existsSync(join(m.raiz, 'avances', 'tienda', '2026-03-02.md')))
})

test('plist de launchd, válido para plutil', () => {
  const x = plist({ hora: 21, minuto: 5, argumentos: ['/usr/bin/node', '/ruta con espacio/bitacora.mjs', 'escribir', '--programado'], log: '/tmp/b.log', path: '/usr/bin' })
  assert.match(x, /<integer>21<\/integer><key>Minute<\/key><integer>5<\/integer>/)
  if (process.platform === 'darwin') {
    const f = join(mkdtempSync(join(tmpdir(), 'pl-')), 'x.plist')
    writeFileSync(f, x)
    assert.equal(spawnSync('plutil', ['-lint', f]).status, 0)
  }
})

test('línea de cron y hora inválida', () => {
  assert.equal(lineaCron({ hora: 21, minuto: 0, argumentos: ['/usr/bin/node', '/a b/c.mjs', 'escribir'], log: '/l.log' }), "0 21 * * * /usr/bin/node '/a b/c.mjs' escribir >> /l.log 2>&1 # com.bitacora.escribir")
  assert.throws(() => instalar({ a: '25:00', cli: 'x', ensayo: true }), /Hora inválida/)
})
