import { Collapse, Count, Stage, Window, type Act, ACENTO } from './ss'
import './marco.css'
import './comun.css'
import './verificar.css'
import { t } from '../lang'

// Lo que se prueba. The model's draft of tienda's note, as it came back. A
// check runs down «Hecho» one line at a time: each source is looked up, the
// line gets its mark, and what can't be proven is struck in coral. Then the
// struck lines leave and the card counts them. Poster: the clean note.

type S = { revisadas: number; fuera: boolean; tarjeta: boolean; n: number; dip: boolean }
type Linea = { texto: string; fuente: string; ok: boolean; soloAncho?: boolean }

const HECHO = (): Linea[] =>
  t(
    [
      { texto: 'Carrito con el descuento aplicado una vez', fuente: 'commit 41d07ee', ok: true },
      { texto: 'Integración con PayPal', fuente: 'commit deadbee', ok: false },
      { texto: 'Pago con tarjeta', fuente: 'archivo src/pago.js', ok: true },
      { texto: 'Subido a producción', fuente: t('sin fuente', 'no source'), ok: false },
      { texto: 'Guía de pagos publicada', fuente: 'url /pagos', ok: true, soloAncho: true },
    ],
    [
      { texto: 'Cart applies the discount once', fuente: 'commit 41d07ee', ok: true },
      { texto: 'PayPal integration', fuente: 'commit deadbee', ok: false },
      { texto: 'Card payments', fuente: 'file src/pago.js', ok: true },
      { texto: 'Shipped to production', fuente: 'no source', ok: false },
      { texto: 'Payments guide published', fuente: 'url /pagos', ok: true, soloAncho: true },
    ],
  )

const initial: S = { revisadas: 0, fuera: false, tarjeta: false, n: 0, dip: false }
const poster: S = { revisadas: 5, fuera: true, tarjeta: true, n: 2, dip: false }

async function script(a: Act<S>) {
  await a.wait(700)
  a.mark('check')
  const total = a.layout === 'wide' ? 5 : 4
  for (let i = 1; i <= total; i++) {
    await a.set({ revisadas: i })
    await a.wait(560)
  }
  await a.wait(500)
  a.mark('out')
  await a.set({ fuera: true, tarjeta: true })
  await a.wait(300)
  await a.set({ n: 2 })
  await a.wait(3200)
  a.mark('reset')
  await a.set({ tarjeta: false, dip: true })
  await a.wait(320)
  await a.snap({ revisadas: 0, fuera: false, n: 0 })
  await a.set({ dip: false })
  await a.wait(400)
}

export default function Verificar() {
  return (
    <Stage<S>
      width={550}
      height={440}
      compact={{ below: 500, width: 400, height: 340 }}
      initial={initial}
      poster={poster}
      script={script}
      accent={ACENTO}
      className="marco bit ver"
    >
      {(s, _r, layout) => {
        const lineas = HECHO().filter((l) => layout === 'wide' || !l.soloAncho)
        return (
          <>
            <Window title="docs/bitacora/2026-11-03.md" className="marco-win">
              <div className="ver-doc">
                <div className="ver-h1">tienda · 3 nov 2026</div>
                <p className="ver-lectura">
                  {t('Entró el pago con tarjeta y el carrito ya no duplica descuentos.', 'Card payments are in and the cart no longer doubles discounts.')}
                </p>
                <div className="ver-h2">{t('Hecho', 'Done')}</div>
                <div className="ver-cuerpo" data-dip={s.dip || undefined}>
                {lineas.map((l, i) => {
                  const vista = s.revisadas > i
                  return (
                    <Collapse key={i} open={!(s.fuera && !l.ok)}>
                      <div className="ver-l" data-estado={vista ? (l.ok ? 'ok' : 'no') : undefined}>
                        <span className="ver-l__marca">{vista ? (l.ok ? '✓' : '✗') : '·'}</span>
                        <span className="ver-l__t">{l.texto}</span>
                        <span className="ver-l__f">[{l.fuente}]</span>
                      </div>
                    </Collapse>
                  )
                })}
                </div>
                <div className="ver-h2">{t('Pendiente', 'Pending')}</div>
                <div className="ver-l">
                  <span className="ver-l__marca">·</span>
                  <span className="ver-l__t">{t('Probar con una tarjeta real, decide Ana', 'Try a real card, Ana decides')}</span>
                </div>
                <div className="ver-h2">{t('Fuentes', 'Sources')}</div>
                <div className="ver-l">
                  <span className="ver-l__marca">·</span>
                  <span className="ver-l__t">{t('Sesiones: TIENDA, builder · pago', 'Sessions: TIENDA, builder · payments')}</span>
                </div>
                <div className="ver-l">
                  <span className="ver-l__marca">·</span>
                  <span className="ver-l__t">git log: 2 commits, 41d07ee..9f2c1ab</span>
                </div>
              </div>
            </Window>
            <div className="marco-sat sat ver-sat" data-show={s.tarjeta || undefined}>
              <div className="sat__cab">{t('Descartadas', 'Dropped')}</div>
              <Count className="sat__n" value={s.n} duration={700} />
              <div className="sat__pie">{t('antes de escribir', 'before writing')}</div>
            </div>
          </>
        )
      }}
    </Stage>
  )
}
