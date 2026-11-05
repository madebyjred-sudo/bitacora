// Ventanas de tiempo en la zona local (process.env.TZ si la config la fija).
const MESES = 'ene feb mar abr may jun jul ago sep oct nov dic'.split(' ')
const DIAS = 'dom lun mar mié jue vie sáb'.split(' ')

export function inicioDelDia(t) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function diaDe(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto || '')
  if (!m) throw new Error(`Fecha inválida «${texto}». Usa AAAA-MM-DD.`)
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime()
}

export function ventanaDia(dia, ahora = Date.now()) {
  const desde = dia ? diaDe(dia) : inicioDelDia(ahora)
  const fin = new Date(desde)
  fin.setDate(fin.getDate() + 1)
  return { desde, hasta: Math.min(fin.getTime(), ahora) }
}

// Lunes 00:00 a domingo 24:00 de la semana que contiene `dia`.
export function ventanaSemana(dia, ahora = Date.now()) {
  const d = new Date(dia ? diaDe(dia) : inicioDelDia(ahora))
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const fin = new Date(d)
  fin.setDate(fin.getDate() + 7)
  return { desde: d.getTime(), hasta: Math.min(fin.getTime(), ahora) }
}

export const iso = t => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const corta = t => `${new Date(t).getDate()} ${MESES[new Date(t).getMonth()]}`
export const diaSemana = t => DIAS[new Date(t).getDay()]
export const hora = t => {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
