// B2 · detector de proyecto por archivos tocados, no por cwd.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { montar, dia } from './ayuda.mjs'
import { actividad } from '../src/actividad.mjs'
import { crearDetector } from '../src/proyecto.mjs'

const m = montar()
const reparto = (d, id) => {
  const act = actividad({ ...dia(d), config: m.config, raizSesiones: m.sesiones })
  const s = act.sesiones.find(x => x.id.startsWith(id))
  return { act, s, escritos: [...s.reparto.values()].filter(r => r.escribio).map(r => r.proyecto.nombre).sort() }
}

test('una sesión desde la carpeta personal cae en el repo que tocó', () => {
  assert.deepEqual(reparto('2026-03-02', 'a1').escritos, ['tienda'])
})

test('un builder en un worktree cae en el repo principal', () => {
  assert.deepEqual(reparto('2026-03-02', 'b2').escritos, ['tienda'])
})

test('una sesión que solo leyó no tiene trabajo', () => {
  const { s, act } = reparto('2026-03-03', 'c3')
  assert.equal(s.escribio, false)
  assert.deepEqual([...s.reparto.keys()], ['blog'])
  assert.equal(act.proyectos.find(p => p.nombre === 'blog').sesiones.find(x => x.sesion === s).escribio, false)
})

test('una sesión multi-repo se reparte (y suma lo de su subagente)', () => {
  assert.deepEqual(reparto('2026-03-03', 'd4').escritos, ['blog', 'notas', 'tienda'])
})

test('una carpeta sin git con STATE.md es un proyecto', () => {
  const p = crearDetector({ ignorar: [] }).proyectoDe(join(m.notas, 'ideas.md'))
  assert.equal(p.tipo, 'carpeta')
  assert.equal(p.nombre, 'notas')
})

test('el mapa de la config manda, con prefijos para worktrees que ya no existen', () => {
  const det = crearDetector({ ignorar: [], proyectos: { Tienda: [m.tienda, join(m.raiz, 'wt-borrado-*')] } })
  assert.equal(det.proyectoDe(join(m.raiz, 'wt-borrado-123', 'x.js')).nombre, 'Tienda')
  assert.equal(det.proyectoDe(join(m.wt, 'src', 'pago.js')).nombre, 'Tienda')
  assert.equal(det.proyectoDe(join(m.raiz, 'wt-borrado-123', 'x.js')).raiz, det.proyectoDe(join(m.tienda, 'src')).raiz)
})

test('la memoria recuerda un worktree que se borró después', () => {
  const memoria = {}
  const wt = join(m.raiz, 'wt-efimero')
  spawnSync('git', ['-C', m.tienda, 'worktree', 'add', '-q', '-b', 'efimero', wt])
  crearDetector({ ignorar: [], memoria }).proyectoDe(join(wt, 'a.js'))
  spawnSync('git', ['-C', m.tienda, 'worktree', 'remove', '--force', wt])
  assert.equal(crearDetector({ ignorar: [] }).proyectoDe(join(wt, 'a.js')), null)
  assert.equal(crearDetector({ ignorar: [], memoria }).proyectoDe(join(wt, 'a.js')).nombre, 'tienda')
})

test('dos clones del mismo remoto son un solo proyecto', () => {
  const clones = ['uno', 'dos'].map(n => {
    const d = join(m.raiz, 'clones', n)
    mkdirSync(d, { recursive: true })
    spawnSync('git', ['init', '-q', d])
    spawnSync('git', ['-C', d, 'remote', 'add', 'origin', 'git@github.com:ana/tienda-web.git'])
    return d
  })
  const det = crearDetector({ ignorar: [] })
  const [a, b] = clones.map(c => det.proyectoDe(join(c, 'x')))
  assert.equal(a, b)
  assert.equal(a.nombre, 'tienda-web')
  assert.equal(a.raices.size, 2)
})

test('lo de node_modules es del proyecto que lo instaló, y las rutas ignoradas no cuentan', () => {
  const det = crearDetector({ ignorar: [join(m.raiz, 'blog')] })
  assert.equal(det.proyectoDe(join(m.tienda, 'node_modules', 'x', 'package.json')).nombre, 'tienda')
  assert.equal(det.proyectoDe(join(m.blog, 'README.md')), null)
})
