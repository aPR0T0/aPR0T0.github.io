// app.js — terminal engine + hash router for the site.
// Classic script (no ES modules). Depends on globals from content.js, which
// must be loaded first. This keeps the site working under file:// and http.

const out = document.getElementById("out");
const input = document.getElementById("cmd");
const term = document.getElementById("terminal");

const TOP_PAGES = ["about", "projects", "blogs", "publications", "contact"];
// Command registry for optional add-ons (author.js registers edit/login/etc).
const extraCommands = {};
const history = [];
let hIndex = 0;
let currentPath = null;
let booting = true; // suppress auto-scroll during initial render
// touch devices: don't auto-focus the prompt (keyboard would pop up over content
// and hijack scroll gestures); keyboard-aware scrolling is enabled instead.
const isTouch = !!(window.matchMedia && window.matchMedia("(hover: none)").matches);

/* ---------- tiny DOM helper ---------- */
function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/* ---------- output primitives ---------- */
function scrollEnd() {
  out.scrollTop = out.scrollHeight;
}
function emit(node) {
  const block = h("div", { class: "block" }, node);
  out.appendChild(block);
  scrollEnd();
  return block;
}
function echo(text) {
  return emit(
    h("div", { class: "echo" }, [
      h("span", { class: "ps1", text: prompt() }),
      h("span", { class: "cmd-text", text: text }),
    ])
  );
}
// scroll so a block sits at the top — the command you ran stays in view and its
// output reads downward (instead of jumping to the bottom). Uses scrollIntoView
// so it works whether the scroller is the terminal body (desktop) or the whole
// page (mobile, where the terminal scrolls with the document).
function alignTop(el) {
  if (!el || booting) return;
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    const innerScroll = out.scrollHeight > out.clientHeight + 1;
    if (innerScroll) out.scrollTop = Math.max(0, el.offsetTop - 12);
    else el.scrollIntoView({ block: "start", behavior: "auto" });
  });
}
function line(text, cls) {
  return h("p", { class: "tline" + (cls ? " " + cls : ""), text });
}
function prompt() {
  return "guest@aPR0T0:~$";
}

/* squary bordered box with a label bar */
function box(label, children) {
  return h("section", { class: "boxx" }, [
    h("div", { class: "boxx-bar" }, [
      h("span", { class: "boxx-dot" }),
      h("span", { class: "boxx-label", text: label }),
    ]),
    h("div", { class: "boxx-body" }, children),
  ]);
}

function internalLink(path, text) {
  return h("a", { class: "ilink", href: "#" + path }, text);
}
function extLink(href, text) {
  return h("a", { class: "xlink", href, target: "_blank", rel: "noopener" }, text);
}

function tagRow(tags) {
  return h(
    "div",
    { class: "tags" },
    tags.map((t) => h("span", { class: "tag", text: t }))
  );
}

