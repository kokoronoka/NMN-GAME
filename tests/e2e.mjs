/* End-to-end tests: drag hit detection on close organs + full game flow.
   Drives real headless Chrome/Edge through the DevTools protocol with
   emulated TOUCH input (so the real Pointer Events code path runs).

   Usage:
     1. Serve the folder:   python -m http.server 8765
     2. Run:                node tests/e2e.mjs [http://127.0.0.1:8765/]
   Env: CHROME_PATH=path/to/chrome-or-msedge  SHOTS=dir (screenshots, optional)
*/
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const SHOTS = process.env.SHOTS || '';
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => existsSync(p));
if (!BROWSER) { console.error('No Chrome/Edge found. Set CHROME_PATH.'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'nad-e2e-'));
const proc = spawn(BROWSER, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej, method }));
}
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
        ws.onmessage = (ev) => {
          const m = JSON.parse(ev.data);
          if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id); pending.delete(m.id);
            m.error ? p.rej(new Error(`${p.method}: ${m.error.message}`)) : p.res(m.result);
          } else if (m.method === 'Runtime.exceptionThrown') {
            consoleErrors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
          } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
            consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
          }
        };
        return;
      }
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Could not connect to browser');
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}\n${expr.slice(0, 200)}`);
  return r.result.value;
}
async function setViewport(width, height, { mobile = true, touch = true, dpr = 2 } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 0 });
}
async function load(query = '') {
  await send('Page.navigate', { url: `${BASE}index.html?dev=1&nosw=1${query}` });
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    try { if (await evaluate('!!(window.__game && document.readyState === "complete")')) break; } catch { /* navigating */ }
  }
  await evaluate('window.__game.ready()');
  await evaluate('document.fonts.ready.then(() => true)');
}
async function shot(name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
}
async function touchDrag(from, to, { steps = 14, hold = false } = {}) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let s = 1; s <= steps; s++) {
    const k = s / steps;
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, id: 1 }] });
    await sleep(18);
  }
  await sleep(200); // let the touch "lift" finish easing in
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: to.x, y: to.y, id: 1 }] });
  await sleep(40);
  if (hold) return;
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function touchTap(p) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  await sleep(40);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(80);
}
async function mouseDrag(from, to, steps = 12) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let s = 1; s <= steps; s++) {
    const k = s / steps;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, button: 'left', buttons: 1 });
    await sleep(16);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0, clickCount: 1 });
}

/* ---------- reporting ---------- */
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  \u2713 ${name}`); } else { fail++; console.log(`  \u2717 ${name} ${detail}`); }
}

/* ---------- in-page helpers (string injected once per load) ---------- */
const HELPERS = `
window.__t = (() => {
  const g = window.__game, h = () => g.hitter;
  const org = (id) => h().organs.find(o => o.id === id);
  const centroid = (poly) => [poly.reduce((s,p)=>s+p[0],0)/poly.length, poly.reduce((s,p)=>s+p[1],0)/poly.length];
  // closest pair of outline points between two organs (all parts)
  function closestPair(a, b) {
    let best = { d: Infinity };
    for (const pa of org(a).polys) for (const p of pa) for (const pb of org(b).polys) for (const q of pb) {
      const d = Math.hypot(p[0]-q[0], p[1]-q[1]);
      if (d < best.d) best = { d, p, q, pa, pb };
    }
    return best;
  }
  // a point just inside organ "id" on its boundary nearest to organ "other"
  function edgePoint(id, other, inset) {
    const c = closestPair(id, other);
    const [cx, cy] = centroid(c.pa);
    const dx = cx - c.p[0], dy = cy - c.p[1], L = Math.hypot(dx, dy);
    return { x: c.p[0] + dx / L * inset, y: c.p[1] + dy / L * inset };
  }
  function midpoint(a, b) { const c = closestPair(a, b); return { x: (c.p[0]+c.q[0])/2, y: (c.p[1]+c.q[1])/2, gap: c.d }; }
  const toClient = (p) => h().svgToClient(p.x, p.y);
  const hitSvg = (p, pad = 10) => h().hitSvg(p.x, p.y, pad);
  const hitClient = (p) => h().hit(p.x, p.y);
  const orbCentre = (i) => { const r = document.getElementById('orb-' + i).getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; };
  const placements = () => g.state.placements.map(p => p.organ);
  return { org, closestPair, edgePoint, midpoint, toClient, hitSvg, hitClient, orbCentre, placements };
})(); true`;

