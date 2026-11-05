// El avance de un proyecto: material (tachado) → modelo → verificación → markdown.
// Nada se escribe sin evidencia: cada viñeta de «Hecho» cita un commit de la ventana, un archivo
// que cambió o una URL que responde. Lo que no se prueba se borra y se cuenta.
import { isAbsolute, join, relative } from 'node:path'
import { tachar, ARCHIVO_SECRETO } from './secretos.mjs'
import { cambiosSinCommit, existeCommit } from './fuentes/git.mjs'
import { corta, hora, iso } from './tiempo.mjs'

const TOPE_SESION = 6000

const recorte = (t, n) => (t.length <= n ? t : '[…] ' + t.slice(-n))
const rel = (p, ruta) => (p.raiz && ruta.startsWith(p.raiz + '/') ? relative(p.raiz, ruta) : ruta)

// Sesiones del proyecto que escribieron algo. Las que solo leyeron no cuentan.
const conTrabajo = p => p.sesiones.filter(x => x.escribio)

export function material(p, { desde, hasta, correos = false } = {}) {
  const partes = [`Proyecto: ${p.nombre}`, `Ventana: ${iso(desde)} ${hora(desde)} a ${hora(hasta)}`]
  if (p.commits.length) {
    partes.push('', 'Commits en la ventana (verificados en git):')
    for (const c of p.commits) partes.push(`- ${c.corto} ${hora(c.ts)} ${c.asunto} (${c.archivos.length} archivos)`)
  }
  const archivos = [...p.archivos].filter(a => !ARCHIVO_SECRETO.test(a)).map(a => rel(p, a))
  if (archivos.length) partes.push('', 'Archivos que escribieron las sesiones:', ...archivos.slice(0, 80).map(a => `- ${a}`))
  for (const x of conTrabajo(p)) {
    const s = x.sesion
    partes.push('', `Sesión ${s.titulo || s.id.slice(0, 8)} (${hora(s.inicio)} a ${hora(s.fin)}${s.humano ? '' : ', agente sin persona'}):`)
    const texto = s.eventos.map(e => `[${hora(e.ts)}] ${e.quien}: ${e.texto}`).join('\n\n')
    partes.push(recorte(texto, TOPE_SESION))
  }
  return tachar(partes.join('\n'), { correos })
}

export function prompt(mat, p) {
  return `Escribe el avance del día del proyecto «${p.nombre}» a partir del material de abajo.

Formato exacto (markdown, en español, con tuteo):
Tema: <tres a seis palabras>
<Lectura corta: dos o tres frases, qué cambió y por qué importa.>
## Hecho
- <qué se hizo, concreto> [commit abc1234]
## Riesgo para revisar primero
- <solo si algo quedó frágil o roto; si no hay, omite la sección>
## Pendiente
- <qué falta y quién decide>

Reglas:
- Cada viñeta de «Hecho» termina con su fuente entre corchetes: [commit <hash>] de la lista de commits, [archivo <ruta>] de la lista de archivos, o [url <https://...>]. Sin fuente, no va.
- Usa solo lo que está en el material. No inventes commits, archivos, URLs, cifras ni resultados.
- Lo que la sesión dijo que hizo pero no tiene commit ni archivo va en «Pendiente» como sin verificar, o no va.
- Sin raya larga (—), sin superlativos, sin jerga, sin credenciales.
- No escribas la sección «Fuentes»: la agrega la herramienta.
- Si no hubo trabajo real (solo lecturas o conversación), responde exactamente [SILENT].

Material:
${mat}`
}

const RE_FUENTE = /\[(commit|archivo|url)\s+([^\]]+)\]/gi

async function urlResponde(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) })
    return r.status < 400
  } catch {
    return false
  }
}

