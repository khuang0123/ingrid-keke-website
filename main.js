// shared between the bronze renderer and the scroll timeline
const shared = { hasGL: false, rise: [1, 1], fig: [0, 0, 0] }; // 0 = flat in the sheet, 1 = fully raised

/* ---------- bronze sheet: static relief rendered in a fragment shader ----------
   The words and figures are part of the sheet itself: soft height fields that press
   up out of the bronze, shaded with the same metal. */
(function () {
  const canvas = document.getElementById('water');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return; // CSS gradient fallback stays visible

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `
precision highp float;
uniform vec2 res; uniform float dpr;
uniform sampler2D txt;   // r: title  g: subtitle  b/a: wide soft skirts of each
uniform sampler2D fig;   // rgb: figures 1–3
uniform sampler2D figw;  // rgb: wide soft skirts of figures 1–3
uniform vec2 rise;       // title, subtitle: 0 = flat, 1 = raised
uniform vec3 frise;      // figures

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a*vnoise(p); p = p*2.03 + 5.3; a *= .5; } return v; }

float sabs(float x, float k){ return sqrt(x*x + k); }

// draped sheet: big warped folds with soft creases where the metal bends over itself
float sheet(vec2 s){
  vec2 p = s * 2.3;
  for (int i = 1; i < 6; i++) {
    float fi = float(i);
    p.x += .55 / fi * sin(fi * p.y * .8 + 1.7 + .3 * fi) + .2;
    p.y += .45 / fi * cos(fi * p.x * .7 + 2.3 + .5 * fi) - .1;
  }
  float h = .5 * (sin(p.x * .8) + cos(p.y * .7));
  h -= .45 * sabs(sin(p.x * .55 + p.y * .35 + .4), .005);  // long rolled folds
  h -= .22 * sabs(sin(p.y * .9 - p.x * .4 + 2.1), .01);
  return h;
}

vec2 fit(vec2 uv, float r){ return .5 + (uv - .5) / (.94 + .06 * r); } // swells slightly as it rises

float height(vec2 s){
  vec2 uv = s * vec2(res.y / res.x, 1.) + .5;
  float h = sheet(s);
  vec4 a = texture2D(txt, fit(uv, rise.x));
  vec4 b = texture2D(txt, fit(uv, rise.y));
  // seals pressed up out of the sheet: carved letters in the main seal, raised in the name seal
  h += rise.x * .022 * a.r + rise.y * .016 * b.g;
  vec3 f = texture2D(fig, uv).rgb, fw = texture2D(figw, uv).rgb;
  h += dot(frise, .036 * f + .012 * fw);
  return h;
}

void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 s = (gl_FragCoord.xy - .5*res) / res.y;

  float ep = 1. / res.y;
  float h0 = height(s);
  float hx = height(s + vec2(ep, 0.)) - height(s - vec2(ep, 0.));
  float hy = height(s + vec2(0., ep)) - height(s - vec2(0., ep));
  vec3 n = normalize(vec3(-hx, -hy, 2.*ep / .9));

  // satin bronze: light raking across the folds plus a soft metallic sheen
  vec3 L = normalize(vec3(-.55, .60, .58));
  vec3 Hv = normalize(L + vec3(0., 0., 1.));
  float dif = clamp(dot(n, L), 0., 1.);
  float sp = pow(clamp(dot(n, Hv), 0., 1.), 18.);
  float g = hash(floor(gl_FragCoord.xy / dpr));               // fine sandy grain
  float g2 = hash(floor(gl_FragCoord.xy / (2. * dpr)) + 7.);

  // dark oxidised bronze dusted with gold, a green patina settling in the hollows
  float m  = fbm(s * 3.2 + 3.);
  float pt = fbm(s * 2.2 + 11.);
  vec3 dark = vec3(.085, .07, .055), gold = vec3(.58, .40, .25);
  float dust = smoothstep(.25, .85, m + (g2 - .5) * .22 + dif * .35);
  vec3 alb = mix(dark, gold, dust);
  float hollow = smoothstep(.3, -.9, h0);
  alb = mix(alb, alb * vec3(.80, 1.08, .92) + vec3(.0, .025, .015), clamp(smoothstep(.45, .75, pt) * .6 + hollow * .5, 0., .8));

  // raised relief is worn and polished, so it catches more light
  vec4 a = texture2D(txt, fit(uv, rise.x)); vec4 b = texture2D(txt, fit(uv, rise.y));
  float relief = clamp(rise.x * a.r + rise.y * b.g + dot(frise, texture2D(fig, uv).rgb), 0., 1.);
  alb = mix(alb, gold, relief * .4);
  // carved strokes hold dark green patina; the name seal's cut-away ground does too
  float ground2 = smoothstep(.1, .25, b.g) * (1. - smoothstep(.4, .6, b.g));
  alb = mix(alb, vec3(.05, .075, .06), clamp(rise.x * a.b * .8 + rise.y * ground2 * .7, 0., 1.));
  alb *= .9 + .2 * g;

  float fill = clamp(dot(n, normalize(vec3(.6, -.4, .7))), 0., 1.);   // soft bounce light
  vec3 col = alb * (.20 + 1.15 * pow(dif, 1.3) + .25 * fill);
  col += vec3(1., .78, .52) * sp * (.25 + .45 * dust + .35 * relief) * (.55 + .9 * g);
  col *= vec3(.97, 1.02, .97);                               // a touch of green overall
  gl_FragColor = vec4(col, 1.);
}`;

  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('res'), uDpr = U('dpr'), uRise = U('rise'), uFrise = U('frise');
  shared.hasGL = true;
  document.documentElement.classList.add('gl');

  // ---- relief masks: draw the words and figures, blur them into soft height fields ----
  function makeTex(unit, name) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
                          [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
      gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.uniform1i(U(name), unit);
    return t;
  }
  const texTxt = makeTex(0, 'txt'), texFig = makeTex(1, 'fig'), texFigW = makeTex(2, 'figw');

  function upload(unit, t, W, H, data) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  function boxBlur(src, w, h, r) {             // 3 box passes each way ≈ gaussian
    r = Math.max(1, Math.round(r));
    let a = src, b = new Float32Array(src.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) {            // horizontal
        let acc = 0; const o = y * w;
        for (let x = -r; x < w + r; x++) {
          acc += (x + r < w ? a[o + x + r] : 0) - (x - r - 1 >= 0 ? a[o + x - r - 1] : 0);
          if (x >= 0 && x < w) b[o + x] = acc / (2 * r + 1);
        }
      }
      for (let x = 0; x < w; x++) {            // vertical
        let acc = 0;
        for (let y = -r; y < h + r; y++) {
          acc += (y + r < h ? b[(y + r) * w + x] : 0) - (y - r - 1 >= 0 ? b[(y - r - 1) * w + x] : 0);
          if (y >= 0 && y < h) a[y * w + x] = acc / (2 * r + 1);
        }
      }
    }
    return a;
  }

  const ss = x => x * x * (3 - 2 * x);
  const dome = (m, lo) => Math.sqrt(ss(Math.max(0, Math.min(1, (m - lo) / (1 - lo)))));  // rounded relief profile
  const skirt = (m, g) => { const v = ss(Math.min(1, m * g)); return v * v; };            // soft stretch around it

  // seal-script style Latin capitals, as centre-lines in a unit cell (y down)
  // p(x, y) maps cell coords to canvas; curves are squared corners, like carved seal script
  const M = (c, p, x, y) => c.moveTo(...p(x, y)), Ln = (c, p, x, y) => c.lineTo(...p(x, y));
  const Q = (c, p, x1, y1, x, y) => c.quadraticCurveTo(...p(x1, y1), ...p(x, y));
  const SEAL_GLYPHS = {
    H: (p, c) => { M(c,p,0,0); Ln(c,p,0,1); M(c,p,1,0); Ln(c,p,1,1); M(c,p,0,.5); Ln(c,p,1,.5); },
    E: (p, c) => { M(c,p,1,0); Ln(c,p,0,0); Ln(c,p,0,1); Ln(c,p,1,1); M(c,p,0,.5); Ln(c,p,.82,.5); },
    R: (p, c) => { M(c,p,0,1); Ln(c,p,0,0); Ln(c,p,.72,0); Q(c,p,1,0,1,.26); Q(c,p,1,.52,.66,.52); Ln(c,p,0,.52);
                   M(c,p,.5,.52); Q(c,p,1,.6,1,1); },
    T: (p, c) => { M(c,p,0,0); Ln(c,p,1,0); M(c,p,.5,0); Ln(c,p,.5,1); },
    I: (p, c) => { M(c,p,.5,0); Ln(c,p,.5,1); M(c,p,.12,0); Ln(c,p,.88,0); M(c,p,.12,1); Ln(c,p,.88,1); },
    P: (p, c) => { M(c,p,0,1); Ln(c,p,0,0); Ln(c,p,.72,0); Q(c,p,1,0,1,.27); Q(c,p,1,.54,.72,.54); Ln(c,p,0,.54); },
    L: (p, c) => { M(c,p,0,0); Ln(c,p,0,1); Ln(c,p,1,1); },
    S: (p, c) => { M(c,p,1,.12); Q(c,p,1,0,.78,0); Ln(c,p,.24,0); Q(c,p,0,0,0,.25); Q(c,p,0,.5,.25,.5);
                   Ln(c,p,.75,.5); Q(c,p,1,.5,1,.75); Q(c,p,1,1,.76,1); Ln(c,p,.22,1); Q(c,p,0,1,0,.88); },
    N: (p, c) => { M(c,p,0,1); Ln(c,p,0,0); Ln(c,p,1,1); Ln(c,p,1,0); },
    G: (p, c) => { M(c,p,1,.14); Q(c,p,1,0,.78,0); Ln(c,p,.24,0); Q(c,p,0,0,0,.25); Ln(c,p,0,.75);
                   Q(c,p,0,1,.25,1); Ln(c,p,.75,1); Q(c,p,1,1,1,.75); Ln(c,p,1,.52); Ln(c,p,.52,.52); },
    D: (p, c) => { M(c,p,0,0); Ln(c,p,0,1); Ln(c,p,.62,1); Q(c,p,1,1,1,.62); Ln(c,p,1,.38); Q(c,p,1,0,.62,0); c.closePath(); },
    U: (p, c) => { M(c,p,0,0); Ln(c,p,0,.75); Q(c,p,0,1,.25,1); Ln(c,p,.75,1); Q(c,p,1,1,1,.75); Ln(c,p,1,0); },
    A: (p, c) => { M(c,p,0,1); Ln(c,p,0,.3); Q(c,p,0,0,.3,0); Ln(c,p,.7,0); Q(c,p,1,0,1,.3); Ln(c,p,1,1);
                   M(c,p,0,.56); Ln(c,p,1,.56); },
  };

  // value noise for chipped, stone-carved edges
  function noise(W, H, cell, seed) {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, g = new Float32Array(gw * gh);
    let s = seed; for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = x / cell, fy = y / cell, ix = fx | 0, iy = fy | 0, tx = ss(fx - ix), ty = ss(fy - iy);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      out[y * W + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
    return out;
  }
  let seedN = 1;
  // roughen a mask's edges: soften, perturb with noise, re-threshold
  function rough(m, scale, amt) {
    const W = curW, H = curH;
    const soft = boxBlur(m, W, H, Math.max(1, scale * .35));
    const n1 = noise(W, H, Math.max(2, scale), 97 * seedN++), n2 = noise(W, H, Math.max(2, scale * .35), 31 * seedN++);
    for (let i = 0; i < soft.length; i++) {
      const v = soft[i] + ((n1[i] - .5) * .7 + (n2[i] - .5) * .3) * amt;
      soft[i] = ss(Math.max(0, Math.min(1, (v - .38) / .24)));
    }
    return soft;
  }
  let curW = 0, curH = 0;

  function buildRelief() {
    const W = Math.min(1100, innerWidth), k = W / innerWidth, H = Math.round(innerHeight * k);
    curW = W; curH = H; seedN = 1;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const alpha = () => {
      const d = ctx.getImageData(0, 0, W, H).data, m = new Float32Array(W * H);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] / 255;
      return m;
    };
    const pack = (chs, fn) => {                // 4 channels, flipped (GL origin is bottom-left)
      const out = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, o = ((H - 1 - y) * W + x) * 4;
        for (let ch = 0; ch < 4; ch++) out[o + ch] = chs[ch] ? 255 * fn[ch](chs[ch][i]) : 0;
      }
      return out;
    };

    // ---- seals: English letters drawn in a seal-script manner (even strokes, squared
    // curves, stretched to fill their cells), with chipped, stone-carved edges ----
    const Sz = Math.min(H * .46, W * .5);                       // main seal size
    const cx = W / 2, top = H * .5 - Sz * .7;
    const seal1 = { x: cx - Sz / 2, y: top, w: Sz, h: Sz };
    const seal2 = { w: Sz * .8, h: Sz * .34 };
    seal2.x = cx - seal2.w / 2; seal2.y = top + Sz + Sz * .08;

    const blank = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); };
    const roundRect = (r, rad) => {
      ctx.beginPath();
      ctx.moveTo(r.x + rad, r.y); ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
      ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad); ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
      ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad); ctx.closePath();
    };
    function sealText(rows, r, stroke) {          // strokes of each row's letters, filling the box
      ctx.strokeStyle = '#fff'; ctx.lineWidth = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'square';
      const gap = stroke * 1.6, rh = (r.h - gap * (rows.length - 1)) / rows.length;
      rows.forEach((row, ri) => {
        const n = row.length, cw = (r.w - gap * (n - 1)) / n;
        [...row].forEach((ch, ci) => {
          const x0 = r.x + ci * (cw + gap) + stroke / 2, y0 = r.y + ri * (rh + gap) + stroke / 2;
          const sx = cw - stroke, sy = rh - stroke, ph = ri * 3.1 + ci * 1.7;
          // a slight hand-carved waver along each stroke
          const wav = (x, y) => [x0 + (x + .022 * Math.sin(y * 6.3 + ph)) * sx,
                                 y0 + (y + .022 * Math.sin(x * 5.7 + ph * 1.3)) * sy];
          ctx.beginPath();
          SEAL_GLYPHS[ch](wav, ctx);
          ctx.stroke();
        });
      });
    }
    const inset = (r, d) => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

    // main seal (letters carved into a solid block)
    blank(); ctx.fillStyle = '#fff'; roundRect(seal1, Sz * .025); ctx.fill();
    const block1 = rough(alpha(), Sz * .02, .3);
    blank(); sealText(['HER', 'TRIP', 'LETS'], inset(seal1, Sz * .09), Sz * .036);
    const carve1 = rough(alpha(), Sz * .01, .4);

    // name seal (raised letters and border, background cut away)
    const st2 = seal2.h * .065;
    blank(); ctx.fillStyle = '#fff'; roundRect(seal2, Sz * .015); ctx.fill();
    const block2 = rough(alpha(), Sz * .015, .3);
    blank(); ctx.strokeStyle = '#fff'; ctx.lineWidth = st2;
    roundRect(inset(seal2, st2 / 2), Sz * .012); ctx.stroke();
    sealText(['INGRID', 'HUANG'], inset(seal2, st2 * 2.6), st2 * .9);
    const raised2 = rough(alpha(), Sz * .007, .35);

    // height fields: R main seal, G name seal; B carved letters, A raised letters (for colouring)
    const c1 = boxBlur(carve1.slice(), W, H, Sz * .004), b1 = boxBlur(block1, W, H, Sz * .006);
    const r2 = boxBlur(raised2.slice(), W, H, Sz * .004), b2 = boxBlur(block2, W, H, Sz * .006);
    const h1 = new Float32Array(W * H), h2 = new Float32Array(W * H);
    for (let i = 0; i < h1.length; i++) {
      h1[i] = dome(b1[i], .2) * (1 - .8 * ss(Math.min(1, c1[i] * 1.2)));
      h2[i] = Math.max(.3 * dome(b2[i], .2), dome(r2[i], .2));
    }
    const id = m => Math.max(0, Math.min(1, m));
    upload(0, texTxt, W, H, pack([h1, h2, carve1, raised2], [id, id, id, id]));
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // figures, drawn from the same silhouettes as the SVGs, at their on-screen positions
    const narrow = [], wide = [];
    document.querySelectorAll('.figure svg').forEach(svg => {
      const r = svg.getBoundingClientRect();
      const sc = Math.min(r.width / 200, r.height / 520) * k;
      const ox = (r.left + r.width / 2) * k - 100 * sc, oy = (r.top + r.height / 2) * k - 260 * sc;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.setTransform(sc, 0, 0, sc, ox, oy);
      ctx.fillStyle = '#fff';
      ctx.fill(new Path2D(svg.querySelector('path').getAttribute('d')));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const m = alpha(), size = r.height * k;
      narrow.push(boxBlur(m.slice(), W, H, size * .018));
      wide.push(boxBlur(m, W, H, size * .06));
    });
    upload(1, texFig, W, H, pack([...narrow, null], [m => dome(m, .2), m => dome(m, .2), m => dome(m, .2)]));
    upload(2, texFigW, W, H, pack([...wide, null], [m => skirt(m, 2), m => skirt(m, 2), m => skirt(m, 2)]));
    dirty = true;
  }

  let dirty = true, last = '';
  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * scale);
    canvas.height = Math.floor(innerHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uDpr, scale);
    dirty = true;
  }
  resize();
  buildRelief();
  let rebuild;
  addEventListener('resize', () => { resize(); clearTimeout(rebuild); rebuild = setTimeout(buildRelief, 200); });

  // static sheet: only redraw when the relief changes (scrolling) or the window resizes
  (function frame() {
    const key = shared.rise.concat(shared.fig).map(x => x.toFixed(3)).join();
    if (dirty || key !== last) {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uRise, shared.rise[0], shared.rise[1]);
      gl.uniform3f(uFrise, shared.fig[0], shared.fig[1], shared.fig[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      last = key; dirty = false;
    }
    requestAnimationFrame(frame);
  })();
})();