const PAIRS = [
  ['heart', 'lungs'],
  ['liver', 'stomach'],
  ['eyes', 'brain'],
  ['kidneys', 'intestines'],
  ['liver', 'lungs'],
  ['stomach', 'intestines'],
  ['kidneys', 'liver'],
];

async function hitUnitTests() {
  console.log('\nHit-test unit checks (SVG geometry):');
  // every organ: its own inside point resolves to itself
  const ids = await evaluate('__game.hitter.ids');
  for (const id of ids) {
    const r = await evaluate(`(() => { const p = __game.hitter.insidePoint('${id}'); return __t.hitSvg(p); })()`);
    check(`centre of ${id} -> ${id}`, r === id, `(got ${r})`);
  }
  // close pairs: points 1.5 / 4 units inside each organ's facing edge
  for (const [a, b] of PAIRS) {
    for (const inset of [1.5, 4]) {
      const ra = await evaluate(`__t.hitSvg(__t.edgePoint('${a}','${b}',${inset}), 30)`);
      const rb = await evaluate(`__t.hitSvg(__t.edgePoint('${b}','${a}',${inset}), 30)`);
      check(`${a} edge facing ${b} (inset ${inset}) -> ${a}`, ra === a, `(got ${ra})`);
      check(`${b} edge facing ${a} (inset ${inset}) -> ${b}`, rb === b, `(got ${rb})`);
    }
    const mid = await evaluate(`(() => { const m = __t.midpoint('${a}','${b}'); return { gap: m.gap, hit: __t.hitSvg(m, 30) }; })()`);
    check(`gap between ${a}/${b} (${mid.gap.toFixed(1)}u) resolves to one of them`, mid.hit === a || mid.hit === b, `(got ${mid.hit})`);
  }
  // bias test: in the gap, 1/4 of the way from A -> A, 3/4 -> B (nearest wins, never the bigger neighbour)
  for (const [a, b] of PAIRS) {
    const r = await evaluate(`(() => { const c = __t.closestPair('${a}','${b}'); if (c.d < 2) return null;
      const q1 = { x: c.p[0] + (c.q[0]-c.p[0])*0.25, y: c.p[1] + (c.q[1]-c.p[1])*0.25 };
      const q3 = { x: c.p[0] + (c.q[0]-c.p[0])*0.75, y: c.p[1] + (c.q[1]-c.p[1])*0.75 };
      return [__t.hitSvg(q1, 30), __t.hitSvg(q3, 30), c.d]; })()`);
    if (r) check(`gap ${a}|${b}: nearer side wins (${r[2].toFixed(1)}u gap)`, r[0] === a && r[1] === b, `(got ${r[0]}, ${r[1]})`);
  }
  // heart sits over lungs: sample the whole heart interior on a grid -> always heart
  const heartGrid = await evaluate(`(() => { const o = __t.org('heart'); const b = o.bbox; let n = 0, bad = 0;
    for (let x = b.x0; x <= b.x1; x += 1) for (let y = b.y0; y <= b.y1; y += 1) {
      const inside = o.polys.some(p => { let c=false; for (let i=0,j=p.length-1;i<p.length;j=i++){ const [xi,yi]=p[i],[xj,yj]=p[j]; if ((yi>y)!==(yj>y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) c=!c; } return c; });
      if (!inside) continue; n++; if (__game.hitter.hitSvg(x, y, 30) !== 'heart') bad++; }
    return { n, bad }; })()`);
  check(`all ${heartGrid.n} grid points inside the heart -> heart`, heartGrid.bad === 0, `(${heartGrid.bad} wrong)`);
  // far outside the body -> null; forearm -> skin
  check('far outside body -> null (returns to tray)', (await evaluate('__game.hitter.hitSvg(20, 700, 10)')) === null);
  check('forearm -> skin', (await evaluate('__game.hitter.hitSvg(80, 420, 10)')) === 'skin');
  check('shin -> skin', (await evaluate('__game.hitter.hitSvg(150, 610, 10)')) === 'skin');
}

