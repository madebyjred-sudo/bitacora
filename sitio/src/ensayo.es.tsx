import Hero from './escenas/hero'
import Hoy from './escenas/hoy'
import Proyecto from './escenas/proyecto'
import Verificar from './escenas/verificar'
import Secretos from './escenas/secretos'
import Horas from './escenas/horas'
import Noche from './escenas/noche'
import { Llevar, Prompt, REPO } from './llevar'

// The essay in Spanish. ensayo.en.tsx is the same page in English: same
// sections, same figures, in the same order; a change here goes there too.

export const SECCIONES = [
  ['ejemplo', 'El ejemplo'],
  ['instalar', 'Instalar'],
  ['proyectos', 'Por archivos'],
  ['verificar', 'Lo que se prueba'],
  ['secretos', 'Secretos'],
  ['horas', 'Horas'],
  ['noche', 'Cada noche'],
  ['como-se-hizo', 'Cómo se hizo'],
  ['limites', 'Límites'],
  ['notas', 'Notas'],
] as const

export default function Ensayo() {
  return (
    <>
      <p>
        Bitácora es una skill para tu agente que lee lo que hicieron tus agentes hoy, lo verifica contra git y lo escribe
        por proyecto donde tu equipo lo lee. Es para quien trabaja con varios agentes a la vez y no quiere reconstruir el
        día de memoria.
      </p>

      <Llevar />

      <figure className="hero">
        <Hero />
        <figcaption>Hecho con Stageshow.</figcaption>
      </figure>

      <h2 id="ejemplo">El ejemplo: el martes de Ana</h2>
      <p>
        Para mostrar qué hace Bitácora, esta página sigue un día inventado. Ana lleva tres proyectos (una tienda, un blog
        y sus notas), abre Claude Code casi siempre desde su carpeta personal y deja builders trabajando en worktrees de
        la tienda. Cada demo de aquí en adelante es Bitácora leyendo ese martes.
      </p>

      <h2 id="instalar">Instalar</h2>
      <p>Pégale esto a tu agente (Claude Code, Codex o Cursor):</p>
      <Prompt />
      <p>O a mano, una vez:</p>
      <pre className="comando">
        <span className="n">
          1{'\n'}2{'\n'}3
        </span>
        <code>
          <span className="c">git</span> clone {REPO} ~/bitacora{'\n'}
          <span className="c">cd</span> ~/bitacora <span className="f">&amp;&amp;</span> <span className="c">npm</span> link{'\n'}
          <span className="c">npx</span> skills add {REPO}
        </code>
      </pre>
      <p>
        Necesita Node 20 o más y nada más. Después, desde cualquier carpeta:
      </p>
      <pre className="comando">
        <span className="n">1</span>
        <code>
          <span className="c">bitacora</span> hoy
        </code>
      </pre>

      <figure className="demo" id="demo-hoy">
        <Hoy />
        <figcaption>El martes de Ana por proyecto: seis sesiones, tres proyectos, cinco commits. Lo que solo leyó queda aparte.</figcaption>
      </figure>

      <h2 id="proyectos">Por archivos, no por carpeta</h2>
      <p>
        Cada transcripción de Claude Code dice desde qué carpeta se abrió la sesión, y casi siempre es la tuya personal.
        Bitácora mira lo que la sesión tocó: los archivos que escribió, los <code>cd</code> y <code>git -C</code> de sus
        comandos y la carpeta de un builder. Cada ruta sube hasta su repo; un worktree cuenta como su repo principal y dos
        clones del mismo remoto son un solo proyecto.
      </p>

      <figure className="demo" id="demo-proyectos">
        <Proyecto />
        <figcaption>Cuatro sesiones del martes. Cada una cae donde escribió; la que solo leyó no cuenta.</figcaption>
      </figure>

      <p>
        Una sesión que escribe en dos repos se reparte entre los dos. Si algo cae mal, se arregla una vez en la config con
        la ruta y el nombre. Y los worktrees que un builder ya borró se recuerdan de las corridas anteriores.
      </p>

      <h2 id="verificar">Lo que se prueba</h2>
      <p>
        Bitácora le pasa al modelo el material del día (los commits de la ventana, los archivos que cambiaron y lo que se
        habló en cada sesión) y le pide el avance en un formato fijo. Cada línea de Hecho tiene que citar su prueba: un
        commit, un archivo o una URL.
      </p>

      <figure className="demo" id="demo-verificar">
        <Verificar />
        <figcaption>El borrador cita un commit que no existe y algo sin fuente. Las dos líneas se van antes de escribir.</figcaption>
      </figure>

      <p>
        Después verifica cada cita: que el commit exista y sea de hoy, que el archivo haya cambiado, que la URL responda.
        Lo que no se prueba se borra y se cuenta. Las fuentes las arma la herramienta, no el modelo.
      </p>
      <table className="modos">
        <thead>
          <tr>
            <th scope="col">Sección</th>
            <th scope="col">Qué lleva</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lectura corta</td>
            <td>Qué cambió y por qué importa, en dos o tres frases.</td>
          </tr>
          <tr>
            <td>Hecho</td>
            <td>Lo que se hizo, cada línea con su commit, archivo o URL.</td>
          </tr>
          <tr>
            <td>Riesgo</td>
            <td>Lo frágil y lo que se escribió sin commit, antes que lo pendiente.</td>
          </tr>
          <tr>
            <td>Pendiente</td>
            <td>Qué falta y quién decide.</td>
          </tr>
          <tr>
            <td>Fuentes</td>
            <td>Sesiones, git log y archivos.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Un avance por proyecto por día, en <code>docs/bitacora/</code> del repo o en Notion. Si ya hay uno de hoy, se
        agrega «Más tarde» con lo nuevo. Al terminar, relee el destino y falla si falta una línea.
      </p>

      <h2 id="secretos">Secretos</h2>
      <p>
        Las transcripciones traen llaves: las pegas para configurar algo, el agente las repite, un <code>.env</code> pasa
        por un comando. Antes de mandar nada al modelo o a un destino, Bitácora las tacha: 23 formatos conocidos, de
        Anthropic y OpenRouter a Stripe, AWS y las llaves privadas, más las cadenas largas de alta entropía junto a una
        palabra como token o clave.
      </p>

      <figure className="demo" id="demo-secretos">
        <Secretos />
        <figcaption>Lo que pegó Ana y lo que llega al modelo.</figcaption>
      </figure>

      <p>
        Lo prueba un fixture con diez secretos que se fabrican al correr la prueba: ninguno llega al prompt, y los hashes
        de commit, los identificadores y las rutas quedan como estaban.
      </p>

      <h2 id="horas">Horas</h2>
      <p>
        El viernes, <code>bitacora horas --semana</code> propone tus horas por proyecto y día, en CSV, con su evidencia.
        Cuenta tiempo de reloj en franjas de cinco minutos, y solo las franjas en que estabas en una sesión: diez builders
        en paralelo, o uno solo de madrugada, no son horas tuyas.
      </p>

      <figure className="demo" id="demo-horas">
        <Horas />
        <figcaption>La semana de Ana. Lo que no tiene proyecto se retiene.</figcaption>
      </figure>

      <p>
        Cada fila trae su confianza. A: estabas tú y hay commits. B: hay trabajo, pero sin ti o sin commit. C: solo lectura
        o sin proyecto, y se retiene para preguntarte. Nada se carga solo en ningún sistema.
      </p>

      <h2 id="noche">Cada noche</h2>
      <p>
        <code>bitacora instalar</code> lo deja corriendo a la hora que digas: launchd en macOS, cron en Linux, el
        Programador de tareas en Windows. Lo que corre es un despertador. Si no hubo sesiones, o nada cambió desde la
        última vez, no gasta modelo.
      </p>

      <figure className="demo" id="demo-noche">
        <Noche />
        <figcaption>Cuatro noches del registro: dos con avances y dos sin gastar modelo.</figcaption>
      </figure>

      <h2 id="como-se-hizo">Cómo se hizo</h2>
      <p>
        Sale de una rutina que ya corría: cada noche a las 21:00, un agente escribía en Notion el avance de cada proyecto y
        verificaba cada línea contra git antes de escribirla. Bitácora es esa rutina sin nada de su dueño, en Node y sin
        Python. Las demos de esta página están hechas con Stageshow, de Benji Taylor<sup><a href="#n1" id="r1">1</a></sup>.
      </p>

      <h2 id="limites">Límites</h2>
      <p>
        Hoy lee Claude Code; Codex viene después. No sabe lo que pasó fuera de una sesión o de git, como una llamada o una
        decisión en un chat. Las horas son una propuesta que tienes que mirar. Y tachar secretos baja el riesgo, pero no
        reemplaza no pegarlos.
      </p>

      <footer className="notas">
        <h2 id="notas">Notas</h2>
        <ol>
          <li id="n1">
            Stageshow, de Benji Taylor. Licencia MIT. <a href="https://benji.org/stageshow">benji.org/stageshow</a>.{' '}
            <a href="#r1" aria-label="Volver al texto">↩</a>
          </li>
          <li>Ana, la tienda, el blog y sus commits son inventados para esta página.</li>
        </ol>
      </footer>
    </>
  )
}
