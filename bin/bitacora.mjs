#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cargarConfig, carpetas, llaves, asegurar, expandir } from '../src/config.mjs'
import { actividad } from '../src/actividad.mjs'
import { proponerHoras, csv } from '../src/horas.mjs'
import { ventanaDia, ventanaSemana, corta, diaSemana, hora, iso } from '../src/tiempo.mjs'
import { material, prompt, verificar, deterministico, markdown, proyectosConTrabajo, sinCommit } from '../src/avance.mjs'
import { redactar } from '../src/modelo.mjs'
import { tachar } from '../src/secretos.mjs'
import { despertador, esSilencio } from '../src/despertador.mjs'
import { escribirMarkdown } from '../src/destinos/markdown.mjs'
import { escribirNotion } from '../src/destinos/notion.mjs'
import { instalar, desinstalar } from '../src/programar.mjs'
import { cambiosSinCommit } from '../src/fuentes/git.mjs'

const AYUDA = `bitacora hoy [--dia AAAA-MM-DD]
bitacora escribir [--destino markdown|notion|todos] [--dia D] [--proyecto P] [--sin-modelo] [--ensayo] [--carpeta DIR]
bitacora horas [--semana [D] | --dia D] [--salida archivo.csv]
bitacora retomar <proyecto> [--dia D]
bitacora instalar [--a 21:00] [--ensayo] · bitacora desinstalar
Comunes: --config RUTA · --sesiones RUTA (en vez de ~/.claude/projects)`

function leerFlags(argv) {
  const f = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      f._.push(a)
      continue
    }
    const k = a.slice(2)
    const sig = argv[i + 1]
    if (['sin-modelo', 'ensayo', 'programado', 'ayuda'].includes(k)) f[k] = true
    else if (k === 'semana') f.semana = sig && !sig.startsWith('--') ? argv[++i] : true
    else f[k] = argv[++i]
  }
  return f
}

const f = leerFlags(process.argv.slice(2))
const cmd = f._[0]
const config = cargarConfig(f.config)
const raizSesiones = expandir(f.sesiones || process.env.BITACORA_SESIONES || config.sesiones) || undefined
const memoria = join(carpetas.estado, 'worktrees.json')
const plural = (n, s, p = s + 's') => `${n} ${n === 1 ? s : p}`
const recortar = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t)
const h = x => `${x.toFixed(x % 1 ? 2 : 0).replace(/0$/, '').replace('.', ',')} h`

async function hoy() {
  const v = ventanaDia(f.dia)
  const act = actividad({ ...v, config, raizSesiones, memoria })
  const horas = new Map(proponerHoras(act, config.horas).map(x => [x.proyecto, x.horas]))
  console.log(`${f.dia ? '' : 'Hoy · '}${diaSemana(v.desde)} ${corta(v.desde)} · ${plural(act.sesiones.length, 'sesión', 'sesiones')}\n`)
  const conTrabajo = proyectosConTrabajo(act)
  for (const p of conTrabajo) {
    const escritoras = p.sesiones.filter(x => x.escribio).length
    const datos = [p.commits.length && plural(p.commits.length, 'commit'), escritoras && plural(escritoras, 'sesión', 'sesiones'), horas.get(p.nombre) && h(horas.get(p.nombre))].filter(Boolean)
    console.log(`${p.nombre} · ${datos.join(' · ')}`)
    for (const c of p.commits.slice(-5).reverse()) console.log(`  ${c.corto.padEnd(9)} ${hora(c.ts)}  ${recortar(tachar(c.asunto).texto, 90)}`)
    if (p.commits.length > 5) console.log(`  y ${p.commits.length - 5} más`)
    if (!p.commits.length) for (const s of p.sesiones.filter(x => x.escribio).slice(0, 3)) console.log(`  ${hora(s.sesion.inicio)}  ${s.sesion.titulo || s.sesion.id.slice(0, 8)} · ${plural(s.archivos.size, 'archivo')}`)
    const sucios = sinCommit(p)
    if (sucios.length) console.log(`  ${plural(sucios.length, 'archivo')} sin commit`)
    console.log('')
  }
  const lectura = act.proyectos.filter(p => !conTrabajo.includes(p)).map(p => p.nombre)
  if (lectura.length) console.log(`Solo lectura · ${lectura.slice(0, 8).join(', ')}${lectura.length > 8 ? ` y ${lectura.length - 8} más` : ''}`)
  if (act.sinProyecto.length) console.log(`Sin proyecto · ${plural(act.sinProyecto.length, 'sesión', 'sesiones')}`)
  if (!act.sesiones.length && !conTrabajo.length) console.log('Nada todavía.')
}

