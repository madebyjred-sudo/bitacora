// Modelo BYO. Por defecto lo redacta el mismo arnés (`claude -p`); alternativas: `codex exec`,
// OpenRouter con tu llave, o `archivo` (respuesta fija, para pruebas).
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { conTecho } from './despertador.mjs'

function correr(cmd, args, entrada, entorno, techo) {
  return new Promise((resolver, rechazar) => {
    const p = spawn(cmd, args, { cwd: tmpdir(), env: { ...process.env, ...entorno }, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    p.stdout.on('data', d => (out += d))
    p.stderr.on('data', d => (err += d))
    p.on('error', e => rechazar(new Error(`No pude lanzar ${cmd}: ${e.message}`)))
    const t = setTimeout(() => {
      p.kill('SIGTERM')
      rechazar(new Error(`${cmd} pasó el techo de ${Math.round(techo / 1000)} s`))
    }, techo)
    p.on('close', code => {
      clearTimeout(t)
      code === 0 ? resolver(out.trim()) : rechazar(new Error(`${cmd} salió con ${code}: ${(err || out).trim().slice(-400)}`))
    })
    p.stdin.end(entrada)
  })
}

export async function redactar(prompt, { via = 'claude', nombre, techo = 600e3, entorno = {} } = {}) {
  if (via === 'archivo') return readFileSync(nombre, 'utf8').trim()
  if (via === 'claude') {
    // Sin herramientas y sin guardar la sesión: si no, la próxima corrida se leería a sí misma.
    const args = ['-p', '--no-session-persistence', '--tools', '', '--output-format', 'text']
    if (nombre) args.push('--model', nombre)
    return correr('claude', args, prompt, entorno, techo)
  }
  if (via === 'codex') {
    return correr('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', ...(nombre ? ['-m', nombre] : []), '-'], prompt, entorno, techo)
  }
  if (via === 'openrouter') {
    const llave = entorno.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
    if (!llave) throw new Error('Falta OPENROUTER_API_KEY.')
    const r = await conTecho(fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: nombre || 'anthropic/claude-sonnet-4.5', messages: [{ role: 'user', content: prompt }] }),
    }), techo)
    const d = await r.json()
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${JSON.stringify(d).slice(0, 300)}`)
    return (d.choices?.[0]?.message?.content || '').trim()
  }
  throw new Error(`Modelo desconocido «${via}». Usa claude, codex, openrouter o archivo.`)
}
