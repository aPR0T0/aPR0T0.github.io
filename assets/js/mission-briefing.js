import '../css/mission-briefing.css';

import { getProjectById } from './site-data.js';
import { getMissionBriefing } from './mission-briefings-data.js';

const app = document.getElementById('missionApp');
const missionId = document.body.dataset.missionId;
const mission = getMissionBriefing(missionId);

// theme: default to the readable light theme; honor a saved choice
// (the 'mode' key is shared with the portfolio pages so it stays consistent)
if (localStorage.getItem('mode') === 'dark-mode') {
  document.body.classList.add('dark-mode');
}

if (!app) {
  throw new Error('Missing mission app mount point');
}

if (!mission) {
  app.innerHTML = `
    <main class="briefing-main mission-empty">
      <section class="empty-card">
        <div class="section-kicker">Mission Error</div>
        <h1 class="empty-title">Briefing data not found.</h1>
        <p>This mission shell exists, but its dossier id is missing from the shared briefing registry.</p>
      </section>
    </main>
  `;
  throw new Error(`Missing mission briefing for '${missionId}'`);
}

document.documentElement.style.setProperty('--mission-accent', mission.accent);
document.title = mission.pageTitle;

const description = document.querySelector('meta[name="description"]');
if (description) {
  description.setAttribute('content', mission.summary);
}

const topNav = [
  { label: 'Return to Sector', href: '../../index.html#projects', strong: false },
  { label: 'Open Channel', href: '../../index.html#uplink', strong: false },
];

const project = mission.projectId ? getProjectById(mission.projectId) : null;
const studioHref = project ? `../../studio.html?id=${encodeURIComponent(project.id)}` : null;

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderList(items) {
  if (!items?.length) return '<p>No cleared items.</p>';

  return `<ul class="stack-list">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('')}</ul>`;
}

function renderMediaItem(item) {
  const frame = item.type === 'video'
    ? `<video controls preload="metadata" ${item.poster ? `poster="${item.poster}"` : ''}><source src="${item.src}" type="video/mp4"></video>`
    : `<img src="${item.src}" alt="${escapeHtml(item.alt || mission.title)}" loading="lazy">`;

  return `
    <article class="media-item">
      <div class="media-frame">${frame}</div>
      <div class="media-copy">
        <div class="media-type">${item.type === 'video' ? 'Cleared Motion Feed' : 'Cleared Still'}</div>
        <h3 class="media-title">${escapeHtml(item.alt || mission.title)}</h3>
      </div>
    </article>
  `;
}

function renderStatusClass(status) {
  const value = status.toLowerCase();
  if (value.includes('published')) return 'published';
  if (value.includes('archived') || value.includes('classified')) return 'archived';
  return 'active';
}

function renderActionRow() {
  const actions = [
    `<a class="hero-action" href="../../index.html#projects">Return to Sector</a>`,
  ];

  if (studioHref) {
    actions.push(`<a class="hero-action-strong" href="${studioHref}">Enter Studio</a>`);
  }

  if (mission.referenceHref) {
    actions.push(
      `<a class="hero-action" href="${mission.referenceHref}" ${mission.referenceHref.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${escapeHtml(mission.referenceLabel || 'Open Reference')}</a>`
    );
  }

  return actions.join('');
}

