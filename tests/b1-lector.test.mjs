// B1 · lector de Claude Code + git sobre tres días de fixtures.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montar, dia } from './ayuda.mjs'
import { leerSesiones, textoHumano, rutasDeComando } from '../src/fuentes/claude-code.mjs'
import { commits, repoDe } from '../src/fuentes/git.mjs'
import { realpathSync } from 'node:fs'

const m = montar()
const ids = ss => ss.map(s => s.id.slice(0, 8)).sort()

// Lo mismo que da actividad-dia.py (sesiones con un mensaje de persona), día por día.
test('sesiones por día: las mismas que el filtro clásico de mensajes humanos', () => {
  const esperado = {
    '2026-03-02': { todas: ['a1111111', 'b2222222'], humanas: ['a1111111'] },
    '2026-03-03': { todas: ['c3333333', 'd4444444'], humanas: ['c3333333', 'd4444444'] },
    '2026-03-04': { todas: ['e5555555', 'g7777777'], humanas: ['e5555555'] },
  }
  for (const [d, e] of Object.entries(esperado)) {
    assert.deepEqual(ids(leerSesiones({ raiz: m.sesiones, ...dia(d) })), e.todas, d)
    assert.deepEqual(ids(leerSesiones({ raiz: m.sesiones, ...dia(d), soloHumanas: true })), e.humanas, d)
  }
})

test('el texto humano no trae los bloques del arnés ni las líneas laterales', () => {
  const [a] = leerSesiones({ raiz: m.sesiones, ...dia('2026-03-02') })
  const humanos = a.eventos.filter(e => e.quien === 'humano').map(e => e.texto)
  assert.deepEqual(humanos, ['El carrito suma mal los descuentos. Arréglalo y haz commit.'])
  assert.equal(a.titulo, 'TIENDA')
  assert.equal(textoHumano([{ type: 'text', text: '<system-reminder>x</system-reminder>' }]), '')
})

test('un builder sin persona trae su encargo y escribe por su cwd', () => {
  const b = leerSesiones({ raiz: m.sesiones, ...dia('2026-03-02') }).find(s => s.id.startsWith('b2'))
  assert.equal(b.humano, false)
  assert.equal(b.eventos[0].quien, 'encargo')
  assert.ok(b.escribio)
  assert.ok(b.comandos.some(c => c.escribe && c.cwd.endsWith('wt-tienda-pago')))
})

test('los subagentes suman sus archivos a la sesión que los lanzó', () => {
  const d = leerSesiones({ raiz: m.sesiones, ...dia('2026-03-03') }).find(s => s.id.startsWith('d4'))
  assert.ok(d.toques.some(t => t.ruta.endsWith('tienda/src/envio.js') && t.modo === 'escribe'))
})

test('rutas de un comando: cd, git -C y rutas absolutas', () => {
  const r = rutasDeComando('cd ~/x && git -C "/Volumes/Disco/repo" log; cat /Users/ana/y.txt', '/tmp')
  assert.ok(r.some(x => x.ruta.endsWith('/x') && x.fuerte))
  assert.ok(r.some(x => x.ruta === '/Volumes/Disco/repo' && x.fuerte))
  assert.ok(r.some(x => x.ruta === '/Users/ana/y.txt' && !x.fuerte))
})

test('git: commits en la ventana, de ramas locales y worktrees, filtrados por autor', () => {
  const d1 = commits(m.tienda, { ...dia('2026-03-02'), autores: ['yo@ejemplo.com'] }).map(c => c.asunto)
  assert.deepEqual(d1, ['Carrito suma bien los descuentos', 'Pago con tarjeta'])
  const d2 = commits(m.blog, { ...dia('2026-03-03'), autores: ['yo@ejemplo.com'] }).map(c => c.asunto)
  assert.deepEqual(d2, ['Post hola'])
  assert.equal(commits(m.blog, { ...dia('2026-03-03') }).length, 2)
})

test('un worktree cuenta como su repo principal', () => {
  assert.equal(repoDe(m.wt + '/src/pago.js').raiz, realpathSync(m.tienda))
})

// Contrato del formato: si Claude Code cambia estos campos, esto falla antes que el resto.
test('contrato del jsonl: campos de los que depende el lector', () => {
  const a = leerSesiones({ raiz: m.sesiones, ...dia('2026-03-02') })[0]
  assert.ok(a.inicio && a.fin > a.inicio)
  assert.ok(Object.keys(a.cwds).length)
  assert.ok(a.toques.find(t => t.herramienta === 'Edit'))
})
