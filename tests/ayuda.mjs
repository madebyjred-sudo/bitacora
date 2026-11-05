// Montaje de pruebas: repos de verdad en una carpeta temporal y las transcripciones de
// tests/fixtures con sus rutas apuntando ahí. Nada de esto sale de datos reales.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

process.env.TZ = 'America/Bogota'
export const AQUI = dirname(fileURLToPath(import.meta.url))
export const CLI = join(AQUI, '..', 'bin', 'bitacora.mjs')

// Azar con semilla: los secretos de prueba se fabrican al correr, no viven en el repo.
function azar(semilla) {
  let x = semilla >>> 0
  return (n, alfabeto) => {
    let s = ''
    for (let i = 0; i < n; i++) {
      x = (x * 1664525 + 1013904223) >>> 0
      s += alfabeto[x % alfabeto.length]
    }
    return s
  }
}
const AN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const HEX = '0123456789abcdef'
const MAY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function secretos(semilla = 7) {
  const r = azar(semilla)
  const b64 = n => r(n, AN + '-_')
  return [
    ['anthropic', 'sk-' + 'ant-api03-' + b64(48)],
    ['openrouter', 'sk-' + 'or-v1-' + r(64, HEX)],
    ['github', 'gh' + 'p_' + r(36, AN)],
    ['aws', 'AK' + 'IA' + r(16, MAY)],
    ['google', 'AI' + 'za' + r(35, AN + '-_')],
    ['stripe', 'sk' + '_live_' + r(24, AN)],
    ['slack', 'xo' + 'xb-' + r(11, '0123456789') + '-' + r(12, '0123456789') + '-' + r(24, AN)],
    ['jwt', 'ey' + 'J' + b64(20) + '.ey' + 'J' + b64(30) + '.' + b64(43)],
    ['env', 'DATABASE_PASSWORD=' + r(18, AN)],
    ['url', 'postgres://app:' + r(14, AN) + '@db.ejemplo.com:5432/app'],
  ]
}
// Lo que de verdad no debe salir: el valor, no el nombre de la variable ni el host.
export const valorSecreto = ([tipo, s]) => (tipo === 'env' ? s.split('=')[1] : tipo === 'url' ? s.split(':')[2].split('@')[0] : s)

const git = (cwd, args, fecha, correo = 'yo@ejemplo.com') => {
  const env = { ...process.env, GIT_AUTHOR_DATE: fecha, GIT_COMMITTER_DATE: fecha, GIT_AUTHOR_NAME: 'Yo', GIT_AUTHOR_EMAIL: correo, GIT_COMMITTER_NAME: 'Yo', GIT_COMMITTER_EMAIL: correo }
  const r = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout.trim()
}
const escribir = (ruta, texto) => {
  mkdirSync(dirname(ruta), { recursive: true })
  writeFileSync(ruta, texto)
}

export function montar() {
  const raiz = mkdtempSync(join(tmpdir(), 'bitacora-'))
  const tienda = join(raiz, 'tienda')
  escribir(join(tienda, 'src', 'carrito.js'), 'export const total = x => x\n')
  escribir(join(tienda, 'src', 'envio.js'), 'export const envio = 0\n')
  git(tienda, ['init', '-q', '-b', 'main'], '2026-02-20T12:00:00Z')
  git(tienda, ['config', 'user.email', 'yo@ejemplo.com'], '2026-02-20T12:00:00Z')
  git(tienda, ['add', '-A'], '2026-02-20T12:00:00Z')
  git(tienda, ['commit', '-qm', 'Inicio'], '2026-02-20T12:00:00Z')
  escribir(join(tienda, 'src', 'carrito.js'), 'export const total = x => x * 0.9\n')
  git(tienda, ['commit', '-qam', 'Carrito suma bien los descuentos'], '2026-03-02T14:30:00Z')
  const wt = join(raiz, 'wt-tienda-pago')
  git(tienda, ['worktree', 'add', '-q', '-b', 'pago', wt], '2026-03-02T15:00:00Z')
  escribir(join(wt, 'src', 'pago.js'), 'export const pagar = () => true\n')
  git(wt, ['add', '-A'], '2026-03-02T15:50:00Z')
  git(wt, ['commit', '-qm', 'Pago con tarjeta'], '2026-03-02T15:50:00Z')

  const blog = join(raiz, 'blog')
  escribir(join(blog, 'README.md'), '# Blog\n')
  escribir(join(blog, 'posts', 'hola.md'), '')
  escribir(join(blog, 'config.js'), '')
  git(blog, ['init', '-q', '-b', 'main'], '2026-02-20T12:00:00Z')
  git(blog, ['config', 'user.email', 'yo@ejemplo.com'], '2026-02-20T12:00:00Z')
  git(blog, ['add', '-A'], '2026-02-20T12:00:00Z')
  git(blog, ['commit', '-qm', 'Inicio'], '2026-02-20T12:00:00Z')
  escribir(join(blog, 'posts', 'hola.md'), 'Hola\n')
  git(blog, ['commit', '-qam', 'Post hola'], '2026-03-03T17:05:00Z')
  escribir(join(blog, 'README.md'), '# Blog ajeno\n')
  git(blog, ['commit', '-qam', 'Arreglo de otra persona'], '2026-03-03T18:00:00Z', 'otro@ejemplo.com')
  escribir(join(blog, 'config.js'), 'cfg\n') // queda sin commit

  const notas = join(raiz, 'notas')
  escribir(join(notas, 'STATE.md'), '# Notas\n')
  escribir(join(notas, 'ideas.md'), 'Idea\n')

  const sec = secretos()
  const sesiones = join(raiz, 'sesiones')
  const valores = {
    '{{RAIZ}}': raiz,
    '{{CASA}}': homedir(),
    '{{SECRETOS}}': sec.map(x => x[1]).join('\n'),
    '{{SECRETO_ECO}}': sec[0][1],
  }
  const copiar = (de, a) => {
    for (const n of readdirSync(de)) {
      const o = join(de, n)
      const d = join(a, n)
      if (statSync(o).isDirectory()) {
        mkdirSync(d, { recursive: true })
        copiar(o, d)
      } else {
        let t = readFileSync(o, 'utf8')
        for (const [k, v] of Object.entries(valores)) t = t.split(k).join(JSON.stringify(v).slice(1, -1))
        escribir(d, t)
      }
    }
  }
  copiar(join(AQUI, 'fixtures', 'sesiones'), sesiones)
  const config = { zona: 'America/Bogota', ignorarPorDefecto: false, ignorar: [join(raiz, 'sesiones')], modelo: { via: 'ninguno' } }
  const archivoConfig = join(raiz, 'bitacora.json')
  writeFileSync(archivoConfig, JSON.stringify(config))
  const estado = join(raiz, 'estado')
  return { raiz, tienda, wt, blog, notas, sesiones, sec, config, archivoConfig, estado }
}

export const dia = d => {
  const desde = new Date(`${d}T00:00:00-05:00`).getTime()
  return { desde, hasta: desde + 864e5 }
}

export function cli(m, args, entorno = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args, '--config', m.archivoConfig, '--sesiones', m.sesiones], {
    encoding: 'utf8',
    env: { ...process.env, BITACORA_ESTADO_DIR: m.estado, BITACORA_CONFIG_DIR: join(m.raiz, 'cfg'), TZ: 'America/Bogota', ...entorno },
  })
  return { codigo: r.status, salida: r.stdout, error: r.stderr }
}
