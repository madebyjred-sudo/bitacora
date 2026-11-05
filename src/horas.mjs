// Horas propuestas por proyecto y día, con evidencia y confianza. Nunca se cargan solas.
//
// Tiempo de reloj, no suma de sesiones: el día se corta en franjas de 5 minutos; una franja cuenta si
// alguna sesión estuvo activa (sus marcas con huecos de hasta `hueco` minutos, o una herramienta
// corriendo). Cada franja se reparte
// entre los proyectos activos en ella según el peso de cada sesión. Diez builders en paralelo no
// multiplican tus horas.
//
// Confianza: A = hubo una persona en la sesión y hay commits; B = hay trabajo (commits o archivos
// escritos) pero sin persona o sin commit; C = solo lectura o sin proyecto: se retiene.
import { iso, diaSemana, hora } from './tiempo.mjs'

const FRANJA = 5 * 60e3

// Modo `persona` (por defecto): solo cuentan las franjas en que una sesión con persona estuvo activa;
// los builders que corren de noche solos no son horas tuyas. Modo `reloj`: toda la actividad.
export function proponerHoras(act, { hueco = 20, modo = 'persona' } = {}) {
  const franjas = new Map() // índice → Map(proyecto → peso)
  const conPersona = new Set()
  const sumarFranja = (k, nombre, peso) => {
    const f = franjas.get(k) || new Map()
    f.set(nombre, (f.get(nombre) || 0) + peso)
    franjas.set(k, f)
  }
  const tramos = (marcas, ocupado = []) => {
    const out = []
    const cubierto = (a, b) => ocupado.some(([x, y]) => x <= a && y >= b)
    for (const t of marcas) {
      const u = out.at(-1)
      if (u && (t - u[1] <= hueco * 60e3 || cubierto(u[1], t))) u[1] = t
      else out.push([t, t])
    }
    return out
  }
  const porSesion = new Map()
  for (const p of act.proyectos) for (const x of p.sesiones) {
    if (!porSesion.has(x.sesion)) porSesion.set(x.sesion, [])
    porSesion.get(x.sesion).push({ nombre: p.nombre, parte: x.parte })
  }
  for (const s of act.sinProyecto) porSesion.set(s, [{ nombre: null, parte: 1 }])
  for (const [s, partes] of porSesion) {
    for (const [a, b] of tramos(s.marcas, s.ocupado)) {
      for (let k = Math.floor(a / FRANJA); k <= Math.floor(b / FRANJA); k++) {
        for (const x of partes) sumarFranja(k, x.nombre, x.parte)
        if (s.humano) conPersona.add(k)
      }
    }
  }
  const filas = new Map() // `${dia}|${proyecto}` → fila
  for (const [k, f] of franjas) {
    if (modo === 'persona' && !conPersona.has(k)) continue
    const total = [...f.values()].reduce((a, b) => a + b, 0)
    const ts = k * FRANJA
    for (const [nombre, peso] of f) {
      const clave = `${iso(ts)}|${nombre ?? ''}`
      const fila = filas.get(clave) || { fecha: iso(ts), dia: diaSemana(ts), proyecto: nombre, minutos: 0, desde: ts, hasta: ts }
      fila.minutos += (5 * peso) / total
      fila.desde = Math.min(fila.desde, ts)
      fila.hasta = Math.max(fila.hasta, ts + FRANJA)
      filas.set(clave, fila)
    }
  }
  const proyectos = new Map(act.proyectos.map(p => [p.nombre, p]))
  return [...filas.values()]
    .map(f => {
      const p = proyectos.get(f.proyecto)
      const delDia = x => iso(x) === f.fecha
      const commits = p ? p.commits.filter(c => delDia(c.ts)) : []
      const sesiones = p ? p.sesiones.filter(x => x.sesion.marcas.some(delDia)) : act.sinProyecto.filter(s => s.marcas.some(delDia)).map(sesion => ({ sesion }))
      const escribio = sesiones.some(x => x.escribio)
      const humano = sesiones.some(x => x.sesion.humano && x.escribio)
      const confianza = !p || (!escribio && !commits.length) ? 'C' : humano && commits.length ? 'A' : 'B'
      const evidencia = [
        commits.length ? `${commits.length} commit${commits.length > 1 ? 's' : ''} (${commits.slice(0, 3).map(c => c.corto).join(' ')}${commits.length > 3 ? ' …' : ''})` : null,
        `${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'}`,
        humano ? 'contigo' : null,
        `${hora(f.desde)}-${hora(f.hasta)}`,
      ].filter(Boolean).join(' · ')
      return { ...f, horas: Math.round((f.minutos / 60) * 4) / 4, proyecto: f.proyecto || 'sin proyecto', confianza, commits: commits.length, sesiones: sesiones.length, evidencia }
    })
    .filter(f => f.horas > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || b.horas - a.horas)
}

const celda = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

export function csv(filas) {
  const cab = ['fecha', 'dia', 'proyecto', 'horas', 'confianza', 'commits', 'sesiones', 'evidencia']
  return [cab.join(','), ...filas.map(f => cab.map(c => celda(c === 'horas' ? f.horas.toFixed(2) : f[c])).join(','))].join('\n') + '\n'
}
