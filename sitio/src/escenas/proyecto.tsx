import { Collapse, States, Stage, Window, type Act, ACENTO } from './ss'
import './marco.css'
import './comun.css'
import './proyecto.css'
import { t } from '../lang'

// Por archivos, no por carpeta. Four of Ana's sessions, all but the builder
// opened from ~. One at a time, what each one touched opens under it and the
// project it goes to lands on its right: the files decide, not the folder.
// The one that only read lands as read only. Poster: all four decided.

type S = { paso: number; dip: boolean }
type Sesion = { titulo: string; desde: string; toques: { h: string; r: string }[]; va: string[] }

const SESIONES = (): Sesion[] => [
  {
    titulo: 'TIENDA',
    desde: '~',
    toques: [
      { h: 'Edit', r: '~/code/tienda/src/carrito.js' },
      { h: 'Bash', r: 'cd ~/code/tienda && git commit' },
    ],
    va: ['tienda'],
  },
  {
    titulo: t('builder · pago', 'builder · payments'),
    desde: '~/wt/tienda-pago',
    toques: [{ h: 'Write', r: 'src/pago.js' }],
    va: ['tienda'],
  },
  {
    titulo: 'BLOG',
    desde: '~',
    toques: [
      { h: 'Edit', r: '~/code/blog/posts/hola.md' },
      { h: 'Edit', r: '~/notas/ideas.md' },
    ],
    va: ['blog', 'notas'],
  },
  {
    titulo: t('pregunta', 'question'),
    desde: '~',
    toques: [{ h: 'Read', r: '~/code/docs/README.md' }],
    va: [],
  },
]

// paso 2i+1 opens session i's files, 2i+2 decides its project
const initial: S = { paso: 0, dip: false }
const poster: S = { paso: 8, dip: false }

async function script(a: Act<S>) {
  await a.wait(600)
  for (let p = 1; p <= 8; p++) {
    if (p % 2) a.mark(`sesion-${(p + 1) / 2}`)
    await a.set({ paso: p })
    await a.wait(p % 2 ? 750 : 550)
  }
  await a.wait(2600)
  a.mark('reset')
  await a.set({ dip: true })
  await a.wait(320)
  await a.snap({ paso: 0 })
  await a.set({ dip: false })
  await a.wait(400)
}

export default function Proyecto() {
  return (
    <Stage<S>
      width={550}
      height={440}
      compact={{ below: 500, width: 400, height: 340 }}
      initial={initial}
      poster={poster}
      script={script}
      accent={ACENTO}
      className="marco oscuro bit pro"
    >
      {(s, _r, layout) => {
        const ancho = layout === 'wide'
        return (
          <Window title={t('Sesiones de hoy', "Today's sessions")} className="marco-win">
            <div className="pro-lista" data-dip={s.dip || undefined}>
              {SESIONES().map((x, i) => {
                const toques = ancho ? x.toques : x.toques.slice(0, 1)
                return (
                  <div className="pro-ses" key={i}>
                    <div className="pro-ses__cab">
                      <span className="pro-ses__t">{x.titulo}</span>
                      <span className="pro-ses__desde">{t('desde', 'from')} {x.desde}</span>
                      <span className="pro-ses__va">
                        <States
                          value={s.paso >= 2 * i + 2 ? 'si' : 'no'}
                          align="end"
                          states={{
                            no: <span className="chip pro-vacio" aria-hidden />,
                            si: x.va.length ? (
                              <span className="pro-chips">
                                {x.va.map((v) => (
                                  <span className="chip" key={v}>{v}</span>
                                ))}
                              </span>
                            ) : (
                              <span className="chip" data-k="gris">{t('solo lectura', 'read only')}</span>
                            ),
                          }}
                        />
                      </span>
                    </div>
                    <Collapse open={s.paso >= 2 * i + 1}>
                      <div className="pro-toques">
                        {toques.map((tq, j) => (
                          <div className="pro-toque" key={j}>
                            <span className="pro-toque__h">{tq.h}</span>
                            <span className="pro-toque__r">{tq.r}</span>
                          </div>
                        ))}
                      </div>
                    </Collapse>
                  </div>
                )
              })}
            </div>
          </Window>
        )
      }}
    </Stage>
  )
}