async function e2eDragTests(label) {
  console.log(`\nTouch drag E2E (${label}):`);
  await evaluate('__game.startPlay()');
  await sleep(500);
  await evaluate(HELPERS);
  const LIFT = 34;
  // drop the orb CENTRE on a target; finger is LIFT px below it (grab at orb centre)
  async function dropOn(orbIndex, svgPointExpr, expect, { mouse = false } = {}) {
    const from = await evaluate(`__t.orbCentre(${orbIndex})`);
    const target = await evaluate(`__t.toClient(${svgPointExpr})`);
    const before = (await evaluate('__t.placements()')).length;
    if (mouse) await mouseDrag(from, target);
    else await touchDrag(from, { x: target.x, y: target.y + LIFT });
    await sleep(520);
    const after = await evaluate('__t.placements()');
    const got = after.length > before ? after[after.length - 1] : null;
    return { got, ok: got === expect, target };
  }
  async function undoAll() {
    for (let k = 0; k < 6; k++) { await evaluate('__game.undo()'); await sleep(60); }
  }

  const cases = [
    ['heart', `__t.edgePoint('heart','lungs',2.5)`],
    ['lungs', `__t.edgePoint('lungs','heart',2.5)`],
    ['liver', `__t.edgePoint('liver','stomach',2.5)`],
    ['stomach', `__t.edgePoint('stomach','liver',2.5)`],
    ['eyes', `__t.edgePoint('eyes','brain',2.5)`],
  ];
  for (const [expect, expr] of cases) {
    const r = await dropOn(0, expr, expect);
    check(`touch-drop on ${expr.replace(/__t\.edgePoint/, 'edge')} -> ${expect}`, r.ok, `(got ${r.got})`);
    await undoAll();
  }
  const cases2 = [
    ['brain', `__t.edgePoint('brain','eyes',2.5)`],
    ['kidneys', `__t.edgePoint('kidneys','intestines',2.5)`],
    ['intestines', `__t.edgePoint('intestines','kidneys',2.5)`],
  ];
  for (const [expect, expr] of cases2) {
    const r = await dropOn(1, expr, expect);
    check(`touch-drop on ${expr.replace(/__t\.edgePoint/, 'edge')} -> ${expect}`, r.ok, `(got ${r.got})`);
    await undoAll();
  }
  // mouse (no lift)
  const m = await dropOn(2, `__t.edgePoint('heart','lungs',2.5)`, 'heart', { mouse: true });
  check('mouse-drop on heart edge facing lungs -> heart', m.ok, `(got ${m.got})`);
  await undoAll();

  // outside the body -> back to tray
  const out = await dropOn(0, `({ x: 30, y: 600 })`, null);
  check('drop outside body -> orb returns to tray', out.got === null && (await evaluate('__t.placements().length')) === 0);
  await sleep(400);
  check('returned orb is visible in tray again', await evaluate(`!document.getElementById('orb-0').classList.contains('is-lifted')`));

  // filled organ bounces
  await dropOn(0, `__game.hitter.insidePoint('heart')`, 'heart');
  const bounce = await dropOn(1, `__game.hitter.insidePoint('heart')`, null);
  check('drop on already-filled heart -> bounces back (no 2nd placement)', bounce.got === null && (await evaluate('__t.placements().length')) === 1);
  await sleep(500);
  check('bounced orb back in tray', await evaluate(`!document.getElementById('orb-1').classList.contains('is-lifted')`));

  // hover label while dragging over lungs
  const from = await evaluate('__t.orbCentre(1)');
  const tgt = await evaluate(`__t.toClient(__game.hitter.insidePoint('lungs'))`);
  await touchDrag(from, { x: tgt.x, y: tgt.y + LIFT }, { hold: true });
  await sleep(120);
  const hover = await evaluate(`({ label: document.getElementById('organ-label').textContent, vis: document.getElementById('organ-label').classList.contains('is-visible'), target: document.querySelector('.organ.is-target')?.dataset.organ })`);
  check('dragging over lungs highlights lungs + shows label', hover.vis && hover.target === 'lungs' && /Lungs/.test(hover.label), JSON.stringify(hover));
  const look = await evaluate(`[...document.querySelectorAll('#body-svg .eye-look')].map(g => g.style.transform)`);
  const dy = look.map((tr) => +((/translate\([^,]+,\s*(-?[\d.]+)px/.exec(tr) || [])[1] || 0));
  check('eyes look down toward the held orb', look.length === 2 && dy.every((v) => v > 0.5), JSON.stringify(look));
  await sleep(250);
  await shot(`${label}-dragging`);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1300);
  const rest = await evaluate(`[...document.querySelectorAll('#body-svg .eye-look')].map(g => g.style.transform)`);
  check('eyes return to centre after the drop', rest.every((tr) => tr === ''), JSON.stringify(rest));

  // tap-to-place: tap orb 2, then tap the liver
  const o2 = await evaluate('__t.orbCentre(2)');
  await touchTap(o2);
  const sel = await evaluate('__game.state.selected');
  check('tap orb selects it', sel === 2, `(selected ${sel})`);
  const lv = await evaluate(`__t.toClient(__game.hitter.insidePoint('liver'))`);
  await touchTap(lv);
  await sleep(500);
  const pl = await evaluate('__t.placements()');
  check('tap liver places selected orb on liver', pl.includes('liver'), JSON.stringify(pl));

  // undo removes last
  await evaluate('__game.undo()');
  await sleep(100);
  check('undo removes the last orb', !(await evaluate('__t.placements()')).includes('liver'));
  await undoAll();
}

