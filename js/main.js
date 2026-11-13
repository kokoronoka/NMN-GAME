/* ==========================================================================
   main.js — screen flow, game state, reveal, learn cards, kiosk features.
   Copy lives in content.js; drag + hit testing lives in drag.js.
   ========================================================================== */
import { CONFIG, CONTENT, ORGAN_ORDER } from './content.js';
import { createHitTester, createDragController, createGhost, flyGhost, bounceGhost } from './drag.js';
import { createShieldGame } from './shield.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SVG_NS = 'http://www.w3.org/2000/svg';
const params = new URLSearchParams(location.search);
const KIOSK = params.get('kiosk') === '1';
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const PLACED_R = 12; // placed orb radius in SVG units
const ORB_COUNT = CONFIG.topPicks.length; // one orb per correct organ

/* ---------------- elements ---------------- */
const el = {
  html: document.documentElement,
  brand: $('#brand-btn'),
  langSwitch: $('#lang-switch'),
  screens: $$('.screen'),
  game: $('#screen-game'),
  stage: $('#stage'),
  label: $('#organ-label'),
  instruction: $('#play-instruction'),
  remaining: $('#remaining'),
  tray: $('#tray'),
  undo: $('#undo-btn'),
  reveal: $('#reveal-btn'),
  panelPlay: $('#panel-play'),
  panelReveal: $('#panel-reveal'),
  revealScore: $('#reveal-score'),
  revealMsg: $('#reveal-msg'),
  revealTop5: $('#reveal-top5'),
  revealTopLabel: $('#reveal-top-label'),
  revealWhole: $('#reveal-whole'),
  cards: $('#cards'),
  dots: $('#card-dots'),
  prev: $('#card-prev'),
  next: $('#card-next'),
  fx: $('#fx-layer'),
  fsBtn: $('#fs-btn'),
  fsHint: $('#fs-hint'),
  idle: $('#idle-overlay'),
  idleCount: $('#idle-count'),
  admin: $('#admin-overlay'),
  adminStats: $('#admin-stats'),
  adminNote: $('#admin-note'),
  adminReset: $('#admin-reset'),
  live: $('#sr-live'),
};

/* ---------------- storage (wrapped: private mode / blocked storage must not break the game) ---------------- */
const STATS_KEY = 'zellv-nad-stats-v1';
const LANG_KEY = 'zellv-nad-lang';
const mem = {};
const store = {
  ok: (() => { try { localStorage.setItem('__zt', '1'); localStorage.removeItem('__zt'); return true; } catch { return false; } })(),
  get(k) { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
};
function loadStats() {
  try {
    const s = JSON.parse(store.get(STATS_KEY) || 'null');
    if (s && typeof s === 'object') {
      return {
        plays: s.plays | 0,
        perfect: s.perfect | 0,
        picks: s.picks && typeof s.picks === 'object' ? s.picks : {},
        shieldPlays: s.shieldPlays | 0,
        shieldWins: s.shieldWins | 0,
      };
    }
  } catch { /* corrupted → start fresh */ }
  return { plays: 0, perfect: 0, picks: {}, shieldPlays: 0, shieldWins: 0 };
}
const saveStats = (s) => store.set(STATS_KEY, JSON.stringify(s));

/* ---------------- i18n ---------------- */
let lang = CONFIG.languages.includes(CONFIG.defaultLanguage) ? CONFIG.defaultLanguage : 'en';
const HTML_LANG = { en: 'en', ms: 'ms', zh: 'zh-Hans' };
const dig = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function t(path, ...args) {
  let v = dig(CONTENT[lang], path);
  if (v === undefined || v === null || v === '') v = dig(CONTENT.en, path);
  if (typeof v === 'function') return v(...args);
  return v ?? '';
}
const organName = (id) => t(`organs.${id}.name`) || id;

/* ---------------- state ---------------- */
const state = {
  screen: 'start',
  game: 'nad',         // which start tab is selected: 'nad' | 'shield'
  mode: 'play',
  placements: [],      // [{ orb: index, organ: id }] in placement order
  selected: null,      // orb index selected for tap-to-place
  busy: 0,             // running fly animations
  round: 0,            // bumps on every reset (cancels stale async work)
  timers: [],
  result: null,        // { picks, score, total, perfect, at }
  target: null,
  cardIndex: 0,
};

let svg = null;
let hitter = null;
let drag = null;
let bodyReady = null;

/* ======================================================================
   Body
   ====================================================================== */
async function loadBody() {
  const res = await fetch('./assets/body.svg');
  if (!res.ok) throw new Error(`body.svg ${res.status}`);
  el.stage.insertAdjacentHTML('afterbegin', await res.text());
  svg = $('#body-svg', el.stage);
  svg.setAttribute('role', 'group');
  hitter = createHitTester(svg, { baseOrgan: 'skin' });
  eyes = $$('.eye-look', svg).map((g) => ({ g, cx: +g.dataset.cx, cy: +g.dataset.cy }));

  for (const g of $$('.organ', svg)) {
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tapOrgan(g.dataset.organ, { keyboard: true });
      }
    });
  }

  // Tap-to-place: a tap on the body places the selected orb on the organ under the finger.
  el.stage.addEventListener('click', (e) => {
    if (state.screen !== 'game' || state.mode !== 'play' || e.detail === 0) return;
    const organ = hitter.hit(e.clientX, e.clientY);
    if (organ) tapOrgan(organ);
  });

  drag = createDragController({
    layer: el.fx,
    hitTest: (x, y) => hitter.hit(x, y),
    canDrag: (orb) => state.screen === 'game' && state.mode === 'play' && !isOrbPlaced(+orb.dataset.index),
    onStart: () => setSelected(null),
    onMove: (x, y) => lookAt(x, y),
    onHover: (id) => setTarget(id),
    onDrop: ({ el: orb, ghost, organ, x, y }) => {
      lookAt(x, y);
      lookBack(organ ? 900 : 350);
      handleDrop(+orb.dataset.index, ghost, organ);
    },
    onCancel: ({ el: orb, ghost }) => { lookBack(0); returnGhost(+orb.dataset.index, ghost); },
  });
  buildTray();
  applyI18n();
}

