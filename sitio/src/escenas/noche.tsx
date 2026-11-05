import { Collapse, States, Stage, Window, type Act, ACENTO } from './ss'
import './marco.css'
import './comun.css'
import './noche.css'
import { t } from '../lang'

// Cada noche: the log of the scheduled run, in the page's one frame on grafito.
// Each night at 21:00 one line arrives at the bottom: the nights with work
// write their notes, the quiet ones say they spent no model. The card on the
// edge shows the night it is. Poster: Thursday, the four nights on screen.

type S = { noche: number; dip: boolean }
type Noche = { dia: string; lineas: { k: 'ok' | 'dim'; a: string }[] }

const NOCHES = (): Noche[] =>
  t(
    [
      { dia: 'lun 2 nov', lineas: [{ k: 'ok', a: 'OK tienda · markdown creado' }, { k: 'ok', a: 'OK blog · notion creado' }] },
      { dia: 'mar 3 nov', lineas: [{ k: 'ok', a: 'OK tienda · markdown creado' }, { k: 'ok', a: 'OK notas · markdown creado' }] },
      { dia: 'mié 4 nov', lineas: [{ k: 'dim', a: 'sin cambios: no gasté modelo' }] },
      { dia: 'jue 5 nov', lineas: [{ k: 'dim', a: 'sin sesiones: no gasté modelo' }] },
    ],
    [
      { dia: 'Mon Nov 2', lineas: [{ k: 'ok', a: 'OK tienda · markdown created' }, { k: 'ok', a: 'OK blog · notion created' }] },
      { dia: 'Tue Nov 3', lineas: [{ k: 'ok', a: 'OK tienda · markdown created' }, { k: 'ok', a: 'OK notas · markdown created' }] },
      { dia: 'Wed Nov 4', lineas: [{ k: 'dim', a: 'no changes: spent no model' }] },
      { dia: 'Thu Nov 5', lineas: [{ k: 'dim', a: 'no sessions: spent no model' }] },
    ],
  )

// The log is never empty: the week before is already there
const ANTES = () =>
  t(
    [
      { dia: 'jue 29 oct', a: 'OK tienda · markdown creado' },
      { dia: 'vie 30 oct', a: 'sin sesiones: no gasté modelo' },
    ],
    [
      { dia: 'Thu Oct 29', a: 'OK tienda · markdown created' },
      { dia: 'Fri Oct 30', a: 'no sessions: spent no model' },
    ],
  )

const initial: S = { noche: 0, dip: false }
const poster: S = { noche: 4, dip: false }

async function script(a: Act<S>) {
  await a.wait(700)
  for (let n = 1; n <= 4; n++) {
    a.mark(`noche-${n}`)
    await a.set({ noche: n })
    await a.wait(1500)
  }
  await a.wait(2000)
  a.mark('reset')
  await a.set({ dip: true })
  await a.wait(320)
  await a.snap({ noche: 0 })
  await a.set({ dip: false })
  await a.wait(400)
}

function Linea({ dia, k, a }: { dia: string; k: 'ok' | 'dim'; a: string }) {
  return (
    <div className="fila noc-fila" data-k={k === 'dim' ? 'dim' : undefined}>
      <span className="noc-dia">{dia} 21:00</span>
      <span>{a}</span>
    </div>
  )
}

export default function NocheEscena() {
  const dias = NOCHES().map((x) => x.dia)
  return (
    <Stage<S>
      width={550}
      height={440}
      compact={{ below: 500, width: 400, height: 340 }}
      initial={initial}
      poster={poster}
      script={script}
      accent={ACENTO}
      className="marco oscuro bit noc"
    >
      {(s) => (
        <>
          <Window chrome="terminal" title="programado.log" className="marco-win">
            <div className="feed">
              <div className="feed__in" data-dip={s.dip || undefined}>
                {ANTES().map((l, i) => (
                  <Linea key={`a${i}`} dia={l.dia} k={l.a.startsWith('OK') ? 'ok' : 'dim'} a={l.a} />
                ))}
                {NOCHES().map((n, i) => (
                  <Collapse key={n.dia} open={s.noche > i}>
                    {n.lineas.map((l, j) => (
                      <Linea key={j} dia={n.dia} k={l.k} a={l.a} />
                    ))}
                  </Collapse>
                ))}
              </div>
            </div>
          </Window>
          <div className="marco-sat sat noc-sat" data-show>
            <div className="sat__cab">
              <States
                value={String(Math.max(1, s.noche))}
                align="start"
                states={Object.fromEntries(dias.map((d, i) => [String(i + 1), d]))}
              />
            </div>
            <div className="sat__n">21:00</div>
            <div className="sat__pie">bitacora escribir</div>
          </div>
        </>
      )}
    </Stage>
  )
}
