/* ==========================================================================
   shield.js — Game 2: "Shield Your Cells" (AstaReal® Astaxanthin)
   Free radicals rush down towards the guest's cells; the guest drags a red
   astaxanthin shield left/right to block them. 3 hearts, survive N seconds.

   Canvas 2D with pre-rendered sprites (no per-frame shadows/filters) so it
   holds 60fps on mid-range phones. Sizes/speeds scale with the play area,
   so difficulty feels the same on a phone and an iPad.
   ========================================================================== */

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function css(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * createShieldGame({ canvas, config, labels, onHud, onHit, onBlock, onEnd })
 *   config: CONFIG.shield from content.js
 *   labels: { cells, shield, ready, go }  (strings, read when the game starts)
 *   onHud({ lives, blocked, remaining })  — called when a value changes
 *   onHit(livesLeft), onBlock(blocked), onEnd({ survived, blocked, lives, seconds })
 */
export function createShieldGame({ canvas, config, labels, onHud, onHit, onBlock, onEnd }) {
  const ctx = canvas.getContext('2d');
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  let cellTop = 0;
  const bar = { x: 0, target: 0, y: 0, w: 120, h: 16 };
  let R = 14; // radical radius
  let sprites = {};
  let lbl = labels();

  let raf = 0, last = 0;
  let phase = 'idle'; // idle | countdown | play | over
  let countdown = 0, elapsed = 0, spawnIn = 0;
  let lives = config.lives, blocked = 0;
  let radicals = [], particles = [];
  let shake = 0, hitFlash = [];
  let paused = false;
  let keys = { left: false, right: false };
  let lastHud = '';

  /* ---------------- layout + sprites ---------------- */
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const ox = W ? bar.x / W : 0.5;
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cellTop = H - clamp(H * 0.13, 58, 110);
    bar.w = clamp(W * config.shieldWidth, 96, 260);
    bar.h = clamp(H * 0.022, 14, 22);
    bar.y = cellTop - clamp(H * 0.12, 54, 120);
    bar.x = bar.target = clamp(ox * W, bar.w / 2, W - bar.w / 2);
    R = clamp(Math.min(W, H) * 0.042, 15, 28);
    buildSprites();
    draw();
  }

  function offscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [c, g];
  }

  function buildSprites() {
    lbl = labels();
    const font = css('--font-body', 'Inter, sans-serif');
    const headFont = css('--font-head', 'Syne, sans-serif');

    // --- free radical: spiky, glowing, with an orbiting unpaired electron
    {
      const pad = R * 1.4, size = R * 2 + pad * 2;
      const [c, g] = offscreen(size, size);
      const cx = size / 2;
      const glow = g.createRadialGradient(cx, cx, R * 0.3, cx, cx, R + pad);
      glow.addColorStop(0, css('--radical-glow', 'rgba(214,255,90,0.55)'));
      glow.addColorStop(1, 'rgba(214,255,90,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, size, size);
      g.beginPath();
      const n = 10;
      for (let i = 0; i < n * 2; i++) {
        const rr = i % 2 === 0 ? R : R * 0.6;
        const a = (Math.PI * i) / n - Math.PI / 2;
        g.lineTo(cx + rr * Math.cos(a), cx + rr * Math.sin(a));
      }
      g.closePath();
      const body = g.createRadialGradient(cx - R * 0.3, cx - R * 0.3, R * 0.1, cx, cx, R);
      body.addColorStop(0, css('--radical-1', '#f6ffb0'));
      body.addColorStop(0.5, css('--radical-2', '#c8f03c'));
      body.addColorStop(1, css('--radical-3', '#ff8a1f'));
      g.fillStyle = body;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(40,20,0,0.35)';
      g.stroke();
      // unpaired electron
      g.beginPath();
      g.arc(cx + R * 0.95, cx - R * 0.95, R * 0.2, 0, TAU);
      g.fillStyle = '#ffffff';
      g.fill();
      sprites.radical = { c, size };
    }

    // --- shield bar (astaxanthin red) with glow + label
    {
      const padX = 22, padTop = 30, padBot = 20;
      const w = bar.w + padX * 2, h = bar.h + padTop + padBot;
      const [c, g] = offscreen(w, h);
      const x0 = padX, y0 = padTop, bw = bar.w, bh = bar.h, rr = bh / 2;
      const capsule = () => {
        g.beginPath();
        g.moveTo(x0 + rr, y0);
        g.lineTo(x0 + bw - rr, y0);
        g.arc(x0 + bw - rr, y0 + rr, rr, -Math.PI / 2, Math.PI / 2);
        g.lineTo(x0 + rr, y0 + bh);
        g.arc(x0 + rr, y0 + rr, rr, Math.PI / 2, (Math.PI * 3) / 2);
        g.closePath();
      };
      g.save();
      g.shadowColor = css('--shield-glow', 'rgba(255,50,70,0.85)');
      g.shadowBlur = 20;
      capsule();
      g.fillStyle = css('--shield-2', '#d0142f');
      g.fill();
      g.restore();
      const grad = g.createLinearGradient(0, y0, 0, y0 + bh);
      grad.addColorStop(0, css('--shield-1', '#ff6b6b'));
      grad.addColorStop(0.55, css('--shield-2', '#d0142f'));
      grad.addColorStop(1, css('--shield-3', '#7d0a1e'));
      capsule();
      g.fillStyle = grad;
      g.fill();
      // specular highlight
      g.beginPath();
      g.moveTo(x0 + rr, y0 + bh * 0.3);
      g.lineTo(x0 + bw - rr, y0 + bh * 0.3);
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = Math.max(1.5, bh * 0.14);
      g.lineCap = 'round';
      g.stroke();
      // label above
      g.font = `700 ${clamp(bh * 0.72, 10, 14)}px ${font}`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillStyle = css('--shield-label', '#ffd3d9');
      g.fillText(lbl.shield, w / 2, y0 - 6, bw + padX * 1.6);
      sprites.bar = { c, w, h, ox: padX + bw / 2, oy: padTop + bh / 2 };
    }

    // --- the guest's cells (bottom band)
    {
      const h = H - cellTop;
      const [c, g] = offscreen(W, h);
      const band = g.createLinearGradient(0, 0, 0, h);
      band.addColorStop(0, css('--cells-1', 'rgba(166,107,255,0.30)'));
      band.addColorStop(1, css('--cells-2', 'rgba(166,107,255,0.06)'));
      g.fillStyle = band;
      g.fillRect(0, 0, W, h);
      // membrane line
      g.beginPath();
      for (let x = 0; x <= W; x += 6) g.lineTo(x, 3 + Math.sin(x / 18) * 2);
      g.strokeStyle = css('--cells-edge', 'rgba(214,190,255,0.85)');
      g.lineWidth = 2;
      g.stroke();
      // cells
      const cr = clamp(h * 0.22, 9, 20);
      const step = cr * 2.6;
      for (let row = 0; row < 2; row++) {
        for (let x = (row ? step / 2 : 0) + cr; x < W; x += step) {
          const y = h * (row ? 0.68 : 0.36);
          const cg = g.createRadialGradient(x - cr * 0.3, y - cr * 0.3, cr * 0.1, x, y, cr);
          cg.addColorStop(0, css('--cell-1', 'rgba(255,255,255,0.55)'));
          cg.addColorStop(1, css('--cell-2', 'rgba(185,150,255,0.25)'));
          g.beginPath();
          g.arc(x, y, cr, 0, TAU);
          g.fillStyle = cg;
          g.fill();
          g.beginPath();
          g.arc(x + cr * 0.15, y + cr * 0.1, cr * 0.32, 0, TAU);
          g.fillStyle = css('--cell-nucleus', 'rgba(120,70,230,0.6)');
          g.fill();
        }
      }
      g.font = `700 ${clamp(h * 0.16, 11, 15)}px ${headFont}`;
      g.textAlign = 'right';
      g.textBaseline = 'bottom';
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText(lbl.cells.toUpperCase(), W - 12, h - 8);
      sprites.cells = { c, h };
    }
  }

  /* ---------------- input ---------------- */
  let activePointer = null;
  function setTargetFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    bar.target = clamp(e.clientX - r.left, bar.w / 2, W - bar.w / 2);
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (phase === 'over' || phase === 'idle') return;
    e.preventDefault();
    activePointer = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setTargetFromEvent(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (phase === 'over' || phase === 'idle') return;
    if (e.pointerType === 'mouse' || e.pointerId === activePointer) setTargetFromEvent(e);
  });
  const endPointer = (e) => { if (e.pointerId === activePointer) activePointer = null; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const onKey = (down) => (e) => {
    if (phase !== 'play' && phase !== 'countdown') return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { keys.left = down; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = down; e.preventDefault(); }
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (!paused && raf) last = performance.now();
  });
  window.addEventListener('resize', () => { if (phase !== 'idle') resize(); });

  /* ---------------- game loop ---------------- */
  function hud() {
    const remaining = Math.max(0, Math.ceil(config.durationSeconds - elapsed));
    const key = `${lives}|${blocked}|${remaining}`;
    if (key !== lastHud) {
      lastHud = key;
      onHud?.({ lives, blocked, remaining, progress: clamp(elapsed / config.durationSeconds, 0, 1) });
    }
  }

  function spawn(opts = {}) {
    const p = clamp(elapsed / config.durationSeconds, 0, 1);
    const fast = opts.fast ?? (p > 0.45 && Math.random() < 0.22);
    const wobble = opts.wobble ?? (!fast && p > 0.25 && Math.random() < 0.28);
    const r = fast ? R * 0.78 : R;
    const x0 = opts.x ?? rand(r, W - r);
    const tx = opts.tx ?? clamp(x0 + rand(-W * 0.35, W * 0.35), r, W - r);
    const y0 = -r * 2;
    const vy = (opts.speed ?? lerp(config.startSpeed, config.endSpeed, p) * rand(0.9, 1.12)) * H * (fast ? 1.3 : 1);
    const vx = ((tx - x0) / (cellTop - y0)) * vy;
    radicals.push({ x: x0, y: y0, bx: x0, vx, vy, r, rot: rand(0, TAU), vr: rand(-3, 3), wobble, wt: rand(0, TAU), passed: false });
  }

  function burst(x, y, color, n, speed = 160) {
    if (reduced()) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(speed * 0.35, speed);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rand(0.35, 0.7), t: 0, size: rand(2, 4.5), color });
    }
  }

  function update(dt) {
    // shield movement (pointer target + keyboard)
    if (keys.left) bar.target = clamp(bar.target - W * 1.3 * dt, bar.w / 2, W - bar.w / 2);
    if (keys.right) bar.target = clamp(bar.target + W * 1.3 * dt, bar.w / 2, W - bar.w / 2);
    bar.x += (bar.target - bar.x) * Math.min(1, dt * 24);

    if (phase === 'countdown') {
      countdown -= dt;
      if (countdown <= 0) { phase = 'play'; spawnIn = 0.4; }
    } else if (phase === 'play') {
      elapsed += dt;
      const p = clamp(elapsed / config.durationSeconds, 0, 1);
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = lerp(config.startSpawnSeconds, config.endSpawnSeconds, p) * rand(0.75, 1.25);
      }
      if (elapsed >= config.durationSeconds) finish(true);
    }

    const top = bar.y - bar.h / 2, bottom = bar.y + bar.h / 2;
    for (let i = radicals.length - 1; i >= 0; i--) {
      const q = radicals[i];
      q.bx += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.wobble) { q.wt += dt * 4; q.x = q.bx + Math.sin(q.wt) * R * 1.6; } else q.x = q.bx;
      if (q.x < q.r) { q.bx += q.r - q.x; q.vx = Math.abs(q.vx); }
      if (q.x > W - q.r) { q.bx -= q.x - (W - q.r); q.vx = -Math.abs(q.vx); }

      if (phase !== 'play') continue;
      if (!q.passed && q.y + q.r >= top && q.y - q.r <= bottom && Math.abs(q.x - bar.x) <= bar.w / 2 + q.r * 0.75) {
        radicals.splice(i, 1);
        blocked++;
        burst(q.x, top, css('--radical-2', '#c8f03c'), 12);
        burst(q.x, top, css('--shield-1', '#ff6b6b'), 6, 120);
        onBlock?.(blocked);
        continue;
      }
      if (q.y - q.r > bottom) q.passed = true;
      if (q.y + q.r * 0.4 >= cellTop) {
        radicals.splice(i, 1);
        lives--;
        burst(q.x, cellTop, css('--hit-color', '#ff4d6d'), 16, 200);
        hitFlash.push({ x: q.x, t: 0 });
        if (!reduced()) shake = 0.35;
        onHit?.(lives);
        if (lives <= 0) finish(false);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const s = particles[i];
      s.t += dt;
      if (s.t >= s.life) { particles.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 380 * dt;
    }
    for (let i = hitFlash.length - 1; i >= 0; i--) { hitFlash[i].t += dt; if (hitFlash[i].t > 0.6) hitFlash.splice(i, 1); }
    if (shake > 0) shake = Math.max(0, shake - dt);
    hud();
  }

  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-1, 1) * shake * 14, rand(-1, 1) * shake * 10);

    // cells
    if (sprites.cells) ctx.drawImage(sprites.cells.c, 0, cellTop, W, sprites.cells.h);
    for (const f of hitFlash) {
      const a = 1 - f.t / 0.6;
      const g = ctx.createRadialGradient(f.x, cellTop, 0, f.x, cellTop, 90);
      g.addColorStop(0, `rgba(255,60,90,${0.65 * a})`);
      g.addColorStop(1, 'rgba(255,60,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x - 90, cellTop - 90, 180, 180);
    }

    // radicals (with a short ghost trail)
    const rs = sprites.radical;
    if (rs) {
      for (const q of radicals) {
        const s = (rs.size * q.r) / R;
        for (let k = 2; k >= 1; k--) {
          ctx.globalAlpha = 0.14 * (3 - k);
          ctx.drawImage(rs.c, q.x - q.vx * 0.025 * k - s / 2, q.y - q.vy * 0.025 * k - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.drawImage(rs.c, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }

    // shield
    if (sprites.bar) ctx.drawImage(sprites.bar.c, bar.x - sprites.bar.ox, bar.y - sprites.bar.oy, sprites.bar.w, sprites.bar.h);

    // particles
    for (const s of particles) {
      ctx.globalAlpha = 1 - s.t / s.life;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // countdown text
    if (phase === 'countdown') {
      const txt = countdown > 0.55 ? lbl.ready : lbl.go;
      const k = countdown > 0.55 ? 1 : 1 + (0.55 - countdown);
      ctx.save();
      ctx.translate(W / 2, H * 0.4);
      ctx.scale(k, k);
      ctx.font = `800 ${clamp(W * 0.09, 30, 64)}px ${css('--font-head', 'Syne, sans-serif')}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (paused) { last = now; return; }
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    if (phase === 'over' && particles.length === 0 && hitFlash.length === 0) { cancelAnimationFrame(raf); raf = 0; draw(); }
  }

  function finish(survived) {
    if (phase === 'over') return;
    phase = 'over';
    // on a win, every remaining free radical pops harmlessly
    for (const q of radicals) burst(q.x, q.y, css('--radical-2', '#c8f03c'), survived ? 8 : 3, 120);
    radicals = [];
    hud();
    onEnd?.({ survived, blocked, lives: Math.max(0, lives), seconds: Math.min(config.durationSeconds, Math.round(elapsed)) });
  }

  return {
    start() {
      this.stop();
      lives = config.lives; blocked = 0; elapsed = 0;
      radicals = []; particles = []; hitFlash = []; shake = 0;
      keys = { left: false, right: false };
      lastHud = '';
      W = 0; resize();
      bar.x = bar.target = W / 2;
      phase = 'countdown';
      countdown = 1.3;
      paused = document.hidden;
      hud();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      phase = 'idle';
      radicals = []; particles = []; hitFlash = [];
      if (W) ctx.clearRect(0, 0, W, H);
    },
    resize,
    get phase() { return phase; },
    // test / debug helpers (used by tests/e2e.mjs)
    debug: {
      state: () => ({ phase, lives, blocked, elapsed, barX: bar.x, barW: bar.w, barY: bar.y, W, H, cellTop, radicals: radicals.length }),
      spawnAt: (x, tx = x) => spawn({ x, tx, wobble: false, fast: false, speed: 0.6 }),
      setElapsed: (t) => { elapsed = t; },
      skipCountdown: () => { if (phase === 'countdown') countdown = 0; },
      setSpawnPaused: (on) => { spawnIn = on ? 1e9 : 0.2; },
    },
  };
}