/* ---------- Eyes follow the NAD+ orb ---------- */
let eyes = [];
let lookTimer = 0;
const EYE_MAX_X = 5.2; // how far the iris can travel inside the eye (SVG units)
const EYE_MAX_Y = 2.4;
function lookAt(x, y) {
  if (!hitter || !eyes.length) return;
  clearTimeout(lookTimer);
  const p = hitter.clientToSvg(x, y);
  if (!p) return;
  for (const e of eyes) {
    const dx = p.x - e.cx, dy = p.y - e.cy;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 60); // ease in near the eye so it doesn't jitter
    e.g.style.transform = `translate(${((dx / d) * EYE_MAX_X * k).toFixed(2)}px, ${((dy / d) * EYE_MAX_Y * k).toFixed(2)}px)`;
  }
}
function lookBack(delay = 0) {
  clearTimeout(lookTimer);
  lookTimer = setTimeout(() => eyes.forEach((e) => { e.g.style.transform = ''; }), delay);
}

const organGroup = (id) => svg?.querySelector(`.organ[data-organ="${id}"]`);
const isFilled = (id) => state.placements.some((p) => p.organ === id);
const isOrbPlaced = (i) => state.placements.some((p) => p.orb === i);
const orbEl = (i) => document.getElementById(`orb-${i}`);

function setLit(id, on) {
  organGroup(id)?.classList.toggle('is-on', on);
  $$(`.halo[data-organ="${id}"]`, svg).forEach((h) => h.classList.toggle('is-on', on));
}

function setTarget(id) {
  if (state.target === id) return;
  if (state.target) {
    organGroup(state.target)?.classList.remove('is-target');
    $$(`.halo[data-organ="${state.target}"]`, svg).forEach((h) => h.classList.remove('is-target'));
  }
  state.target = id;
  if (!id) { el.label.classList.remove('is-visible'); return; }
  organGroup(id)?.classList.add('is-target');
  $$(`.halo[data-organ="${id}"]`, svg).forEach((h) => h.classList.add('is-target'));
  showLabel(id);
}

function showLabel(id) {
  const stageRect = el.stage.getBoundingClientRect();
  let x, y;
  if (id === 'skin') {
    const a = hitter.anchorClient(id);
    x = a.x; y = a.y - 26;
  } else {
    const r = hitter.rectClient(id);
    x = (r.left + r.right) / 2; y = r.top - 10;
  }
  el.label.textContent = isFilled(id) ? `${organName(id)} ✓` : organName(id);
  // keep the label inside the stage
  const w = el.label.offsetWidth || 80;
  const lx = Math.min(Math.max(x - stageRect.left, w / 2 + 6), stageRect.width - w / 2 - 6);
  const ly = Math.max(y - stageRect.top, 40);
  el.label.style.transform = `translate3d(${lx}px, ${ly}px, 0) translate(-50%, -100%)`;
  el.label.classList.add('is-visible');
}

function addPlacedOrb(id) {
  const a = hitter.anchorSvg(id);
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'placed-orb');
  g.dataset.organ = id;
  g.setAttribute('transform', `translate(${a.x} ${a.y})`);
  g.innerHTML = `<g class="po-inner"><circle class="po-glow" r="${PLACED_R * 1.7}"/><circle class="po-core" r="${PLACED_R}"/><text class="po-text" y="0.5">NAD+</text></g>`;
  $('#placed-orbs', svg).appendChild(g);
}

/* ======================================================================
   Tray + placing
   ====================================================================== */
function buildTray() {
  el.tray.innerHTML = '';
  for (let i = 0; i < ORB_COUNT; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'orb';
    b.id = `orb-${i}`;
    b.dataset.index = i;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="orb-core"><span class="orb-text">NAD+</span></span>';
    b.addEventListener('click', () => onOrbTap(i));
    b.addEventListener('animationend', () => b.classList.remove('is-returning'));
    slot.appendChild(b);
    el.tray.appendChild(slot);
    drag?.attach(b);
  }
  updateOrbLabels();
}

function updateOrbLabels() {
  $$('.orb', el.tray).forEach((b, i) => b.setAttribute('aria-label', t('play.orbLabel', i + 1)));
}

function onOrbTap(i) {
  if (state.screen !== 'game' || state.mode !== 'play' || isOrbPlaced(i)) return;
  setSelected(state.selected === i ? null : i);
  if (state.selected !== null) announce(t('play.instructionSelected'));
}

