# apr0t0.github.io

A minimal, terminal-driven personal site for **Mohd Alqama Shaikh** — robotics &
embedded systems engineer.

Text-based, squared, monospace. Visitors can navigate either way:

- **Click** the GUI nav / links, or
- **Type** commands in the terminal: `./about`, `./projects`, `./projects/rdog`,
  `./publications`, `./contact`, plus `ls`, `help`, `theme`, `whoami`, `clear`.

## Stack

Pure static — no build step, no dependencies. Plain classic scripts (not ES
modules), so it works whether served over HTTP or opened straight from disk.

```
index.html    structure + styles (squary terminal shell, light/dark)
content.js    all page content (single source of truth) — loaded first
app.js        terminal engine + hash router + commands
media/        curated project images
```

## Run locally

Just open `index.html` in a browser — it works offline via `file://`.

Or serve it (nicer hash-route behavior):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Hash routes are shareable (e.g. `#projects/rdog`). Deploys to GitHub Pages via
`.github/workflows/deploy.yml` (publishes the repo root as-is).

## Editing content

Everything lives in `content.js`: bio, projects, publications, and contact
channels. Add a project by appending to the `projects` array; drop images into
`media/<id>/` and reference them in that project's `media` list.
