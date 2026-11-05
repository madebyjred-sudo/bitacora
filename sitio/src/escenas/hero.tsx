import { Prompt, Stage, Window, ACENTO } from './ss'
import './comun.css'
import './hero.css'
import { horas, t } from '../lang'

// The hero under the intro, as on benji.org/stageshow: real pieces of Bitácora
// composed as one bento picture, built with the kit. A still: no script.
// Four tiles, four kinds: the written note on grafito, the day's hours on the
// deep white, the terminal on the light grey and a redacted key on the page's
// one coral tile.

export default function Hero() {
  return (
    <Stage width={550} height={372} compact={{ below: 500, width: 358, height: 602 }} initial={{}} className="bit hro" accent={ACENTO}>
      {() => (
        <div className="hro-grid">
          <div className="hro-tile hro-a">
            <div className="hro-nota">
              <div className="hro-nota__t">tienda · 3 nov 2026</div>
              <div className="hro-nota__h">{t('Hecho', 'Done')}</div>
              <div className="hro-nota__l">
                <span>{t('Pago con tarjeta', 'Card payments')}</span>
                <code>[commit 9f2c1ab]</code>
              </div>
              <div className="hro-nota__l">
                <span>{t('Carrito suma bien', 'Cart adds right')}</span>
                <code>[commit 41d07ee]</code>
              </div>
            </div>
          </div>

          <div className="hro-tile hro-b">
            <div className="hro-b__cab">{t('Contigo hoy', 'With you today')}</div>
            <div className="hro-b__n">{horas(3.25)}</div>
            <div className="hro-b__pie">{t('5 commits verificados', '5 verified commits')}</div>
          </div>

          <div className="hro-tile hro-c">
            <Window chrome="terminal" title="~ · zsh" className="hro-term">
              <div className="hro-term__cuerpo">
                <Prompt path="~">bitacora hoy</Prompt>
                <div className="fila" data-k="proyecto">
                  <span className="a">tienda</span>
                  <span className="b">{t('4 commits · 2,5 h', '4 commits · 2.5 h')}</span>
                </div>
                <div className="fila" data-k="proyecto">
                  <span className="a">blog</span>
                  <span className="b">{t('1 commit · 0,75 h', '1 commit · 0.75 h')}</span>
                </div>
              </div>
            </Window>
          </div>

          <div className="hro-tile hro-d">
            <div className="hro-d__carta">
              <div>OPENROUTER_API_KEY=</div>
              <div className="hro-d__marca">[secreto:openrouter]</div>
            </div>
          </div>
        </div>
      )}
    </Stage>
  )
}
