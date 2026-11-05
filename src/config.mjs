// Config opcional (bitacora.json) y carpetas propias. Todo funciona sin config.
//
// {
//   "zona": "America/Bogota",
//   "sesiones": "~/.claude/projects",                                    dónde están las transcripciones
//   "proyectos": { "Tienda": ["~/code/tienda", "~/code/tienda-api"] },   ruta → nombre
//   "ignorar": ["~/borradores"],                                         se suma a lo ignorado por defecto
//   "repos": ["~/code/blog"],                                            repos a mirar aunque no haya sesión
//   "autores": ["yo@trabajo.com"],                                       commits de quién cuentan (más user.email)
//   "modelo": { "via": "claude", "nombre": "sonnet" },
//   "llaves": { "archivo": "~/.config/bitacora/.env" },
//   "destinos": { "markdown": { "carpeta": null }, "notion": { "paginas": { "Tienda": "<page_id>" } } },
//   "horas": { "hueco": 20 }
// }
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { IGNORAR } from './proyecto.mjs'

const CASA = homedir()
const win = process.platform === 'win32'

export const carpetas = {
  config: process.env.BITACORA_CONFIG_DIR || (win ? join(process.env.APPDATA || CASA, 'bitacora') : join(process.env.XDG_CONFIG_HOME || join(CASA, '.config'), 'bitacora')),
  estado: process.env.BITACORA_ESTADO_DIR || (win ? join(process.env.LOCALAPPDATA || CASA, 'bitacora') : join(process.env.XDG_STATE_HOME || join(CASA, '.local', 'state'), 'bitacora')),
}

export const expandir = p => (typeof p === 'string' && (p === '~' || p.startsWith('~/')) ? join(CASA, p.slice(1)) : p)

export function cargarConfig(ruta) {
  const archivo = expandir(ruta || process.env.BITACORA_CONFIG || join(carpetas.config, 'bitacora.json'))
  let c = {}
  if (existsSync(archivo)) {
    try {
      c = JSON.parse(readFileSync(archivo, 'utf8'))
    } catch (e) {
      throw new Error(`No pude leer ${archivo}: ${e.message}`)
    }
  } else if (ruta) throw new Error(`No existe ${archivo}`)
  if (c.zona) process.env.TZ = c.zona
  c.ignorar = [...(c.ignorarPorDefecto === false ? [] : IGNORAR), ...(c.ignorar || []).map(expandir)]
  c.repos = (c.repos || []).map(expandir)
  c.archivo = existsSync(archivo) ? archivo : null
  return c
}

// Llaves: del entorno o de un archivo .env que nombre la config. Solo las que se piden.
export function llaves(config, nombres) {
  const out = {}
  const archivo = expandir(config.llaves?.archivo)
  const alias = config.llaves?.alias || {}
  let env = {}
  if (archivo && existsSync(archivo)) {
    for (const l of readFileSync(archivo, 'utf8').split('\n')) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l)
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  for (const n of nombres) {
    const v = process.env[n] || env[alias[n] || n]
    if (v) out[n] = v
  }
  return out
}

export function asegurar(dir) {
  mkdirSync(dir, { recursive: true })
  return dir
}
