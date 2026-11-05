---
name: bitacora
description: Use when someone asks what their agents did today, wants a daily progress note or standup per project, wants it written to the repo or Notion, needs to pick a project back up, or wants a proposed weekly timesheet. Reads Claude Code sessions and git, verifies every claim before writing.
---

# bitacora

Lee lo que hicieron tus agentes (transcripciones de Claude Code en `~/.claude/projects` y commits de git),
decide a qué proyecto va cada sesión por los archivos que tocó y escribe un avance verificado por proyecto.
Nada se escribe sin evidencia: un commit de la ventana, un archivo que cambió o una URL que responde.

Si el comando `bitacora` no está en el PATH: `npx bitacora <comando>` (Node 20 o más).

## Comandos
| comando | qué hace |
|---|---|
| `bitacora hoy [--dia AAAA-MM-DD]` | el día por proyecto, sin escribir nada |
| `bitacora escribir [--destino markdown\|notion\|todos]` | un avance por proyecto con trabajo real |
| `bitacora horas --semana [AAAA-MM-DD]` | CSV propuesto: horas por proyecto y día, con evidencia y confianza |
| `bitacora retomar <proyecto>` | dónde quedó, qué riesgo y qué falta |
| `bitacora instalar [--a 21:00]` | lo programa (launchd, cron o Programador de tareas) |

Opciones útiles de `escribir`: `--ensayo` (muestra sin escribir), `--proyecto P`, `--sin-modelo` (solo git),
`--carpeta DIR` (markdown fuera del repo).

## Cómo trabajar con esto
1. Antes de escribir, corre `bitacora hoy` y muéstraselo a la persona. Si un proyecto quedó mal asignado,
   arréglalo en la config (`proyectos`), no en el avance.
2. `bitacora escribir --ensayo` para ver el avance. Las líneas `descartada (...)` son afirmaciones que no se
   pudieron probar: no las agregues a mano.
3. `bitacora escribir` (markdown en `docs/bitacora/AAAA-MM-DD.md` del repo) o `--destino notion`. Si imprime
   `OK`, pasa la ruta o el link. Si imprime `FALLÓ`, di qué falló; no lo reportes como hecho.
4. Las horas son una propuesta. Nunca las cargues en ningún sistema sin que la persona diga que sí. Lo de
   confianza C (solo lectura o sin proyecto) se retiene y se pregunta junto al final.

## Formato del avance
```
<Lectura corta: qué cambió y por qué importa.>
## Hecho
- <qué se hizo> [commit abc1234]
## Riesgo para revisar primero
- <archivos escritos sin commit, algo frágil>
## Pendiente
- <qué falta y quién decide>
## Fuentes
- <sesiones, git log, archivos: lo arma la herramienta>
```
Un avance por proyecto por día. Si ya hay uno, se agrega «Más tarde · HH:MM» con lo nuevo.

## Config (opcional)
`~/.config/bitacora/bitacora.json` (en Windows `%APPDATA%\bitacora`):
```json
{
  "zona": "America/Bogota",
  "proyectos": { "Tienda": ["~/code/tienda", "~/worktrees/tienda-*"] },
  "ignorar": ["~/borradores"],
  "autores": ["tu@trabajo.com"],
  "modelo": { "via": "claude", "nombre": "sonnet" },
  "llaves": { "archivo": "~/.config/bitacora/.env" },
  "destinos": { "notion": { "paginas": { "Tienda": "<page_id>" }, "numerar": true } }
}
```
- `modelo.via`: `claude` (por defecto, `claude -p` sin herramientas ni sesión guardada), `codex`, `openrouter`
  (con `OPENROUTER_API_KEY`) o `ninguno`.
- Antes de mandar texto al modelo se tachan llaves, tokens, contraseñas y líneas de `.env`.
- Notion necesita `NOTION_API_KEY` y la página de cada proyecto compartida con la integración. Un proyecto
  sin página se omite: no se abren espacios nuevos.

## Cómo decide el proyecto
Archivos escritos con Edit/Write, `cd` y `git -C` en Bash, y el cwd de los builders. Un worktree cuenta como
su repo principal; dos clones del mismo remoto son un proyecto. Las sesiones que solo leyeron no generan
avance. Las rutas de la config mandan sobre todo lo demás.
