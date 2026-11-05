// B6 · horas propuestas: tiempo de reloj por franjas de 5 min, repartido por peso, con evidencia.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montar, dia } from './ayuda.mjs'
import { actividad } from '../src/actividad.mjs'
import { proponerHoras, csv } from '../src/horas.mjs'
import { ventanaSemana } from '../src/tiempo.mjs'

const m = montar()
const semana = ventanaSemana('2026-03-04', Date.parse('2026-03-10T00:00:00Z'))
const act = actividad({ ...semana, config: m.config, raizSesiones: m.sesiones })
const filas = proponerHoras(act, { modo: 'reloj' })
const fila = (f, p) => filas.find(x => x.fecha === f && x.proyecto === p)

test('la semana va de lunes a domingo', () => {
  assert.equal(new Date(semana.desde).getDay(), 1)
  assert.equal(semana.hasta - semana.desde, 7 * 864e5)
})

test('lunes: carrito (14:00-14:31) y pago (15:00-15:55, con una suite de 40 min) suman 1,5 h en tienda, A', () => {
  // 7 franjas + 12 franjas = 95 min, redondeado a cuartos de hora.
  const t = fila('2026-03-02', 'tienda')
  assert.equal(t.horas, 1.5)
  assert.equal(t.confianza, 'A')
  assert.equal(t.commits, 2)
  assert.match(t.evidencia, /2 commits/)
})

test('modo persona (por defecto): el builder que corrió solo no suma horas tuyas', () => {
  const t = proponerHoras(act).find(x => x.fecha === '2026-03-02' && x.proyecto === 'tienda')
  assert.equal(Math.round(t.minutos), 35) // solo 14:00-14:31, cuando estabas en la sesión TIENDA
  assert.equal(t.confianza, 'A')
})

test('un hueco de más de 20 minutos corta el tramo', () => {
  const martes = filas.filter(x => x.fecha === '2026-03-03')
  const total = martes.reduce((a, x) => a + x.minutos, 0)
  // D: 16:00-16:20 (5 franjas), 17:00-17:05 (2) y 17:30 (1); C: 14:00-14:05 (2).
  // Ni 16:20-17:00 ni 17:05-17:30 cuentan: más de 20 minutos sin nada.
  assert.equal(Math.round(total), (5 + 2 + 1 + 2) * 5)
})

test('trabajo sin commit es B; solo lectura y sin proyecto se retienen (C)', () => {
  assert.equal(fila('2026-03-04', 'blog').confianza, 'B')
  // Menos de un cuarto de hora no se propone (el aviso de 5 minutos del miércoles).
  assert.equal(fila('2026-03-04', 'sin proyecto'), undefined)
  const t0 = Date.parse('2026-03-05T14:00:00Z')
  const sesion = { id: 'l', humano: true, marcas: Array.from({ length: 13 }, (_, i) => t0 + i * 300e3) }
  const h = proponerHoras({ proyectos: [{ nombre: 'leido', commits: [], sesiones: [{ sesion, parte: 1, escribio: false }] }], sinProyecto: [{ ...sesion, id: 'n' }] })
  assert.deepEqual(h.map(x => [x.proyecto, x.confianza]).sort(), [['leido', 'C'], ['sin proyecto', 'C']])
})

test('sesiones en paralelo no multiplican las horas', () => {
  const s = (id, a, b) => ({ id, marcas: Array.from({ length: (b - a) / 300e3 + 1 }, (_, i) => a + i * 300e3), humano: true })
  const t0 = Date.parse('2026-03-05T14:00:00Z')
  const sesiones = [s('x', t0, t0 + 3600e3), s('y', t0, t0 + 3600e3), s('z', t0, t0 + 3600e3)]
  const p = (nombre, ss) => ({ nombre, commits: [], sesiones: ss.map(sesion => ({ sesion, parte: 1, escribio: true })) })
  const h = proponerHoras({ proyectos: [p('uno', sesiones.slice(0, 2)), p('dos', sesiones.slice(2))], sinProyecto: [] })
  const total = h.reduce((a, x) => a + x.minutos, 0)
  assert.equal(Math.round(total), 65) // 13 franjas de reloj, no 39
  assert.ok(h.find(x => x.proyecto === 'uno').minutos > h.find(x => x.proyecto === 'dos').minutos)
})

test('CSV con encabezado y comillas donde hace falta', () => {
  const c = csv(filas).split('\n')
  assert.equal(c[0], 'fecha,dia,proyecto,horas,confianza,commits,sesiones,evidencia')
  assert.match(c[1], /^2026-03-02,lun,tienda,1\.50,A,2,2,/)
})