/* ---------- tiny, safe markdown ---------- */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function sanitizeUrl(url) {
  url = url.trim();
  if (/^(https?:\/\/|mailto:|\/|#|\.\/|\.\.\/)/i.test(url)) return url;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(url)) return "mailto:" + url;
  return null; // drop javascript:, data:, etc.
}
// inline markdown -> safe HTML (input is escaped first, only our tags injected)
function mdInline(text) {
  let s = escapeHtml(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return txt;
    const ext = /^https?:/i.test(safe);
    return '<a class="' + (ext ? "xlink" : "ilink") + '" href="' + safe + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + txt + "</a>";
  });
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => "<code>" + codes[i] + "</code>");
  return s;
}
// block-level markdown -> array of DOM nodes
function renderMarkdown(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const html = (tag, cls, inlineSrc) => {
    const el = h(tag, cls ? { class: cls } : {});
    el.innerHTML = mdInline(inlineSrc);
    return el;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }

    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      const pre = h("pre", { class: "md-pre" });
      const code = h("code");
      code.textContent = buf.join("\n");
      pre.appendChild(code);
      blocks.push(pre);
      continue;
    }
    const hm = line.match(/^(#{1,3})\s+(.*)$/);
    if (hm) { blocks.push(html("h" + (hm[1].length + 1), "md-h md-h" + hm[1].length, hm[2].trim())); i++; continue; }
    if (/^\s*([-*]\s*){3,}$/.test(line) || /^\s*-{3,}\s*$/.test(line)) { blocks.push(h("hr", { class: "rule" })); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push(html("blockquote", "md-quote", buf.join(" ")));
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const ul = h("ul", { class: "md-list" });
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { ul.appendChild(html("li", null, lines[i].replace(/^\s*[-*]\s+/, ""))); i++; }
      blocks.push(ul);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const ol = h("ol", { class: "md-list" });
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { ol.appendChild(html("li", null, lines[i].replace(/^\s*\d+\.\s+/, ""))); i++; }
      blocks.push(ol);
      continue;
    }
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,3}\s|>\s?|```|\s*[-*]\s+|\s*\d+\.\s+|-{3,}\s*$)/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push(html("p", "tline md-p", para.join(" ")));
  }
  return blocks;
}

function mediaGrid(media) {
  if (!media || !media.length) return null;
  const items = media.map((m) =>
    h("figure", { class: "frame" }, [
      h("img", { src: m.src, alt: m.alt || "", loading: "lazy", decoding: "async" }),
      h("figcaption", { text: m.alt || "" }),
    ])
  );
  return box("media", h("div", { class: "media" }, items));
}

/* ---------- page renderers ---------- */
function renderHome() {
  const cmds = [
    ["./about", "who I am"],
    ["./projects", "things I've built"],
    ["./blogs", "thinking out loud"],
    ["./publications", "papers"],
    ["./contact", "reach me"],
    ["ls", "list pages"],
    ["theme", "toggle light / dark"],
    ["max", "maximize for reading"],
    ["clear", "wipe the screen"],
    ["help", "show this again"],
  ];
  emit(
    box("readme", [
      line(`${profile.name} — ${profile.role}.`),
      line(profile.tagline, "muted"),
      h("p", { class: "tline" }, [
        "Type a command, or click anything. Open pages with ",
        h("code", { text: "./pagename" }),
        " (try ",
        internalLink("about", "./about"),
        ").",
      ]),
      h(
        "div",
        { class: "cmdlist" },
        cmds.map(([c, d]) =>
          h("div", { class: "cmdrow" }, [
            h("a", { class: "ilink mono", href: cmdHref(c), "data-cmd": c, text: c }),
            h("span", { class: "cmddesc", text: d }),
          ])
        )
      ),
      h("p", { class: "tline muted authhint" }, [
        "author? ",
        h("code", { text: "login" }),
        " unlocks ",
        h("code", { text: "edit <slug>" }),
        " / ",
        h("code", { text: "new" }),
        " (password-gated).",
      ]),
    ])
  );
}

function renderAbout() {
  emit(
    box("about", [
      h("h2", { class: "title", text: profile.name }),
      h("p", { class: "subtitle", text: profile.role }),
      ...about.paragraphs.map((p) => line(p)),
      h(
        "dl",
        { class: "kv" },
        about.facts.flatMap(([k, v]) => [
          h("dt", { text: k }),
          h("dd", { text: v }),
        ])
      ),
    ])
  );
}

function renderProjects() {
  const rows = projects.map((p) =>
    h("div", { class: "list-item" }, [
      h("div", { class: "li-head" }, [
        internalLink("projects/" + p.id, p.title),
        h("span", { class: "li-meta", text: `${p.year} · ${p.status}` }),
      ]),
      h("p", { class: "li-sum", text: p.summary }),
      tagRow(p.tags),
    ])
  );
  emit(
    box("projects", [
      h("p", { class: "tline muted", text: "Open one with ./projects/<name> — e.g. ./projects/rdog" }),
      h("div", { class: "list" }, rows),
    ])
  );
}

function renderProject(p) {
  const links = p.links && p.links.length
    ? box(
        "links",
        h(
          "div",
          { class: "linklist" },
          p.links.map((l) => extLink(l.href, l.label + " ->"))
        )
      )
    : null;

  emit(
    box("projects/" + p.id, [
      h("div", { class: "proj-head" }, [
        h("h2", { class: "title", text: p.title }),
        h("span", { class: "li-meta", text: `${p.year} · ${p.status}` }),
      ]),
      h("p", { class: "subtitle", text: p.kind }),
      line(p.summary, "lead"),
      h("hr", { class: "rule" }),
      ...p.body.map((para) => line(para)),
      tagRow(p.tags),
    ])
  );
  const media = mediaGrid(p.media);
  if (media) emit(media);
  if (links) emit(links);
  emit(
    h("p", { class: "tline muted" }, [
      "back to ",
      internalLink("projects", "./projects"),
    ])
  );
}

function renderBlogs() {
  const rows = blogs.map((b) =>
    h("div", { class: "list-item" }, [
      h("div", { class: "li-head" }, [
        internalLink("blogs/" + b.slug, b.title),
        h("span", { class: "li-meta", text: b.date }),
      ]),
      h("p", { class: "li-sum", text: b.summary }),
      tagRow(b.tags),
    ])
  );
  emit(
    box("blogs", [
      h("p", { class: "tline muted", text: "Read one with ./blogs/<slug> — thinking out loud, mostly." }),
      h("div", { class: "list" }, rows),
    ])
  );
}

function renderPost(b) {
  const bodyMd = (b.body || []).join("\n\n");
  emit(
    box("blogs/" + b.slug, [
      h("h2", { class: "title", text: b.title }),
      h("p", { class: "subtitle", text: b.date }),
      h("hr", { class: "rule" }),
      h("div", { class: "md" }, renderMarkdown(bodyMd)),
      tagRow(b.tags),
    ])
  );
  emit(
    h("p", { class: "tline muted" }, ["back to ", internalLink("blogs", "./blogs")])
  );
}

function renderPublications() {
  const rows = publications.map((pub) =>
    h("div", { class: "list-item" }, [
      h("div", { class: "li-head" }, [
        pub.href ? extLink(pub.href, pub.title) : h("span", { class: "li-title", text: pub.title }),
        h("span", { class: "li-meta", text: pub.venue }),
      ]),
      h("p", { class: "li-sum", text: pub.note }),
    ])
  );
  emit(box("publications", h("div", { class: "list" }, rows)));
}

function renderContact() {
  const rows = contact.map((c) =>
    h("div", { class: "contact-row" }, [
      h("span", { class: "c-no", text: c.no }),
      h("span", { class: "c-name", text: c.name }),
      extLink(c.href, c.value),
    ])
  );
  emit(
    box("contact", [
      h("p", { class: "tline muted", text: "Channels are open." }),
      h("div", { class: "contacts" }, rows),
    ])
  );
}

function renderNotFound(path) {
  emit(
    h("div", { class: "block" }, [
      line(`./${path}: no such page`, "err"),
      h("p", { class: "tline" }, ["try ", internalLink("home", "help"), " or ", internalLink("projects", "./projects"), "."]),
    ])
  );
}

/* ---------- routing ---------- */
function normalize(p) {
  p = (p || "").trim().toLowerCase().replace(/^\.?\/+/, "").replace(/\/+$/, "");
  if (p === "" || p === "home" || p === "help" || p === "~") return "home";
  return p;
}

// returns canonical path string if known, else null
function resolve(path) {
  if (path === "home") return "home";
  if (TOP_PAGES.includes(path)) return path;
  if (path.startsWith("blogs/")) {
    const slug = path.slice("blogs/".length);
    return getPost(slug) ? "blogs/" + slug : null;
  }
  if (getPost(path)) return "blogs/" + path;
  let id = path.startsWith("projects/") ? path.slice("projects/".length) : path;
  if (getProject(id)) return "projects/" + id;
  return null;
}

function route(path) {
  if (path === "home") return renderHome();
  if (path === "about") return renderAbout();
  if (path === "projects") return renderProjects();
  if (path === "blogs") return renderBlogs();
  if (path === "publications") return renderPublications();
  if (path === "contact") return renderContact();
  if (path.startsWith("blogs/")) {
    const b = getPost(path.slice("blogs/".length));
    return b ? renderPost(b) : renderNotFound(path);
  }
  if (path.startsWith("projects/")) {
    const p = getProject(path.slice("projects/".length));
    return p ? renderProject(p) : renderNotFound(path);
  }
  return renderNotFound(path);
}

function navigate(raw, { echo: doEcho = false } = {}) {
  const canonical = resolve(normalize(raw));
  if (!canonical) {
    const a = doEcho ? echo("./" + normalize(raw)) : null;
    renderNotFound(normalize(raw));
    alignTop(a);
    return;
  }
  const anchor = doEcho ? echo("./" + (canonical === "home" ? "" : canonical)) : null;
  route(canonical);
  currentPath = canonical;
  const target = canonical === "home" ? "" : canonical;
  if (location.hash.replace(/^#\/?/, "") !== target) {
    location.hash = target ? "#" + target : "#";
  }
  alignTop(anchor);
}

function onHashChange() {
  const path = normalize(decodeURIComponent(location.hash.replace(/^#\/?/, "")));
  const canonical = resolve(path) || path;
  if (canonical === currentPath) return; // our own change
  navigate(path, { echo: true });
}

/* ---------- commands ---------- */
function cmdHref(c) {
  if (c.startsWith("./")) {
    const n = normalize(c);
    return "#" + (n === "home" ? "" : n);
  }
  return "#run";
}

function cmdLs(arg) {
  if (arg && normalize(arg) === "projects") {
    emit(
      h(
        "div",
        { class: "ls" },
        projects.map((p) => internalLink("projects/" + p.id, p.id))
      )
    );
    return;
  }
  if (arg && normalize(arg) === "blogs") {
    emit(
      h(
        "div",
        { class: "ls" },
        blogs.map((b) => internalLink("blogs/" + b.slug, b.slug))
      )
    );
    return;
  }
  emit(
    h(
      "div",
      { class: "ls" },
      TOP_PAGES.map((p) => internalLink(p, p))
    )
  );
}

function cmdTheme(arg) {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  let next;
  if (!arg || arg === "toggle") next = cur === "light" ? "dark" : "light";
  else next = arg === "dark" ? "dark" : "light";
  applyTheme(next);
  emit(line(`theme -> ${next}`, "muted"));
}

function cmdWhoami() {
  emit(line(`${profile.name} · ${profile.role} · ${profile.location}`, "muted"));
}

function clearScreen() {
  out.innerHTML = "";
}

function unknown(name) {
  emit(
    h("div", { class: "block" }, [
      line(`${name}: command not found`, "err"),
      h("p", { class: "tline" }, ["type ", internalLink("home", "help"), " for a list of commands."]),
    ])
  );
}

function exec(raw) {
  const cmd = raw.trim();
  const anchor = echo(cmd);
  if (!cmd) return;
  history.push(cmd);
  hIndex = history.length;
  runCommand(cmd);
  alignTop(anchor);
}

function runCommand(cmd) {
  const parts = cmd.split(/\s+/);
  const name = parts[0];

  // easter egg: the mascot engine. `traxx` toggles the default character,
  // `traxx <name>` / `./<name>` summons a registered one, `traxx list` shows
  // them, `traxx bye` hides. Handled before the ./ page router so a character
  // name isn't treated as a missing page.
  if (window.Traxx && typeof window.Traxx.route === "function") {
    if (window.Traxx.route(name, parts.slice(1))) return;
  } else if (name.replace(/^\.\//, "").toLowerCase() === "traxx") {
    emit(line("traxx: mascot module not loaded", "err"));
    return;
  }

  if (name.startsWith("./") || name === "open" || name === "cat" || name === "cd") {
    const target = name.startsWith("./") ? name : parts[1] || "";
    navigate(target, { echo: false });
    return;
  }

  switch (name.toLowerCase()) {
    case "help":
    case "home":
      navigate("home", { echo: false });
      return;
    case "ls":
    case "dir":
      cmdLs(parts[1]);
      return;
    case "clear":
    case "cls":
      clearScreen();
      return;
    case "theme":
      cmdTheme(parts[1] && parts[1].toLowerCase());
      return;
    case "whoami":
      cmdWhoami();
      return;
    case "max":
    case "maximize":
    case "fullscreen":
    case "zoom":
      setMaximized(true);
      emit(line("reading mode on — press Esc or the ⤡ button to exit.", "muted"));
      return;
    case "min":
    case "minimize":
    case "restore":
      setMaximized(false);
      emit(line("reading mode off.", "muted"));
      return;
    case "pwd":
      emit(line("/" + (currentPath === "home" ? "" : currentPath), "muted"));
      return;
    default:
      if (resolve(normalize(name))) {
        navigate(name, { echo: false });
        return;
      }
      if (typeof extraCommands[name.toLowerCase()] === "function") {
        extraCommands[name.toLowerCase()](parts.slice(1), cmd);
        return;
      }
      unknown(name);
  }
}

/* ---------- theme ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {}
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = theme === "light" ? "[ dark ]" : "[ light ]";
}

/* ---------- maximize (reading mode) ---------- */
let maximized = false;
// the scrollback block currently at the top of the view (to preserve reading
// position across a maximize toggle, since the scroll container changes).
function topBlock() {
  const probe = 90;
  let best = null, bestTop = -Infinity;
  for (const b of out.children) {
    const top = b.getBoundingClientRect().top;
    if (top <= probe && top > bestTop) { bestTop = top; best = b; }
  }
  return best || out.lastElementChild || null;
}
function setMaximized(on) {
  on = !!on;
  if (on === maximized) return;
  const anchor = topBlock();
  maximized = on;
  term.classList.toggle("maximized", maximized);
  document.documentElement.classList.toggle("term-max", maximized);
  const btn = document.getElementById("maxBtn");
  if (btn) {
    btn.textContent = maximized ? "⤡" : "⤢";
    btn.setAttribute("aria-pressed", maximized ? "true" : "false");
    btn.setAttribute("aria-label", maximized ? "Exit reading mode" : "Maximize terminal for reading");
    btn.title = maximized ? "Exit reading mode (Esc)" : "Maximize (reading mode)";
  }
  // preserve reading position after the layout / scroll-container change
  requestAnimationFrame(() => {
    if (anchor && anchor.isConnected) anchor.scrollIntoView({ block: "start" });
    if (!isTouch) try { input.focus({ preventScroll: true }); } catch (e) {}
  });
}
function toggleMaximized() {
  setMaximized(!maximized);
}

/* ---------- tab completion ---------- */
function complete() {
  const val = input.value;
  const m = val.match(/(\.\/)?([\w-]*\/?[\w-]*)$/);
  const frag = m ? m[2] : "";
  const candidates = [
    ...TOP_PAGES,
    ...projects.map((p) => "projects/" + p.id),
    ...projects.map((p) => p.id),
    ...blogs.map((b) => "blogs/" + b.slug),
    ...blogs.map((b) => b.slug),
  ];
  const usingDot = val.includes("./");
  const hits = candidates.filter((c) => c.startsWith(frag));
  if (hits.length === 1) {
    const prefix = usingDot ? "./" : "./";
    input.value = prefix + hits[0];
  } else if (hits.length > 1) {
    echo(input.value);
    emit(h("div", { class: "ls" }, hits.map((c) => h("span", { class: "tag", text: c }))));
  }
}

/* ---------- input wiring ---------- */
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const v = input.value;
    input.value = "";
    exec(v);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (hIndex > 0) {
      hIndex--;
      input.value = history[hIndex] || "";
    }
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (hIndex < history.length) {
      hIndex++;
      input.value = history[hIndex] || "";
    }
  } else if (e.key === "Tab") {
    e.preventDefault();
    complete();
  } else if (e.key === "l" && e.ctrlKey) {
    e.preventDefault();
    clearScreen();
  }
});

// keep the prompt visible when the mobile on-screen keyboard opens (touch only)
if (isTouch) {
  input.addEventListener("focus", () => {
    setTimeout(() => {
      try { input.scrollIntoView({ block: "center" }); } catch (e) {}
    }, 250);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (document.activeElement === input) {
        try { input.scrollIntoView({ block: "center" }); } catch (e) {}
      }
    });
  }
}

// click anywhere on the terminal focuses the prompt (desktop only — on touch this
// would pop the keyboard during scroll gestures; tap the prompt directly instead).
term.addEventListener("mousedown", (e) => {
  if (isTouch) return;
  const tag = e.target.tagName;
  if (
    tag === "A" ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "BUTTON" ||
    tag === "SELECT" ||
    tag === "LABEL" ||
    e.target.closest(".editor, .authform") ||
    window.getSelection().toString()
  )
    return;
  setTimeout(() => input.focus(), 0);
});

// theme button + data-cmd buttons in the readme
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-cmd]");
  if (t && t.dataset.cmd && !t.dataset.cmd.startsWith("./")) {
    e.preventDefault();
    exec(t.dataset.cmd);
  }
});
document.getElementById("themeBtn").addEventListener("click", () => cmdTheme("toggle"));
document.getElementById("maxBtn").addEventListener("click", toggleMaximized);

// Esc exits reading mode (but let the editor / auth prompts handle their own Esc)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && maximized && !(e.target.closest && e.target.closest(".editor, .authform"))) {
    e.preventDefault();
    setMaximized(false);
  }
});

window.addEventListener("hashchange", onHashChange);

/* ---------- boot ---------- */
function boot() {
  let saved = "light";
  try {
    saved = localStorage.getItem("theme") || "light";
  } catch (e) {}
  applyTheme(saved);

  emit(
    h("div", { class: "banner" }, [
      h("pre", { class: "ascii", text: profile.name.toUpperCase() }),
      line(`${profile.role} · ${profile.location}`, "muted"),
    ])
  );

  const initial = normalize(decodeURIComponent(location.hash.replace(/^#\/?/, "")));
  navigate(initial, { echo: initial !== "home" });
  // start every load from the top (header/nav/banner visible for context), then
  // enable in-session auto-align so running a command jumps to its output.
  requestAnimationFrame(() => {
    out.scrollTop = 0;
    window.scrollTo(0, 0);
    booting = false;
  });
  // focus the prompt on desktop only (preventScroll so it doesn't jump the page);
  // on touch we don't auto-focus to avoid the keyboard hijacking the landing.
  if (!isTouch) {
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
  }
}

boot();
