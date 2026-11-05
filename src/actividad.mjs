// Junta las fuentes de una ventana en proyectos: sesiones repartidas + commits de cada repo.
import { leerSesiones } from './fuentes/claude-code.mjs'
import { commits, correoDe } from './fuentes/git.mjs'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { crearDetector, repartir } from './proyecto.mjs'

function leerMemoria(archivo) {
  try {
    return archivo && existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {}
  } catch {
    return {}
  }
}

// `memoria`: archivo donde se recuerdan los worktrees vistos (ver proyecto.mjs).
export function actividad({ desde, hasta, config = {}, raizSesiones, detector, memoria }) {
  const antes = leerMemoria(memoria)
  detector ||= crearDetector({ ...config, memoria: { ...antes } })
  const sesiones = leerSesiones({ raiz: raizSesiones, desde, hasta })
  const proyectos = new Map()
  const sinProyecto = []
  const tomar = p => {
    if (!proyectos.has(p.nombre)) {
      proyectos.set(p.nombre, { ...p, sesiones: [], commits: [], archivos: new Set(), humano: false })
    }
    return proyectos.get(p.nombre)
  }
  for (const s of sesiones) {
    s.reparto = repartir(s, detector)
    const total = [...s.reparto.values()].reduce((a, r) => a + r.peso, 0)
    if (!s.reparto.size) {
      sinProyecto.push(s)
      continue
    }
    for (const r of s.reparto.values()) {
      const p = tomar(r.proyecto)
      p.sesiones.push({ sesion: s, parte: r.peso / total, escribio: r.escribio, archivos: r.archivos })
      for (const a of r.archivos) p.archivos.add(a)
      if (s.humano && r.escribio) p.humano = true
    }
  }
  const extra = config.repos || []
  for (const ruta of extra) {
    const p = detector.proyectoDe(ruta)
    if (p) tomar(p)
  }
  const autoresBase = (config.autores || []).map(x => x.toLowerCase())
  for (const p of proyectos.values()) {
    const vistos = new Set()
    for (const raiz of p.raices) {
      const propio = correoDe(raiz)
      const autores = config.todosLosAutores ? [] : [...new Set([...autoresBase, propio].filter(Boolean))]
      for (const c of commits(raiz, { desde, hasta, autores })) {
        if (vistos.has(c.hash)) continue
        vistos.add(c.hash)
        p.commits.push({ ...c, raiz })
      }
    }
    p.commits.sort((a, b) => a.ts - b.ts)
  }
  for (const p of proyectos.values()) {
    p.trabajo = p.commits.length > 0 || p.sesiones.some(x => x.escribio)
  }
  if (memoria && JSON.stringify(detector.memoria) !== JSON.stringify(antes)) {
    mkdirSync(dirname(memoria), { recursive: true })
    writeFileSync(memoria, JSON.stringify(detector.memoria, null, 1))
  }
  const lista = [...proyectos.values()].sort((a, b) => b.commits.length - a.commits.length || b.sesiones.length - a.sesiones.length)
  return { sesiones, proyectos: lista, sinProyecto, desde, hasta }
}
