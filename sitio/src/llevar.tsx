import { useState } from 'react'
import { t } from './lang'

// Where Bitácora lives once published, and the two prompts that take it to
// someone's own AI: the full one for a coding agent that can run commands
// (copied), and a reading one for a chat that can only open links.
export const REPO = 'https://github.com/madebyjred-sudo/bitacora'

export const PROMPT_AGENTE = () =>
  t(
    [
      `Instala Bitácora en este equipo: clona ${REPO} en ~/bitacora, corre npm link dentro, y agrega la skill con npx skills add ${REPO}.`,
      'Después corre bitacora hoy y muéstrame lo que hicieron mis agentes hoy, por proyecto.',
      'No escribas avances ni cargues horas en ningún lado sin preguntarme.',
    ],
    [
      `Install Bitácora on this machine: clone ${REPO} into ~/bitacora, run npm link inside it, and add the skill with npx skills add ${REPO}.`,
      'Then run bitacora hoy and show me what my agents did today, by project, in English.',
      "Don't write progress notes or log hours anywhere without asking me.",
    ],
  ).join(' ')

const PROMPT_CHAT = () =>
  t(
    `Lee ${REPO} y ayúdame a usar Bitácora: qué hace, qué necesito tener instalado y cómo escribir el primer avance de mis proyectos.`,
    `Read ${REPO} and help me use Bitácora: what it does, what I need installed and how to write the first progress note for my projects.`,
  )

const claude = () => `https://claude.ai/new?q=${encodeURIComponent(PROMPT_CHAT())}`
const chatgpt = () => `https://chatgpt.com/?q=${encodeURIComponent(PROMPT_CHAT())}`

// The Clipboard API first; where a browser or an embed blocks it, the old
// selection copy, which still works inside the click
async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.setAttribute('readonly', '')
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    const ok = document.execCommand('copy')
    campo.remove()
    return ok
  }
}

function Copiar({ texto, children, className }: { texto: string; children: string; className?: string }) {
  const [hecho, setHecho] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        // If neither works, the prompt is still on the page to select
        if (!(await copiar(texto))) return
        setHecho(true)
        setTimeout(() => setHecho(false), 1600)
      }}
    >
      <span aria-live="polite">{hecho ? t('Copiado', 'Copied') : children}</span>
    </button>
  )
}

/** The row under the intro: one action that does the work, two that explain. */
export function Llevar() {
  return (
    <div className="llevar">
      <Copiar texto={PROMPT_AGENTE()} className="boton boton--lleno">
        {t('Copiar para tu agente', 'Copy for your agent')}
      </Copiar>
      <a className="boton" href={claude()} target="_blank" rel="noreferrer">
        {t('Abrir en Claude', 'Open in Claude')} <span aria-hidden="true">↗</span>
      </a>
      <a className="boton" href={chatgpt()} target="_blank" rel="noreferrer">
        {t('Abrir en ChatGPT', 'Open in ChatGPT')} <span aria-hidden="true">↗</span>
      </a>
    </div>
  )
}

/** The prompt itself, shown whole at the install step, with its copy. */
export function Prompt() {
  return (
    <div className="prompt">
      <p className="prompt__texto">{PROMPT_AGENTE()}</p>
      <Copiar texto={PROMPT_AGENTE()} className="boton boton--chico">
        {t('Copiar', 'Copy')}
      </Copiar>
    </div>
  )
}