// Verifica cada afirmación. Devuelve { secciones, descartadas }.
export async function verificar(texto, p) {
  const delaVentana = new Map(p.commits.map(c => [c.hash, c]))
  const commitOk = h => {
    const c = [...delaVentana.values()].find(c => c.hash.startsWith(h.toLowerCase()))
    return Boolean(c && [...p.raices].some(r => existeCommit(r, h)))
  }
  const archivosVentana = new Set([...p.archivos, ...p.commits.flatMap(c => c.archivos.map(a => join(p.raiz, a)))])
  const archivoOk = a => {
    const abs = isAbsolute(a) ? a : join(p.raiz || '', a)
    return archivosVentana.has(abs) || [...archivosVentana].some(x => x.endsWith('/' + a))
  }
  const fuenteOk = async (tipo, valor) => {
    valor = valor.trim()
    if (tipo === 'commit') return commitOk(valor.split(/[\s,]+/)[0])
    if (tipo === 'archivo') return archivoOk(valor)
    return urlResponde(valor)
  }
  const lineas = texto.replace(/\s+—\s+/g, ', ').replace(/—/g, ',').split('\n')
  const secciones = { tema: '', lectura: [], hecho: [], riesgo: [], pendiente: [] }
  const descartadas = []
  let actual = 'lectura'
  for (const bruta of lineas) {
    const l = bruta.trimEnd()
    if (!l.trim()) continue
    const tema = /^tema:\s*(.+)$/i.exec(l)
    if (tema) {
      secciones.tema = tema[1].trim()
      continue
    }
    const cab = /^#{1,3}\s*(.+)$/.exec(l)
    if (cab) {
      const t = cab[1].toLowerCase()
      actual = /hecho|publicado/.test(t) ? 'hecho' : /riesgo/.test(t) ? 'riesgo' : /pendiente/.test(t) ? 'pendiente' : /fuentes/.test(t) ? null : actual
      continue
    }
    if (!actual) continue
    const fuentes = [...l.matchAll(RE_FUENTE)].map(m => [m[1].toLowerCase(), m[2]])
    // Un hash suelto también es una afirmación.
    const sueltos = [...l.replace(RE_FUENTE, '').matchAll(/\b[0-9a-f]{7,40}\b/g)].map(m => m[0]).filter(h => /[a-f]/.test(h) && /\d/.test(h))
    const pruebas = await Promise.all(fuentes.map(([t, v]) => fuenteOk(t, v)))
    const malos = pruebas.filter(x => !x).length + sueltos.filter(h => !commitOk(h)).length
    const necesitaFuente = actual === 'hecho'
    if (malos || (necesitaFuente && !fuentes.length)) {
      descartadas.push({ seccion: actual, linea: l.trim(), motivo: malos ? 'fuente que no se verifica' : 'sin fuente' })
      continue
    }
    secciones[actual].push(l.trim())
  }
  return { secciones, descartadas }
}

// Sin modelo: el avance sale solo de lo que git y las sesiones prueban.
export function deterministico(p) {
  const hecho = p.commits.slice(-15).map(c => `- ${c.asunto} [commit ${c.corto}]`)
  if (p.commits.length > 15) hecho.unshift(`- ${p.commits.length - 15} commits anteriores de la ventana [commit ${p.commits[0].corto}]`)
  if (!p.commits.length) {
    for (const a of [...p.archivos].slice(0, 15)) hecho.push(`- Cambió ${rel(p, a)} [archivo ${rel(p, a)}]`)
  }
  const n = p.commits.length
  const lectura = n
    ? [`${n} commit${n > 1 ? 's' : ''} en ${p.nombre}, de «${p.commits[0].asunto}» a «${p.commits.at(-1).asunto}».`]
    : [p.archivos.size === 1 ? `Cambió 1 archivo en ${p.nombre}, sin commit todavía.` : `Cambiaron ${p.archivos.size} archivos en ${p.nombre}, sin commit todavía.`]
  return { tema: (p.commits.at(-1)?.asunto || 'cambios sin commit').slice(0, 60), lectura, hecho, riesgo: [], pendiente: [] }
}

// Lo que git ve sin commit entre los archivos que escribieron las sesiones.
export function sinCommit(p) {
  if (p.tipo === 'carpeta' || !p.raiz) return []
  const sucios = new Set(cambiosSinCommit(p.raiz).map(a => join(p.raiz, a)))
  return [...p.archivos].filter(a => sucios.has(a)).map(a => rel(p, a))
}

export function fuentes(p) {
  const ses = conTrabajo(p).map(x => `${x.sesion.titulo || x.sesion.id.slice(0, 8)} (${x.sesion.id.slice(0, 8)})`)
  const out = []
  if (ses.length) out.push(`- Sesiones de Claude Code: ${[...new Set(ses)].join(', ')}`)
  if (p.commits.length) out.push(`- git log de ${p.raiz}: ${p.commits.length} commit${p.commits.length > 1 ? 's' : ''}, ${p.commits[0].corto}..${p.commits.at(-1).corto}`)
  if (p.archivos.size) out.push(`- Archivos escritos: ${p.archivos.size}`)
  return out
}

export function markdown(sec, p, { desde }) {
  const pendientes = sinCommit(p)
  const riesgo = [...sec.riesgo]
  if (pendientes.length) riesgo.push(`- ${pendientes.length} archivo${pendientes.length > 1 ? 's' : ''} escrito${pendientes.length > 1 ? 's' : ''} hoy sin commit: ${pendientes.slice(0, 6).join(', ')}${pendientes.length > 6 ? ' …' : ''}`)
  const bloque = [
    ...sec.lectura,
    '',
    '## Hecho',
    ...sec.hecho,
    ...(riesgo.length ? ['', '## Riesgo para revisar primero', ...riesgo] : []),
    ...(sec.pendiente.length ? ['', '## Pendiente', ...sec.pendiente] : []),
    '',
    '## Fuentes',
    ...fuentes(p),
  ]
  return { titulo: `${p.nombre} · ${corta(desde)} ${new Date(desde).getFullYear()}`, tema: sec.tema, cuerpo: bloque.join('\n').trim() + '\n' }
}

export const proyectosConTrabajo = act => act.proyectos.filter(p => p.trabajo && (p.commits.length || p.archivos.size))
