// Fuente: transcripciones de Claude Code (~/.claude/projects/*/*.jsonl).
// Una sesión = un archivo de primer nivel. Los subagentes (<sesión>/subagents/*.jsonl) suman sus
// archivos tocados y su actividad a la sesión que los lanzó, pero no su texto.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, basename, isAbsolute, resolve } from 'node:path'
import { homedir } from 'node:os'

export const RAIZ = join(homedir(), '.claude', 'projects')

const ESCRIBEN = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const LEEN = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead'])

export function archivosDeSesion(raiz = RAIZ, desde = 0) {
  let carpetas
  try {
    carpetas = readdirSync(raiz)
  } catch (e) {
    throw new Error(`No pude leer ${raiz} (${e.code}). En macOS, dale a tu terminal Acceso total al disco.`)
  }
  const out = []
  for (const c of carpetas) {
    const dir = join(raiz, c)
    let nombres
    try {
      nombres = readdirSync(dir)
    } catch {
      continue
    }
    for (const n of nombres) {
      if (!n.endsWith('.jsonl')) continue
      const ruta = join(dir, n)
      const st = statSync(ruta)
      if (st.mtimeMs < desde) continue
      const sub = join(dir, n.slice(0, -6), 'subagents')
      const subagentes = existsSync(sub)
        ? readdirSync(sub).filter(x => x.endsWith('.jsonl')).map(x => join(sub, x))
        : []
      out.push({ ruta, mtime: st.mtimeMs, subagentes })
    }
  }
  return out
}

