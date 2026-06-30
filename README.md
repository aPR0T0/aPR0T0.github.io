# apr0t0.github.io

A minimal, terminal-driven personal site for **Mohd Alqama Shaikh** — robotics &
embedded systems engineer.

Text-based, squared, monospace. Visitors can navigate either way:

- **Click** the GUI nav / links, or
- **Type** commands in the terminal: `./about`, `./projects`, `./projects/rdog`,
  `./publications`, `./contact`, plus `ls`, `help`, `theme`, `whoami`, `clear`.

## Stack

Pure static — no build step, no dependencies.

```
index.html    structure + styles (squary terminal shell, light/dark)
app.js        terminal engine + hash router + commands
content.js    all page content (single source of truth)
media/        curated project images
```

## Run locally

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
