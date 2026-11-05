// Fuente: git. Raíz de repo por ruta (un worktree cuenta como su repo principal) y commits en la ventana.
import { existsSync, readFileSync, statSync, realpathSync } from 'node:fs'
import { dirname, join, resolve, isAbsolute } from 'node:path'
import { spawnSync } from 'node:child_process'

const cache = new Map()

export function git(repo, args) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return r.status === 0 ? r.stdout : null
}

const real = p => {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

// Carpeta existente más cercana (la ruta puede ser un archivo borrado o por crear).
function existente(ruta) {
  let d = ruta
  while (d && !existsSync(d)) {
    const padre = dirname(d)
    if (padre === d) return null
    d = padre
  }
  try {
    return statSync(d).isDirectory() ? d : dirname(d)
  } catch {
    return null
  }
}

// { raiz, worktree } del repo que contiene `ruta`, o null. `raiz` es el checkout principal.
export function repoDe(ruta) {
  const inicio = existente(ruta)
  if (!inicio) return null
  const recorridos = []
  let d = inicio
  let hallado = null
  while (true) {
    if (cache.has(d)) {
      hallado = cache.get(d)
      break
    }
    recorridos.push(d)
    const g = join(d, '.git')
    if (existsSync(g)) {
      hallado = { raiz: real(principal(d, g)), worktree: real(d) }
      break
    }
    const padre = dirname(d)
    if (padre === d) break
    d = padre
  }
  for (const r of recorridos) cache.set(r, hallado)
  return hallado
}

function principal(dir, g) {
  try {
    if (statSync(g).isDirectory()) return dir
    const m = /gitdir:\s*(.+)/.exec(readFileSync(g, 'utf8'))
    if (!m) return dir
    const gitdir = isAbsolute(m[1].trim()) ? m[1].trim() : resolve(dir, m[1].trim())
    const common = join(gitdir, 'commondir')
    if (!existsSync(common)) return dir // submódulo: es su propio repo
    const comun = resolve(gitdir, readFileSync(common, 'utf8').trim())
    return dirname(comun)
  } catch {
    return dir
  }
}

const SEP = '\x1f'
const REG = '\x1e'

// Commits de ramas locales en la ventana. `autores`: correos aceptados (vacío = todos).
export function commits(raiz, { desde, hasta, autores = [] }) {
  const s = Math.floor(desde / 1000)
  const h = Math.floor(hasta / 1000)
  const out = git(raiz, [
    'log', '--branches', '--no-merges', `--since=@${s}`, `--until=@${h}`,
    `--format=${REG}%H${SEP}%h${SEP}%an${SEP}%ae${SEP}%ct${SEP}%s${SEP}%D`, '--name-only',
  ])
  if (!out) return []
  const vistos = new Set()
  const lista = []
  for (const bloque of out.split(REG).slice(1)) {
    const [cab, ...resto] = bloque.split('\n')
    const [hash, corto, autor, correo, ct, asunto, refs] = cab.split(SEP)
    if (vistos.has(hash)) continue
    vistos.add(hash)
    const ts = +ct * 1000
    if (ts < desde || ts >= hasta) continue
    if (autores.length && !autores.includes(correo.toLowerCase())) continue
    lista.push({ hash, corto, autor, correo, ts, asunto, refs, archivos: resto.map(x => x.trim()).filter(Boolean) })
  }
  return lista.sort((a, b) => a.ts - b.ts)
}

export function correoDe(raiz) {
  return (git(raiz, ['config', 'user.email']) || '').trim().toLowerCase()
}

export function existeCommit(raiz, hash) {
  if (!/^[0-9a-f]{7,40}$/i.test(hash)) return false
  return git(raiz, ['cat-file', '-e', `${hash}^{commit}`]) !== null
}

export function cambiosSinCommit(raiz) {
  const out = git(raiz, ['status', '--porcelain'])
  return out ? out.split('\n').filter(Boolean).map(l => l.slice(3)) : []
}