// Texto que escribió una persona, sin los bloques que inyecta el arnés.
export function textoHumano(contenido) {
  const partes = typeof contenido === 'string'
    ? [contenido]
    : Array.isArray(contenido) ? contenido.filter(b => b?.type === 'text').map(b => b.text || '') : []
  return partes
    .map(t => t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

const expandir = (p, cwd) => {
  if (!p) return null
  p = p.replace(/^["']|["']$/g, '')
  if (p === '~' || p.startsWith('~/')) p = join(homedir(), p.slice(1))
  if (p.includes('$') || p.includes('*')) return null
  return isAbsolute(p) ? p : cwd ? resolve(cwd, p) : null
}

// Rutas que nombra un comando de shell: `cd X`, `git -C X`, y rutas absolutas o con ~.
export function rutasDeComando(comando, cwd) {
  const out = []
  const tok = String.raw`("[^"]+"|'[^']+'|[^\s;&|()<>]+)`
  for (const m of comando.matchAll(new RegExp(String.raw`(?:^|[\s;&|(])cd\s+` + tok, 'g'))) out.push({ ruta: m[1], fuerte: true })
  for (const m of comando.matchAll(new RegExp(String.raw`git\s+-C\s+` + tok, 'g'))) out.push({ ruta: m[1], fuerte: true })
  for (const m of comando.matchAll(/(?:^|[\s="'(:])((?:~\/|\/)(?:Users|home|Volumes|mnt|srv|opt|var\/www|workspace|projects|code|src|[A-Za-z]:)[^\s"'`;&|()<>,]*)/g)) {
    out.push({ ruta: m[1], fuerte: false })
  }
  for (const m of comando.matchAll(/(?:^|[\s="'(])(~\/[^\s"'`;&|()<>,]+)/g)) out.push({ ruta: m[1], fuerte: false })
  const vistas = new Set()
  return out
    .map(r => ({ ...r, ruta: expandir(r.ruta, cwd) }))
    .filter(r => r.ruta && !vistas.has(r.ruta + r.fuerte) && vistas.add(r.ruta + r.fuerte))
}

// Comandos que cambian archivos. Una redirección cuenta salvo que vaya a /dev/null o sea de stderr.
const ESCRIBE_SHELL = /(^|[\s;&|(])(git(?:\s+-[Cc]\s+\S+)*\s+(commit|push|merge|rebase|cherry-pick|tag|am|apply)|sed\s+-i|perl\s+-pi|tee\s|mv\s|cp\s|rm\s|mkdir\s|touch\s|npm\s+(publish|version)|rsync\s|scp\s|patch\s)|(^|[\s;&|])(1?>>?|&>)\s*(?!\/dev\/null)[^\s&|;)]/

function leerLineas(ruta, alLinea) {
  let texto
  try {
    texto = readFileSync(ruta, 'utf8')
  } catch {
    return
  }
  for (const linea of texto.split('\n')) {
    // Las líneas de pedido a la API pesan megas y no traen nada que sirva.
    if (!linea || linea.startsWith('{"type":"api-request')) continue
    let d
    try {
      d = JSON.parse(linea)
    } catch {
      continue
    }
    alLinea(d)
  }
}

function tsDe(d) {
  const t = Date.parse(d.timestamp || '')
  return Number.isFinite(t) ? t : null
}

function recogerHerramientas(d, ts, s) {
  const contenido = d.message?.content
  if (!Array.isArray(contenido)) return
  for (const b of contenido) {
    if (b?.type !== 'tool_use') continue
    const i = b.input || {}
    if (ESCRIBEN.has(b.name)) {
      const r = expandir(i.file_path || i.notebook_path, d.cwd)
      if (r) s.toques.push({ ts, ruta: r, modo: 'escribe', herramienta: b.name })
    } else if (LEEN.has(b.name)) {
      const r = expandir(i.file_path || i.path || i.notebook_path, d.cwd)
      if (r) s.toques.push({ ts, ruta: r, modo: 'lee', herramienta: b.name })
    } else if (b.name === 'Bash' && typeof i.command === 'string') {
      const escribe = ESCRIBE_SHELL.test(i.command)
      s.comandos.push({ ts, comando: i.command, cwd: d.cwd, escribe })
      for (const r of rutasDeComando(i.command, d.cwd)) {
        s.toques.push({ ts, ruta: r.ruta, modo: r.fuerte ? 'cd' : 'menciona', herramienta: 'Bash', escribe })
      }
    }
  }
}

export function leerSesion({ ruta, subagentes = [] }, { desde = 0, hasta = Infinity } = {}) {
  const s = {
    id: basename(ruta, '.jsonl'),
    archivo: ruta,
    titulo: '',
    eventos: [], // { ts, quien: 'humano' | 'encargo' | 'asistente', texto }
    marcas: [], // timestamps de toda la actividad en la ventana (para las horas)
    ocupado: [], // [desde, hasta] de cada herramienta corriendo: un test de 40 min no es un hueco
    toques: [], // { ts, ruta, modo: 'escribe' | 'lee' | 'cd' | 'menciona' }
    comandos: [],
    cwds: {},
    ramas: {},
    humano: false,
  }
  const enVentana = ts => ts !== null && ts >= desde && ts < hasta
  let usoPendiente = null
  leerLineas(ruta, d => {
    if (d.type === 'custom-title' && d.customTitle) s.titulo = d.customTitle
    if (d.type !== 'user' && d.type !== 'assistant') return
    if (d.isSidechain) return
    const ts = tsDe(d)
    if (!enVentana(ts)) return
    s.marcas.push(ts)
    if (d.cwd) s.cwds[d.cwd] = (s.cwds[d.cwd] || 0) + 1
    if (d.gitBranch && d.gitBranch !== 'HEAD') s.ramas[d.gitBranch] = (s.ramas[d.gitBranch] || 0) + 1
    const c = d.message?.content
    if (d.type === 'user') {
      const tieneResultado = Array.isArray(c) && c.some(b => b?.type === 'tool_result')
      if (tieneResultado) {
        if (usoPendiente !== null) s.ocupado.push([usoPendiente, ts])
        usoPendiente = null
        return
      }
      const texto = textoHumano(c)
      if (!texto) return
      if (d.origin?.kind === 'human') {
        s.eventos.push({ ts, quien: 'humano', texto })
        s.humano = true
      } else if (!d.origin && !d.isMeta && !s.eventos.some(e => e.quien === 'encargo')) {
        // El primer pedido de una sesión sin persona (claude -p, un builder): su encargo.
        s.eventos.push({ ts, quien: 'encargo', texto })
      }
      return
    }
    if (Array.isArray(c)) {
      const texto = c.filter(b => b?.type === 'text').map(b => b.text || '').join('\n').trim()
      if (texto) s.eventos.push({ ts, quien: 'asistente', texto })
      if (c.some(b => b?.type === 'tool_use')) usoPendiente = ts
    }
    recogerHerramientas(d, ts, s)
  })
  for (const sub of subagentes) {
    leerLineas(sub, d => {
      if (d.type !== 'assistant' && d.type !== 'user') return
      const ts = tsDe(d)
      if (!enVentana(ts)) return
      s.marcas.push(ts)
      if (d.type === 'assistant') recogerHerramientas(d, ts, s)
    })
  }
  s.marcas.sort((a, b) => a - b)
  s.inicio = s.marcas[0] ?? null
  s.fin = s.marcas.at(-1) ?? null
  s.escribio = s.toques.some(t => t.modo === 'escribe') || s.comandos.some(c => c.escribe)
  return s
}

// Sesiones con actividad en la ventana. `soloHumanas` reproduce el filtro clásico: solo las que
// tienen al menos un mensaje escrito por una persona.
export function leerSesiones({ raiz = RAIZ, desde = 0, hasta = Infinity, soloHumanas = false } = {}) {
  return archivosDeSesion(raiz, desde)
    .map(a => leerSesion(a, { desde, hasta }))
    .filter(s => s.marcas.length && (!soloHumanas || s.humano))
    .sort((a, b) => a.inicio - b.inicio)
}
