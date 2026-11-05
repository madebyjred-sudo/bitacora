// El despertador: decide si vale la pena gastar modelo. Módulo suelto (no importa nada de Bitácora).
//
//   const d = despertador({ nombre, carpeta })
//   const cambio = d.cambio(huella)      false si la huella es igual a la de la última corrida
//   d.guardar(huella)                    se guarda ANTES del modelo: un fallo no re-avisa lo mismo
//   await d.conCandado(fn)               una corrida a la vez; un candado de un proceso muerto se recupera
//   await conTecho(promesa, ms)          corta lo que se pase del techo de tiempo
//   esSilencio(salida)                   el modelo respondió [SILENT]: no hay nada que decir
import { mkdirSync, readFileSync, writeFileSync, rmSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export const huellaDe = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex')

const vivo = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

export function despertador({ nombre, carpeta }) {
  const dir = join(carpeta, nombre)
  mkdirSync(dir, { recursive: true })
  const archivo = join(dir, 'huella')
  const leer = f => {
    try {
      return readFileSync(f, 'utf8').trim()
    } catch {
      return null
    }
  }
  return {
    dir,
    cambio: huella => huellaDe(huella) !== leer(archivo),
    guardar: huella => writeFileSync(archivo, huellaDe(huella) + '\n'),
    registrar: linea => appendFileSync(join(dir, 'corridas.log'), `${new Date().toISOString()} ${linea}\n`),
    async conCandado(fn) {
      const candado = join(dir, 'candado')
      try {
        mkdirSync(candado)
      } catch {
        const pid = Number(leer(join(candado, 'pid')))
        if (pid && vivo(pid)) return { saltada: true }
        rmSync(candado, { recursive: true, force: true })
        mkdirSync(candado)
      }
      writeFileSync(join(candado, 'pid'), String(process.pid))
      try {
        return await fn()
      } finally {
        rmSync(candado, { recursive: true, force: true })
      }
    },
  }
}

export function conTecho(promesa, ms, alCortar) {
  let t
  return Promise.race([
    promesa,
    new Promise((_, rechazar) => {
      t = setTimeout(() => {
        alCortar?.()
        rechazar(new Error(`Pasó el techo de ${Math.round(ms / 1000)} s`))
      }, ms)
    }),
  ]).finally(() => clearTimeout(t))
}

export const esSilencio = salida => String(salida || '').trim() === '[SILENT]'
