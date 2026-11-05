import { Count, States, Stage, Window, type Act, ACENTO } from './ss'
import './marco.css'
import './comun.css'
import './secretos.css'
import { t } from '../lang'

// Secretos. What Ana pasted into a session, as the transcript keeps it: three
// credentials in a message. Before anything goes to the model, each one turns
// into its mark, left to right, and the card counts down to zero. The marks
// are the redactor's real output for these strings. Poster: the clean message.

type S = { tachados: number; dip: boolean }

const SECRETOS = [
  { campo: 'OPENROUTER_API_KEY=', crudo: 'sk-or-v1-8f3a9c2e7b1d…', marca: '[secreto:openrouter]' },
  { campo: 'STRIPE_KEY=', crudo: 'sk_live_51HxQ2Lk8Wm3…', marca: '[secreto:stripe]' },
  { campo: 'postgres://app:', crudo: 'Hn72kqWp9z', marca: '[secreto:url-con-clave]', cola: '@db/app' },
]

const initial: S = { tachados: 0, dip: false }
const poster: S = { tachados: 3, dip: false }

async function script(a: Act<S>) {
  await a.wait(1100)
  a.mark('tachar')
  for (let i = 1; i <= SECRETOS.length; i++) {
    await a.set({ tachados: i })
    await a.wait(650)
  }
  await a.wait(3000)
  a.mark('reset')
  await a.set({ dip: true })
  await a.wait(320)
  await a.snap({ tachados: 0 })
  await a.set({ dip: false })
  await a.wait(400)
}

export default function Secretos() {
  return (
    <Stage<S>
      width={550}
      height={440}
      compact={{ below: 500, width: 400, height: 340 }}
      initial={initial}
      poster={poster}
      script={script}
      accent={ACENTO}
      className="marco oscuro bit sec"
    >
      {(s) => (
        <>
          <Window title="BLOG · Claude Code" className="marco-win">
            <div className="sec-chat">
              <div className="sec-msj">
                <p>{t('Configura el blog con estas llaves:', 'Set up the blog with these keys:')}</p>
                {SECRETOS.map((x, i) => (
                  <div className="sec-linea" key={i} data-dip={s.dip || undefined}>
                    {x.campo}
                    <States
                      value={s.tachados > i ? 'marca' : 'crudo'}
                      align="start"
                      states={{ crudo: <span className="sec-crudo">{x.crudo}</span>, marca: <span className="sec-marca">{x.marca}</span> }}
                    />
                    {x.cola}
                  </div>
                ))}
              </div>
              <p className="sec-resp">{t('Listo: config.js lee las tres desde el entorno.', 'Done: config.js reads all three from the environment.')}</p>
            </div>
          </Window>
          <div className="marco-sat sat sec-sat" data-show>
            <div className="sat__cab">{t('Al modelo', 'To the model')}</div>
            <Count className="sat__n" value={3 - s.tachados} duration={600} />
            <div className="sat__pie">{t('secretos', 'secrets')}</div>
          </div>
        </>
      )}
    </Stage>
  )
}