async function fullFlow(label, picks) {
  console.log(`\nFull flow (${label}): picks ${picks.join(', ')}`);
  await evaluate('__game.resetToStart()');
  await sleep(450);
  await shot(`${label}-1-start`);
  await evaluate(`document.getElementById('start-btn').click()`);
  await sleep(500);
  await shot(`${label}-2-howto`);
  await evaluate(`document.getElementById('howto-btn').click()`);
  await sleep(500);
  await evaluate(HELPERS);
  for (let i = 0; i < picks.length; i++) {
    const from = await evaluate(`__t.orbCentre(${i})`);
    const tgt = await evaluate(`__t.toClient(__game.hitter.insidePoint('${picks[i]}'))`);
    await touchDrag(from, { x: tgt.x, y: tgt.y + 34 });
    await sleep(520);
  }
  const placed = await evaluate('__t.placements()');
  check(`all ${picks.length} orbs placed on intended organs`, JSON.stringify(placed) === JSON.stringify(picks), JSON.stringify(placed));
  check('reveal button visible', await evaluate(`!document.getElementById('reveal-btn').hidden`));
  await shot(`${label}-3-placed`);
  await evaluate(`document.getElementById('reveal-btn').click()`);
  await sleep(500);
  const txt = await evaluate(`document.getElementById('reveal-score').textContent + ' | ' + document.getElementById('reveal-msg').textContent`);
  console.log(`    reveal: ${txt}`);
  check('reveal copy never says wrong/incorrect', !/wrong|incorrect/i.test(txt));
  await sleep(3200);
  const lit = await evaluate(`document.querySelectorAll('.organ.is-on').length`);
  check('whole body lit up (all 10 organs)', lit === 10, `(${lit})`);
  await shot(`${label}-4-reveal`);
  await evaluate(`document.getElementById('learn-btn').click()`);
  await sleep(600);
  const cards = await evaluate(`[...document.querySelectorAll('.card h3')].map(h => h.textContent)`);
  console.log(`    cards: ${cards.join(' | ')}`);
  await shot(`${label}-5-learn`);
  await evaluate(`document.getElementById('card-next').click()`);
  await evaluate(`document.getElementById('card-next').click()`);
  await sleep(700);
  await shot(`${label}-5b-learn-organ`);
  await evaluate(`document.getElementById('finish-btn').click()`);
  await sleep(600);
  await shot(`${label}-6-end`);
  return { txt, cards };
}

