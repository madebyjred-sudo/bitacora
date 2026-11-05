// B4 · el avance: lo que el modelo no puede probar se borra; las sesiones de solo lectura no generan avance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { montar, dia } from './ayuda.mjs'
import { actividad } from '../src/actividad.mjs'
import { verificar, deterministico, markdown, proyectosConTrabajo, material } from '../src/avance.mjs'
import { redactar } from '../src/modelo.mjs'

const m = montar()
const lunes = actividad({ ...dia('2026-03-02'), config: m.config, raizSesiones: m.sesiones })
const tienda = lunes.proyectos.find(p => p.nombre === 'tienda')
const inicio = spawnSync('git', ['-C', m.tienda, 'rev-list', '--max-parents=0', 'HEAD'], { encoding: 'utf8' }).stdout.trim()

const servidor = createServer((req, res) => res.writeHead(req.url === '/vivo' ? 200 : 404).end()).listen(0)
const url = p => `http://127.0.0.1:${servidor.address().port}${p}`
test.after(() => servidor.close())

test('el modelo inventa: se borra todo lo que no se prueba', async () => {
  const [carrito, pago] = tienda.commits
  const respuesta = `Tema: carrito y pago
El carrito aplica bien los descuentos y entró el pago con tarjeta (${carrito.corto}).
## Hecho
- Carrito con el descuento aplicado una vez [commit ${carrito.corto}]
- Pago con tarjeta [archivo src/pago.js] [commit ${pago.corto}]
- Guía publicada [url ${url('/vivo')}]
- Integración con PayPal [commit deadbee]
- Subido a producción
- Página de ayuda [url ${url('/muerta')}]
- Arreglo viejo [commit ${inicio.slice(0, 7)}]
- Archivo que nadie tocó [archivo src/fantasma.js]
## Riesgo para revisar primero
- El test de pago no cubre reembolsos
## Pendiente
- Probar con una tarjeta real — decide Ana
- Revisar el cambio 1234abc
## Fuentes
- Una fuente inventada`
  const archivo = join(m.raiz, 'respuesta.md')
  writeFileSync(archivo, respuesta)
  const { secciones, descartadas } = await verificar(await redactar('x', { via: 'archivo', nombre: archivo }), tienda)
  assert.equal(secciones.hecho.length, 3)
  assert.deepEqual(descartadas.map(d => d.linea.slice(2, 20)).sort(), ['Archivo que nadie ', 'Arreglo viejo [com', 'Integración con Pa', 'Página de ayuda [u', 'Revisar el cambio ', 'Subido a producció'].sort())
  assert.equal(secciones.tema, 'carrito y pago')
  assert.ok(!JSON.stringify(secciones).includes('—'))
  const av = markdown(secciones, tienda, dia('2026-03-02'))
  assert.ok(!av.cuerpo.includes('Una fuente inventada'))
  assert.match(av.cuerpo, /## Fuentes\n- Sesiones de Claude Code: TIENDA \(a1111111\)/)
})

test('las sesiones de solo lectura no generan avance', () => {
  const soloC = actividad({ desde: Date.parse('2026-03-03T13:30:00Z'), hasta: Date.parse('2026-03-03T15:00:00Z'), config: m.config, raizSesiones: m.sesiones })
  assert.equal(soloC.sesiones.length, 1)
  assert.deepEqual(proyectosConTrabajo(soloC), [])
  const martes = actividad({ ...dia('2026-03-03'), config: m.config, raizSesiones: m.sesiones })
  const blog = martes.proyectos.find(p => p.nombre === 'blog')
  assert.ok(!material(blog, dia('2026-03-03')).texto.includes('README del blog'))
})

test('cinco días: ninguna viñeta de Hecho sin fuente verificada', async () => {
  let avances = 0
  for (const d of ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']) {
    const act = actividad({ ...dia(d), config: m.config, raizSesiones: m.sesiones })
    for (const p of proyectosConTrabajo(act)) {
      const sec = deterministico(p)
      const texto = ['## Hecho', ...sec.hecho].join('\n')
      const { secciones, descartadas } = await verificar(texto, p)
      assert.deepEqual(descartadas, [], `${d} ${p.nombre}`)
      assert.ok(secciones.hecho.length && secciones.hecho.every(l => /\[(commit|archivo|url) /.test(l)))
      avances++
    }
  }
  // lun: tienda · mar: blog, notas, tienda · mié: blog · jue y vie: nada.
  assert.equal(avances, 5)
})

test('archivos escritos sin commit van a «Riesgo para revisar primero»', () => {
  const mie = actividad({ ...dia('2026-03-04'), config: m.config, raizSesiones: m.sesiones })
  const blog = mie.proyectos.find(p => p.nombre === 'blog')
  const av = markdown(deterministico(blog), blog, dia('2026-03-04'))
  assert.match(av.cuerpo, /## Riesgo para revisar primero\n- 1 archivo escrito hoy sin commit: config.js/)
})