/* ---------- scroll timeline ----------
   With WebGL: the words flatten back into the bronze while the figures press up out of it.
   Without WebGL (fallback): SVG title and figures rise from / sink into the page, where
   "depth" (0 = surface, 1 = deep) makes them smaller, fainter, blurrier and warped. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const ease = x => x * x * (3 - 2 * x);              // slow from the deep, gentle arrival
  const easeIn = x => x * x;
  const clamp = x => Math.max(0, Math.min(1, x));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // filter sizes are in each SVG's own units (title viewBox is 1000 wide, figures 200)
  const look = {
    title:    { freq: '0.004 0.012', disp: 70, blur: 9, bob: 8 },
    subtitle: { freq: '0.006 0.02',  disp: 40, blur: 6, bob: 8 },
    figure:   { freq: '0.012 0.03',  disp: 34, blur: 5, bob: 9 },
  };

  let n = 0;
  const items = [...document.querySelectorAll('.depth')].map(el => {
    const kind = el.dataset.kind, L = look[kind];
    const svg = el.ownerSVGElement;
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(SVGNS, 'defs'); svg.prepend(defs); }
    const id = 'uw' + (++n);
    const f = document.createElementNS(SVGNS, 'filter');
    f.setAttribute('id', id);
    for (const [k, v] of Object.entries({ x: '-40%', y: '-40%', width: '180%', height: '180%' })) f.setAttribute(k, v);
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML =
      `<feTurbulence type="fractalNoise" baseFrequency="${L.freq}" numOctaves="2" seed="${n * 7}" result="noise"/>` +
      `<feOffset in="noise" dx="0" dy="0" result="flow"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="flow" scale="0" xChannelSelector="R" yChannelSelector="G" result="warp"/>` +
      `<feGaussianBlur in="warp" stdDeviation="0"/>`;
    defs.appendChild(f);
    return {
      el, kind, L, id, filtered: false,
      start: +el.dataset.start || 0,
      offset: f.querySelector('feOffset'),
      warp: f.querySelector('feDisplacementMap'),
      blur: f.querySelector('feGaussianBlur'),
      phase: n * 1.7,
    };
  });
  // with WebGL the words are rendered in the water itself; the SVG title is only a fallback
  const titles = shared.hasGL ? [] : items.filter(i => i.kind !== 'figure');
  const figuresSVG = shared.hasGL ? [] : items.filter(i => i.kind === 'figure');
  const starts = [...document.querySelectorAll('.title-svg .depth')].map(el => +el.dataset.start || 0);

  function render(it, d, s) {
    const L = it.L, el = it.el;
    const t = s + it.phase;
    el.style.opacity = Math.pow(1 - d, 1.4);
    const scale = 1 - .65 * d;
    const sway = reduce ? 0 : Math.sin(t * .8) * 3 * d;                 // drifting while submerged
    const bob = reduce ? 0 : Math.sin(t * .75) * L.bob * (1 - d) * .5;  // gentle float at the surface
    el.style.transform = `translate(${sway}px, ${bob}px) scale(${scale})`;

    if (d < .002) {               // at the surface: crisp, no water in front of it
      if (it.filtered) { el.removeAttribute('filter'); it.filtered = false; }
      return;
    }
    if (!it.filtered) { el.setAttribute('filter', `url(#${it.id})`); it.filtered = true; }
    // the water above keeps moving, so the warp ripples continuously
    it.offset.setAttribute('dx', (Math.sin(t * .9) * 40).toFixed(1));
    it.offset.setAttribute('dy', (Math.cos(t * .7) * 30).toFixed(1));
    it.warp.setAttribute('scale', (L.disp * Math.pow(d, .8)).toFixed(1));
    it.blur.setAttribute('stdDeviation', (L.blur * d).toFixed(2));
  }

  // the intro clock starts once the page has fully loaded, so it always opens on pure water
  let loadedAt = Infinity;
  const markLoaded = () => { loadedAt = performance.now(); };
  if (document.readyState === 'complete') markLoaded(); else addEventListener('load', markLoaded);

  (function frame(now) {
    const s = now / 1000, ms = now - loadedAt;
    const max = document.documentElement.scrollHeight - innerHeight;
    const P = max > 0 ? clamp(scrollY / max) : 0;

    // 1–2) after a beat of pure water, the words float up from the deep
    // 3)   scrolling sinks the words back down while the figures float up
    const sink = easeIn(clamp(P / .45));
    // in bronze the words are already pressed into the sheet when the page opens
    starts.forEach((st, i) => { shared.rise[i] = 1 - sink; });
    titles.forEach(it => {
      const up = reduce ? 1 : ease(clamp((ms - it.start) / 5000));
      render(it, Math.max(1 - up, sink), s);
    });
    for (let i = 0; i < 3; i++) {
      const up = ease(clamp((P - .04 - i * .12) / .6));
      shared.fig[i] = up;
      if (figuresSVG[i]) render(figuresSVG[i], 1 - up, s);
    }
    requestAnimationFrame(frame);
  })(performance.now());
})();