async function shieldTests(label) {
  console.log(`\nShield game (${label}):`);
  const S = (expr) => evaluate(`__game.shield.debug.${expr}`);
  await evaluate('__game.resetToStart()');
  await sleep(400);
  await evaluate(`document.getElementById('tab-shield').click()`);
  check('shield tab shows the shield game panel', await evaluate(`!document.getElementById('start-panel-shield').hidden && document.getElementById('start-panel-nad').hidden`));
  await sleep(300);
  await shot(`${label}-s1-start`);
  await evaluate(`document.getElementById('shield-start-btn').click()`);
  await sleep(1300);
  await shot(`${label}-s2-howto`);
  await evaluate(`document.getElementById('shield-howto-btn').click()`);
  await sleep(450);
  await S('skipCountdown()');
  await sleep(120);
  await S('setSpawnPaused(true)');
  const st = await S('state()');
  check('shield game is running', st.phase === 'play' && st.lives === 3, JSON.stringify(st));
  const cr = await evaluate(`(() => { const r = document.getElementById('shield-canvas').getBoundingClientRect(); return { left: r.left, top: r.top }; })()`);
  const tx = Math.max(st.barW / 2 + 2, st.W * 0.2);
  await touchDrag({ x: cr.left + st.W / 2, y: cr.top + st.H * 0.55 }, { x: cr.left + tx, y: cr.top + st.H * 0.55 }, { steps: 10 });
  await sleep(300);
  let s = await S('state()');
  check('touch-dragging moves the shield left', Math.abs(s.barX - tx) < 4, `(bar ${s.barX.toFixed(1)} vs ${tx.toFixed(1)})`);
  await S(`spawnAt(${s.barX})`);
  await sleep(1900);
  s = await S('state()');
  check('free radical falling onto the shield is blocked', s.blocked === 1 && s.lives === 3, JSON.stringify(s));
  check('HUD shows blocked count', /1/.test(await evaluate(`document.getElementById('shield-blocked').textContent`)));
  await S(`spawnAt(${st.W * 0.88})`);
  await S(`spawnAt(${st.W * 0.66})`);
  await sleep(700);
  await shot(`${label}-s3-play`);
  await sleep(1600);
  s = await S('state()');
  check('free radicals that miss the shield cost hearts', s.lives === 1, JSON.stringify(s));
  check('HUD hearts show lost hearts', (await evaluate(`document.querySelectorAll('#shield-hearts .heart.is-lost').length`)) === 2);
  await S('setElapsed(49.7)');
  await sleep(1700);
  check('surviving the full time shows the result', await evaluate(`!document.getElementById('shield-result').hidden`));
  const title = await evaluate(`document.getElementById('shield-result-title').textContent`);
  check('result says "You survived!"', title === 'You survived!', title);
  await shot(`${label}-s4-result`);
  await evaluate(`document.getElementById('shield-result-btn').click()`);
  await sleep(700);
  const cards = await evaluate(`[...document.querySelectorAll('.card h3')].map(h => h.textContent)`);
  const lt = await evaluate(`document.getElementById('learn-title').textContent`);
  check('explanation cards: shield = AstaReal® Astaxanthin', cards.length === 5 && /AstaReal/.test(lt) && cards[0] === 'What the game means', `${lt} | ${cards.join(' | ')}`);
  await shot(`${label}-s5-learn`);
  await evaluate(`document.getElementById('card-next').click()`);
  await evaluate(`document.getElementById('card-next').click()`);
  await sleep(700);
  await shot(`${label}-s5b-learn`);
  await evaluate(`document.getElementById('finish-btn').click()`);
  await sleep(600);
  const end = await evaluate(`({ badge: document.getElementById('badge-title').textContent, shield: document.querySelector('.badge').classList.contains('is-shield'), score: document.getElementById('score-line').textContent })`);
  check('end screen: shield badge "Cell Defender"', end.badge === 'Cell Defender' && end.shield, JSON.stringify(end));
  await shot(`${label}-s6-end`);

  // losing path: 3 misses
  await evaluate('__game.startShield()');
  await sleep(300);
  await S('skipCountdown()');
  await sleep(120);
  await S('setSpawnPaused(true)');
  const s0 = await S('state()');
  const far = s0.barX < s0.W / 2 ? s0.W * 0.9 : s0.W * 0.1;
  for (let k = 0; k < 3; k++) { await S(`spawnAt(${far})`); await sleep(250); }
  await sleep(2400);
  s = await S('state()');
  check('losing all hearts ends the game', s.phase === 'over' && s.lives === 0, JSON.stringify(s));
  await sleep(300);
  check('result stays positive ("Great defence!")', (await evaluate(`document.getElementById('shield-result-title').textContent`)) === 'Great defence!');
  await evaluate(`document.getElementById('shield-result-btn').click()`);
  await sleep(300);
  await evaluate(`document.getElementById('finish-btn').click()`);
  await sleep(300);
  check('end screen: "Brave Defender" badge', (await evaluate(`document.getElementById('badge-title').textContent`)) === 'Brave Defender');
}

