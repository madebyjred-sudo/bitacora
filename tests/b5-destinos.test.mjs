// B5 · destinos: escribe, relee y falla si falta una línea.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { montar, dia } from './ayuda.mjs'
import { escribirMarkdown } from '../src/destinos/markdown.mjs'
import { escribirNotion, bloques } from '../src/destinos/notion.mjs'
import { faltantes } from '../src/destinos/verificar.mjs'

const m = montar()
const p = { nombre: 'tienda', raiz: m.tienda }
const av = (tema, hecho) => ({ titulo: 'tienda · 2 mar 2026', tema, cuerpo: `Lectura.\n\n## Hecho\n- ${hecho} [commit abc1234]\n\n## Fuentes\n- git log\n` })

test('markdown: crea docs/bitacora/AAAA-MM-DD.md y la segunda vez agrega «Más tarde»', () => {
  const r1 = escribirMarkdown(av('carrito', 'Carrito'), p, { ...dia('2026-03-02'), ahora: Date.parse('2026-03-02T20:00:00Z') })
  assert.equal(r1.accion, 'creado')
  assert.equal(r1.donde, join(m.tienda, 'docs', 'bitacora', '2026-03-02.md'))
  const r2 = escribirMarkdown(av('pago', 'Pago'), p, { ...dia('2026-03-02'), ahora: Date.parse('2026-03-02T23:30:00Z') })
  assert.equal(r2.accion, 'agregado')
  const t = readFileSync(r1.donde, 'utf8')
  assert.match(t, /^# tienda · 2 mar 2026 · carrito\n/)
  assert.match(t, /## Más tarde · 18:30 · pago\n\nLectura\.\n\n## Hecho\n- Pago/)
})

test('markdown: con --carpeta escribe fuera del repo', () => {
  const r = escribirMarkdown(av('x', 'X'), p, { ...dia('2026-03-02'), carpeta: join(m.raiz, 'afuera') })
  assert.equal(r.donde, join(m.raiz, 'afuera', 'tienda', '2026-03-02.md'))
})

test('la relectura detecta una línea que no entró', () => {
  assert.deepEqual(faltantes('# x\n- uno\n', '- uno\n- dos\n'), ['dos'])
  assert.deepEqual(faltantes('## Hecho\n- uno [commit a]\n', '## Hecho\n- uno [commit a]\n'), [])
})

// Notion de mentira: guarda páginas y bloques en memoria; `perder` simula un bloque que no entra.
function notionFalso({ perder = false } = {}) {
  const paginas = new Map([['padre', { hijos: [] }]])
  let n = 0
  const srv = createServer(async (req, res) => {
    let cuerpo = ''
    for await (const c of req) cuerpo += c
    const d = cuerpo ? JSON.parse(cuerpo) : null
    const enviar = (code, x) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(x))
    if (req.headers.authorization !== 'Bearer llave-falsa') return enviar(401, { message: 'no' })
    const ruta = new URL(req.url, 'http://x').pathname.replace('/v1/', '')
    const leer = b => ({ ...b, [b.type]: { rich_text: b[b.type].rich_text.map(t => ({ plain_text: t.text.content })) } })
    if (req.method === 'POST' && ruta === 'pages') {
      const id = `pagina-${++n}`
      const titulo = d.properties.title.title.map(t => t.text.content).join('')
      paginas.set(id, { hijos: (perder ? d.children.slice(1) : d.children).map(leer) })
      paginas.get(d.parent.page_id).hijos.push({ id, type: 'child_page', child_page: { title: titulo } })
      return enviar(200, { id })
    }
    const m = /^blocks\/([^/]+)\/children$/.exec(ruta)
    if (m && req.method === 'GET') return enviar(200, { results: paginas.get(m[1])?.hijos || [], has_more: false })
    if (m && req.method === 'PATCH') {
      paginas.get(m[1]).hijos.push(...d.children.map(leer))
      return enviar(200, {})
    }
    enviar(404, {})
  }).listen(0)
  return { srv, paginas, api: () => `http://127.0.0.1:${srv.address().port}/v1/` }
}

test('notion: crea el avance bajo la página del proyecto, relee y agrega «Más tarde» el mismo día', async () => {
  const f = notionFalso()
  try {
    const config = { api: f.api(), paginas: { tienda: 'padre' }, numerar: true }
    const r1 = await escribirNotion(av('carrito', 'Carrito'), p, { ...dia('2026-03-02'), config, llave: 'llave-falsa' })
    assert.equal(r1.accion, 'creado')
    assert.equal(r1.titulo, '1 · Avance 2 mar · carrito')
    const r2 = await escribirNotion(av('pago', 'Pago'), p, { ...dia('2026-03-02'), config, llave: 'llave-falsa' })
    assert.equal(r2.accion, 'agregado')
    assert.equal(f.paginas.get('padre').hijos.length, 1)
    const r3 = await escribirNotion(av('envío', 'Envío'), p, { ...dia('2026-03-03'), config, llave: 'llave-falsa' })
    assert.equal(r3.titulo, '2 · Avance 3 mar · envío')
  } finally {
    f.srv.close()
  }
})

test('notion: si un bloque no entró, falla en vez de reportar éxito', async () => {
  const f = notionFalso({ perder: true })
  try {
    const config = { api: f.api(), paginas: { tienda: 'padre' } }
    await assert.rejects(escribirNotion(av('x', 'X'), p, { ...dia('2026-03-02'), config, llave: 'llave-falsa' }), /Verificación falló/)
  } finally {
    f.srv.close()
  }
})

test('notion: un proyecto sin página se omite, sin abrir espacios nuevos', async () => {
  const r = await escribirNotion(av('x', 'X'), p, { ...dia('2026-03-02'), config: { paginas: {} }, llave: 'llave-falsa' })
  assert.match(r.omitido, /no tiene página/)
})

test('bloques: títulos, viñetas y párrafos; textos largos en trozos de 1900', () => {
  const b = bloques(`## Hecho\n- uno\nPárrafo ${'x'.repeat(4000)}`)
  assert.deepEqual(b.map(x => x.type), ['heading_2', 'bulleted_list_item', 'paragraph'])
  assert.equal(b[2].paragraph.rich_text.length, 3)
})
