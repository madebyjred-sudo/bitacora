// A qué proyecto va cada cosa: por los archivos que la sesión tocó, no por su cwd.
// Orden: mapa de la config → rutas ignoradas → repo git (un worktree cuenta como su repo) →
// carpeta con un marcador de proyecto. Lo demás queda sin proyecto.
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { repoDe } from './fuentes/git.mjs'

const CASA = homedir()
export const IGNORAR = ['~/.claude', '~/Library', '~/.cache', '~/.npm', '~/.Trash', '/tmp', '/private/tmp', '/private/var/folders', tmpdir(),
  '/opt/homebrew', '/usr', '/Library', '/System', '/Applications', '/etc']
const MARCADORES = ['STATE.md', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'deno.json', 'composer.json', 'Gemfile']

const PESO = { escribe: 5, cd: 2, menciona: 1, lee: 1 }

const expandir = p => (p === '~' || p.startsWith('~/') ? join(CASA, p.slice(1)) : p)
const real = p => {
  try {
    return realpathSync(p)
  } catch {
    let d = p
    const resto = []
    while (d && !existsSync(d)) {
      resto.unshift(basename(d))
      if (dirname(d) === d) return p
      d = dirname(d)
    }
    try {
      return join(realpathSync(d), ...resto)
    } catch {
      return p
    }
  }
}
const bajo = (ruta, base) => ruta === base || ruta.startsWith(base.endsWith('/') ? base : base + '/')

// `memoria`: worktree → repo visto en corridas anteriores. Los builders borran su worktree al
// terminar; sin esto, sus sesiones de ayer ya no tendrían a dónde ir.
export function crearDetector({ proyectos = {}, ignorar = IGNORAR, memoria = {} } = {}) {
  // Una ruta que termina en * es un prefijo de nombre: ~/wt/tienda-* toma ~/wt/tienda-pago y ~/wt/tienda-ui.
  const mapa = Object.entries(proyectos)
    .flatMap(([nombre, rutas]) => [].concat(rutas).flatMap(r => {
      const prefijo = r.endsWith('*')
      const base = expandir(prefijo ? r.slice(0, -1) : r)
      return [base, prefijo ? base : real(base)].map(b => ({ nombre, base: b, prefijo }))
    }))
    .sort((a, b) => b.base.length - a.base.length)
  const ignoradas = [...new Set(ignorar.flatMap(r => [expandir(r), real(expandir(r))]))]
  const memo = new Map()

  const porOrigen = new Map()
  const mapeados = new Map()
  // Un proyecto del mapa: su raíz es la primera de sus rutas que sea un repo.
  function delMapa(nombre) {
    if (mapeados.has(nombre)) return mapeados.get(nombre)
    const bases = mapa.filter(x => x.nombre === nombre && !x.prefijo).map(x => x.base)
    const repos = [...new Set(bases.map(b => repoDe(b)?.raiz).filter(Boolean))]
    const raiz = repos[0] || bases.find(b => existsSync(b)) || bases[0] || null
    const p = { nombre, raiz, raices: new Set(repos), tipo: repos.length ? 'repo' : 'carpeta' }
    mapeados.set(nombre, p)
    return p
  }
  function proyectoDe(ruta) {
    // Lo que está dentro de node_modules es del proyecto que lo instaló.
    ruta = ruta.replace(/\/node_modules\/.*$/, '')
    if (memo.has(ruta)) return memo.get(ruta)
    const r = real(ruta)
    let p = null
    const m = mapa.find(x => (x.prefijo ? ruta.startsWith(x.base) || r.startsWith(x.base) : bajo(ruta, x.base) || bajo(r, x.base)))
    if (m) p = delMapa(m.nombre)
    else if (ignoradas.some(b => bajo(ruta, b) || bajo(r, b))) p = null
    else {
      let repo = repoDe(r)
      if (repo && repo.worktree !== repo.raiz) memoria[repo.worktree] = repo.raiz
      if (!repo) {
        const wt = Object.keys(memoria).find(w => bajo(r, w) || bajo(ruta, w))
        if (wt && existsSync(memoria[wt])) repo = { raiz: memoria[wt], worktree: wt }
      }
      if (repo && repo.raiz !== CASA && repo.raiz !== '/') {
        // Dos clones del mismo remoto son el mismo proyecto.
        const origen = origenDe(repo.raiz)
        const previo = origen && porOrigen.get(origen)
        const alias = mapa.find(x => !x.prefijo && bajo(repo.raiz, x.base))
        if (alias) {
          p = delMapa(alias.nombre)
          p.raices.add(repo.raiz)
        } else if (previo) {
          previo.raices.add(repo.raiz)
          p = previo
        } else {
          const nombre = origen ? basename(origen).replace(/\.git$/, '') : basename(repo.raiz)
          p = { nombre, raiz: repo.raiz, raices: new Set([repo.raiz]), origen, tipo: 'repo' }
          if (origen) porOrigen.set(origen, p)
        }
      } else p = carpeta(r)
    }
    memo.set(ruta, p)
    return p
  }
  return { proyectoDe, memoria }
}

// URL del remoto origin, leída del config de git (sin lanzar procesos).
function origenDe(raiz) {
  try {
    const cfg = readFileSync(join(raiz, '.git', 'config'), 'utf8')
    const m = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(cfg)
    return m ? m[1].replace(/^git@([^:]+):/, 'https://$1/').replace(/\/$/, '') : null
  } catch {
    return null
  }
}

function carpeta(ruta) {
  let d = existsSync(ruta) ? ruta : dirname(ruta)
  while (d && d !== CASA && dirname(d) !== d) {
    if (existsSync(d) && MARCADORES.some(m => existsSync(join(d, m)))) return { nombre: basename(d), raiz: d, raices: new Set(), tipo: 'carpeta' }
    d = dirname(d)
  }
  return null
}

// Reparto de una sesión entre proyectos: { nombre → { proyecto, peso, escribio, archivos } }.
export function repartir(sesion, detector) {
  const reparto = new Map()
  const sumar = (p, peso, escribe, ruta) => {
    if (!p) return
    const r = reparto.get(p.nombre) || { proyecto: p, peso: 0, escribio: false, archivos: new Set() }
    r.peso += peso
    if (escribe) {
      r.escribio = true
      if (ruta) r.archivos.add(real(ruta))
    }
    reparto.set(p.nombre, r)
  }
  for (const t of sesion.toques) {
    const p = detector.proyectoDe(t.ruta)
    const escribe = t.modo === 'escribe' || (t.escribe && t.modo === 'cd')
    sumar(p, PESO[t.modo] * (t.escribe ? 2 : 1), escribe, t.modo === 'escribe' ? t.ruta : null)
  }
  // `git commit` sin cd: escribe en el proyecto de su cwd (un builder dentro de su worktree).
  for (const c of sesion.comandos) {
    if (c.escribe && c.cwd && c.cwd !== CASA && !/(^|[\s;&|(])cd\s|git\s+-C\s/.test(c.comando)) {
      sumar(detector.proyectoDe(c.cwd), 2, true)
    }
  }
  if (!reparto.size) {
    const cwd = Object.entries(sesion.cwds).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (cwd && cwd !== CASA) sumar(detector.proyectoDe(cwd), 1, false)
  }
  return reparto
}
