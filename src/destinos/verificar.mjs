// Un 200 no prueba que el contenido entró: se relee el destino y se busca cada línea.
const normal = l => l.replace(/^(#+|-|\*)\s+/, '').replace(/\s+/g, ' ').trim()

export function faltantes(leido, md) {
  const plano = normal(leido.replace(/\n/g, ' ')).replace(/\s+/g, ' ')
  const enLeido = new Set(leido.split('\n').map(normal))
  return md
    .split('\n')
    .map(normal)
    .filter(Boolean)
    .filter(l => !enLeido.has(l) && !plano.includes(l.slice(0, 120)))
}