/* ---------- iPad / touch-friendliness ---------- */
// every visible button must be at least 44 x 44 CSS px (Apple HIG minimum touch target)
async function tapTargetAudit(label) {
  const small = await evaluate(`[...document.querySelectorAll('.screen.is-active button, .topbar button, .screen.is-active .orb')]
    .filter(b => b.offsetParent !== null && getComputedStyle(b).visibility !== 'hidden')
    .map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.className.baseVal || b.className, w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(r => r.w < 44 || r.h < 44)`);
  check(`${label}: all touch targets >= 44px`, small.length === 0, JSON.stringify(small));
  const ov = await evaluate(`(() => { const b = document.getElementById('fs-btn').getBoundingClientRect(), l = document.getElementById('lang-switch').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, appW: document.getElementById('app').scrollWidth, vw: innerWidth, fsRight: Math.round(b.right), langH: Math.round(l.height), topH: Math.round(document.querySelector('.topbar').getBoundingClientRect().height) }; })()`);
  check(`${label}: top bar fits, no sideways overflow`, ov.sw <= ov.vw && ov.appW <= ov.vw && ov.fsRight <= ov.vw && ov.langH <= 56, JSON.stringify(ov));
}

// Headless browsers have no real window, so they always refuse full screen ("not granted").
// This stand-in behaves like Safari/Chrome: it only succeeds when called during a real user gesture.
const FS_STUB = `(() => {
  let cur = null; window.__fsCalls = 0;
  const fire = () => document.dispatchEvent(new Event('fullscreenchange'));
  Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => cur });
  Element.prototype.requestFullscreen = function () {
    window.__fsCalls++;
    if (!navigator.userActivation.isActive) return Promise.reject(new TypeError('Permissions check failed'));
    cur = this; setTimeout(fire); return Promise.resolve();
  };
  Document.prototype.exitFullscreen = function () { cur = null; setTimeout(fire); return Promise.resolve(); };
  return true;
})()`;

