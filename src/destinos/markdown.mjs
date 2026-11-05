// Destino: markdown en el repo (docs/bitacora/AAAA-MM-DD.md). Escribe, relee y falla si falta una línea.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { hora, iso } from '../tiempo.mjs'
import { faltantes } from './verificar.mjs'

export function escribirMarkdown(av, p, { desde, carpeta, ahora = Date.now() }) {
  if (!carpeta && !p.raiz) throw new Error(`«${p.nombre}» no tiene carpeta propia: usa --carpeta`)
  const dir = carpeta ? join(carpeta, p.nombre) : join(p.raiz, 'docs', 'bitacora')
  mkdirSync(dir, { recursive: true })
  const archivo = join(dir, `${iso(desde)}.md`)
  const previo = existsSync(archivo) ? readFileSync(archivo, 'utf8') : ''
  const tema = av.tema ? ` · ${av.tema}` : ''
  const nuevo = previo
    ? `${previo.trimEnd()}\n\n## Más tarde · ${hora(ahora)}${tema}\n\n${av.cuerpo}`
    : `# ${av.titulo}${tema}\n\n${av.cuerpo}`
  writeFileSync(archivo, nuevo)
  const falta = faltantes(readFileSync(archivo, 'utf8'), av.cuerpo)
  if (falta.length) throw new Error(`Verificación falló en ${archivo}: faltan ${falta.length} líneas, p. ej. «${falta[0].slice(0, 80)}»`)
  return { destino: 'markdown', donde: archivo, accion: previo ? 'agregado' : 'creado' }
}