// Lo ya escrito hoy por proyecto, para que una segunda corrida solo agregue lo nuevo.
function estadoAvance(fecha, nombre) {
  const archivo = join(asegurar(join(carpetas.estado, 'avances', fecha)), `${nombre.replace(/[^\w.-]/g, '_')}.json`)
  const previo = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : { commits: [], hasta: 0 }
  return { previo, guardar: d => writeFileSync(archivo, JSON.stringify(d)) }
}

function soloLoNuevo(p, previo) {
  if (!previo.hasta) return p
  const ya = new Set(previo.commits)
  const sesiones = p.sesiones.filter(x => x.sesion.marcas.some(t => t > previo.hasta))
  const archivos = new Set(sesiones.flatMap(x => [...x.archivos]))
  return { ...p, commits: p.commits.filter(c => !ya.has(c.hash)), sesiones, archivos }
}

async function escribir() {
  const v = ventanaDia(f.dia)
  const destinos = f.destino === 'todos' ? ['markdown', 'notion'] : [f.destino || config.destino || 'markdown']
  const desp = despertador({ nombre: 'escribir', carpeta: asegurar(carpetas.estado) })
  const correr = async () => {
    const act = actividad({ ...v, config, raizSesiones, memoria })
    if (!act.sesiones.length && !act.proyectos.some(p => p.commits.length)) {
      if (f.programado) desp.registrar('sin sesiones: no gasté modelo')
      return console.log('Sin sesiones en la ventana. No gasté modelo.')
    }
    if (f.programado) {
      const huella = [act.sesiones.map(s => [s.id, s.fin]), act.proyectos.map(p => p.commits.map(c => c.hash))]
      if (!desp.cambio(huella)) {
        desp.registrar('sin cambios: no gasté modelo')
        return console.log('Sin cambios desde la última corrida. No gasté modelo.')
      }
      desp.guardar(huella) // antes del modelo: un fallo no repite lo mismo
    }
    const elegidos = proyectosConTrabajo(act).filter(p => !f.proyecto || p.nombre.toLowerCase() === f.proyecto.toLowerCase())
    if (f.proyecto && !elegidos.length) return console.log(`«${f.proyecto}» no tiene trabajo verificable en la ventana.`)
    const modelo = { ...(config.modelo || {}), entorno: llaves(config, ['CLAUDE_CODE_OAUTH_TOKEN', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY']) }
    let fallos = 0
    for (const completo of elegidos) {
      const est = estadoAvance(iso(v.desde), completo.nombre)
      const p = soloLoNuevo(completo, est.previo)
      if (!p.commits.length && !p.archivos.size) {
        console.log(`${p.nombre} · sin novedades desde ${hora(est.previo.hasta)}`)
        continue
      }
      let sec
      let descartadas = []
      if (f['sin-modelo'] || modelo.via === 'ninguno') sec = deterministico(p)
      else {
        const mat = material(p, { ...v, correos: config.correos })
        let resp
        try {
          resp = await redactar(prompt(mat.texto, p), modelo)
        } catch (e) {
          fallos++
          console.log(`${p.nombre} · el modelo falló (${e.message.split('\n')[0]}). Uso el avance sin modelo.`)
          resp = null
        }
        if (resp && !esSilencio(resp)) {
          ;({ secciones: sec, descartadas } = await verificar(resp, p))
          if (!sec.hecho.length) sec = { ...deterministico(p), pendiente: sec.pendiente, riesgo: sec.riesgo }
        } else sec = deterministico(p)
      }
      const av = markdown(sec, p, v)
      av.cuerpo = tachar(av.cuerpo, { correos: config.correos }).texto
      if (f.ensayo) {
        console.log(`# ${av.titulo}${av.tema ? ' · ' + av.tema : ''}\n\n${av.cuerpo}`)
        for (const d of descartadas) console.log(`  descartada (${d.motivo}): ${d.linea}`)
        continue
      }
      for (const destino of destinos) {
        try {
          const r = destino === 'notion'
            ? await escribirNotion(av, p, { ...v, config: config.destinos?.notion, llave: llaves(config, ['NOTION_API_KEY']).NOTION_API_KEY })
            : escribirMarkdown(av, p, { ...v, carpeta: expandir(f.carpeta || config.destinos?.markdown?.carpeta) })
          console.log(r.omitido ? `${p.nombre} · ${destino} omitido: ${r.omitido}` : `OK ${p.nombre} · ${destino} ${r.accion} · ${r.donde}`)
        } catch (e) {
          fallos++
          console.log(`FALLÓ ${p.nombre} · ${destino}: ${e.message}`)
        }
      }
      for (const d of descartadas) console.log(`  descartada (${d.motivo}): ${d.linea}`)
      est.guardar({ hasta: v.hasta, commits: [...est.previo.commits, ...p.commits.map(c => c.hash)] })
    }
    if (f.programado) desp.registrar(`escritos ${elegidos.length} proyectos, ${fallos} fallos`)
    if (fallos) process.exitCode = 1
  }
  const r = await desp.conCandado(correr)
  if (r?.saltada) console.log('Ya hay una corrida en curso.')
}

async function horas() {
  const v = f.dia ? ventanaDia(f.dia) : ventanaSemana(typeof f.semana === 'string' ? f.semana : undefined)
  const act = actividad({ ...v, config, raizSesiones, memoria })
  const salida = csv(proponerHoras(act, config.horas))
  if (f.salida) {
    writeFileSync(expandir(f.salida), salida)
    console.log(`Propuesta en ${f.salida}. No se cargó en ningún lado.`)
  } else process.stdout.write(salida)
}

async function retomar() {
  const nombre = f._[1]
  if (!nombre) throw new Error('Uso: bitacora retomar <proyecto>')
  const ahora = f.dia ? ventanaDia(f.dia).desde + 864e5 : Date.now()
  const act = actividad({ desde: ahora - 14 * 864e5, hasta: ahora, config, raizSesiones, memoria })
  const p = act.proyectos.find(x => x.nombre.toLowerCase() === nombre.toLowerCase())
  if (!p) throw new Error(`No vi «${nombre}» en los últimos 14 días. Proyectos: ${act.proyectos.map(x => x.nombre).join(', ')}`)
  const dir = expandir(f.carpeta || config.destinos?.markdown?.carpeta)
  const carpeta = dir ? join(dir, p.nombre) : join(p.raiz, 'docs', 'bitacora')
  const ultimo = existsSync(carpeta) ? readdirSync(carpeta).filter(x => /^\d{4}-\d{2}-\d{2}\.md$/.test(x)).sort().at(-1) : null
  console.log(`${p.nombre} · ${p.raiz}\n`)
  if (ultimo) {
    const texto = readFileSync(join(carpeta, ultimo), 'utf8')
    const seccion = t => (new RegExp(`## ${t}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`).exec(texto)?.[1] || '').trim()
    console.log(`Último avance · ${ultimo.slice(0, 10)}`)
    for (const t of ['Riesgo para revisar primero', 'Pendiente']) if (seccion(t)) console.log(`\n${t}\n${seccion(t)}`)
    const desde = new Date(ultimo.slice(0, 10) + 'T00:00:00').getTime() + 864e5
    const nuevos = p.commits.filter(c => c.ts >= desde)
    if (nuevos.length) console.log(`\nDespués de ese avance · ${plural(nuevos.length, 'commit')}\n${nuevos.slice(-8).map(c => `  ${c.corto} ${c.asunto}`).join('\n')}`)
  } else {
    console.log('Sin avances escritos. Últimos commits:')
    for (const c of p.commits.slice(-8)) console.log(`  ${c.corto} ${iso(c.ts)} ${c.asunto}`)
  }
  const sucios = p.tipo === 'carpeta' ? [] : cambiosSinCommit(p.raiz)
  if (sucios.length) console.log(`\nSin commit en ${p.raiz} · ${plural(sucios.length, 'archivo')}`)
  const ultima = p.sesiones.map(x => x.sesion).sort((a, b) => b.fin - a.fin)[0]
  if (ultima) console.log(`\nÚltima sesión · ${ultima.titulo || ultima.id.slice(0, 8)} · ${iso(ultima.fin)} ${hora(ultima.fin)} · ${ultima.archivo}`)
}

async function programar() {
  const extra = f.config ? ['--config', expandir(f.config)] : []
  const r = instalar({ a: f.a || '21:00', cli: fileURLToPath(import.meta.url), extra, ensayo: f.ensayo })
  if (f.ensayo) return console.log(r.contenido)
  console.log(`OK ${r.sistema} · todos los días a las ${r.hora} · registro en ${r.log}`)
}

const comandos = { hoy, escribir, horas, retomar, instalar: programar, desinstalar: async () => console.log(JSON.stringify(desinstalar())) }
if (!cmd || f.ayuda || !comandos[cmd]) {
  console.log(AYUDA)
  process.exit(cmd && !f.ayuda && !comandos[cmd] ? 1 : 0)
}
comandos[cmd]().catch(e => {
  console.error(e.message)
  process.exit(1)
})
