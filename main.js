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
  // letters pressed up out of the sheet, the metal stretched smoothly around them
  h += rise.x * (.024 * a.r + .008 * a.b) + rise.y * (.008 * b.g + .003 * b.a);
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

  // gothic title font; try others with ?font=grenze or ?font=pirata
  const gothic = GOTHIC_FONTS[new URLSearchParams(location.search).get('font')] || GOTHIC_FONTS.unifraktur;

  function buildRelief() {
    const W = Math.min(1100, innerWidth), k = W / innerWidth, H = Math.round(innerHeight * k);
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

    // words, laid out like the SVG title
    const box = Math.min(innerWidth * .92, 1100) * k;
    const top = (H - box * .32) / 2;
    function text(str, size, g, spacing, baseline) {
      ctx.clearRect(0, 0, W, H);
      ctx.font = `${g.weight} ${size}px "${g.family}", "Helvetica Neue", Helvetica, Arial, serif`;
      ctx.fillStyle = '#fff';
      const ws = [...str].map(ch => ctx.measureText(ch).width);
      let x = (W - (ws.reduce((p, q) => p + q, 0) + spacing * (str.length - 1))) / 2;
      [...str].forEach((ch, i) => { ctx.fillText(ch, x, baseline); x += ws[i] + spacing; });
      return alpha();
    }
    const tSize = box * .17, sSize = box * .05;
    const t1 = text('Her Triplets', tSize, gothic, box * .006, top + box * .175);
    // subtitle in the most legible gothic so it reads clearly at a small size
    const s1 = text('by Ingrid Huang', sSize, GOTHIC_FONTS.grenze, box * .012, top + box * .268);
    const tA = boxBlur(t1.slice(), W, H, tSize * .025), tB = boxBlur(t1, W, H, tSize * .12);
    const sA = boxBlur(s1.slice(), W, H, sSize * .045), sB = boxBlur(s1, W, H, sSize * .4);
    upload(0, texTxt, W, H, pack([tA, sA, tB, sB],
      [m => dome(m, .3), m => dome(m, .25), m => skirt(m, 2.2), m => skirt(m, 3.5)]));

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
  // rebuild once the gothic fonts are ready
  Promise.all([...new Set([gothic, GOTHIC_FONTS.grenze])].map(g =>
    new FontFace(g.family, `url(${g.src})`, { weight: String(g.weight) }).load().then(f => document.fonts.add(f))))
    .then(buildRelief, buildRelief);

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