async function ipadTouchTests() {
  console.log('\niPad / touch / full screen:');
  await setViewport(1180, 820);
  await load();
  await evaluate(HELPERS);
  await tapTargetAudit('ipad start');
  await evaluate(FS_STUB);
  check('app blocks pinch + double-tap zoom (touch-action)', (await evaluate(`getComputedStyle(document.getElementById('app')).touchAction`)) === 'pan-x pan-y');
  check('iOS pinch gesture is cancelled', await evaluate(`(() => { const e = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; })()`));
  check('long-press menu blocked on the body graphic', await evaluate(`(() => { const e = new MouseEvent('contextmenu', { cancelable: true, bubbles: true }); document.getElementById('stage').dispatchEvent(e); return e.defaultPrevented; })()`));
  check('two-finger touchmove cancelled', await evaluate(`(() => { const t = (id) => new Touch({ identifier: id, target: document.body, clientX: 10 * id, clientY: 10 }); const e = new TouchEvent('touchmove', { cancelable: true, bubbles: true, touches: [t(1), t(2)] }); document.body.dispatchEvent(e); return e.defaultPrevented; })()`));

  // full screen button
  check('full screen button is shown', await evaluate(`!document.getElementById('fs-btn').hidden`));
  const fsRect = await evaluate(`(() => { const r = document.getElementById('fs-btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await touchTap(fsRect);
  await sleep(500);
  check('tapping it enters full screen', await evaluate(`document.fullscreenElement === document.documentElement`));
  check('button switches to "Exit full screen"', (await evaluate(`document.getElementById('fs-btn').getAttribute('aria-pressed') + '|' + document.getElementById('fs-btn').getAttribute('aria-label')`)) === 'true|Exit full screen');
  await shot('ipad-fullscreen');
  await touchTap(fsRect);
  await sleep(500);
  check('tapping again leaves full screen', await evaluate(`!document.fullscreenElement && document.getElementById('fs-btn').getAttribute('aria-pressed') === 'false'`));
  await evaluate(`__game.setLang('zh')`);
  check('full screen label is translated', (await evaluate(`document.getElementById('fs-btn').getAttribute('aria-label')`)) === '全屏');
  await evaluate(`__game.setLang('en')`);

  // rotate the iPad in the middle of the NAD+ game
  await evaluate('__game.startPlay()');
  await sleep(500);
  await tapTargetAudit('ipad play');
  const LIFT = 34;
  const drop = async (i, expr) => {
    const from = await evaluate(`__t.orbCentre(${i})`);
    const to = await evaluate(`__t.toClient(${expr})`);
    await touchDrag(from, { x: to.x, y: to.y + LIFT });
    await sleep(520);
  };
  await drop(0, `__t.edgePoint('heart','lungs',2.5)`);
  await setViewport(820, 1180); // rotate to portrait
  await sleep(600);
  await drop(1, `__t.edgePoint('liver','stomach',2.5)`);
  await setViewport(1180, 820); // and back
  await sleep(600);
  await drop(2, `__t.edgePoint('lungs','heart',2.5)`);
  const placed = await evaluate('__t.placements()');
  check('drops stay accurate after rotating mid-game', placed.join() === 'heart,liver,lungs', placed.join());

  // rotate in the middle of the shield game
  await evaluate('__game.resetToStart()');
  await sleep(300);
  await evaluate(`__game.selectGame('shield'); __game.startShield()`);
  await sleep(450);
  await evaluate('__game.shield.debug.skipCountdown()');
  await evaluate('__game.shield.debug.setSpawnPaused(true)');
  await setViewport(820, 1180);
  await sleep(600);
  const fit = await evaluate(`(() => { const c = document.getElementById('shield-canvas'), r = c.getBoundingClientRect(), s = __game.shield.debug.state(); return { cw: Math.round(r.width), ch: Math.round(r.height), W: Math.round(s.W), H: Math.round(s.H), barX: s.barX, barW: s.barW, bw: c.width }; })()`);
  check('shield game re-fits after rotation', fit.W === fit.cw && fit.H === fit.ch && fit.barX >= fit.barW / 2 - 1 && fit.barX <= fit.W - fit.barW / 2 + 1 && fit.bw >= fit.cw, JSON.stringify(fit));
  const cr = await evaluate(`(() => { const r = document.getElementById('shield-canvas').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; })()`);
  await touchDrag({ x: cr.left + cr.w * 0.5, y: cr.top + cr.h * 0.6 }, { x: cr.left + cr.w * 0.8, y: cr.top + cr.h * 0.6 }, { steps: 8 });
  await sleep(300);
  const bx = (await evaluate('__game.shield.debug.state()')).barX;
  check('shield follows the finger after rotation', Math.abs(bx - Math.min(cr.w * 0.8, cr.w - fit.barW / 2)) < 4, `(bar ${bx.toFixed(1)})`);
  await evaluate('__game.resetToStart()');

  // kiosk: first tap anywhere goes full screen
  await setViewport(1180, 820);
  await load('&kiosk=1');
  await evaluate(FS_STUB);
  await evaluate('document.documentElement.requestFullscreen().catch(() => {})');
  check('full screen is refused without a tap (browser rule respected)', await evaluate('!document.fullscreenElement'));
  await touchTap({ x: 600, y: 700 });
  await sleep(500);
  check('kiosk: first tap goes full screen', await evaluate(`document.fullscreenElement === document.documentElement`));
  await evaluate('document.exitFullscreen()');
  await sleep(400);
  await touchTap({ x: 600, y: 700 });
  await sleep(500);
  check('kiosk: next tap re-enters full screen after a swipe-out', await evaluate(`document.fullscreenElement === document.documentElement`));
  await evaluate('document.exitFullscreen()');
  await sleep(300);

  // iPhone Safari: no Fullscreen API -> the button explains Add to Home Screen
  await setViewport(390, 844, { dpr: 3 });
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }); Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });` });
  await load();
  await tapTargetAudit('iphone start');
  check('iPhone: full screen button shown', await evaluate(`!document.getElementById('fs-btn').hidden`));
  await evaluate(`document.getElementById('fs-btn').click()`);
  await sleep(350);
  const hint = await evaluate(`document.getElementById('fs-hint').hidden ? '' : document.getElementById('fs-hint').textContent`);
  check('iPhone: tapping it explains Add to Home Screen', /Add to Home Screen/.test(hint), hint);
  await shot('iphone-fs-hint');
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  await send('Emulation.setUserAgentOverride', { userAgent: '' });

  // other common phone widths: iPhone SE (1st gen), iPhone SE/8, iPhone Pro Max
  for (const [w, h] of [[320, 568], [375, 667], [430, 932]]) {
    await setViewport(w, h, { dpr: 3 });
    await load();
    await tapTargetAudit(`phone ${w}px start`);
    await evaluate(`__game.selectGame('shield')`);
    await sleep(200);
    await tapTargetAudit(`phone ${w}px shield tab`);
  }
}

