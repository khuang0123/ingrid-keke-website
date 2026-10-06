/* ---------- 宣纸: a sheet of rice paper pulled up over the bronze as you scroll ----------
   A round bronze paperweight (镇纸) carved with the seal comes down from the top to rest
   across it, and on the paper are three fashion croquis figures in 毛笔 brush strokes.
   Paper and paperweight are each painted once into a canvas (re-painted on resize);
   scrolling only slides them. */
(function () {
  const paper = document.querySelector('.paper');
  const canvas = paper.querySelector('canvas');
  const weight = document.querySelector('.weight');
  const wcanvas = weight.querySelector('canvas');
  const paperCtx = canvas.getContext('2d'), weightCtx = wcanvas.getContext('2d');
  let ctx = paperCtx;                       // the canvas currently being painted
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- small deterministic helpers ----
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = x => Math.max(0, Math.min(1, x));

  // ---- croquis figure, traced from the reference sketch: strokes in a 100 × 334 box ----
  // each stroke: [weight, [x, y], …] (points are passed through smoothly)
  const BASE = {
    head: [[0.75, [50.0, 0.0], [42.1, 2.9], [37.4, 12.6], [38.1, 24.5], [43.5, 31.8], [50.0, 33.6]],
           [0.75, [50.0, 0.0], [57.9, 2.9], [62.6, 12.6], [61.9, 24.5], [56.5, 31.8], [50.0, 33.6]]],
    neck: [[0.5, [44.9, 31.8], [44.6, 41.5], [42.8, 50.5]],
           [0.5, [55.1, 31.8], [55.4, 41.5], [57.2, 50.5]]],
    armL: [[1, [42.8, 50.5], [35.6, 53.4], [31.9, 57.8], [30.5, 66.8], [29.1, 86.6], [26.9, 104.7], [22.6, 122.7], [17.5, 139.0], [9.6, 151.6], [3.1, 155.2]],
           [0.6, [34.8, 75.1], [33.8, 93.9], [31.2, 111.9], [26.2, 130.0], [19.3, 144.4], [12.5, 151.6]],
           [0.45, [3.1, 155.2], [-2.0, 156.0], [-4.1, 158.8]],
           [0.4, [6.7, 154.5], [3.1, 160.6]]],
    armR: [[1, [57.2, 50.5], [64.4, 53.4], [68.0, 57.8], [69.5, 66.8], [71.7, 86.6], [74.5, 104.7], [79.6, 122.7], [85.4, 139.0], [93.3, 150.9], [100.5, 155.2]],
           [0.6, [65.9, 75.1], [67.3, 93.9], [70.6, 111.9], [76.0, 130.0], [84.3, 144.4], [91.2, 151.6]],
           [0.45, [100.5, 155.2], [105.6, 156.7], [107.0, 160.3]],
           [0.4, [96.9, 154.5], [99.8, 161.0]]],
    body: [[1, [33.4, 61.4], [32.7, 72.2], [33.4, 81.2], [37.7, 92.1], [39.9, 101.1], [36.3, 111.9], [30.5, 124.5], [28.3, 139.0], [29.1, 155.2], [30.5, 167.9]],
           [1, [66.6, 61.4], [67.3, 72.2], [66.6, 81.2], [62.3, 92.1], [60.1, 101.1], [62.3, 111.9], [65.9, 122.7], [67.3, 137.2], [65.9, 151.6]],
           [0.4, [37.0, 76.5], [42.1, 83.8], [49.6, 80.1]],
           [0.4, [50.4, 80.1], [57.9, 83.8], [63.0, 76.5]],
           [0.4, [39.9, 130.0], [46.4, 133.6], [50.0, 139.0], [53.6, 133.6], [60.1, 128.2]]],
    legs: [[0.9, [30.5, 167.9], [31.2, 191.3], [34.8, 216.6], [37.7, 231.0], [38.4, 245.5], [40.6, 267.1], [43.5, 288.8], [45.7, 306.8], [46.4, 321.3]],
           [0.6, [48.6, 144.4], [47.1, 173.3], [45.7, 202.2], [44.9, 227.4], [45.7, 249.1], [47.1, 278.0], [48.6, 303.2], [49.3, 317.7]],
           [0.9, [65.9, 151.6], [64.4, 176.9], [60.1, 202.2], [55.8, 227.4], [54.3, 245.5], [52.2, 267.1], [50.0, 288.8], [48.6, 306.8], [50.0, 324.9]],
           [0.6, [53.6, 144.4], [53.6, 176.9], [52.9, 202.2], [52.2, 227.4], [50.7, 249.1], [49.3, 278.0], [47.8, 299.6]],
           [0.45, [46.4, 321.3], [44.2, 328.5], [47.8, 332.1]],
           [0.45, [50.0, 324.9], [49.3, 331.4], [52.9, 333.9]]],
  };
  // a second pose: right hand resting on the hip
  const HIP_R = [[1, [57.2, 50.5], [64.4, 53.4], [68.0, 57.8], [70.9, 66.8], [78.2, 84.8], [82.5, 101.1], [75.3, 115.5], [64.4, 120.9]],
                 [0.6, [65.9, 75.1], [70.9, 88.4], [72.4, 101.1], [66.6, 111.9], [60.8, 116.2]],
                 [0.4, [64.4, 120.9], [59.4, 122.7]]];
  const flip = strokes => strokes.map(([w, ...pts]) => [w, ...pts.map(([x, y]) => [100 - x, y])]);
  const all = parts => Object.values(parts).flat();
  const POSES = [
    all(BASE),
    flip(all({ ...BASE, armR: HIP_R })),
    all({ ...BASE, armL: flip(BASE.armR), armR: flip(BASE.armL) }),
  ];

  // Catmull-Rom through the points, resampled to ~step px
  function smooth(pts, step) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t +
          (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // One 毛笔 stroke: pressed in at the start, swelling, tapering as the brush lifts,
  // with bristle streaks breaking up (飞白) as the ink runs dry, and a faint bleed.
  function brush(pts, W, sd) {
    const path = smooth(pts, .8);
    const n = path.length, len = [0];
    for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const L = len[n - 1] || 1;
    // per point: width, ink density and the side normal
    const pt = path.map(([x, y], i) => {
      const t = len[i] / L;
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1;
      const w = W * (.25 + .75 * ss(0, .12, t)) * (1 - .85 * ss(.5, 1, t)) * (.55 + .9 * noise1(len[i] / (W * 11) + sd))
              + W * .45 * Math.exp(-t / .03);                          // the press at the start
      return { x, y, t, w, nx: nx / nl, ny: ny / nl, ink: .9 - .3 * ss(.45, 1, t) };
    });
    ctx.lineCap = 'round';
    const seg = (p, q, o, width, alpha) => {
      ctx.strokeStyle = `rgba(20, 18, 16, ${alpha})`; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(p.x + p.nx * o * p.w, p.y + p.ny * o * p.w);
      ctx.lineTo(q.x + q.nx * o * q.w, q.y + q.ny * o * q.w); ctx.stroke();
    };
    for (let i = 1; i < n; i++) {                                      // ink bleeding into the fibres
      const p = pt[i - 1], q = pt[i];
      ctx.strokeStyle = `rgba(30, 26, 22, ${.03 * q.ink})`; ctx.lineWidth = q.w * 1.6 + W * .7;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    for (let i = 1; i < n; i++) seg(pt[i - 1], pt[i], 0, pt[i].w * (.5 - .42 * ss(.45, 1, pt[i].t)), pt[i].ink);   // body, thinning as the brush dries
    const NB = 7;                                                      // bristles, running dry (飞白)
    for (let k = 0; k < NB; k++) {
      const o = (k / (NB - 1) - .5) * .95, edge = Math.abs(o) * 2.1;
      for (let i = 1; i < n; i++) {
        const q = pt[i], dry = .06 + .9 * ss(.4, 1, q.t);
        if (noise1(len[i] / (W * 9) + k * 17.3 + sd) < dry * (.5 + .7 * edge)) continue;
        seg(pt[i - 1], q, o, Math.max(.5, q.w / NB * 2.1), q.ink);
      }
    }
  }

  function drawFigure(strokes, ox, oy, h, sd) {
    const s = h / 334, W = h * .0064;
    strokes.forEach(([wt, ...pts], i) =>
      brush(pts.map(([x, y]) => [ox + (x - 50) * s, oy + y * s]), W * wt, sd * 31 + i * 7.7));
  }

  // ---- the paper itself: warm, fibrous, with soft deckled edges ----
  function paperShape(x, y, w, h) {
    ctx.beginPath();
    const j = (i, a) => (noise1(i * .35 + a) - .5) * 1.6 + (noise1(i * 2.3 + a) - .5) * .9;
    const step = 6;
    for (let i = 0; i <= w / step; i++) ctx.lineTo(x + i * step, y + j(i, 3));
    for (let i = 0; i <= h / step; i++) ctx.lineTo(x + w + j(i, 9), y + i * step);
    ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
    for (let i = Math.floor(h / step); i >= 0; i--) ctx.lineTo(x + j(i, 17), y + i * step);
    ctx.closePath();
  }

  function paintPaper(x, y, w, h) {
    ctx.save();
    // thin rice paper: a light shadow, and a hint of the bronze showing through
    ctx.shadowColor = 'rgba(10, 6, 2, .32)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 5;
    paperShape(x, y, w, h); ctx.fillStyle = 'rgba(240, 233, 216, .93)'; ctx.fill();
    ctx.restore();
    ctx.save(); paperShape(x, y, w, h); ctx.clip();
    for (let i = 0; i < 70; i++) {                                    // soft mottling
      const cx = x + rnd() * w, cy = y + rnd() * h, r = 60 + rnd() * 260;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rnd() < .5 ? 'rgba(160, 135, 95, .05)' : 'rgba(255, 252, 240, .12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    const fibres = Math.round(w * h / 260);
    for (let i = 0; i < fibres; i++) {                                // long fibres
      const fx = x + rnd() * w, fy = y + rnd() * h, a = rnd() * 6.283, l = 6 + rnd() * rnd() * 50, bend = (rnd() - .5) * .5;
      ctx.strokeStyle = rnd() < .75 ? `rgba(150, 128, 95, ${.03 + rnd() * .06})` : `rgba(255, 255, 248, ${.12 + rnd() * .18})`;
      ctx.lineWidth = .25 + rnd() * .6;
      ctx.beginPath(); ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + Math.cos(a + bend) * l * .5, fy + Math.sin(a + bend) * l * .5, fx + Math.cos(a) * l, fy + Math.sin(a) * l);
      ctx.stroke();
    }
    for (let i = 0; i < fibres / 3; i++) {                            // specks
      ctx.fillStyle = `rgba(120, 100, 70, ${.08 + rnd() * .15})`;
      ctx.fillRect(x + rnd() * w, y + rnd() * h, .6 + rnd(), .6 + rnd());
    }
    const edge = ctx.createLinearGradient(x, 0, x + w, 0);           // edges a touch darker
    edge.addColorStop(0, 'rgba(120, 95, 60, .05)'); edge.addColorStop(.02, 'rgba(0,0,0,0)');
    edge.addColorStop(.98, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(120, 95, 60, .05)');
    ctx.fillStyle = edge; ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // ---- 镇纸: a round bronze rod with the seal carved into it ----
  function paintRod(cx, cy, len, D) {
    const x0 = cx - len / 2, y0 = cy - D / 2;
    const shadow = ctx.createRadialGradient(cx, cy + D * .55, 0, cx, cy + D * .55, len * .55);
    shadow.addColorStop(0, 'rgba(40, 25, 10, .35)'); shadow.addColorStop(1, 'rgba(40, 25, 10, 0)');
    ctx.save(); ctx.translate(cx, cy + D * .55); ctx.scale(1, D / len * 1.1); ctx.translate(-cx, -(cy + D * .55));
    ctx.fillStyle = shadow; ctx.fillRect(x0 - D, cy - len, len + 2 * D, 2 * len); ctx.restore();

    ctx.save();
    SealScript.roundRect(ctx, { x: x0, y: y0, w: len, h: D }, D * .08); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + D);             // round body lit from above
    [[0, '#120d08'], [.07, '#3e2e1c'], [.2, '#a07c4e'], [.27, '#f0d29a'], [.31, '#c19a63'], [.45, '#7a5c3a'],
     [.7, '#3a2b1a'], [.88, '#17110a'], [.96, '#2c2216'], [1, '#463826']]
      .forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g; ctx.fillRect(x0, y0, len, D);
    for (let i = 0; i < 40; i++) {                                    // green patina patches
      const px = x0 + rnd() * len, py = y0 + rnd() * D, r = D * (.2 + rnd() * .6);
      const pg = ctx.createRadialGradient(px, py, 0, px, py, r);
      pg.addColorStop(0, `rgba(70, 105, 80, ${.10 + rnd() * .12})`); pg.addColorStop(1, 'rgba(70, 105, 80, 0)');
      ctx.fillStyle = pg; ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < len * D / 6; i++) {                           // sandy grain
      ctx.fillStyle = rnd() < .5 ? `rgba(255, 220, 160, ${rnd() * .12})` : `rgba(0, 0, 0, ${rnd() * .18})`;
      ctx.fillRect(x0 + rnd() * len, y0 + rnd() * D, 1, 1);
    }
    const ends = ctx.createLinearGradient(x0, 0, x0 + len, 0);       // the rod turns away at its ends
    ends.addColorStop(0, 'rgba(0,0,0,.35)'); ends.addColorStop(.02, 'rgba(0,0,0,0)');
    ends.addColorStop(.98, 'rgba(0,0,0,0)'); ends.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = ends; ctx.fillRect(x0, y0, len, D);

    // carved seal: square frame + letters; lit lower lip, dark patina in the groove
    const S = D * .76, seal = { x: cx - S / 2, y: cy - S / 2, w: S, h: S };
    const carve = (style, dy) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = S * .03; SealScript.roundRect(ctx, SealScript.inset(seal, -S * .04 + dy * 0), S * .03);
      ctx.save(); ctx.translate(0, dy); ctx.stroke(); ctx.restore();
      SealScript.titleText(ctx, seal, 0, dy);
    };
    carve('rgba(255, 225, 170, .45)', S * .018);
    carve('rgba(22, 34, 27, .92)', 0);
    ctx.restore();
  }

  // ---- layout + painting ----
  let geo = null;
  function sizeCanvas(cv, c, w, h, dpr) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  }
  function paint() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const vw = innerWidth, vh = innerHeight;
    const pw = Math.min(vw * .96, 1600), ph = vh * 1.04;         // paper (runs off the bottom)
    const mg = 40;                                               // room for the shadow
    sizeCanvas(canvas, paperCtx, pw + 2 * mg, ph + mg, dpr);
    paper.style.width = (pw + 2 * mg) + 'px';
    seed = 7;

    const x = mg, y = mg * .5;
    ctx = paperCtx;
    paintPaper(x, y, pw, ph);
    const top = vh * .035;                                        // paper's resting gap from the top

    // three figures across the centre
    const D = Math.min(vh * .095, pw * .07);
    const fh = Math.min(vh * .7, pw * .5);
    const fy = y + D * 2.1 + (vh - top - D * 2.1 - fh) * .45;
    [.25, .5, .75].forEach((fx, i) => drawFigure(POSES[i], x + pw * fx, fy, fh * (i === 1 ? 1.02 : 1), i + 1));

    // paperweight, in its own canvas: it rests across the top centre of the paper
    const len = Math.min(pw * .5, D * 8), wm = D * 1.2;
    sizeCanvas(wcanvas, weightCtx, len + 2 * wm, D * 2.4, dpr);
    weight.style.width = (len + 2 * wm) + 'px';
    ctx = weightCtx;
    paintRod(wm + len / 2, D * .8, len, D);
    ctx = paperCtx;

    geo = { top, offset: y, rodRest: top + D * .95 - D * .8, rodH: D * 2.4 };
    place();
  }

  // ---- scroll: the paper is pulled up from below while the paperweight comes down ----
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  const ease = t => 1 - Math.pow(1 - t, 3);
  function place() {
    if (!geo) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const P = max > 0 ? clamp(scrollY / max) : 0;
    const p = ease(clamp(P / .85));
    const y = geo.top - geo.offset + (1 - p) * (innerHeight + 40);
    const tilt = reduce ? 0 : (1 - p) * -1.2;                     // a slight angle while being pulled
    paper.style.transform = `translate(-50%, ${y}px) rotate(${tilt}deg)`;
    paper.style.visibility = p <= 0 ? 'hidden' : 'visible';
    // the paperweight descends from above the screen, landing as the paper settles
    const wy = geo.rodRest - (1 - p) * (geo.rodRest + geo.rodH + 20);
    weight.style.transform = `translate(-50%, ${wy}px)`;
    weight.style.visibility = p <= 0 ? 'hidden' : 'visible';
  }
  paint();
  addEventListener('scroll', place, { passive: true });
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(paint, 150); });
})();
