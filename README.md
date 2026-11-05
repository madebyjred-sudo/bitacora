# bitacora

Lo que tus agentes hicieron hoy, verificado, escrito donde tu equipo lo lee. Y el viernes, tus horas.

Landing: <https://bitacora.madebyjred.com> (en inglés en [/en/](https://bitacora.madebyjred.com/en/)).
Repo: [github.com/madebyjred-sudo/bitacora](https://github.com/madebyjred-sudo/bitacora).

```
npx bitacora hoy
npx bitacora escribir
npx bitacora horas --semana
```

## Instalar

Pégale esto a tu agente (Claude Code, Codex o Cursor):

> Instala bitácora en este equipo: clona https://github.com/madebyjred-sudo/bitacora en ~/bitacora, y dentro corre
> npm install y npm link. Después copia skills/bitacora en ~/.claude/skills/bitacora. Corre bitacora hoy y
> muéstrame el día por proyecto. No escribas nada sin preguntarme.

O a mano, una vez:

```sh
git clone https://github.com/madebyjred-sudo/bitacora ~/bitacora
cd ~/bitacora && npm install && npm link
mkdir -p ~/.claude/skills && cp -R skills/bitacora ~/.claude/skills/bitacora
```

Eso deja la skill en Claude Code y el comando `bitacora` en el PATH. Necesitas Node 20 o más.

```sh
bitacora hoy
bitacora escribir
bitacora horas --semana
```

La config vive en `~/.config/bitacora/bitacora.json` (en Windows `%APPDATA%\bitacora`). Ahí se declaran los
proyectos, la zona horaria y los destinos, incluido Notion con el id de cada página.

## Qué hace

- Lee las sesiones de Claude Code (`~/.claude/projects/*/*.jsonl`) y los commits de git de la ventana.
- Asigna cada sesión al proyecto por los archivos que tocó, no por la carpeta desde donde la abriste.
- Tacha secretos antes de mandar nada a un modelo.
- Escribe un avance por proyecto (markdown en el repo o Notion) y relee para confirmar que entró.
- Borra lo que el modelo no puede probar con un commit, un archivo o una URL.
- Propone las horas de la semana en CSV, con evidencia. Nunca las carga solo.
- `bitacora instalar` lo deja corriendo cada noche; si no hubo sesiones, no gasta modelo.

Instrucciones para agentes: [skills/bitacora/SKILL.md](skills/bitacora/SKILL.md).

## La landing

`sitio/` es la página de bitácora: Vite y React, con las escenas hechas con [Stageshow](https://benji.org/stageshow)
de Benji Taylor. El kit copiado está en `sitio/src/kit`; su licencia y los avisos de terceros están en `NOTICE.md`.

```sh
cd sitio && npm install && npm run dev
```

## Desarrollo

`npm test` corre todo sobre fixtures sintéticos (`tests/fixtures`) y repos que se arman en una carpeta temporal.

Módulos sueltos, sin dependencias del resto: `src/secretos.mjs` (redactor) y `src/despertador.mjs`
(huella, candado, techo, `[SILENT]`).

## Licencia

MIT.
