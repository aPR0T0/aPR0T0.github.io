# apr0t0.github.io

A minimal, terminal-driven personal site for **Mohd Alqama Shaikh** — robotics &
embedded systems engineer.

Text-based, squared, monospace. Visitors can navigate either way:

- **Click** the GUI nav / links, or
- **Type** commands in the terminal: `./about`, `./projects`, `./projects/rdog`,
  `./blogs`, `./blogs/<slug>`, `./publications`, `./contact`, plus `ls`, `help`,
  `theme`, `whoami`, `clear`.

There's also a hidden **mascot**: type `traxx` (or `./angry-dario`) to summon an
interactive character that roams the page — see [Mascots](#mascots-interactive-characters).

## Stack

Pure static — no build step, no dependencies. Plain classic scripts (not ES
modules), so it works whether served over HTTP or opened straight from disk.

```
index.html    structure + styles (squary terminal shell, light/dark)
posts.js      blog posts data (window.BLOG_POSTS) — rewritten by the editor
content.js    page content: bio, projects, publications, contact
app.js        terminal engine + hash router + commands
author.js     password-gated blog editor (WebCrypto + GitHub commit)
traxx.js      interactive mascot engine (pluggable characters)
characters/   one folder per mascot: character.js config + .svg frames
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

## Mascots (interactive characters)

Type a character's name in the terminal to summon a little companion. It pops
out of the terminal, roams the screen, turns to watch the prompt while you type,
and panics when you pick it up and drag it anywhere.

```
traxx            summon / hide DJ TRAXX (the default)
traxx <name>     summon a specific character   (e.g. traxx angry-dario)
./<name>         same, in the site's ./ style  (e.g. ./angry-dario)
traxx list       list registered characters
traxx bye        send the current one away     (Esc or the × button work too)
```

`angry-dario` ships as a second, ready-to-copy example.

### Add your own

A character is just a folder under `characters/` plus a one-line script tag — no
build step.

1. Create `characters/<id>/` and add SVG frames (any `viewBox`, drawn facing the
   viewer). Only `idle.svg` is required; the rest fall back to it:

   ```
   characters/my-bot/
     idle.svg     required — resting pose
     look.svg     optional — shown while you type
     panic.svg    optional — shown while held / dragged
   ```

2. Add `characters/my-bot/character.js`:

   ```js
   window.Traxx.define({
     id: "my-bot",
     name: "MY BOT",
     height: 140, aspect: 112/140, speed: 64,
     sign: { bg: "#111", fg: "#0af" },      // LED name-tag (or null to hide)
     states: {
       idle:  { frames: "idle",  anim: "bob-slow" },
       walk:  { frames: "idle",  anim: "bob" },
       look:  { frames: "look",  anim: "bob-slow", lean: true },
       panic: { frames: "panic", anim: "shake" },
     },
     speech: {
       hello: ["hi!"], panic: ["aaah!"], land: ["oof."], idle: ["..."],
     },
   });
   ```

3. Load it in `index.html`, after `traxx.js`:

   ```html
   <script src="./characters/my-bot/character.js"></script>
   ```

   Then run `./my-bot`.

**Notes**

- `frames` is an SVG name (without `.svg`), or a list to cycle for frame-by-frame
  animation — `{ frames: ["walk-a","walk-b"], fps: 8 }`.
- `anim` is a built-in motion — `bob-slow`, `bob`, `shake`, `none` — or a custom
  one you supply via a `css` field (see `characters/angry-dario` for a `stomp`
  example). `lean: true` makes the character tilt toward the prompt.
- Frames are plain `<img>` loads, so mascots work offline over `file://` too.
- Respects `prefers-reduced-motion`, is touch-friendly, and only one mascot is
  out at a time.

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
