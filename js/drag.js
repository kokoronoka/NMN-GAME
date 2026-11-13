/* ==========================================================================
   drag.js — drag & drop (Pointer Events) + organ hit testing
   --------------------------------------------------------------------------
   HIT TESTING
   Each organ's visible .organ-shape path(s) are sampled once into polygons
   (SVG user units). A drop point is resolved in three steps:
     1. Inside a visible organ shape  → that organ (top-most drawn wins,
        e.g. the heart is drawn over the lungs).
     2. Otherwise, within PAD_PX of an organ outline → the NEAREST organ.
        This is the "invisible padded hit area": generous, but it can never
        let a big neighbour steal a drop that is visibly closer to (or on)
        a smaller organ.
     3. Otherwise, inside / near the body silhouette → the base organ (skin).
   ========================================================================== */

export const PAD_PX = 22;        // forgiving radius around organs, in screen pixels
const MIN_PAD_UNITS = 6;         // never pad less than this (SVG units)
const DRAG_THRESHOLD = { mouse: 5, pen: 6, touch: 9 };
const TOUCH_LIFT_PX = 34;        // lift the orb above the finger so it isn't hidden

/* ---------------- geometry helpers ---------------- */

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPoly(x, y, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + t * dx - x, py = ay + t * dy - y;
    const d = px * px + py * py;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Sample an SVG geometry element into one or more polygons in the SVG's user space. */
function sampleShape(svg, shape) {
  const total = shape.getTotalLength();
  const n = Math.max(48, Math.min(1200, Math.ceil(total / 2.5)));
  const step = total / n;
  // local -> svg user space (handles any transforms on the shape or its parents)
  let m = null;
  try {
    const s = svg.getScreenCTM(), e = shape.getScreenCTM();
    if (s && e) m = s.inverse().multiply(e);
  } catch { /* ignore, assume identity */ }
  const map = (p) => (m ? [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f] : [p.x, p.y]);

  const polys = [];
  let cur = [];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const pt = map(shape.getPointAtLength(Math.min(total, i * step)));
    // a jump much larger than the step means a new sub-path (moveto)
    if (prev && Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) > step * 2.5 + 0.5) {
      if (cur.length > 2) polys.push(cur);
      cur = [];
    }
    cur.push(pt);
    prev = pt;
  }
  if (cur.length > 2) polys.push(cur);
  return polys;
}

function bboxOf(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/* ---------------- hit tester ---------------- */

/**
 * @param {SVGSVGElement} svg  the body svg (must be rendered, i.e. not display:none)
 * @param {{baseOrgan?: string, padPx?: number}} opts
 */
export function createHitTester(svg, { baseOrgan = 'skin', padPx = PAD_PX } = {}) {
  const organs = [...svg.querySelectorAll('.organ[data-organ]')].map((el) => {
    const polys = [...el.querySelectorAll('.organ-shape')].flatMap((s) => sampleShape(svg, s));
    const [ax, ay] = (el.dataset.anchor || '').split(',').map(Number);
    const bb = bboxOf(polys);
    return {
      id: el.dataset.organ,
      el,
      polys,
      bbox: bb,
      anchor: Number.isFinite(ax) ? { x: ax, y: ay } : { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 },
    };
  });
  const byId = new Map(organs.map((o) => [o.id, o]));
  const base = byId.get(baseOrgan);
  // later in DOM = drawn on top = higher priority
  const topFirst = organs.filter((o) => o !== base).reverse();

  const near = (o, x, y, pad) => x >= o.bbox.x0 - pad && x <= o.bbox.x1 + pad && y >= o.bbox.y0 - pad && y <= o.bbox.y1 + pad;
  const inside = (o, x, y) => near(o, x, y, 0) && o.polys.some((p) => pointInPoly(x, y, p));
  const dist = (o, x, y) => Math.min(...o.polys.map((p) => distToPoly(x, y, p)));

  /** Hit test in SVG user units. */
  function hitSvg(x, y, pad) {
    for (const o of topFirst) if (inside(o, x, y)) return o.id;
    let best = null, bestD = pad;
    for (const o of topFirst) {
      if (!near(o, x, y, pad)) continue;
      const d = dist(o, x, y);
      if (d <= bestD) { best = o.id; bestD = d; }
    }
    if (best) return best;
    if (base && near(base, x, y, pad) && (inside(base, x, y) || dist(base, x, y) <= pad)) return base.id;
    return null;
  }

  function clientToSvg(cx, cy) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const inv = ctm.inverse();
    return { x: inv.a * cx + inv.c * cy + inv.e, y: inv.b * cx + inv.d * cy + inv.f, scale: Math.hypot(ctm.a, ctm.b) || 1 };
  }

  function svgToClient(x, y) {
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }

  return {
    organs,
    ids: organs.map((o) => o.id),
    /** Organ id under a client (viewport) point, or null. */
    hit(cx, cy) {
      const p = clientToSvg(cx, cy);
      if (!p) return null;
      return hitSvg(p.x, p.y, Math.max(MIN_PAD_UNITS, padPx / p.scale));
    },
    hitSvg,
    clientToSvg,
    svgToClient,
    /** Client coords where a placed orb sits. */
    anchorClient(id) {
      const o = byId.get(id);
      return o ? svgToClient(o.anchor.x, o.anchor.y) : null;
    },
    anchorSvg(id) {
      return byId.get(id)?.anchor ?? null;
    },
    /** Client rect of an organ (all parts). */
    rectClient(id) {
      const o = byId.get(id);
      if (!o) return null;
      const a = svgToClient(o.bbox.x0, o.bbox.y0), b = svgToClient(o.bbox.x1, o.bbox.y1);
      return { left: a.x, top: a.y, right: b.x, bottom: b.y, width: b.x - a.x, height: b.y - a.y };
    },
    bboxSvg(id) {
      return byId.get(id)?.bbox ?? null;
    },
    /** A point guaranteed to be inside the organ's visible shape (for tests / keyboard). */
    insidePoint(id) {
      const o = byId.get(id);
      if (!o) return null;
      if (inside(o, o.anchor.x, o.anchor.y)) return { ...o.anchor };
      const p = o.polys[0];
      return { x: p.reduce((s, q) => s + q[0], 0) / p.length, y: p.reduce((s, q) => s + q[1], 0) / p.length };
    },
  };
}

