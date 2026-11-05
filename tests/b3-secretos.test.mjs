// B3 · redactor de secretos: diez secretos conocidos en una transcripción, cero llegan al prompt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montar, dia, valorSecreto, secretos } from './ayuda.mjs'
import { actividad } from '../src/actividad.mjs'
import { material, prompt, deterministico, markdown } from '../src/avance.mjs'
import { tachar } from '../src/secretos.mjs'

const m = montar()

test('fixture con 10 secretos: 0 llegan al prompt', () => {
  const act = actividad({ ...dia('2026-03-04'), config: m.config, raizSesiones: m.sesiones })
  const blog = act.proyectos.find(p => p.nombre === 'blog')
  const crudo = blog.sesiones.flatMap(x => x.sesion.eventos.map(e => e.texto)).join('\n')
  for (const s of m.sec) assert.ok(crudo.includes(valorSecreto(s)), `el fixture trae ${s[0]}`)
  const mat = material(blog, dia('2026-03-04'))
  const p = prompt(mat.texto, blog)
  const fugas = m.sec.filter(s => p.includes(valorSecreto(s))).map(s => s[0])
  assert.deepEqual(fugas, [])
  assert.ok(mat.hallados.length >= 10)
})

test('cada formato por separado', () => {
  for (const sem of [1, 2, 3]) {
    for (const s of secretos(sem)) {
      const { texto } = tachar(`va esto: ${s[1]} y sigue`)
      assert.ok(!texto.includes(valorSecreto(s)), `${s[0]} (semilla ${sem}): ${texto}`)
    }
  }
})

test('llave privada, bearer, JSON y una cadena larga sin formato conocido', () => {
  // Armada por concatenacion: la copia publica no puede traer un literal con
  // forma de llave privada, aunque el cuerpo sea de prueba
  const llavePrivada = (cuerpo) =>
    ['-----' + 'BEGIN OPENSSH PRIVATE KEY-----', cuerpo, '-----' + 'END OPENSSH PRIVATE KEY-----'].join('\n')
  const casos = [
    llavePrivada('cuerpo de prueba, no una llave'),
    'curl -H "Authorization: Bearer Qm9uZ29Mb25nVG9rZW5WYWx1ZTEyMzQ1Njc4OQ"',
    '{"client_secret": "kq83JdLs92mXx01pQ"}',
    'token: Zx81LkQp02mNv77RtYu3WqAs9DfGh4Jk',
    'export OPENAI_API_KEY="abcd1234efgh5678"',
  ]
  for (const c of casos) {
    const { texto, hallados } = tachar(c)
    assert.ok(hallados.length, c)
    assert.ok(texto.includes('[secreto:'), texto)
  }
})

test('no tacha lo que no es secreto', () => {
  const inocente = [
    'commit 66060d4 y 2fbdf5ca1b2c3d4e5f60718293a4b5c6d7e8f901',
    'sesión 53185512-71b0-46d8-a123-2817a5a690ba',
    '/Users/ana/proyectos/tienda/src/componentes/CarritoDeCompras.tsx',
    'npm run build && node --test tests/*.test.mjs',
    'El carrito suma bien los descuentos en la vista del pedido',
  ]
  for (const t of inocente) assert.equal(tachar(t).texto, t)
})

test('un secreto conocido dentro de VAR=valor se tacha una sola vez, con su tipo', () => {
  const s = secretos(4)[1][1]
  const { texto, hallados } = tachar(`OPENROUTER_API_KEY=${s}`)
  assert.equal(texto, 'OPENROUTER_API_KEY=[secreto:openrouter]')
  assert.deepEqual(hallados.map(h => h.tipo), ['openrouter'])
})

test('correos solo si se pide', () => {
  assert.equal(tachar('escribe a ana@ejemplo.com').texto, 'escribe a ana@ejemplo.com')
  assert.equal(tachar('escribe a ana@ejemplo.com', { correos: true }).texto, 'escribe a [correo]')
})

test('el avance escrito tampoco los trae (asunto de commit con una llave)', () => {
  const s = secretos(9)[2][1]
  const p = { nombre: 'x', raiz: '/r', raices: new Set(), tipo: 'carpeta', archivos: new Set(), sesiones: [], commits: [{ hash: 'a'.repeat(40), corto: 'aaaaaaa', ts: 0, asunto: `Rota la llave ${s}`, archivos: [] }] }
  const av = markdown(deterministico(p), p, { desde: 0 })
  assert.ok(!tachar(av.cuerpo).texto.includes(s))
})
