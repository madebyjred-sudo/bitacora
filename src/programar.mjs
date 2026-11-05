// `bitacora instalar`: lo programa con el programador del sistema (launchd, cron, schtasks).
// Lo que corre es `bitacora escribir --programado`: el despertador decide si gasta modelo.
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { carpetas } from './config.mjs'

const ETIQUETA = 'com.bitacora.escribir'
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function orden(cli, extra = []) {
  return [process.execPath, resolve(cli), 'escribir', '--programado', ...extra]
}

export function plist({ hora, minuto, argumentos, log, path = process.env.PATH }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${ETIQUETA}</string>
  <key>ProgramArguments</key>
  <array>
${argumentos.map(a => `    <string>${xml(a)}</string>`).join('\n')}
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${xml(path)}</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>${hora}</integer><key>Minute</key><integer>${minuto}</integer></dict>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict>
</plist>
`
}

const comillas = a => (/^[\w./:=@-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)
export const lineaCron = ({ hora, minuto, argumentos, log }) => `${minuto} ${hora} * * * ${argumentos.map(comillas).join(' ')} >> ${comillas(log)} 2>&1 # ${ETIQUETA}`

export function instalar({ a = '21:00', cli, extra = [], ensayo = false }) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(a)
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`Hora inválida «${a}». Usa HH:MM.`)
  const [hora, minuto] = [+m[1], +m[2]]
  mkdirSync(carpetas.estado, { recursive: true })
  const log = join(carpetas.estado, 'programado.log')
  const argumentos = orden(cli, extra)
  if (process.platform === 'darwin') {
    const dir = join(homedir(), 'Library', 'LaunchAgents')
    const archivo = join(dir, `${ETIQUETA}.plist`)
    const contenido = plist({ hora, minuto, argumentos, log })
    if (ensayo) return { sistema: 'launchd', archivo, contenido }
    mkdirSync(dir, { recursive: true })
    spawnSync('launchctl', ['bootout', `gui/${process.getuid()}/${ETIQUETA}`])
    writeFileSync(archivo, contenido)
    const r = spawnSync('launchctl', ['bootstrap', `gui/${process.getuid()}`, archivo], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`launchctl no lo cargó: ${r.stderr.trim()}`)
    return { sistema: 'launchd', archivo, hora: a, log }
  }
  if (process.platform === 'win32') {
    const tr = argumentos.map(x => `"${x}"`).join(' ')
    const args = ['/Create', '/F', '/SC', 'DAILY', '/ST', `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`, '/TN', 'Bitacora', '/TR', tr]
    if (ensayo) return { sistema: 'schtasks', contenido: `schtasks ${args.join(' ')}` }
    const r = spawnSync('schtasks', args, { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`schtasks falló: ${r.stderr || r.stdout}`)
    return { sistema: 'schtasks', hora: a, log }
  }
  const linea = lineaCron({ hora, minuto, argumentos, log })
  if (ensayo) return { sistema: 'cron', contenido: linea }
  const actual = spawnSync('crontab', ['-l'], { encoding: 'utf8' }).stdout || ''
  const resto = actual.split('\n').filter(l => l && !l.includes(`# ${ETIQUETA}`))
  const r = spawnSync('crontab', ['-'], { input: [...resto, linea].join('\n') + '\n', encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`crontab falló: ${r.stderr}`)
  return { sistema: 'cron', hora: a, log }
}

export function desinstalar() {
  if (process.platform === 'darwin') {
    const archivo = join(homedir(), 'Library', 'LaunchAgents', `${ETIQUETA}.plist`)
    spawnSync('launchctl', ['bootout', `gui/${process.getuid()}/${ETIQUETA}`])
    const habia = existsSync(archivo)
    rmSync(archivo, { force: true })
    return { sistema: 'launchd', quitado: habia }
  }
  if (process.platform === 'win32') {
    const r = spawnSync('schtasks', ['/Delete', '/F', '/TN', 'Bitacora'])
    return { sistema: 'schtasks', quitado: r.status === 0 }
  }
  const actual = spawnSync('crontab', ['-l'], { encoding: 'utf8' }).stdout || ''
  const resto = actual.split('\n').filter(l => l && !l.includes(`# ${ETIQUETA}`))
  spawnSync('crontab', ['-'], { input: resto.join('\n') + (resto.length ? '\n' : ''), encoding: 'utf8' })
  return { sistema: 'cron', quitado: resto.length !== actual.split('\n').filter(Boolean).length }
}

export { ETIQUETA }