/* ---------------- ghost (the orb that flies around) ---------------- */

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Make a visual copy of an orb, positioned over the original, inside `layer`. */
export function createGhost(el, layer) {
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.className = 'orb orb-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.tabIndex = -1;
  ghost.style.width = `${r.width}px`;
  ghost.style.height = `${r.height}px`;
  ghost._w = r.width;
  ghost._h = r.height;
  ghost._x = r.left + r.width / 2;
  ghost._y = r.top + r.height / 2;
  ghost._s = 1;
  setGhost(ghost, ghost._x, ghost._y, 1);
  layer.appendChild(ghost);
  return ghost;
}

function ghostTransform(g, x, y, s) {
  return `translate3d(${x - g._w / 2}px, ${y - g._h / 2}px, 0) scale(${s})`;
}

export function setGhost(g, x, y, s = g._s) {
  g._x = x; g._y = y; g._s = s;
  g.style.transform = ghostTransform(g, x, y, s);
}

/** Animate a ghost to a client point. Resolves when done. Uses transform only. */
export function flyGhost(g, x, y, { scale = 1, duration = 380, easing = 'cubic-bezier(.2,.9,.25,1.15)' } = {}) {
  const from = ghostTransform(g, g._x, g._y, g._s);
  const to = ghostTransform(g, x, y, scale);
  setGhost(g, x, y, scale);
  if (reducedMotion() || !g.animate) return Promise.resolve();
  const anim = g.animate([{ transform: from }, { transform: to }], { duration, easing });
  return anim.finished.catch(() => {});
}

/** Little "nope" wiggle in place (for an organ that already has an orb). */
export function bounceGhost(g) {
  if (reducedMotion() || !g.animate) return Promise.resolve();
  const k = (dx, dy, s) => ({ transform: ghostTransform(g, g._x + dx, g._y + dy, s) });
  return g.animate([k(0, 0, g._s), k(-10, -14, 1.15), k(8, -6, 1.1), k(-5, 0, 1.05), k(0, 0, 1)], { duration: 380, easing: 'ease-out' })
    .finished.catch(() => {});
}

/* ---------------- drag controller ---------------- */

