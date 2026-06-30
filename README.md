# apr0t0.github.io

A minimal, terminal-driven personal site for **Mohd Alqama Shaikh** — robotics &
embedded systems engineer.

Text-based, squared, monospace. Visitors can navigate either way:

- **Click** the GUI nav / links, or
- **Type** commands in the terminal: `./about`, `./projects`, `./projects/rdog`,
  `./blogs`, `./blogs/<slug>`, `./publications`, `./contact`, plus `ls`, `help`,
  `theme`, `whoami`, `clear`.

## Stack

Pure static — no build step, no dependencies. Plain classic scripts (not ES
modules), so it works whether served over HTTP or opened straight from disk.

```
index.html    structure + styles (squary terminal shell, light/dark)
posts.js      blog posts data (window.BLOG_POSTS) — rewritten by the editor
content.js    page content: bio, projects, publications, contact
app.js        terminal engine + hash router + commands
author.js     password-gated blog editor (WebCrypto + GitHub commit)
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

Page content lives in `content.js`: bio, projects, publications, and contact
channels. Add a project by appending to the `projects` array; drop images into
`media/<id>/` and reference them in that project's `media` list. Blog posts live
in `posts.js` (`window.BLOG_POSTS`).

## Author mode (in-browser blog editor)

Blog posts can be written/edited from the terminal and committed straight to the
repo — no backend. Your GitHub token is encrypted with a password using real
WebCrypto, so no secret is ever stored in plaintext.

**Crypto:** AES-256-GCM with a key derived via PBKDF2-SHA256 (600,000
iterations, random 16-byte salt + 12-byte IV). `login` decrypts the token with
your password; a wrong password fails AES-GCM auth-tag verification, so the
password *is* the key (no separate hash is kept).

**Commands:**

```
auth setup      encrypt a GitHub token with a password (one time)
login           unlock author mode with your password
edit <slug>     edit a post in an inline editor, then commit
new             write a new post, then commit
auth publish    store the encrypted blob in the repo (auth.json) for
                cross-device login — it stays ciphertext, never plaintext
auth status     show current auth state
auth reset      remove the encrypted blob from this browser
logout          lock author mode
```

Committing rewrites `posts.js` via the GitHub Contents API; GitHub Pages then
redeploys automatically (~1 min).

**Security notes**

- Use a **long passphrase**. The encrypted blob (in `localStorage`, or in
  `auth.json` if you publish it) is only as safe as your password is hard to
  brute-force.
- Use a **fine-grained personal access token** scoped to **only this repo** with
  **Contents: read & write** and an **expiry**. That caps the blast radius.
- Requires a secure context (https or localhost / `file://`) for WebCrypto.
