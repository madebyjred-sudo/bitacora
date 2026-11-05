import Hero from './escenas/hero'
import Hoy from './escenas/hoy'
import Proyecto from './escenas/proyecto'
import Verificar from './escenas/verificar'
import Secretos from './escenas/secretos'
import Horas from './escenas/horas'
import Noche from './escenas/noche'
import { Llevar, Prompt, REPO } from './llevar'

// The essay in English: ensayo.es.tsx, the same sections and figures in the
// same order.

export const SECCIONES = [
  ['ejemplo', 'The example'],
  ['instalar', 'Install'],
  ['proyectos', 'By files'],
  ['verificar', 'What gets proven'],
  ['secretos', 'Secrets'],
  ['horas', 'Hours'],
  ['noche', 'Every night'],
  ['como-se-hizo', 'How it was made'],
  ['limites', 'Limits'],
  ['notas', 'Notes'],
] as const

export default function Ensayo() {
  return (
    <>
      <p>
        Bitácora is a skill for your agent that reads what your agents did today, checks it against git and writes it per
        project where your team reads it. It's for anyone working with several agents at once who doesn't want to rebuild
        the day from memory.
      </p>

      <Llevar />

      <figure className="hero">
        <Hero />
        <figcaption>Made with Stageshow.</figcaption>
      </figure>

      <h2 id="ejemplo">The example: Ana's Tuesday</h2>
      <p>
        To show what Bitácora does, this page follows a made-up day. Ana runs three projects (a store, a blog and her
        notes), almost always opens Claude Code from her home folder and leaves builders working in worktrees of the
        store. Every demo from here on is Bitácora reading that Tuesday.
      </p>

      <h2 id="instalar">Install</h2>
      <p>Paste this to your agent (Claude Code, Codex or Cursor):</p>
      <Prompt />
      <p>Or by hand, once:</p>
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
        It needs Node 20 or later and nothing else. Then, from any folder:
      </p>
      <pre className="comando">
        <span className="n">1</span>
        <code>
          <span className="c">bitacora</span> hoy
        </code>
      </pre>

      <figure className="demo" id="demo-hoy">
        <Hoy />
        <figcaption>Ana's Tuesday by project: six sessions, three projects, five commits. What only read stays apart.</figcaption>
      </figure>

      <h2 id="proyectos">By files, not by folder</h2>
      <p>
        Every Claude Code transcript says which folder the session was opened from, and it's almost always your home
        folder. Bitácora looks at what the session touched: the files it wrote, the <code>cd</code> and <code>git -C</code>{' '}
        in its commands and a builder's folder. Each path climbs to its repo; a worktree counts as its main repo and two
        clones of the same remote are one project.
      </p>

      <figure className="demo" id="demo-proyectos">
        <Proyecto />
        <figcaption>Four sessions from Tuesday. Each lands where it wrote; the one that only read doesn't count.</figcaption>
      </figure>

      <p>
        A session that writes to two repos is split between them. If something lands wrong, you fix it once in the
        config with the path and the name. And worktrees a builder already deleted are remembered from earlier runs.
      </p>

      <h2 id="verificar">What gets proven</h2>
      <p>
        Bitácora hands the model the day's material (the window's commits, the files that changed and what was said in
        each session) and asks for the note in a fixed format. Every line under Done has to cite its proof: a commit, a
        file or a URL.
      </p>

      <figure className="demo" id="demo-verificar">
        <Verificar />
        <figcaption>The draft cites a commit that doesn't exist and something with no source. Both lines go before writing.</figcaption>
      </figure>

      <p>
        Then it checks every citation: that the commit exists and is from today, that the file changed, that the URL
        answers. What can't be proven is removed and counted. The sources are written by the tool, not the model.
      </p>
      <table className="modos">
        <thead>
          <tr>
            <th scope="col">Section</th>
            <th scope="col">What it holds</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Short read</td>
            <td>What changed and why it matters, in two or three sentences.</td>
          </tr>
          <tr>
            <td>Done</td>
            <td>What got done, each line with its commit, file or URL.</td>
          </tr>
          <tr>
            <td>Risk</td>
            <td>What's fragile and what was written without a commit, before what's pending.</td>
          </tr>
          <tr>
            <td>Pending</td>
            <td>What's missing and who decides.</td>
          </tr>
          <tr>
            <td>Sources</td>
            <td>Sessions, git log and files.</td>
          </tr>
        </tbody>
      </table>
      <p>
        One note per project per day, in the repo's <code>docs/bitacora/</code> or in Notion. If there's one from today
        already, a «Later» section adds what's new. When it's done, it reads the destination back and fails if a line is
        missing.
      </p>

      <h2 id="secretos">Secrets</h2>
      <p>
        Transcripts carry keys: you paste them to set something up, the agent repeats them, a <code>.env</code> goes
        through a command. Before sending anything to the model or a destination, Bitácora strikes them out: 23 known
        formats, from Anthropic and OpenRouter to Stripe, AWS and private keys, plus long high-entropy strings next to a
        word like token or key.
      </p>

      <figure className="demo" id="demo-secretos">
        <Secretos />
        <figcaption>What Ana pasted and what reaches the model.</figcaption>
      </figure>

      <p>
        A fixture with ten secrets, made up when the test runs, proves it: none reaches the prompt, and commit hashes,
        identifiers and paths stay as they were.
      </p>

      <h2 id="horas">Hours</h2>
      <p>
        On Friday, <code>bitacora horas --semana</code> proposes your hours by project and day, as CSV, with their
        evidence. It counts clock time in five-minute slots, and only the slots when you were in a session: ten builders in
        parallel, or one alone at dawn, aren't your hours.
      </p>

      <figure className="demo" id="demo-horas">
        <Horas />
        <figcaption>Ana's week. What has no project is held.</figcaption>
      </figure>

      <p>
        Every row has its confidence. A: you were there and there are commits. B: there's work, but without you or
        without a commit. C: read only or no project, held to ask you. Nothing gets logged anywhere on its own.
      </p>

      <h2 id="noche">Every night</h2>
      <p>
        <code>bitacora instalar</code> leaves it running at the hour you say: launchd on macOS, cron on Linux, Task
        Scheduler on Windows. What runs is an alarm clock. If there were no sessions, or nothing changed since last time,
        it spends no model.
      </p>

      <figure className="demo" id="demo-noche">
        <Noche />
        <figcaption>Four nights of the log: two with notes and two without spending model.</figcaption>
      </figure>

      <h2 id="como-se-hizo">How it was made</h2>
      <p>
        It comes from a routine that was already running: every night at 21:00, an agent wrote each project's progress
        note to Notion and checked every line against git before writing it. Bitácora is that routine with nothing of its
        owner's, in Node and without Python. The demos on this page are made with Stageshow, by Benji Taylor
        <sup><a href="#n1" id="r1">1</a></sup>.
      </p>

      <h2 id="limites">Limits</h2>
      <p>
        Today it reads Claude Code; Codex comes later. It doesn't know what happened outside a session or git, like a
        call or a decision in a chat. The hours are a proposal you have to look at. And striking out secrets lowers the
        risk, but doesn't replace not pasting them.
      </p>

      <footer className="notas">
        <h2 id="notas">Notes</h2>
        <ol>
          <li id="n1">
            Stageshow, by Benji Taylor. MIT license. <a href="https://benji.org/stageshow">benji.org/stageshow</a>.{' '}
            <a href="#r1" aria-label="Back to the text">↩</a>
          </li>
          <li>Ana, the store, the blog and their commits are made up for this page.</li>
        </ol>
      </footer>
    </>
  )
}
