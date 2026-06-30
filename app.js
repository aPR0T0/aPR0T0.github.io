// app.js — terminal engine + hash router for the site.
import { profile, about, projects, publications, contact, getProject } from "./content.js";

const out = document.getElementById("out");
const input = document.getElementById("cmd");
const term = document.getElementById("terminal");

const TOP_PAGES = ["about", "projects", "publications", "contact"];
const history = [];
let hIndex = 0;
let currentPath = null;

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
  emit(
    h("div", { class: "echo" }, [
      h("span", { class: "ps1", text: prompt() }),
      h("span", { class: "cmd-text", text: text }),
    ])
  );
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
    ["./publications", "papers"],
    ["./contact", "reach me"],
    ["ls", "list pages"],
    ["theme", "toggle light / dark"],
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
  let id = path.startsWith("projects/") ? path.slice("projects/".length) : path;
  if (getProject(id)) return "projects/" + id;
  return null;
}

function route(path) {
  if (path === "home") return renderHome();
  if (path === "about") return renderAbout();
  if (path === "projects") return renderProjects();
  if (path === "publications") return renderPublications();
  if (path === "contact") return renderContact();
  if (path.startsWith("projects/")) {
    const p = getProject(path.slice("projects/".length));
    return p ? renderProject(p) : renderNotFound(path);
  }
  return renderNotFound(path);
}

function navigate(raw, { echo: doEcho = false } = {}) {
  const canonical = resolve(normalize(raw));
  if (!canonical) {
    if (doEcho) echo("./" + normalize(raw));
    renderNotFound(normalize(raw));
    return;
  }
  if (doEcho) echo("./" + (canonical === "home" ? "" : canonical));
  route(canonical);
  currentPath = canonical;
  const target = canonical === "home" ? "" : canonical;
  if (location.hash.replace(/^#\/?/, "") !== target) {
    location.hash = target ? "#" + target : "#";
  }
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
  echo(cmd);
  if (!cmd) return;
  history.push(cmd);
  hIndex = history.length;

  const parts = cmd.split(/\s+/);
  const name = parts[0];

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
    case "pwd":
      emit(line("/" + (currentPath === "home" ? "" : currentPath), "muted"));
      return;
    default:
      if (resolve(normalize(name))) {
        navigate(name, { echo: false });
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

/* ---------- tab completion ---------- */
function complete() {
  const val = input.value;
  const m = val.match(/(\.\/)?([\w-]*\/?[\w-]*)$/);
  const frag = m ? m[2] : "";
  const candidates = [
    ...TOP_PAGES,
    ...projects.map((p) => "projects/" + p.id),
    ...projects.map((p) => p.id),
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

// click anywhere on the terminal focuses the prompt (unless selecting a link/text)
term.addEventListener("mousedown", (e) => {
  if (e.target.tagName === "A" || window.getSelection().toString()) return;
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
  input.focus();
}

boot();
