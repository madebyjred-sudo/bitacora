import { Collapse, Count, Prompt, Caret, Stage, Window, type Act, ACENTO } from './ss'
import './marco.css'
import './comun.css'
import './hoy.css'
import { horas, t } from '../lang'

// Bitácora hoy, in the page's one frame. The terminal is mid-session: Monday's
// view of Ana's day is on screen. Tuesday's is typed at the bottom and its
// lines push Monday up, a project and its commits at a time. The card lands
// on the terminal's empty right side and rolls to the day's hours with her.
// Poster: the finished run.

type S = { cmd: string; run: boolean; lineas: number; tarjeta: boolean; horas: number; dip: boolean }
type Linea = { k: 'dim' | 'proyecto' | 'commit'; a: string; b?: string; soloAncho?: boolean }

const COMANDO = 'bitacora hoy'

const sesiones = (n: number) => t(`${n} sesiones`, `${n} sessions`)

const ANTES = (): Linea[] => [
  { k: 'dim', a: t('lun 2 nov · 4 sesiones', 'Mon Nov 2 · 4 sessions') },
  { k: 'proyecto', a: 'tienda', b: t('2 commits · 2 sesiones · 1,75 h', '2 commits · 2 sessions · 1.75 h') },
  { k: 'commit', a: 'a83f0c2', b: t('Envío gratis desde 50', 'Free shipping over 50'), soloAncho: true },
  { k: 'proyecto', a: 'blog', b: t('1 sesión', '1 session') },
]

const LINEAS = (): Linea[] => [
  { k: 'dim', a: t('mar 3 nov · ', 'Tue Nov 3 · ') + sesiones(6) },
  { k: 'proyecto', a: 'tienda', b: t('4 commits · 3 sesiones · 2,5 h', '4 commits · 3 sessions · 2.5 h') },
  { k: 'commit', a: '9f2c1ab', b: t('Pago con tarjeta', 'Card payments') },
  { k: 'commit', a: '41d07ee', b: t('Carrito suma bien los descuentos', 'Cart adds discounts right'), soloAncho: true },
  { k: 'proyecto', a: 'blog', b: t('1 commit · 1 sesión · 0,75 h', '1 commit · 1 session · 0.75 h') },
  { k: 'commit', a: 'c3e9a10', b: t('Post hola', 'Hello post') },
  { k: 'proyecto', a: 'notas', b: t('1 sesión', '1 session') },
  { k: 'dim', a: t('Solo lectura · docs', 'Read only · docs') },
]

const HORAS = 3.25
// The hidden card starts at a figure as wide as the day's, so it doesn't jump in width
const initial: S = { cmd: '', run: false, lineas: 0, tarjeta: false, horas: 0.25, dip: false }
const poster: S = { cmd: COMANDO, run: true, lineas: LINEAS().length, tarjeta: true, horas: HORAS, dip: false }

async function script(a: Act<S>) {
  await a.wait(500)
  a.mark('type')
  await a.type('cmd', COMANDO)
  await a.wait(250)
  await a.key('enter')
  await a.set({ run: true })
  await a.wait(350)
  a.mark('lines')
  for (let i = 1; i <= LINEAS().length; i++) {
    await a.set({ lineas: i })
    await a.wait(LINEAS()[i - 1].k === 'proyecto' ? 420 : 300)
  }
  await a.wait(300)
  a.mark('card')
  await a.set({ tarjeta: true })
  await a.wait(350)
  await a.set({ horas: HORAS })
  await a.wait(3400)
  a.mark('reset')
  await a.set({ tarjeta: false, dip: true })
  await a.wait(320)
  await a.snap({ cmd: '', run: false, lineas: 0, horas: 0.25 })
  await a.set({ dip: false })
  await a.wait(400)
}

function Fila({ l }: { l: Linea }) {
  return (
    <div className="fila" data-k={l.k}>
      {l.k === 'dim' ? <span style={{ gridColumn: '1 / -1' }}>{l.a}</span> : <><span className="a">{l.a}</span><span className="b">{l.b}</span></>}
    </div>
  )
}

export default function Hoy() {
  return (
    <Stage<S>
      width={550}
      height={440}
      compact={{ below: 500, width: 400, height: 340 }}
      initial={initial}
      poster={poster}
      script={script}
      accent={ACENTO}
      keys={{ wide: 'bottom-left', compact: 'top' }}
      className="marco bit hoy"
    >
      {(s, _r, layout) => {
        const ancho = layout === 'wide'
        const queda = (l: Linea) => ancho || !l.soloAncho
        const nuevas = LINEAS().filter(queda)
        const cuenta = ancho ? s.lineas : LINEAS().slice(0, s.lineas).filter(queda).length
        return (
          <>
            <Window chrome="terminal" title="~ · zsh" className="marco-win">
              <div className="feed">
                <div className="feed__in" data-dip={s.dip || undefined}>
                  <Prompt path="~">bitacora hoy --dia 2026-11-02</Prompt>
                  {ANTES().filter(queda).map((l, i) => <Fila key={`a${i}`} l={l} />)}
                  <Prompt path="~">
                    {s.cmd}
                    {!s.run && <Caret still={s.cmd.length > 0 && s.cmd.length < COMANDO.length} />}
                  </Prompt>
                  {nuevas.map((l, i) => (
                    <Collapse key={`n${i}`} open={cuenta > i}>
                      <Fila l={l} />
                    </Collapse>
                  ))}
                </div>
              </div>
            </Window>
            <div className="marco-sat sat hoy-sat" data-show={s.tarjeta || undefined}>
              <div className="sat__cab">{t('Contigo hoy', 'With you today')}</div>
              <Count className="sat__n" value={s.horas} format={horas} duration={900} />
              <div className="sat__pie">{t('5 commits verificados', '5 verified commits')}</div>
            </div>
          </>
        )
      }}
    </Stage>
  )
}