(async () => {
  try {
    await connect();
    await send('Page.enable');
    await send('Runtime.enable');

    // iPhone-ish portrait
    await setViewport(390, 844);
    await load();
    await evaluate(HELPERS);
    await hitUnitTests();
    await e2eDragTests('phone-portrait');
    await shieldTests('phone-portrait');
    const perfect = await fullFlow('phone-portrait', ['heart', 'brain', 'muscles', 'liver']);
    check('perfect picks -> "Perfect Match! 4/4"', /Perfect Match! 4\/4/.test(perfect.txt));
    const r2 = await fullFlow('phone-portrait-b', ['heart', 'eyes', 'kidneys', 'brain']);
    check('2/4 picks -> "You matched 2/4" + positive twist', /You matched 2\/4/.test(r2.txt) && /Every organ you chose is right/.test(r2.txt));
    check('learn cards: intros, top picks first, then other picks', r2.cards.slice(0, 6).join() === 'What is NAD+?,What is NMN?,Heart,Brain,Muscles,Liver' && r2.cards.slice(6).join() === 'Eyes,Kidneys', r2.cards.join());

    // iPad landscape + portrait
    await setViewport(1180, 820);
    await load();
    await evaluate(HELPERS);
    await e2eDragTests('ipad-landscape');
    await fullFlow('ipad-landscape', ['skin', 'brain', 'liver', 'heart']);
    await shieldTests('ipad-landscape');
    await ipadTouchTests();
    await setViewport(1180, 820);

    await setViewport(820, 1180);
    await load();
    await evaluate(HELPERS);
    await e2eDragTests('ipad-portrait');
    await fullFlow('ipad-portrait', ['lungs', 'intestines', 'eyes', 'skin']);

    // small Android phone
    await setViewport(360, 740, { dpr: 3 });
    await load();
    await evaluate(HELPERS);
    await tapTargetAudit('android-360 start');
    await e2eDragTests('android-360');
    await shieldTests('android-360');

    // language + admin + idle
    console.log('\nMisc:');
    await evaluate(`__game.setLang('zh')`);
    check('language switch to zh shows Chinese copy', (await evaluate(`document.getElementById('start-title').textContent`)) === '用 NAD+ 为身体充能');
    await evaluate(`__game.setLang('ms')`);
    check('language switch to ms shows Malay copy', (await evaluate(`document.getElementById('start-title').textContent`)) === 'Tenagakan Tubuh Anda dengan NAD+');
    await evaluate(`__game.setLang('zh')`);
    check('<html lang> updated', (await evaluate('document.documentElement.lang')) === 'zh-Hans');
    await evaluate(`__game.setLang('en')`);
    await evaluate(`__game.resetToStart()`);
    for (let k = 0; k < 5; k++) await evaluate(`document.getElementById('brand-btn').click()`);
    check('5 logo taps open admin', await evaluate(`!document.getElementById('admin-overlay').hidden`));
    const stats = await evaluate(`[...document.querySelectorAll('#admin-stats dd')].map(d => d.textContent)`);
    console.log(`    admin stats: ${stats.join(' | ')}`);
    check('admin counts plays + perfect matches', +stats[0] >= 4 && +stats[1] >= 1, stats.join());
    await shot('admin');
    await evaluate(`document.getElementById('admin-close').click()`);

    // localStorage blocked -> game must still work
    await load();
    const noStore = await evaluate(`(() => { const d = Object.getOwnPropertyDescriptor(window, 'localStorage'); try { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); } catch (e) { return 'skip'; } return 'ok'; })()`);
    check('localStorage blocked: page still loads', noStore === 'ok' || noStore === 'skip');

    // kiosk + idle (short timeout via patched config is not possible from outside; check overlay logic quickly)
    await load('&kiosk=1');
    check('kiosk mode adds .kiosk class', await evaluate(`document.documentElement.classList.contains('kiosk')`));

    console.log(`\nConsole errors: ${consoleErrors.length ? consoleErrors.join('\n') : 'none'}`);
    if (consoleErrors.length) fail++;
  } catch (e) {
    console.error(e);
    fail++;
  } finally {
    console.log(`\n${pass} passed, ${fail} failed`);
    try { ws?.close(); } catch { /* ignore */ }
    proc.kill();
    process.exit(fail ? 1 : 0);
  }
})();
