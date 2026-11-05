import { Collapse, Count, Stage, Window, type Act, ACENTO } from './ss'
import './marco.css'
import './comun.css'
import './horas.css'
import { horas, t } from '../lang'

// Horas. Ana's week as bitacora horas --semana proposes it, in a plain table
// window. The rows arrive one at a time with their confidence; the one with no
// project is held, on the coral veil. The card adds up what's proposed and says
// nothing was logged. Poster: the whole week.

type S = { filas: number; tarjeta: boolean; total: number; dip: boolean }
type Fila = { dia: string; proyecto: string; horas: number; c: 'A' | 'B' | 'C'; soloAncho?: boolean }

const FILAS = (): Fila[] => [
  { dia: t('lun', 'Mon'), proyecto: 'tienda', horas: 1.75, c: 'A' },
  { dia: t('lun', 'Mon'), proyecto: 'blog', horas: 0.5, c: 'B', soloAncho: true },
  { dia: t('mar', 'Tue'), proyecto: 'tienda', horas: 2.5, c: 'A' },
  { dia: t('mar', 'Tue'), proyecto: 'blog', horas: 0.75, c: 'A' },
  { dia: t('mar', 'Tue'), proyecto: 'notas', horas: 0.25, c: 'B', soloAncho: true },
  { dia: t('mié', 'Wed'), proyecto: 'tienda', horas: 1.5, c: 'B' },
  { dia: t('mié', 'Wed'), proyecto: t('sin proyecto', 'no project'), horas: 0.5, c: 'C' },
]

const propuestas = (fs: Fila[]) => fs.filter((f) => f.c !== 'C').reduce((a, f) => a + f.horas, 0)
// The hidden card starts at a figure as wide as the total, so it doesn't jump in width
// Monday is already on screen when the loop starts, so the table is never bare
const YA = 3
const initial: S = { filas: YA, tarjeta: false, total: 1.25, dip: false }
const poster: S = { filas: FILAS().length, tarjeta: true, total: propuestas(FILAS()), dip: false }
const dos = (n: number) => t(n.toFixed(2).replace('.', ','), n.toFixed(2))

async function script(a: Act<S>) {
  await a.wait(600)
  a.mark('rows')
  const filas = FILAS().filter((f) => a.layout === 'wide' || !f.soloAncho)
  for (let i = YA + 1; i <= filas.length; i++) {
    await a.set({ filas: i })
    await a.wait(380)
  }
  await a.wait(400)
  a.mark('card')
  await a.set({ tarjeta: true })
  await a.wait(300)
  await a.set({ total: propuestas(filas) })
  await a.wait(3300)
  a.mark('reset')
  await a.set({ tarjeta: false, dip: true })
  await a.wait(320)
  await a.snap({ filas: YA, total: 1.25 })
  await a.set({ dip: false })
  await a.wait(400)
}

export default function Horas() {
  return (
    <Stage<S>
      width={550}
      height={440}
      compact={{ below: 500, width: 400, height: 340 }}
      initial={initial}
      poster={poster}
      script={script}
      accent={ACENTO}
      className="marco bit hrs"
    >
      {(s, _r, layout) => {
        const filas = FILAS().filter((f) => layout === 'wide' || !f.soloAncho)
        return (
          <>
            <Window title="horas-semana.csv" className="marco-win">
              <div className="hrs-tabla">
                <div className="hrs-f hrs-f--cab">
                  <span>{t('día', 'day')}</span>
                  <span>{t('proyecto', 'project')}</span>
                  <span className="hrs-n">{t('horas', 'hours')}</span>
                  <span>{t('confianza', 'confidence')}</span>
                </div>
                {filas.map((f, i) => (
                  <Collapse key={i} open={s.filas > i} className="hrs-fila" data-dip={(s.dip && i >= YA) || undefined}>
                    <div className="hrs-f" data-c={f.c}>
                      <span>{f.dia}</span>
                      <span>{f.proyecto}</span>
                      <span className="hrs-n">{dos(f.horas)}</span>
                      <span>{f.c}</span>
                    </div>
                  </Collapse>
                ))}
              </div>
            </Window>
            <div className="marco-sat sat hrs-sat" data-show={s.tarjeta || undefined}>
              <div className="sat__cab">{t('Propuestas', 'Proposed')}</div>
              <Count className="sat__n" value={s.total} format={horas} duration={900} />
              <div className="sat__pie">{t('Nada se cargó', 'Nothing was logged')}</div>
            </div>
          </>
        )
      }}
    </Stage>
  )
}
