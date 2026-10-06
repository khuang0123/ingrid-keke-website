/* ---------- 宣纸: a sheet of rice paper pulled up over the bronze as you scroll ----------
   A round bronze paperweight (镇纸) carved with the seal comes down from the top to rest
   across it, an inkstone (砚台) slides in from the left to its left edge, and on the paper
   are three fashion croquis silhouettes in 毛笔 brush strokes.
   Paper and paperweight are each painted once into a canvas (re-painted on resize);
   scrolling only slides them. */
(function () {
  const paper = document.querySelector('.paper');
  const canvas = paper.querySelector('canvas');
  const weight = document.querySelector('.weight');
  const wcanvas = weight.querySelector('canvas');
  const stone = document.querySelector('.inkstone');
  const scanvas = stone.querySelector('canvas');
  const paperCtx = canvas.getContext('2d'), weightCtx = wcanvas.getContext('2d'), stoneCtx = scanvas.getContext('2d');
  let ctx = paperCtx;                       // the canvas currently being painted
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- small deterministic helpers ----
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = x => Math.max(0, Math.min(1, x));

  // ---- croquis silhouette: outer contour plus the line between the legs, snapped point-by-
  // point onto the lines of the reference sketch, in a 100-wide × 334-tall box ----
  // each stroke: [weight, [x, y], …]
  const SILHOUETTE = [
    [1, [49.6, 0.0], [47.2, 0.8], [45.3, 1.6], [43.3, 2.7], [41.5, 4.2], [40.1, 6.1], [38.9, 8.2], [38.2, 10.4], [37.9, 12.8], [37.8, 15.2], [37.5, 17.6], [37.0, 20.2], [37.1, 22.6], [38.0, 24.6], [39.4, 26.4], [40.6, 28.5], [41.7, 30.6], [43.1, 32.4], [45.0, 34.4]], // headL
    [1, [49.6, 0.0], [52.0, 0.8], [53.9, 1.6], [55.9, 2.8], [57.7, 4.3], [59.1, 6.2], [60.2, 8.3], [60.9, 10.5], [61.3, 12.8], [61.5, 15.2], [61.8, 17.7], [62.2, 20.2], [62.1, 22.5], [61.3, 24.5], [60.0, 26.2], [58.8, 28.2], [57.7, 30.4], [56.3, 32.4], [54.9, 33.8]], // headR
    [0.7, [45.0, 35.2], [45.1, 37.7], [45.4, 39.8], [45.7, 42.0], [46.1, 44.2], [46.6, 45.9]], // neckL
    [0.7, [55.7, 35.2], [56.0, 37.7], [56.1, 39.8], [56.1, 42.0], [56.3, 44.2], [56.5, 45.9]], // neckR
    [1, [45.4, 45.9], [43.0, 47.2], [41.0, 48.4], [38.9, 49.8], [36.5, 51.0], [34.0, 51.8], [31.6, 52.6], [29.6, 53.6], [28.2, 54.7]], // shoulderL
    [1, [56.5, 45.9], [59.0, 47.7], [61.1, 49.2], [63.8, 49.1], [66.6, 48.0], [69.3, 47.7], [72.0, 48.3], [74.4, 49.7], [75.9, 51.6], [76.9, 54.4]], // shoulderR
    [1, [28.2, 54.7], [27.6, 57.4], [27.2, 59.6], [26.9, 62.0], [26.6, 64.3], [26.4, 66.6], [26.1, 68.9], [25.9, 71.2], [25.5, 73.4], [25.1, 75.7], [24.7, 78.0], [24.3, 80.3], [23.9, 82.6], [23.4, 84.8], [23.0, 87.1], [22.5, 89.3], [22.0, 91.6], [21.5, 94.0], [21.2, 96.3], [20.9, 98.7], [20.2, 100.9], [19.3, 103.1], [18.2, 105.3], [17.1, 107.4], [16.3, 109.6], [15.9, 112.0], [15.7, 114.4], [15.4, 116.7], [15.2, 119.0], [15.0, 121.4], [14.7, 123.8], [14.5, 126.2], [14.3, 128.5], [14.0, 130.9], [13.7, 133.3], [13.4, 135.7], [13.1, 138.0], [12.7, 140.4], [12.3, 142.6], [11.7, 144.8], [10.9, 146.9], [9.8, 148.8], [8.5, 150.4], [6.8, 151.9], [4.8, 153.3], [2.6, 154.5], [0.5, 155.7], [-1.3, 157.5], [-3.0, 159.3], [-4.4, 160.8], [-5.6, 161.8]], // armL
    [0.6, [-5.3, 161.5], [-6.0, 162.5], [-4.9, 163.1], [-3.1, 164.1], [-1.0, 165.4], [1.0, 166.7], [3.1, 167.5], [5.3, 167.3], [6.9, 166.1], [7.8, 164.1], [9.1, 162.1], [10.6, 160.3], [11.9, 158.2], [12.9, 156.1], [13.9, 154.0], [14.9, 152.0], [15.7, 150.0], [16.0, 148.3]], // handL
    [0.75, [33.2, 70.0], [32.9, 72.5], [32.9, 74.6], [33.4, 76.9], [34.4, 79.3], [35.0, 81.8], [34.1, 84.1], [32.8, 86.2], [32.0, 88.4], [31.4, 90.8], [30.7, 93.2], [30.1, 95.5], [29.5, 97.8], [29.0, 100.1], [29.1, 102.5], [29.6, 104.8], [30.3, 106.7]], // innerArmL
    [1, [77.2, 54.6], [77.7, 57.2], [78.1, 59.5], [78.6, 61.8], [79.0, 64.1], [79.5, 66.4], [79.9, 68.8], [80.3, 71.0], [80.7, 73.4], [81.1, 75.8], [81.6, 78.1], [81.9, 80.5], [82.4, 82.8], [82.7, 85.2], [83.2, 87.6], [83.5, 90.0], [83.8, 92.5], [84.1, 94.9], [84.6, 97.3], [85.2, 99.7], [85.8, 102.0], [86.8, 104.2], [88.0, 106.3], [88.8, 108.7], [89.3, 111.1], [89.7, 113.6], [90.1, 116.0], [90.6, 118.3], [90.9, 120.7], [91.3, 123.0], [91.7, 125.3], [92.2, 127.6], [92.7, 130.0], [92.8, 132.4], [92.5, 134.7], [92.3, 137.0], [92.6, 139.3], [93.2, 141.6], [94.0, 143.9], [94.8, 146.1], [95.7, 148.3], [96.9, 150.3], [98.1, 152.3], [99.4, 154.2], [100.7, 156.0], [102.1, 158.2]], // armR
    [0.6, [100.1, 159.7], [103.0, 160.4], [104.0, 162.1], [103.6, 164.0], [102.1, 165.5], [100.8, 166.7], [100.5, 167.2], [100.2, 166.3], [99.5, 164.4], [98.2, 162.6], [96.7, 161.5]], // handR
    [0.75, [73.0, 85.2], [73.6, 87.8], [74.2, 89.9], [74.9, 92.2], [75.5, 94.6], [76.1, 96.9], [76.6, 99.3], [76.9, 101.7], [77.3, 104.1], [77.9, 106.4], [78.6, 108.7], [79.4, 110.9], [80.3, 113.1], [81.1, 115.3], [82.0, 117.5], [82.9, 119.6], [83.7, 121.7], [84.6, 123.9], [85.5, 126.0], [86.3, 128.2], [87.2, 130.3], [88.1, 132.6], [88.8, 135.0], [89.1, 137.5], [89.0, 140.0], [89.3, 142.4], [89.8, 144.7], [90.1, 147.1], [90.3, 149.5], [90.9, 151.8], [91.9, 153.9], [93.1, 155.7], [94.0, 157.6], [94.7, 159.5], [96.7, 161.5]], // innerArmR
    [1, [34.3, 65.1], [34.0, 67.6], [33.5, 69.7], [33.0, 71.9], [32.9, 74.2], [33.2, 76.5], [34.2, 78.8], [35.5, 81.0], [36.3, 83.2], [36.5, 85.5], [36.9, 87.7], [37.5, 90.0], [38.0, 92.3], [38.5, 94.7], [38.9, 97.3], [39.4, 100.1], [38.9, 102.3], [37.0, 103.8], [34.5, 104.8], [32.1, 105.9], [30.0, 107.5], [28.3, 109.4], [26.7, 111.3], [25.2, 113.1], [23.9, 115.0], [22.5, 117.1], [21.3, 119.3], [20.1, 121.5], [19.1, 123.8], [18.3, 126.1], [17.6, 128.4], [17.0, 130.9], [16.5, 133.3], [16.2, 135.6], [16.0, 138.1], [15.9, 140.5], [15.9, 143.0], [15.9, 145.3], [16.0, 147.6], [16.1, 150.0], [16.4, 152.3], [16.8, 154.6], [17.1, 156.9], [17.5, 159.1], [17.8, 161.4], [18.2, 163.7], [18.7, 166.0], [19.1, 168.2], [19.5, 170.5], [20.0, 172.6], [20.5, 175.0], [20.1, 174.0], [20.7, 176.7], [21.1, 179.0], [21.5, 181.5], [22.0, 183.9], [22.5, 186.4], [22.9, 188.7], [23.3, 191.1], [23.6, 193.4], [23.8, 195.8], [24.1, 198.2], [24.7, 200.6], [25.3, 203.0], [25.9, 205.3], [26.4, 207.7], [27.0, 210.1], [27.7, 212.5], [27.8, 214.9], [26.7, 217.1], [25.6, 219.2], [25.1, 221.5], [24.9, 223.9], [24.7, 226.2], [24.6, 228.5], [24.5, 230.9], [24.4, 233.2], [24.3, 235.6], [24.4, 237.9], [24.5, 240.3], [24.7, 242.6], [25.1, 245.0], [25.6, 247.3], [26.1, 249.7], [26.7, 252.0], [27.4, 254.2], [28.1, 256.4], [28.9, 258.6], [29.7, 260.7], [30.6, 262.8], [31.4, 265.0], [32.1, 267.1], [32.9, 269.3], [33.7, 271.5], [34.4, 273.7], [35.1, 275.8], [35.8, 278.0], [36.5, 280.2], [37.2, 282.5], [37.9, 284.7], [38.7, 287.0], [39.4, 289.4], [40.2, 291.6], [41.0, 293.9], [41.7, 296.1], [42.3, 298.4], [42.8, 300.7], [43.2, 303.0], [43.3, 305.3], [43.3, 307.6], [43.5, 309.9], [43.9, 312.2], [44.1, 314.5], [44.1, 316.9], [43.9, 319.3], [43.8, 321.6], [43.6, 324.0], [43.6, 326.4], [43.8, 328.8], [44.4, 331.0], [45.7, 332.6], [47.8, 333.4], [50.2, 333.5], [52.6, 332.9], [54.4, 331.5], [55.1, 329.3], [54.6, 326.8], [53.9, 324.4], [53.1, 322.1], [52.3, 319.8], [51.6, 317.5], [51.0, 315.1], [50.4, 312.8], [49.9, 310.5], [49.5, 308.6], [49.2, 307.2]], // bodyL + legL
    [1, [69.9, 68.1], [70.5, 70.5], [70.9, 72.7], [70.7, 75.0], [70.0, 77.3], [68.7, 79.5], [67.7, 81.8], [67.5, 84.2], [67.2, 86.7], [66.6, 88.9], [65.8, 91.1], [65.0, 93.3], [64.1, 95.5], [63.3, 97.7], [62.6, 99.9], [61.9, 102.2], [61.3, 104.5], [61.2, 106.9], [61.3, 109.3], [61.6, 111.7], [62.0, 114.0], [62.4, 116.2], [62.7, 118.5], [63.0, 120.8], [63.3, 123.1], [63.5, 125.4], [63.8, 127.7], [63.9, 130.0], [64.0, 132.3], [64.1, 134.7], [64.1, 137.0], [64.0, 139.3], [63.8, 141.6], [63.5, 143.9], [63.2, 146.1], [62.8, 148.4], [62.4, 150.7], [62.0, 153.0], [61.5, 155.3], [61.0, 157.5], [60.5, 159.8], [60.0, 162.1], [59.5, 164.3], [59.0, 166.7], [58.5, 169.0], [58.0, 171.2], [57.7, 173.0], [57.5, 172.8], [56.9, 175.5], [56.4, 177.9], [55.9, 180.3], [55.4, 182.6], [54.8, 184.9], [54.3, 187.2], [53.8, 189.5], [53.3, 191.8], [52.8, 194.2], [52.3, 196.5], [52.1, 198.9], [52.0, 201.2], [51.7, 203.5], [51.5, 205.8], [51.6, 208.1], [51.9, 210.4], [52.3, 212.7], [52.7, 215.0], [52.9, 217.3], [53.1, 219.7], [53.4, 222.1], [53.9, 224.5], [54.5, 226.8], [55.0, 229.1], [55.3, 231.5], [55.5, 233.9], [55.7, 236.2], [55.6, 238.6], [55.4, 241.0], [55.1, 243.3], [54.9, 245.6], [54.6, 247.9], [54.2, 250.2], [53.8, 252.5], [53.4, 254.8], [52.9, 257.0], [52.4, 259.3], [52.1, 261.6], [51.9, 263.9], [51.5, 266.2], [50.8, 268.5], [50.3, 270.8], [50.1, 273.3], [50.0, 275.7], [50.1, 278.1], [50.5, 280.6], [50.8, 282.9], [51.1, 285.3], [51.4, 287.7], [51.8, 290.0], [52.3, 292.3], [52.6, 294.6], [52.5, 296.9], [52.0, 299.1], [51.1, 301.4], [50.3, 303.8], [49.7, 305.7], [49.2, 307.2]], // bodyR + legR
    [.8, [42.0, 142.1], [40.7, 144.5], [39.5, 146.2], [38.2, 148.1], [37.3, 150.3], [37.0, 152.8], [37.0, 155.2], [37.0, 157.6], [37.0, 159.9], [37.1, 162.2], [37.2, 164.5], [37.3, 166.8], [37.3, 169.1], [37.4, 171.4], [37.4, 173.7], [37.4, 176.0], [37.4, 178.3], [37.4, 180.6], [37.4, 182.9], [37.4, 185.2], [37.4, 187.5], [37.3, 189.8], [37.1, 192.1], [37.2, 194.4], [37.9, 196.5], [38.8, 198.8], [39.0, 201.2], [38.9, 203.5], [38.8, 205.9], [38.7, 208.2], [38.6, 210.6], [38.1, 212.9], [36.9, 215.0], [35.8, 217.2], [35.6, 219.6], [36.0, 221.9], [36.5, 224.2], [36.7, 226.5], [37.0, 228.8], [37.2, 231.1], [37.5, 233.4], [37.7, 235.7], [37.9, 238.0], [38.1, 240.3], [38.4, 242.6], [38.6, 244.9], [38.9, 247.2], [39.2, 249.4], [39.4, 251.7], [39.7, 254.1], [39.9, 256.4], [40.2, 258.7], [40.6, 261.0], [40.9, 263.3], [41.1, 265.6], [41.4, 267.9], [41.8, 270.1], [42.2, 272.4], [42.6, 274.7], [43.0, 277.0], [43.3, 279.3], [43.6, 281.6], [43.9, 283.9], [44.3, 286.2], [44.8, 288.5], [45.2, 290.8], [45.7, 293.0], [46.2, 295.1], [46.9, 297.5]], // legGap: the line between the legs
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
      const w = W * (.25 + .75 * ss(0, .12, t)) * (1 - .7 * ss(.6, 1, t)) * (.55 + .9 * noise1(len[i] / (W * 11) + sd))
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
    const S = D * .84, seal = { x: cx - S / 2, y: cy - S / 2, w: S, h: S };
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

  // ---- 砚台: a dark inkstone with a soft, leaf-like rim around one long recessed well
  // (where the origami pieces will sit). Painted top-down with a little thickness showing. ----
  function stoneOutline(x, y, w, h, amp, ph) {
    // walk a rounded rectangle, pushing the edge in and out like a soft leaf margin
    const r = Math.min(w, h) * .18, pts = [], per = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
    const N = 260;
    for (let i = 0; i < N; i++) {
      let d = i / N * per, px, py, nx, ny;
      const seg = [w - 2 * r, Math.PI * r / 2, h - 2 * r, Math.PI * r / 2, w - 2 * r, Math.PI * r / 2, h - 2 * r, Math.PI * r / 2];
      let k = 0; while (d > seg[k]) { d -= seg[k]; k++; }
      const arc = (cx, cy, a0) => { const a = a0 + d / r; px = cx + Math.cos(a) * r; py = cy + Math.sin(a) * r; nx = Math.cos(a); ny = Math.sin(a); };
      if (k === 0) { px = x + r + d; py = y; nx = 0; ny = -1; }
      else if (k === 1) arc(x + w - r, y + r, -Math.PI / 2);
      else if (k === 2) { px = x + w; py = y + r + d; nx = 1; ny = 0; }
      else if (k === 3) arc(x + w - r, y + h - r, 0);
      else if (k === 4) { px = x + w - r - d; py = y + h; nx = 0; ny = 1; }
      else if (k === 5) arc(x + r, y + h - r, Math.PI / 2);
      else if (k === 6) { px = x; py = y + h - r - d; nx = -1; ny = 0; }
      else arc(x + r, y + r, Math.PI);
      const t = i / N, wv = amp * (.55 * Math.sin(t * 6.283 * 4 + ph) + .3 * Math.sin(t * 6.283 * 9 + ph * 2) + .5 * (noise1(t * 22 + ph) - .5));
      pts.push([px + nx * wv, py + ny * wv, nx, ny]);
    }
    return pts;
  }
  
  // carved relief: a soft bevel inside a shape, lit from the upper left
  function bevel(path, w, raised = true, strength = 1) {
    ctx.save(); ctx.clip(path);
    const pass = (col, dx, dy) => {
      ctx.shadowColor = col; ctx.shadowBlur = w * .035; ctx.shadowOffsetX = dx; ctx.shadowOffsetY = dy;
      // stroke the outline far off-canvas so only its shadow lands inside the shape
      ctx.lineWidth = w * .05; ctx.strokeStyle = '#000';
      const far = 1e4, m = ctx.getTransform();
      ctx.save(); ctx.translate(-far, 0);
      ctx.shadowOffsetX = far * m.a + dx; ctx.shadowOffsetY = dy;
      ctx.stroke(path); ctx.restore();
    };
    const k = w * .012, s = raised ? 1 : -1;
    pass(`rgba(255, 246, 228, ${.22 * strength})`, s * k, s * k);       // light on the upper-left inner edge
    pass(`rgba(0, 0, 0, ${.55 * strength})`, -s * k, -s * k);           // shade on the lower-right
    ctx.restore();
  }
  const toPath = pts => { const p = new Path2D(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; };

  function paintInkstone(x, y, w, h) {
    const T = h * .035;                                            // visible thickness
    const outer = toPath(stoneOutline(x, y, w, h, w * .035, 1.3));
    const wellPts = stoneOutline(x + w * .12, y + h * .06, w * .76, h * .86, w * .025, 4.1);
    const well = toPath(wellPts);

    // shadow on the paper, then the stone's side
    ctx.save();
    ctx.shadowColor = 'rgba(15, 10, 5, .42)'; ctx.shadowBlur = w * .14; ctx.shadowOffsetX = w * .03; ctx.shadowOffsetY = w * .06;
    ctx.translate(0, T); ctx.fillStyle = '#100f0e'; ctx.fill(outer); ctx.restore();
    ctx.save(); ctx.translate(0, T);
    const side = ctx.createLinearGradient(x, 0, x + w, 0);
    side.addColorStop(0, '#22201d'); side.addColorStop(1, '#0d0c0b');
    ctx.fillStyle = side; ctx.fill(outer); ctx.restore();

    // top face: matte dark stone with soft mottling
    const face = ctx.createLinearGradient(x, y, x + w, y + h);
    face.addColorStop(0, '#47433e'); face.addColorStop(.45, '#33302c'); face.addColorStop(1, '#232120');
    ctx.fillStyle = face; ctx.fill(outer);
    ctx.save(); ctx.clip(outer);
    for (let i = 0; i < 24; i++) {
      const cx = x + rnd() * w, cy = y + rnd() * h, r = w * (.1 + rnd() * .3);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rnd() < .5 ? 'rgba(0, 0, 0, .12)' : 'rgba(120, 112, 100, .08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    ctx.restore();
    bevel(outer, w, true, 1.2);

    // the well: recessed and smoothly polished, ready to hold the pieces
    const wg = ctx.createLinearGradient(x, y + h * .06, x + w, y + h);
    wg.addColorStop(0, '#272522'); wg.addColorStop(.55, '#2e2c29'); wg.addColorStop(1, '#211f1d');
    ctx.fillStyle = wg; ctx.fill(well);
    bevel(well, w, false, 1.3);
    ctx.save(); ctx.clip(well);
    const sheen = ctx.createLinearGradient(x + w * .15, y + h * .1, x + w * .85, y + h * .9);
    sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(.45, 'rgba(255, 250, 240, .06)');
    sheen.addColorStop(.6, 'rgba(255, 250, 240, .02)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen; ctx.fillRect(x, y, w, h);
    ctx.restore();

    // fine stone grain
    ctx.save(); ctx.clip(outer);
    for (let i = 0; i < w * h / 6; i++) {
      ctx.fillStyle = rnd() < .5 ? `rgba(255, 255, 255, ${rnd() * .04})` : `rgba(0, 0, 0, ${rnd() * .1})`;
      ctx.fillRect(x + rnd() * w, y + rnd() * h, 1, 1);
    }
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

    // the inkstone takes the left edge; three identical figures share the rest
    const D = Math.min(vh * .095, pw * .07);
    const below = D * 1.45, avail = vh - top - below;              // paper area under the paperweight
    const fh = Math.min(avail * .9, pw * .5);
    const fy = y + below + (avail - fh) * .3;
    // inkstone: the same length as the figures, head to feet
    const sw = Math.min(pw * .2, avail * .62), sh = fh;
    const sx = pw * .012, sy = fy - y - fh * .05;                   // inkstone, in paper coords
    const fx0 = sx + sw + pw * .04, fx1 = pw * .97;
    [1, 3, 5].forEach(k => drawFigure(SILHOUETTE, x + fx0 + (fx1 - fx0) * k / 6, fy, fh, k));

    // paperweight, in its own canvas: it rests across the top centre of the paper
    const RD = D * .7;                                            // a slimmer rod
    const len = Math.min(pw * .5, D * 8), wm = D * 1.2;
    sizeCanvas(wcanvas, weightCtx, len + 2 * wm, D * 2.4, dpr);
    weight.style.width = (len + 2 * wm) + 'px';
    ctx = weightCtx;
    paintRod(wm + len / 2, D * .8, len, RD);
    ctx = paperCtx;

    // inkstone, in its own canvas: it slides in from the left to rest at the paper's left edge
    const smg = sw * .2;
    sizeCanvas(scanvas, stoneCtx, sw + 2 * smg, sh + 2 * smg, dpr);
    ctx = stoneCtx; seed = 11;
    paintInkstone(smg, smg, sw, sh);
    ctx = paperCtx;

    geo = { top, offset: y, rodRest: top + D * .62 - D * .8, rodH: D * 2.4,
            stoneX: (vw - pw) / 2 + sx - smg, stoneY: top + sy - smg, stoneW: sw + 2 * smg };
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
    // the inkstone slides in from beyond the left edge to the paper's left edge
    const sx = geo.stoneX - (1 - p) * (geo.stoneX + geo.stoneW + 30);
    stone.style.transform = `translate(${sx}px, ${geo.stoneY}px)`;
    stone.style.visibility = p <= 0 ? 'hidden' : 'visible';
  }
  paint();
  addEventListener('scroll', place, { passive: true });
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(paint, 150); });
})();