function setSelected(i) {
  state.selected = i;
  $$('.orb', el.tray).forEach((b) => {
    const on = +b.dataset.index === i;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  if (i !== null && orbEl(i)) {
    const r = orbEl(i).getBoundingClientRect();
    lookAt(r.left + r.width / 2, r.top + r.height / 2);
  } else if (!drag?.active) {
    lookBack(0);
  }
  updatePlayUI();
}

function firstFreeOrb() {
  for (let i = 0; i < ORB_COUNT; i++) if (!isOrbPlaced(i)) return i;
  return null;
}

function tapOrgan(id, { keyboard = false } = {}) {
  if (state.screen !== 'game' || state.mode !== 'play') return;
  let i = state.selected;
  if (i === null && keyboard) i = firstFreeOrb();
  if (i === null) {
    // no orb selected: show the organ name and nudge the tray as a hint
    if (firstFreeOrb() !== null) {
      setTarget(id);
      later(() => { if (state.target === id) setTarget(null); }, 900);
      el.tray.classList.remove('is-nudge');
      void el.tray.offsetWidth;
      el.tray.classList.add('is-nudge');
    }
    return;
  }
  if (isFilled(id)) {
    announce(t('play.alreadyFilled', organName(id)));
    setTarget(id);
    later(() => { if (state.target === id) setTarget(null); }, 900);
    return;
  }
  setSelected(null);
  const orb = orbEl(i);
  const ghost = createGhost(orb, el.fx);
  orb.classList.add('is-lifted');
  const a = hitter.anchorClient(id);
  lookAt(a.x, a.y);
  lookBack(1000);
  place(i, id, ghost);
}

function handleDrop(i, ghost, organ) {
  if (state.mode !== 'play' || state.screen !== 'game') { returnGhost(i, ghost); return; }
  if (!organ) {
    announce(t('play.returned'));
    returnGhost(i, ghost);
    return;
  }
  if (isFilled(organ)) {
    announce(t('play.alreadyFilled', organName(organ)));
    state.busy++;
    const round = state.round;
    bounceGhost(ghost).then(() => {
      state.busy--;
      if (round === state.round) returnGhost(i, ghost);
      else ghost.remove();
    });
    return;
  }
  place(i, organ, ghost);
}

function place(i, organ, ghost) {
  state.placements.push({ orb: i, organ });
  const orb = orbEl(i);
  orb.classList.add('is-placed');
  orb.classList.remove('is-selected', 'is-returning');
  orb.parentElement.classList.add('is-empty');
  updatePlayUI();
  updateOrganAria();
  announce(t('play.placed', organName(organ)));

  const a = hitter.anchorClient(organ);
  const ctm = svg.getScreenCTM();
  const scale = ((PLACED_R * 2 * (ctm ? Math.hypot(ctm.a, ctm.b) : 1)) / (ghost._w || 60));
  const round = state.round;
  state.busy++;
  flyGhost(ghost, a.x, a.y, { scale, duration: 340 }).then(() => {
    ghost.remove();
    state.busy--;
    if (round !== state.round || !state.placements.some((p) => p.orb === i && p.organ === organ)) return;
    addPlacedOrb(organ);
    setLit(organ, true);
    burst(a.x, a.y);
    haptic();
    updatePlayUI();
  });
}

function returnGhost(i, ghost) {
  const orb = orbEl(i);
  if (!orb) { ghost.remove(); return; }
  const r = orb.getBoundingClientRect();
  const round = state.round;
  state.busy++;
  flyGhost(ghost, r.left + r.width / 2, r.top + r.height / 2, { scale: 1, duration: 300, easing: 'cubic-bezier(.3,.7,.3,1)' }).then(() => {
    ghost.remove();
    state.busy--;
    if (round === state.round) orb.classList.remove('is-lifted');
    updatePlayUI();
  });
}

function undo() {
  if (state.busy || !state.placements.length || state.mode !== 'play') return;
  const last = state.placements.pop();
  $(`.placed-orb[data-organ="${last.organ}"]`, svg)?.remove();
  setLit(last.organ, false);
  const orb = orbEl(last.orb);
  orb.classList.remove('is-placed', 'is-lifted');
  orb.parentElement.classList.remove('is-empty');
  orb.classList.add('is-returning');
  updatePlayUI();
  updateOrganAria();
  announce(t('play.returned'));
}

function updatePlayUI() {
  const left = ORB_COUNT - state.placements.length;
  const done = left === 0;
  el.instruction.textContent = done ? t('play.allPlaced') : state.selected !== null ? t('play.instructionSelected') : t('play.instruction');
  el.remaining.textContent = done ? '' : `· ${t('play.remaining', left)}`;
  el.undo.disabled = state.placements.length === 0;
  el.undo.setAttribute('aria-label', t('play.undo'));
  el.tray.hidden = done;
  el.reveal.hidden = !done;
  el.reveal.disabled = state.busy > 0;
}

function updateOrganAria() {
  if (!svg) return;
  svg.setAttribute('aria-label', t('a11y.body'));
  for (const g of $$('.organ', svg)) {
    const id = g.dataset.organ;
    g.setAttribute('aria-label', isFilled(id) ? `${organName(id)}, ${t('a11y.filled')}` : organName(id));
    g.setAttribute('tabindex', state.screen === 'game' && state.mode === 'play' ? '0' : '-1');
  }
}

/* ======================================================================
   Reveal
   ====================================================================== */
function doReveal() {
  if (state.busy || state.placements.length < ORB_COUNT) return;
  const picks = state.placements.map((p) => p.organ);
  const top = CONFIG.topPicks;
  const score = picks.filter((p) => top.includes(p)).length;
  const perfect = score === top.length && picks.length === top.length;
  state.result = { game: 'nad', picks, score, total: top.length, perfect, at: new Date() };

  const stats = loadStats();
  stats.plays++;
  if (perfect) stats.perfect++;
  for (const p of picks) stats.picks[p] = (stats.picks[p] | 0) + 1;
  saveStats(stats);

  setTarget(null);
  setSelected(null);
  setMode('reveal');
  renderReveal();
  el.revealWhole.classList.remove('is-visible');
  if (perfect) later(confetti, 250);

  // light up the whole body, organ by organ
  const order = ORGAN_ORDER.filter((id) => organGroup(id));
  const step = reducedMotion() ? 0 : 230;
  later(() => {
    el.revealWhole.classList.add('is-visible');
    order.forEach((id, k) => later(() => setLit(id, true), k * step));
  }, reducedMotion() ? 0 : 1100);
  $('#learn-btn').focus({ preventScroll: true });
}

function renderReveal() {
  const r = state.result;
  if (!r) return;
  el.revealScore.textContent = r.perfect ? t('reveal.perfectTitle', r.total) : t('reveal.scoreTitle', r.score, r.total);
  el.revealScore.classList.toggle('is-perfect', r.perfect);
  el.revealMsg.textContent = r.perfect ? t('reveal.perfectText') : t('reveal.positiveTwist');
  el.revealTopLabel.textContent = t('reveal.topLabel', r.total);
  el.revealTop5.innerHTML = '';
  for (const id of CONFIG.topPicks) {
    const li = document.createElement('li');
    const hit = r.picks.includes(id);
    li.className = `chip${hit ? ' is-match' : ''}`;
    li.innerHTML = hit ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>' : '';
    li.append(document.createTextNode(organName(id)));
    el.revealTop5.appendChild(li);
  }
}

function setMode(mode) {
  state.mode = mode;
  el.game.dataset.mode = mode;
  el.panelPlay.hidden = mode !== 'play';
  el.panelReveal.hidden = mode !== 'reveal';
  updateOrganAria();
}

/* ======================================================================
   Learn cards
   ====================================================================== */
function organIcon(id) {
  const g = organGroup(id);
  const bb = hitter.bboxSvg(id);
  const s = document.createElementNS(SVG_NS, 'svg');
  const pad = 6;
  const w = bb.x1 - bb.x0 + pad * 2, h = bb.y1 - bb.y0 + pad * 2;
  s.setAttribute('viewBox', `${bb.x0 - pad} ${bb.y0 - pad} ${w} ${h}`);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  const clone = g.cloneNode(true);
  clone.removeAttribute('id');
  clone.removeAttribute('tabindex');
  clone.removeAttribute('role');
  clone.removeAttribute('aria-label');
  clone.classList.remove('is-target', 'is-on');
  $$('.eye-look', clone).forEach((g) => { g.style.transform = ''; });
  s.appendChild(clone);
  return s;
}

// Icons for the shield-game explanation cards
const SHIELD_PATH = 'M32 4 54 12v18c0 14-9.6 24.4-22 30C19.6 54.4 10 44 10 30V12L32 4Z';
const SHIELD_ICONS = {
  meaning: '<svg viewBox="0 0 80 80" aria-hidden="true"><use href="#sym-radical" x="8" y="0" width="24" height="24"/><use href="#sym-radical" x="46" y="8" width="18" height="18"/><rect x="10" y="38" width="60" height="11" rx="5.5" fill="url(#g-shield)"/><path d="M16 41.5H64" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/><g fill="url(#g-cell)"><circle cx="16" cy="68" r="9"/><circle cx="40" cy="66" r="9"/><circle cx="64" cy="68" r="9"/></g></svg>',
  radical: '<svg viewBox="-16 -16 32 32" aria-hidden="true"><use href="#sym-radical" x="-16" y="-16" width="32" height="32"/></svg>',
  asta: '<svg viewBox="0 0 80 40" aria-hidden="true"><g fill="none" stroke="#ff4d5e" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><polygon points="4,20 10,10 22,10 28,20 22,30 10,30"/><polyline points="28,20 34,13 40,20 46,13 52,20"/><polygon points="52,20 58,10 70,10 76,20 70,30 58,30"/></g><circle cx="16" cy="20" r="2.6" fill="#ffb3bc"/><circle cx="64" cy="20" r="2.6" fill="#ffb3bc"/></svg>',
  membrane: '<svg viewBox="0 0 80 70" aria-hidden="true"><g fill="#c9b2ff">' +
    Array.from({ length: 8 }, (_, i) => `<circle cx="${6 + i * 9.7}" cy="12" r="4.2"/><circle cx="${6 + i * 9.7}" cy="58" r="4.2"/>`).join('') +
    '</g><g stroke="#c9b2ff" stroke-opacity=".55" stroke-width="1.4">' +
    Array.from({ length: 8 }, (_, i) => `<path d="M${6 + i * 9.7} 16 V30 M${6 + i * 9.7} 54 V40"/>`).join('') +
    '</g><rect x="36" y="2" width="8" height="66" rx="4" fill="url(#g-shield)"/></svg>',
  together: `<span class="orb" style="--s:52px" aria-hidden="true"><span class="orb-core"><span class="orb-text">NMN</span></span></span><svg viewBox="0 0 64 64" aria-hidden="true"><path d="${SHIELD_PATH}" fill="url(#g-shield)"/></svg>`,
};

function buildCards() {
  if (state.result?.game === 'shield') { buildShieldCards(); return; }
  $('#learn-title').textContent = t('learn.title');
  const r = state.result || { picks: [], score: 0 };
  const top = CONFIG.topPicks;
  const items = [
    ...(CONTENT.en.intro || []).map((_, i) => ({ type: 'intro', i })),
    ...top.map((id) => ({ type: 'organ', id })),
    ...r.picks.filter((id) => !top.includes(id)).map((id) => ({ type: 'organ', id })),
  ];
  el.cards.innerHTML = '';
  el.dots.innerHTML = '';
  items.forEach((item, n) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('aria-label', t('learn.cardOf', n + 1, items.length));
    const icon = document.createElement('div');
    icon.className = 'card-icon';
    if (item.type === 'intro') {
      const id = dig(CONTENT.en, `intro.${item.i}.id`);
      icon.innerHTML = `<span class="orb" style="--s:72px" aria-hidden="true"><span class="orb-core"><span class="orb-text">${id === 'nmn' ? 'NMN' : 'NAD+'}</span></span></span>`;
      card.append(icon, h3(t(`intro.${item.i}.title`)), para('card-text', t(`intro.${item.i}.text`)));
      const extra = t(`intro.${item.i}.extra`);
      if (extra) card.append(para('card-extra', extra));
    } else {
      icon.appendChild(organIcon(item.id));
      const tags = document.createElement('div');
      tags.className = 'card-tags';
      if (top.includes(item.id)) tags.append(tag('tag tag-top', t('learn.topPickTag')));
      if (r.picks.includes(item.id)) tags.append(tag('tag tag-pick', t('learn.yourPickTag')));
      const nmn = document.createElement('div');
      nmn.className = 'card-nmn';
      nmn.append(para('card-nmn-label', t('learn.howNmnLabel')), para('', t(`organs.${item.id}.nmn`)));
      card.append(icon, tags, h3(organName(item.id)), para('card-text', t(`organs.${item.id}.text`)), nmn);
    }
    el.cards.appendChild(card);
    const dot = document.createElement('span');
    dot.className = 'dot';
    el.dots.appendChild(dot);
  });
  finishCards(items.length);
}

function buildShieldCards() {
  $('#learn-title').textContent = t('shield.learnTitle');
  const count = CONTENT.en.shield.cards.length;
  el.cards.innerHTML = '';
  el.dots.innerHTML = '';
  for (let n = 0; n < count; n++) {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('aria-label', t('learn.cardOf', n + 1, count));
    const iconKey = dig(CONTENT.en, `shield.cards.${n}.icon`);
    const icon = document.createElement('div');
    icon.className = `card-icon is-red${iconKey === 'together' ? ' is-wide' : ''}`;
    icon.innerHTML = SHIELD_ICONS[iconKey] || SHIELD_ICONS.meaning;
    card.append(icon, h3(t(`shield.cards.${n}.title`)), para('card-text', t(`shield.cards.${n}.text`)));
    const extra = t(`shield.cards.${n}.extra`);
    if (extra) card.append(para('card-extra', extra));
    el.cards.appendChild(card);
    el.dots.appendChild(Object.assign(document.createElement('span'), { className: 'dot' }));
  }
  finishCards(count);
}

function finishCards(count) {
  el.prev.setAttribute('aria-label', t('learn.prev'));
  el.next.setAttribute('aria-label', t('learn.next'));
  requestAnimationFrame(() => goToCard(Math.min(state.cardIndex, count - 1), false));
}
const h3 = (text) => Object.assign(document.createElement('h3'), { textContent: text });
const para = (cls, text) => Object.assign(document.createElement('p'), { className: cls, textContent: text });
const tag = (cls, text) => Object.assign(document.createElement('span'), { className: cls, textContent: text });

function cardStep() {
  const c = el.cards.querySelector('.card');
  return c ? c.offsetWidth + parseFloat(getComputedStyle(el.cards).columnGap || '14') : 1;
}
function goToCard(i, smooth = true) {
  const cards = $$('.card', el.cards);
  if (!cards.length) return;
  i = Math.max(0, Math.min(cards.length - 1, i));
  const c = cards[i];
  const left = c.offsetLeft - (el.cards.clientWidth - c.offsetWidth) / 2;
  el.cards.scrollTo({ left, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  setCardIndex(i);
}
function setCardIndex(i) {
  state.cardIndex = i;
  const n = el.dots.children.length;
  [...el.dots.children].forEach((d, k) => d.classList.toggle('is-active', k === i));
  el.prev.disabled = i <= 0;
  el.next.disabled = i >= n - 1;
}
let cardRaf = 0;
el.cards.addEventListener('scroll', () => {
  if (cardRaf) return;
  cardRaf = requestAnimationFrame(() => {
    cardRaf = 0;
    setCardIndex(Math.round(el.cards.scrollLeft / cardStep()));
  });
}, { passive: true });
el.cards.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { e.preventDefault(); goToCard(state.cardIndex + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); goToCard(state.cardIndex - 1); }
});
el.prev.addEventListener('click', () => goToCard(state.cardIndex - 1));
el.next.addEventListener('click', () => goToCard(state.cardIndex + 1));

/* ======================================================================
   End
   ====================================================================== */
function renderEnd() {
  const r = state.result || { game: 'nad', score: 0, total: CONFIG.topPicks.length, at: new Date() };
  const isShield = r.game === 'shield';
  $('.badge').classList.toggle('is-shield', isShield);
  if (isShield) {
    const rules = CONFIG.shield.badges;
    const badge = rules.find((b) => b.survived === r.survived && r.lives >= b.minLives) || rules[rules.length - 1];
    $('#badge-title').textContent = t(`shield.badges.${badge.key}.title`);
    $('#badge-text').textContent = t(`shield.badges.${badge.key}.text`);
    $('#score-line').textContent = t('shield.scoreLine', r.blocked, r.lives);
  } else {
    const badge = CONFIG.badges.find((b) => r.score >= b.min) || CONFIG.badges[CONFIG.badges.length - 1];
    $('#badge-title').textContent = t(`badges.${badge.key}.title`);
    $('#badge-text').textContent = t(`badges.${badge.key}.text`);
    $('#score-line').textContent = t('end.scoreLine', r.score, r.total);
  }
  let stamp = '';
  try {
    stamp = new Intl.DateTimeFormat(HTML_LANG[lang] || 'en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(r.at);
  } catch { stamp = r.at.toLocaleString(); }
  $('#cta-stamp').textContent = `${t('end.playedAt')} · ${stamp}`;
}

/* ======================================================================
   Screen flow
   ====================================================================== */
function goTo(name) {
  state.screen = name;
  for (const s of el.screens) {
    const on = s.dataset.screen === name;
    s.classList.toggle('is-active', on);
    s.setAttribute('aria-hidden', String(!on));
  }
  updateOrganAria();
  lastActivity = performance.now();
}

async function startPlay() {
  await bodyReady;
  resetRound();
  setMode('play');
  goTo('game');
  updatePlayUI();
}

function resetRound() {
  state.round++;
  drag?.cancel();
  shieldGame.stop();
  el.shieldResult.hidden = true;
  state.timers.forEach(clearTimeout);
  state.timers = [];
  state.placements = [];
  state.selected = null;
  state.result = null;
  state.busy = 0;
  state.cardIndex = 0;
  $$('.orb-ghost, .particle, .ring-burst, .confetti', el.fx).forEach((n) => n.remove());
  if (svg) {
    $('#placed-orbs', svg).innerHTML = '';
    $$('.organ, .halo', svg).forEach((n) => n.classList.remove('is-on', 'is-target'));
  }
  state.target = null;
  lookBack(0);
  el.label.classList.remove('is-visible');
  el.revealWhole.classList.remove('is-visible');
  buildTray();
  setMode('play');
  updatePlayUI();
}

function resetToStart({ resetLanguage = false } = {}) {
  resetRound();
  if (resetLanguage) {
    if (lang !== CONFIG.defaultLanguage) setLang(CONFIG.defaultLanguage);
    selectGame('nad');
  }
  closeAdmin();
  goTo('start');
}

/* ======================================================================
   Game 2 — AstaReal® Astaxanthin shield
   ====================================================================== */
el.shieldResult = $('#shield-result');
const HEART_SVG = '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.9 1.2 5.4 3.1 1.5-1.9 3.2-3.1 5.4-3.1 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>';
let shieldHud = { lives: CONFIG.shield.lives, blocked: 0, remaining: CONFIG.shield.durationSeconds };

const shieldGame = createShieldGame({
  canvas: $('#shield-canvas'),
  config: CONFIG.shield,
  labels: () => ({ cells: t('shield.cellsLabel'), shield: t('shield.shieldLabel'), ready: t('shield.ready'), go: t('shield.go') }),
  onHud: (h) => { shieldHud = h; renderShieldHud(); },
  onHit: (livesLeft) => {
    const f = $('#shield-flash');
    f.classList.remove('is-on');
    void f.offsetWidth;
    f.classList.add('is-on');
    const hearts = $$('#shield-hearts .heart');
    hearts[livesLeft]?.classList.add('is-pop');
    try { navigator.vibrate?.(70); } catch { /* ignore */ }
    announce(`${t('shield.hit')} ${t('shield.hearts', Math.max(0, livesLeft))}`);
  },
  onBlock: () => { try { navigator.vibrate?.(8); } catch { /* ignore */ } },
  onEnd: (r) => onShieldEnd(r),
});

function selectGame(game) {
  state.game = game;
  for (const tab of $$('.game-tab')) {
    const on = tab.dataset.game === game;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  }
  $('#start-panel-nad').hidden = game !== 'nad';
  $('#start-panel-shield').hidden = game !== 'shield';
}

function renderHearts(container, lives) {
  const total = CONFIG.shield.lives;
  if (container.children.length !== total) container.innerHTML = HEART_SVG.repeat(total);
  [...container.children].forEach((h, i) => h.classList.toggle('is-lost', i >= lives));
  container.setAttribute('aria-label', t('shield.hearts', lives));
}

function renderShieldHud() {
  const h = shieldHud;
  renderHearts($('#shield-hearts'), h.lives);
  $('#shield-time').textContent = t('shield.seconds', h.remaining);
  $('#shield-timer-fill').style.transform = `scaleX(${(h.remaining / CONFIG.shield.durationSeconds).toFixed(3)})`;
  $('#shield-blocked').textContent = t('shield.blocked', h.blocked);
}

function startShield() {
  resetRound();
  state.game = 'shield';
  shieldHud = { lives: CONFIG.shield.lives, blocked: 0, remaining: CONFIG.shield.durationSeconds };
  $$('#shield-hearts .heart').forEach((h) => h.classList.remove('is-pop'));
  renderShieldHud();
  goTo('shield');
  requestAnimationFrame(() => shieldGame.start());
}

function onShieldEnd(r) {
  const round = state.round;
  state.result = { game: 'shield', ...r, at: new Date() };
  const stats = loadStats();
  stats.shieldPlays++;
  if (r.survived) stats.shieldWins++;
  saveStats(stats);
  if (r.survived && r.lives === CONFIG.shield.lives) later(confetti, 300);
  later(() => {
    if (round !== state.round) return;
    renderShieldResult();
    el.shieldResult.hidden = false;
    $('#shield-result-btn').focus({ preventScroll: true });
  }, 900);
}

function renderShieldResult() {
  const r = state.result;
  if (!r || r.game !== 'shield') return;
  $('#shield-result-title').textContent = r.survived ? t('shield.winTitle') : t('shield.loseTitle');
  $('#shield-result-text').textContent = r.survived ? t('shield.winText', r.blocked, r.seconds) : t('shield.loseText', r.blocked, r.seconds);
  renderHearts($('#shield-result-hearts'), r.lives);
}

function applyShieldI18n() {
  const s = CONFIG.shield;
  $('#shield-hook').textContent = t('shield.hook', s.durationSeconds);
  $('#shield-howto-text').textContent = t('shield.howtoText', s.durationSeconds, s.lives);
  $('#game-tabs').setAttribute('aria-label', t('a11y.games'));
  $('#shield-canvas').setAttribute('aria-label', t('shield.howtoText', s.durationSeconds, s.lives));
  renderShieldHud();
  renderShieldResult();
  if (state.screen === 'shield' && shieldGame.phase !== 'idle') shieldGame.resize();
}

const later = (fn, ms) => { const id = setTimeout(fn, ms); state.timers.push(id); return id; };

/* ======================================================================
   FX
   ====================================================================== */
function burst(x, y) {
  if (reducedMotion()) return;
  const frag = document.createDocumentFragment();
  const nodes = [];
  const ring = document.createElement('span');
  ring.className = 'ring-burst';
  ring.style.setProperty('--x', `${x}px`);
  ring.style.setProperty('--y', `${y}px`);
  frag.appendChild(ring);
  nodes.push(ring);
  const n = 14;
  for (let k = 0; k < n; k++) {
    const p = document.createElement('span');
    nodes.push(p);
    p.className = 'particle';
    const ang = (k / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 34 + Math.random() * 46;
    p.style.setProperty('--x', `${x}px`);
    p.style.setProperty('--y', `${y}px`);
    p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    frag.appendChild(p);
  }
  el.fx.appendChild(frag);
  setTimeout(() => nodes.forEach((p) => p.remove()), 900);
}

function confetti() {
  if (reducedMotion()) return;
  const cs = getComputedStyle(el.html);
  const colours = [1, 2, 3, 4, 5].map((i) => cs.getPropertyValue(`--confetti-${i}`).trim()).filter(Boolean);
  const n = window.innerWidth < 600 ? 70 : 110;
  const frag = document.createDocumentFragment();
  let maxT = 0;
  for (let k = 0; k < n; k++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    const dur = 2.2 + Math.random() * 1.6, delay = Math.random() * 0.7;
    maxT = Math.max(maxT, dur + delay);
    c.style.setProperty('--x', `${Math.random() * window.innerWidth}px`);
    c.style.setProperty('--drift', `${(Math.random() - 0.5) * 180}px`);
    c.style.setProperty('--rot', `${(Math.random() - 0.5) * 1440}deg`);
    c.style.setProperty('--dur', `${dur}s`);
    c.style.setProperty('--delay', `${delay}s`);
    c.style.setProperty('--c', colours[k % colours.length]);
    if (k % 3 === 0) { c.style.width = '8px'; c.style.height = '8px'; c.style.borderRadius = '50%'; }
    frag.appendChild(c);
  }
  el.fx.appendChild(frag);
  later(() => $$('.confetti', el.fx).forEach((c) => c.remove()), maxT * 1000 + 200);
}

function haptic() {
  try { navigator.vibrate?.(18); } catch { /* not supported (iOS) */ }
}

function announce(msg) {
  el.live.textContent = '';
  requestAnimationFrame(() => { el.live.textContent = msg; });
}

/* ======================================================================
   Language
   ====================================================================== */
function buildLangSwitch() {
  el.langSwitch.innerHTML = '';
  el.langSwitch.hidden = CONFIG.languages.length < 2;
  for (const code of CONFIG.languages) {
    if (!CONTENT[code]) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang-btn';
    b.dataset.lang = code;
    b.textContent = CONTENT[code].langShort || code.toUpperCase();
    b.setAttribute('aria-label', CONTENT[code].langName || code);
    b.addEventListener('click', () => setLang(code));
    el.langSwitch.appendChild(b);
  }
}

function setLang(code) {
  if (!CONTENT[code]) return;
  lang = code;
  store.set(LANG_KEY, code);
  applyI18n();
}

function applyI18n() {
  el.html.lang = HTML_LANG[lang] || lang;
  el.langSwitch.setAttribute('aria-label', t('a11y.language'));
  $$('.lang-btn', el.langSwitch).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $$('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  el.brand.setAttribute('aria-label', t('brand'));
  updateFsButton();
  if (!el.fsHint.hidden) el.fsHint.textContent = t('a11y.fullscreenHint');
  updateOrbLabels();
  updatePlayUI();
  updateOrganAria();
  applyShieldI18n();
  if (state.result?.game === 'nad') renderReveal();
  if (state.screen === 'learn') buildCards();
  if (state.screen === 'end') renderEnd();
}

/* ======================================================================
   Idle auto-reset
   ====================================================================== */
let lastActivity = performance.now();
const idleOn = () => CONFIG.idle.enabled && (!CONFIG.idle.kioskOnly || KIOSK);
function activity() {
  lastActivity = performance.now();
  if (!el.idle.hidden) idleTick();
}
['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach((ev) => window.addEventListener(ev, activity, { passive: true, capture: true }));
document.addEventListener('scroll', activity, { passive: true, capture: true });

function idleTick() {
  if (!idleOn() || state.screen === 'start') { el.idle.hidden = true; return; }
  const idleS = (performance.now() - lastActivity) / 1000;
  const total = CONFIG.idle.timeoutSeconds;
  const warnAt = Math.max(0, total - CONFIG.idle.warningSeconds);
  if (idleS >= total) {
    el.idle.hidden = true;
    resetToStart({ resetLanguage: true });
  } else if (idleS >= warnAt) {
    const wasHidden = el.idle.hidden;
    el.idle.hidden = false;
    el.idleCount.textContent = t('idle.text', Math.ceil(total - idleS));
    if (wasHidden) { drag?.cancel(); $('#idle-btn').focus({ preventScroll: true }); }
  } else {
    el.idle.hidden = true;
  }
}
setInterval(idleTick, 250);
$('#idle-btn').addEventListener('click', () => { lastActivity = performance.now(); idleTick(); });

/* ======================================================================
   Hidden admin (tap the logo N times)
   ====================================================================== */
let brandTaps = [];
el.brand.addEventListener('click', () => {
  const now = Date.now();
  brandTaps = brandTaps.filter((x) => now - x < 2500);
  brandTaps.push(now);
  if (brandTaps.length >= CONFIG.adminTapCount) { brandTaps = []; openAdmin(); }
});
function openAdmin() {
  renderAdmin();
  el.admin.hidden = false;
  $('#admin-close').focus({ preventScroll: true });
}
function closeAdmin() {
  el.admin.hidden = true;
  el.adminReset.dataset.armed = '';
  el.adminReset.textContent = t('admin.reset');
}
function renderAdmin() {
  const s = loadStats();
  const rate = s.plays ? Math.round((s.perfect / s.plays) * 100) : 0;
  const popular = Object.entries(s.picks).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${organName(id)} (${n})`).join(', ') || '—';
  el.adminStats.innerHTML = '';
  for (const [k, v] of [['admin.plays', s.plays], ['admin.perfect', s.perfect], ['admin.rate', `${rate}%`], ['admin.popular', popular], ['admin.shieldPlays', s.shieldPlays], ['admin.shieldWins', s.shieldWins]]) {
    el.adminStats.append(Object.assign(document.createElement('dt'), { textContent: t(k) }), Object.assign(document.createElement('dd'), { textContent: String(v) }));
  }
  el.adminNote.textContent = store.ok ? '' : t('admin.storageOff');
}
$('#admin-close').addEventListener('click', closeAdmin);
el.adminReset.addEventListener('click', () => {
  if (el.adminReset.dataset.armed !== '1') {
    el.adminReset.dataset.armed = '1';
    el.adminReset.textContent = t('admin.confirmReset');
    return;
  }
  saveStats({ plays: 0, perfect: 0, picks: {}, shieldPlays: 0, shieldWins: 0 });
  el.adminReset.dataset.armed = '';
  el.adminReset.textContent = t('admin.reset');
  renderAdmin();
});

/* ======================================================================
   Touch hardening + full screen (iPad / phones)
   ====================================================================== */
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || !!window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches;
const fsEnabled = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

function enterFullscreen() {
  const d = document.documentElement;
  try {
    // iPadOS 16.4+ / Android / desktop: standard API. Older iPadOS Safari: webkit-prefixed (returns undefined).
    const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen?.();
    p?.catch?.(() => {});
  } catch { /* not allowed right now */ }
}
function exitFullscreen() {
  try {
    const p = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen?.();
    p?.catch?.(() => {});
  } catch { /* ignore */ }
}

let hintTimer = 0;
function showFsHint() {
  el.fsHint.textContent = t('a11y.fullscreenHint');
  el.fsHint.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { el.fsHint.hidden = true; }, 6000);
}

function updateFsButton() {
  const on = !!fsElement();
  el.fsBtn.setAttribute('aria-pressed', String(on));
  el.fsBtn.setAttribute('aria-label', t(on ? 'a11y.exitFullscreen' : 'a11y.fullscreen'));
  el.html.classList.toggle('is-fullscreen', on);
}

function setupFullscreen() {
  // Already running as a home-screen app (no browser bars) → nothing to do.
  // iPhone Safari has no Fullscreen API for pages → the button explains "Add to Home Screen" instead.
  const usable = !isStandalone() && (fsEnabled() || IS_IOS);
  el.fsBtn.hidden = !usable;
  if (!usable) return;
  el.fsBtn.addEventListener('click', () => {
    if (!fsEnabled()) { el.fsHint.hidden ? showFsHint() : (el.fsHint.hidden = true); return; }
    fsElement() ? exitFullscreen() : enterFullscreen();
  });
  el.fsHint.addEventListener('click', () => { el.fsHint.hidden = true; });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
    updateFsButton();
    // layout changed size: re-fit the shield canvas / floating labels
    window.dispatchEvent(new Event('resize'));
  }));
  updateFsButton();
}

// Game-wide touch protection (not only kiosk): a stray pinch, double-tap or long-press
// while dragging must never zoom the page or pop up a callout / selection.
function setupTouch() {
  const block = (e) => { if (e.cancelable) e.preventDefault(); };
  // iOS Safari ignores user-scalable=no, but honours preventDefault on its gesture events.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, block, { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) block(e); }, { passive: false });
  // long-press menu on the body graphic, orbs and buttons (selectable learn-card text keeps its menu outside kiosk)
  document.addEventListener('contextmenu', (e) => { if (KIOSK || !e.target.closest?.('.card-text, .card-extra, .card-nmn, .disclaimer')) e.preventDefault(); });
}

/* ======================================================================
   Kiosk mode (?kiosk=1)
   ====================================================================== */
function setupKiosk() {
  if (!KIOSK) return;
  el.html.classList.add('kiosk');
  const vp = document.querySelector('meta[name="viewport"]');
  vp?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  const block = (e) => e.preventDefault();
  ['selectstart', 'dblclick'].forEach((ev) => document.addEventListener(ev, block, { passive: false }));
  document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });
  // Go full screen on the first tap, and again on the next tap if a guest swipes out of it.
  // (Browsers only allow full screen from a tap, never automatically on load.)
  if (fsEnabled() && !isStandalone()) {
    const fs = (e) => { if (!fsElement() && !e.target.closest?.('#fs-btn')) enterFullscreen(); };
    document.addEventListener('pointerup', fs);
    document.addEventListener('click', fs);
  }
}

/* ======================================================================
   Wiring
   ====================================================================== */
$('#start-btn').addEventListener('click', () => goTo('howto'));
$('#howto-btn').addEventListener('click', startPlay);
el.undo.addEventListener('click', undo);
el.reveal.addEventListener('click', doReveal);
$('#learn-btn').addEventListener('click', () => { state.cardIndex = 0; goTo('learn'); buildCards(); });
$('#finish-btn').addEventListener('click', () => { renderEnd(); goTo('end'); });
$('#again-btn').addEventListener('click', () => resetToStart());

// game tabs (start screen) — click + arrow-key navigation
for (const tab of $$('.game-tab')) {
  tab.addEventListener('click', () => selectGame(tab.dataset.game));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const tabs = $$('.game-tab');
    const next = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectGame(next.dataset.game);
    next.focus();
  });
}
$('#shield-start-btn').addEventListener('click', () => goTo('shield-howto'));
$('#shield-howto-btn').addEventListener('click', startShield);
$('#shield-result-btn').addEventListener('click', () => { el.shieldResult.hidden = true; state.cardIndex = 0; goTo('learn'); buildCards(); });
window.addEventListener('resize', () => { if (state.target) showLabel(state.target); if (state.screen === 'learn') goToCard(state.cardIndex, false); });

function init() {
  setupTouch();
  setupKiosk();
  setupFullscreen();
  const saved = store.get(LANG_KEY);
  if (!KIOSK && saved && CONFIG.languages.includes(saved) && CONTENT[saved]) lang = saved;
  buildLangSwitch();
  applyI18n();
  bodyReady = loadBody().catch((err) => {
    console.error(err);
    el.stage.insertAdjacentHTML('afterbegin', '<p class="stage-pill">Could not load the body graphic. Please reload.</p>');
  });

  if ('serviceWorker' in navigator && !params.has('nosw') && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e)));
  }

  // Test hook (only with ?dev=1): used by tests/hit-test.html
  if (params.get('dev') === '1') {
    window.__game = { state, get hitter() { return hitter; }, get svg() { return svg; }, ready: () => bodyReady, startPlay, goTo, doReveal, undo, tapOrgan, onOrbTap, setLang, resetToStart, renderEnd, buildCards, selectGame, startShield, shield: shieldGame };
  }
}

init();