app.innerHTML = `
  <div class="briefing-topbar">
    <div class="bar-inner">
      <div class="bar-brand"><span class="dot"></span>Mission Briefing · ${escapeHtml(mission.code)}</div>
      <nav class="bar-nav">
        ${topNav
          .map(
            (item) => `<a class="${item.strong ? 'bar-link-strong' : 'bar-link'}" href="${item.href}">${item.label}</a>`
          )
          .join('')}
        <button type="button" class="bar-link theme-toggle" id="themeToggle" aria-label="Toggle theme"></button>
      </nav>
    </div>
  </div>

  <main class="briefing-main">
    <section class="hero">
      <article class="hero-copy">
        <div class="eyebrow">Operation Briefing</div>
        <h1>OPERATION <span>${escapeHtml(mission.mission)}</span></h1>
        <p class="hero-summary">${escapeHtml(mission.summary)}</p>
        <div class="chip-row">
          <span class="chip"><strong>Status</strong> ${escapeHtml(mission.status)}</span>
          <span class="chip"><strong>Classification</strong> ${escapeHtml(mission.classification)}</span>
          <span class="chip"><strong>Grid</strong> ${escapeHtml(mission.grid)}</span>
          <span class="chip"><strong>Year</strong> ${escapeHtml(String(mission.year))}</span>
        </div>
        <div class="hero-actions">${renderActionRow()}</div>
      </article>

      <aside class="hero-panel">
        <div class="corner-tag">Theater Snapshot</div>
        <div class="panel-stack">
          <div class="stat-row">
            <div class="data-label">Call Sign</div>
            <div class="data-value">${escapeHtml(mission.callSign)}</div>
          </div>
          <div class="stat-row">
            <div class="data-label">Asset</div>
            <div class="data-value">${escapeHtml(mission.title)}</div>
          </div>
          <div class="stat-row">
            <div class="data-label">Theater</div>
            <div class="data-value">${escapeHtml(mission.theater)}</div>
          </div>
          <div class="stat-row">
            <div class="data-label">Operator</div>
            <div class="data-value">${escapeHtml(mission.operator)}</div>
          </div>
          <div class="stat-row">
            <div class="data-label">Loadout</div>
            <div class="data-value">${escapeHtml(mission.loadout.join(' · '))}</div>
          </div>
        </div>
      </aside>
    </section>

    <section class="briefing-grid" aria-label="mission board">
      <article class="board-card">
        <div class="section-kicker">Mission Board</div>
        <h2 class="section-title">Primary <span>Objectives</span></h2>
        ${renderList(mission.objectives)}
      </article>

      <article class="board-card">
        <div class="section-kicker">Operational Friction</div>
        <h2 class="section-title">Constraints & <span>Pressure</span></h2>
        ${renderList(mission.constraints)}
      </article>
    </section>

    ${mission.notice ? `
      <section class="board-card notice-card" aria-label="briefing notice">
        <div class="section-kicker">Command Note</div>
        <h2 class="section-title">Archive <span>Status</span></h2>
        <p>${escapeHtml(mission.notice)}</p>
      </section>
    ` : ''}

    <section class="log-wrap" aria-label="field log">
      ${mission.fieldNotes
        .map(
          (note) => `
            <article class="log-card">
              <div class="log-head">
                <div>
                  <div class="log-stamp">${escapeHtml(note.stamp)}</div>
                  <h2 class="log-title">${escapeHtml(note.title)}</h2>
                </div>
                <div class="status-pill ${renderStatusClass(mission.status)}">${escapeHtml(mission.status)}</div>
              </div>
              <div class="log-body">
                ${note.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
              </div>
            </article>
          `
        )
        .join('')}
    </section>

    <section class="evidence-grid" aria-label="cleared evidence">
      ${mission.media?.length
        ? mission.media.map(renderMediaItem).join('')
        : `
          <article class="empty-card">
            <div class="section-kicker">Evidence Locker</div>
            <h2 class="empty-title">No cleared media attached.</h2>
            <p>${escapeHtml(mission.evidenceNote || 'This mission currently has no public media.')}</p>
          </article>
        `}
    </section>

    <section class="debrief-grid" aria-label="mission debrief">
      ${mission.debrief
        .map(
          (item) => `
            <article class="debrief-card">
              <div class="section-kicker">Mission Debrief</div>
              <h2 class="debrief-title">${escapeHtml(item.title)}</h2>
              <div class="debrief-copy">${item.body
                .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
                .join('')}</div>
            </article>
          `
        )
        .join('')}
    </section>

    <section class="closing-banner">
      <div>
        <div class="footer-tag">Final Situation Report</div>
        <strong>${escapeHtml(mission.closingNote)}</strong>
        <p>${escapeHtml(mission.evidenceNote || '')}</p>
      </div>
      <div class="footer-links">
        <a class="media-link" href="../../index.html#projects">Back to Map</a>
        ${studioHref ? `<a class="media-link" href="${studioHref}">Enter Studio</a>` : ''}
        <a class="media-link" href="../../index.html#uplink">Open Channel</a>
      </div>
    </section>
  </main>
`;

// ----- dark / bright theme toggle -----
(() => {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const paint = () => {
    const dark = document.body.classList.contains('dark-mode');
    btn.textContent = dark ? '\u2600 Light' : '\u263E Dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  paint();
  btn.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('mode', dark ? 'dark-mode' : 'bright-mode');
    paint();
  });
})();