/**
 * createDragController({ layer, hitTest, canDrag, onHover, onDrop, onCancel })
 *   hitTest(x, y)         → organ id | null  (x, y = orb centre in client px)
 *   canDrag(el)           → boolean
 *   onStart(el)
 *   onMove(x, y)          → every frame while dragging (orb centre, client px)
 *   onHover(id|null)      → called when the organ under the orb changes
 *   onDrop({el, ghost, organ, x, y})  → caller owns the ghost afterwards
 *   onCancel({el, ghost}) → caller owns the ghost afterwards
 * Taps (no movement) are NOT handled here — listen for 'click' on the orb.
 * A click that follows a drag is swallowed automatically.
 */
export function createDragController({ layer, hitTest, canDrag = () => true, onStart, onMove, onHover, onDrop, onCancel }) {
  let a = null; // active pointer session

  function attach(el) {
    el.addEventListener('pointerdown', (e) => down(el, e));
    // swallow the click generated at the end of a drag
    el.addEventListener('click', (e) => {
      if (el._suppressClick) {
        el._suppressClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('dragstart', (e) => e.preventDefault());
  }

  function down(el, e) {
    if (a || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || !canDrag(el)) return;
    e.preventDefault();
    el._suppressClick = false;
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or unsupported — window listeners still work */ }
    const r = el.getBoundingClientRect();
    a = {
      el,
      id: e.pointerId,
      type: e.pointerType || 'mouse',
      sx: e.clientX,
      sy: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offX: e.clientX - (r.left + r.width / 2),
      offY: e.clientY - (r.top + r.height / 2),
      dragging: false,
      ghost: null,
      organ: null,
      raf: 0,
      t0: 0,
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
  }

  function centre() {
    const lift = a.type === 'touch' ? TOUCH_LIFT_PX * Math.min(1, (performance.now() - a.t0) / 140) : 0;
    return { x: a.x - a.offX, y: a.y - a.offY - lift };
  }

  function frame() {
    if (!a || !a.dragging) return;
    a.raf = 0;
    const c = centre();
    setGhost(a.ghost, c.x, c.y, 1.12);
    onMove?.(c.x, c.y);
    const organ = hitTest(c.x, c.y);
    if (organ !== a.organ) {
      a.organ = organ;
      onHover?.(organ);
    }
    // keep animating while the touch "lift" eases in
    if (a.type === 'touch' && performance.now() - a.t0 < 160) a.raf = requestAnimationFrame(frame);
  }

  function move(e) {
    if (!a || e.pointerId !== a.id) return;
    e.preventDefault();
    a.x = e.clientX;
    a.y = e.clientY;
    if (!a.dragging) {
      const th = DRAG_THRESHOLD[a.type] ?? 6;
      if (Math.hypot(a.x - a.sx, a.y - a.sy) < th) return;
      a.dragging = true;
      a.t0 = performance.now();
      a.ghost = createGhost(a.el, layer);
      a.ghost.classList.add('is-dragging');
      a.el.classList.add('is-lifted');
      onStart?.(a.el);
    }
    if (!a.raf) a.raf = requestAnimationFrame(frame);
  }

  function finish() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key);
    if (a?.raf) cancelAnimationFrame(a.raf);
    try { a?.el.releasePointerCapture(a.id); } catch { /* ignore */ }
    const s = a;
    a = null;
    return s;
  }

  function up(e) {
    if (!a || e.pointerId !== a.id) return;
    a.x = e.clientX;
    a.y = e.clientY;
    if (!a.dragging) { finish(); return; } // plain tap → the click handler deals with it
    const c = centre();
    const s = finish();
    s.el._suppressClick = true;
    setTimeout(() => { s.el._suppressClick = false; }, 400);
    setGhost(s.ghost, c.x, c.y, 1.12);
    s.ghost.classList.remove('is-dragging');
    const organ = hitTest(c.x, c.y);
    onHover?.(null);
    onDrop?.({ el: s.el, ghost: s.ghost, organ, x: c.x, y: c.y });
  }

  function cancel(e) {
    if (!a || (e && e.pointerId !== undefined && e.pointerId !== a.id)) return;
    const s = finish();
    if (!s.dragging) return;
    s.el._suppressClick = true;
    setTimeout(() => { s.el._suppressClick = false; }, 400);
    s.ghost.classList.remove('is-dragging');
    onHover?.(null);
    onCancel?.({ el: s.el, ghost: s.ghost });
  }

  function key(e) {
    if (e.key === 'Escape') cancel();
  }

  return {
    attach,
    cancel: () => cancel(),
    get active() { return !!a?.dragging; },
  };
}
