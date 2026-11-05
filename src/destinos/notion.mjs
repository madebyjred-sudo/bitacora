// Destino: Notion. Un avance por proyecto por día bajo la página que le asigna la config
// (`destinos.notion.paginas`). Si ya hay uno de esa fecha, agrega «Más tarde» en vez de duplicar.
// Se relee después de escribir y falla si falta una línea.
import { corta, hora } from '../tiempo.mjs'
import { faltantes } from './verificar.mjs'

export function clienteNotion({ llave, api = 'https://api.notion.com/v1/', version = '2022-06-28' }) {
  if (!llave) throw new Error('Falta la llave de Notion (NOTION_API_KEY).')
  async function llamar(ruta, cuerpo, metodo) {
    for (let intento = 0; ; intento++) {
      const r = await fetch(api + ruta, {
        method: metodo || (cuerpo ? 'POST' : 'GET'),
        headers: { Authorization: `Bearer ${llave}`, 'Notion-Version': version, 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      })
      if ([429, 502, 503].includes(r.status) && intento < 3) {
        await new Promise(res => setTimeout(res, 1000 * 2 ** intento))
        continue
      }
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(`Notion ${r.status}: ${JSON.stringify(d).slice(0, 300)}`)
      return d
    }
  }
  async function hijos(id) {
    const out = []
    let cursor
    do {
      const d = await llamar(`blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`)
      out.push(...d.results)
      cursor = d.has_more ? d.next_cursor : null
    } while (cursor)
    return out
  }
  return { llamar, hijos }
}

const rt = t => {
  const out = []
  for (let i = 0; i < Math.max(t.length, 1); i += 1900) out.push({ type: 'text', text: { content: t.slice(i, i + 1900) } })
  return out
}

export function bloques(md) {
  const out = []
  for (const l of md.split('\n').map(x => x.trimEnd())) {
    if (!l) continue
    const tipos = [['### ', 'heading_3'], ['## ', 'heading_2'], ['# ', 'heading_2'], ['- ', 'bulleted_list_item'], ['* ', 'bulleted_list_item']]
    const t = tipos.find(([pre]) => l.startsWith(pre))
    const tipo = t ? t[1] : 'paragraph'
    out.push({ object: 'block', type: tipo, [tipo]: { rich_text: rt(t ? l.slice(t[0].length) : l) } })
  }
  return out
}

export function plano(bs) {
  return bs
    .map(b => (b.type === 'child_page' ? `[página] ${b.child_page.title}` : (b[b.type]?.rich_text || []).map(x => x.plain_text ?? x.text?.content ?? '').join('')))
    .join('\n')
}

export async function escribirNotion(av, p, { desde, config = {}, llave, ahora = Date.now() }) {
  const padre = config.paginas?.[p.nombre]
  if (!padre) return { destino: 'notion', omitido: `«${p.nombre}» no tiene página en destinos.notion.paginas` }
  const n = clienteNotion({ llave, api: config.api })
  const fecha = corta(desde)
  const paginas = (await n.hijos(padre)).filter(b => b.type === 'child_page').map(b => ({ id: b.id, titulo: b.child_page.title }))
  const mismo = paginas.filter(x => new RegExp(`Avance ${fecha}( |$)`).test(x.titulo)).at(-1)
  let id
  let titulo
  if (mismo) {
    ;({ id, titulo } = mismo)
    const bl = [{ object: 'block', type: 'heading_2', heading_2: { rich_text: rt(`Más tarde · ${hora(ahora)}${av.tema ? ' · ' + av.tema : ''}`) } }, ...bloques(av.cuerpo)]
    for (let i = 0; i < bl.length; i += 100) await n.llamar(`blocks/${id}/children`, { children: bl.slice(i, i + 100) }, 'PATCH')
  } else {
    let pre = ''
    if (config.numerar) {
      const nums = paginas.map(x => /(?:^|· )(\d+) · /.exec(x.titulo)?.[1]).filter(Boolean).map(Number)
      pre = `${nums.length ? Math.max(...nums) + 1 : 1} · `
    }
    titulo = `${pre}Avance ${fecha}${av.tema ? ' · ' + av.tema : ''}`
    const bl = bloques(av.cuerpo)
    const pagina = await n.llamar('pages', { parent: { page_id: padre }, properties: { title: { title: rt(titulo) } }, children: bl.slice(0, 100) })
    id = pagina.id
    for (let i = 100; i < bl.length; i += 100) await n.llamar(`blocks/${id}/children`, { children: bl.slice(i, i + 100) }, 'PATCH')
  }
  const leido = plano(await n.hijos(id))
  const falta = faltantes(leido, av.cuerpo)
  if (falta.length) throw new Error(`Verificación falló en Notion ${id}: faltan ${falta.length} líneas, p. ej. «${falta[0].slice(0, 80)}»`)
  return { destino: 'notion', donde: `https://www.notion.so/${id.replace(/-/g, '')}`, titulo, accion: mismo ? 'agregado' : 'creado' }
}
