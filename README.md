# apr0t0.github.io

A minimal, terminal-driven personal site for **Mohd Alqama Shaikh** — robotics &
embedded systems engineer.

Text-based, squared, monospace. Visitors can navigate either way:

- **Click** the GUI nav / links, or
- **Type** commands in the terminal: `./about`, `./projects`, `./projects/rdog`,
  `./blogs`, `./blogs/<slug>`, `./publications`, `./contact`, plus `ls`, `help`,
  `theme`, `whoami`, `clear`.

There's also a hidden **mascot**: type `traxx` (or `./angry-dario`, or any
[PetDex](https://petdex.dev) pet like `./boba` / `petdex random`) to summon an
interactive character that roams the page — see [Mascots](#mascots-interactive-characters).

## Stack

Pure static — no production build step or package installation. The portfolio
uses classic scripts and also works from disk. Beam Lab uses ES modules and
browser storage, so serve that section over HTTP or HTTPS.

```
index.html    structure + styles (squary terminal shell, light/dark)
posts.js      blog posts data (window.BLOG_POSTS) — rewritten by the editor
content.js    page content: bio, projects, publications, contact
app.js        terminal engine + hash router + commands
author.js     password-gated blog editor (WebCrypto + GitHub commit)
traxx.js      interactive mascot engine (pluggable characters)
characters/   one folder per mascot: character.js config + .svg frames
petdex.js     local PetDex pet provider (reads window.PETS)
pets/         vendored PetDex spritesheets + generated manifest.js
scripts/      fetch-pets.mjs — download/refresh vendored pets
media/        curated project images
sem/          SEM project plan and current design map
sem/lab/      published Beam Lab simulator, guides, and local-edition download
```

## Agent Remote

[Open Agent Remote](https://apr0t0.github.io/remote/) is a permanent start page for a private OpenCode/Codex workspace. It remembers a Tailscale relay address in the visitor's browser and opens that private relay directly. Authentication and agent traffic stay on the relay laptop.

The page also provides a clean Windows/macOS/Linux laptop kit with launchers and a local setup GUI. Viewing devices need Tailscale and a supported browser; laptops hosting agents also run the connector. The public files contain no personal relay key, pairing, provider login, or conversation data.

Refresh from the Agent Remote source project:

```bash
npm run build:pages
npm run stage:pages -- /path/to/apr0t0.github.io
```

Run `node scripts/check-remote.mjs` in this repository before publishing. It checks the public asset hashes, download checksum, archive paths, launcher permissions, and navigation link.

## Run locally

Just open `index.html` in a browser — it works offline via `file://`.

Or serve it (nicer hash-route behavior):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Hash routes are shareable (e.g. `#projects/rdog`). Deploys to GitHub Pages via
`.github/workflows/deploy.yml`, which checks simulator assets and blog links
before publishing the repo root.

## Beam Lab and build journal

- [Launch Beam Lab](https://apr0t0.github.io/sem/lab/)
- [Read the project journal](https://apr0t0.github.io/#blogs/building-a-simple-electron-microscope)
- [SEM project plan](https://apr0t0.github.io/sem/)

The hosted simulator runs entirely in the visitor's browser. BOM edits and
named setups stay in that browser's storage; they never rewrite this repository.
Component research needs the localhost edition and the visitor's own Codex
session. A curated, self-contained local source ZIP is linked from
`sem/lab/run-locally.html`; it requires no access to the private development repo.

The 512 × 512 butterfly preset uses 140 µm field width and about 109 minutes of
modeled hardware acquisition. The 500× preview takes about 13 seconds. Images
are synthetic; the electronics are unbuilt reference designs.

Refresh the hosted copy from the Beam Lab source checkout:

```sh
node /path/to/simplest-electron-microscope/simulator/build-static.mjs \
  --out /path/to/portfolio/sem/lab \
  --base-path /sem/lab/ \
  --blog-url '/#blogs/building-a-simple-electron-microscope'
node scripts/check-sem.mjs
```

The publisher uses an explicit asset list, records SHA-256 hashes, preserves
the base version, and omits personal run history, credentials, and development
data. Commit the refreshed `sem/lab/` files alongside any journal changes;
the Pages workflow does not need private-repository credentials.

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

### PetDex pets (vendored locally)

`petdex.js` connects the same engine to pets from [PetDex](https://petdex.dev),
the gallery of animated Codex pets. Pets are **vendored into this repo** (their
spritesheets live under `pets/`), so they load from the site's own origin — no
runtime calls to petdex.dev. That makes them **blocker-proof, offline-proof, and
`file://`-friendly** (an earlier CDN-streaming version showed only a placeholder
when an ad/tracking blocker blocked the CDN — this fixes that for good).

```
./<slug>              summon an INSTALLED pet   (local, instant, offline)
<slug>                same, without the ./
spawn <name>          fetch ANY petdex pet by name over the network, then show it
petdex list           list installed pets
petdex find <query>   search installed pets
petdex random         summon a random installed pet
petdex state <id>     play any expression on the current pet (see below)
petdex seats on|off   perch the current pet on every nav / toolbar button
petdex bye            send it away              (Esc / × also work)
```

`./<slug>` only loads pets that are **vendored** in this repo (no network — works
offline / behind blockers). To bring in a pet that isn't installed yet, use
`spawn <name>`: it goes to petdex.dev, resolves the name, and loads the sprite on
demand (needs a connection, and won't work if petdex.dev is blocked). If you want
that pet to be permanent + offline, vendor it with the script below.

**Installing pets** — one command downloads them into `pets/` and regenerates
`pets/manifest.js`:

```bash
node scripts/fetch-pets.mjs boba dalek pixel-panda   # add pets by name/slug
node scripts/fetch-pets.mjs --curated                # add all official curated pets
node scripts/fetch-pets.mjs --remove homelander      # drop one
```

Names can be slugs, display names, or `petdex.dev/pets/<slug>` URLs. Browse the
gallery at [petdex.dev](https://petdex.dev) to find names. Commit the new files
in `pets/` and they deploy with the site. (Sheets are re-encoded for size; a full
sheet is ~0.5 MB.)

Each pet is one spritesheet whose rows are the **9 animation states**, all
reachable (`petdex state <id>`): `idle`, `running-right`, `running-left`,
`waving`, `jumping`, `failed`, `waiting`, `running`, `review`. The engine maps
them to behaviour automatically — it runs left/right while roaming, `review`s
while you type, and `failed`s (panics) when you grab it. Every so often the
roaming pet **walks over and hops onto a button**, sits *on top* of it, comments
on that option, then **hops from button to button** before dropping back down —
no command needed. You can also **drag the pet onto any button** to seat it there
yourself. All of this works for whichever character is out (`./boba`, `./nukey`,
`spawn <name>`, …), not just one.

`petdex seats on` perches a pet on **every nav / toolbar button**. They *rain in*
(each drops onto its button with a bounce), then keep it lively — every few
seconds a random one **falls onto its button again** or pops a little speech
bubble riffing on that option (e.g. on `./projects`: "ooh, robots!"; on the theme
button: "flip the lights!"). Hovering a button makes its pet **wave** and comment;
clicking makes it **jump**; the current page's pet sits in `review`. Use
`petdex seats <name>` to pick who sits, `petdex seats off` to clear. If a sheet is
ever missing, the pet shows a labelled placeholder instead of an invisible walker.

Pets are community fan art — code is MIT, assets belong to their submitters
([takedowns](https://github.com/crafter-station/petdex)).

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

## RK3566 circuit simulation lab

[Open the RK3566 lab](https://apr0t0.github.io/rk3566/) to explore the Revision 4
PCB, saved simulation runs, model studies, and electromagnetic field analysis.
The site navigation and `./projects/rk3566` also link to the lab.

The Pages package is a dated snapshot of the local analysis. Interactive views,
playback, saved-run selection, and evidence downloads work on Pages. New Python
solver runs and validation sweeps require the local simulation service.
`rk3566/publication.json` records the export time, source identities, API-to-file
mapping, and hashes of the exported evidence. See `scripts/export-rk3566.py` for
the repeatable data export and `rk3566/README.md` for the published UI behavior.

Validate with `node scripts/check-rk3566.mjs`; the Pages workflow runs this check
alongside the existing SEM and Agent Remote checks before deploying.

The [whole-board magnetic view](https://apr0t0.github.io/rk3566/#magnetic) adds
conditional contributions from the saved averaged power-rail currents across the
55 × 55 mm board. It supports height selection, B/H field values, source selection,
playback and probes; the same study is available in the 3D workbench. Each current
path and return is an explicit geometric assumption. Unsupported current paths
remain outside the modeled sum and are listed in its coverage report.

Generate its evidence with `python3 -B board_magnetic.py` from the local simulation
directory before running the Pages export. `node scripts/check-board-magnetic.mjs`
checks the published field data and its numerical contract.
