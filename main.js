// shared between the water renderer and the scroll/intro timeline
const shared = { hasGL: false, rise: [0, 0] }; // rise: 0 = deep underwater, 1 = surfaced

/* ---------- water: fullscreen fragment shader ---------- */
(function () {
  const canvas = document.getElementById('water');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return; // CSS gradient fallback stays visible

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `
precision highp float;
uniform vec2 res; uniform float t; uniform vec2 mouse;
uniform sampler2D txt;  // r: title  g: subtitle  b/a: wide blurs of each (ripples, deep blur)
uniform vec2 rise;      // title, subtitle: 0 = deep, 1 = surfaced

float sabs(float x, float k){ return sqrt(x*x + k); } // smooth |x|: sharp but clean creases

// The words are part of the liquid itself: a soft height field (blurred letter
// masks) that grows out of the surface as they rise. Below the surface they are
// only glimpsed through the water, smaller and warped.
vec2 lay(vec2 uv, float r, float ph){
  uv.y -= sin(t * .75 + ph) * .004 * smoothstep(.8, 1., r);        // gentle float once surfaced
  return .5 + (uv - .5) / (.35 + .65 * r);                          // smaller when deeper
}
float emerge(float r){ return smoothstep(.62, 1., r); }             // how far it stands out of the water

// liquid surface: iteratively warped flow gives long curving folds like poured silk/metal
float height(vec2 s){
  float tt = t * .18;
  vec2 p = s * 1.3;
  for (int i = 1; i < 7; i++) {
    float fi = float(i);
    p.x += .55 / fi * sin(fi * p.y * .9 + tt + .3 * fi) + .25;
    p.y += .45 / fi * cos(fi * p.x * .8 + tt * 1.1 + .5 * fi) - .15;
  }
  float h = .5 * (sin(p.x * .9) + cos(p.y * .8)) + .14 * sin(p.x * 2.1 + p.y * 1.3);

  // mouse ripple
  vec2 m = (mouse - .5) * vec2(res.x/res.y, 1.);
  float d = length(s - m);
  h += sin(d*40. - t*3.) * exp(-d*9.) * .012;

  // letters pushing up through the surface, with rings spreading as they break through
  vec2 uv = s * vec2(res.y / res.x, 1.) + .5;
  vec4 a = texture2D(txt, lay(uv, rise.x, 0.));
  vec4 b = texture2D(txt, lay(uv, rise.y, 1.3));
  float e1 = emerge(rise.x), e2 = emerge(rise.y);
  h += e1 * .034 * a.r + e2 * .010 * b.g;
  // water clinging to the letters (meniscus): a smooth concave skirt that rises with them
  // and is dragged up highest while they break through, then relaxes
  float pull1 = e1 * .006 + 4. * e1 * (1. - e1) * .013;
  float pull2 = e2 * .002 + 4. * e2 * (1. - e2) * .004;
  h += pull1 * a.b + pull2 * b.a;
  return h;
}

vec3 env(vec3 r){
  vec3 dark  = vec3(.30, .38, .42);
  vec3 mid   = vec3(.54, .63, .66);
  vec3 light = vec3(.76, .84, .87);
  float g = r.y*.85 + r.x*.4;
  vec3 c = mix(dark, mid, smoothstep(-.8, -.05, g));
  c = mix(c, light, smoothstep(.05, .7, g));
  // crisp soft-box highlights
  c += vec3(.95, 1., 1.)  * .45 * smoothstep(.90, .94, dot(r, normalize(vec3(-.55, .55, .62))));
  c += vec3(.86, .97, 1.) * smoothstep(.92, .955, dot(r, normalize(vec3( .65,-.35, .65)))) * .35;
  c += vec3(.90, .98, 1.) * exp(-abs(r.y - .30) * 60.) * .35;   // thin horizon line
  // dark streaks that trace the flow
  c *= 1. - .35 * exp(-abs(r.x + .26) * 22.);
  c *= 1. - .25 * exp(-abs(r.y + .28) * 22.);
  return c;
}

// higher-contrast chrome for the risen letters, like polished liquid metal
vec3 chrome(vec3 r){
  float g = r.y*.85 + r.x*.4;
  vec3 c = mix(vec3(.06, .09, .11), vec3(.50, .60, .64), smoothstep(-.8, -.05, g));
  c = mix(c, vec3(.95, 1., 1.), smoothstep(.05, .7, g));
  c += vec3(1.)           * smoothstep(.88, .93, dot(r, normalize(vec3(-.55, .55, .62))));
  c += vec3(.86, .97, 1.) * smoothstep(.90, .95, dot(r, normalize(vec3( .65,-.35, .65)))) * .8;
  c += vec3(.90, .98, 1.) * exp(-abs(r.y - .30) * 50.) * .8;
  c *= 1. - .7 * exp(-abs(r.x + .26) * 18.);
  return c;
}

void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 s = (gl_FragCoord.xy - .5*res) / res.y;

  float ep = 1. / res.y;
  float hx = height(s + vec2(ep, 0.)) - height(s - vec2(ep, 0.));
  float hy = height(s + vec2(0., ep)) - height(s - vec2(0., ep));
  vec3 n = normalize(vec3(-hx, -hy, 2.*ep / .55));

  vec3 rv = reflect(vec3(0., 0., -1.), n);
  vec3 refl = env(rv);

  // clear aqua water beneath, glimpsed through the flatter parts
  vec2 refr = uv + n.xy * .1;
  vec3 under = mix(vec3(.40, .62, .66), vec3(.82, .94, .95), refr.y);

  float slope = 1. - n.z;
  float F = clamp(.62 + 3. * slope, 0., 1.);  // gentle sheen, more see-through water
  vec3 col = mix(under, refl, F);

  // submerged letters, seen through (and warped by) the moving water; blurrier when deeper
  // (warped by a water wobble only, not the surface normal, so the letters' own slopes
  //  never shift a ghost copy of them)
  vec2 wob = vec2(sin(uv.y * 26. + uv.x * 9. + t * 1.9), cos(uv.x * 21. - uv.y * 7. - t * 1.5)) * .005;
  float e1 = emerge(rise.x), e2 = emerge(rise.y);
  vec4 a = texture2D(txt, lay(uv + wob * (.4 + 2. * (1. - rise.x)), rise.x, 0.));
  vec4 b = texture2D(txt, lay(uv + wob * (.4 + 2. * (1. - rise.y)), rise.y, 1.3));
  float sub = mix(a.b * 1.6, a.r, rise.x) * smoothstep(.0, .55, rise.x) * (1. - e1)
            + mix(b.a * 1.6, b.g, rise.y) * smoothstep(.0, .55, rise.y) * (1. - e2);
  col = mix(col, vec3(.86, .94, .96), clamp(sub, 0., 1.) * .55);

  // risen letters: solid polished liquid metal
  // water film grades smoothly into metal up the sides of the letters
  float lm = clamp(e1 * smoothstep(.1, .7, texture2D(txt, lay(uv, rise.x, 0.)).r)
                 + e2 * smoothstep(.1, .7, texture2D(txt, lay(uv, rise.y, 1.3)).g), 0., 1.);
  col = mix(col, chrome(rv), lm);

  col *= vec3(.94, 1., 1.04);                 // cool watery tint
  col = col / (1. + col * .35) * 1.3;         // soften blown-out highlights
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
  const uRes = U('res'), uT = U('t'), uMouse = U('mouse'), uRise = U('rise');
  shared.hasGL = true;
  document.documentElement.classList.add('gl');

  // ---- letter masks: draw the words, blur them into soft height fields ----
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
                        [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
    gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.uniform1i(U('txt'), 0);

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

  // gothic title font; try others with ?font=grenze or ?font=pirata
  const gothic = GOTHIC_FONTS[new URLSearchParams(location.search).get('font')] || GOTHIC_FONTS.unifraktur;

  function buildLetters() {
    const W = Math.min(1100, innerWidth), k = W / innerWidth, H = Math.round(innerHeight * k);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const box = Math.min(innerWidth * .92, 1100) * k;          // same layout as the SVG title
    const top = (H - box * .32) / 2;
    const font = `"${gothic.family}", "Helvetica Neue", Helvetica, Arial, serif`;
    function mask(text, size, weight, spacing, baseline, fam = font) {
      ctx.clearRect(0, 0, W, H);
      ctx.font = `${weight} ${size}px ${fam}`;
      ctx.fillStyle = '#fff';
      const ws = [...text].map(ch => ctx.measureText(ch).width);
      let x = (W - (ws.reduce((p, q) => p + q, 0) + spacing * (text.length - 1))) / 2;
      [...text].forEach((ch, i) => { ctx.fillText(ch, x, baseline); x += ws[i] + spacing; });
      const d = ctx.getImageData(0, 0, W, H).data, m = new Float32Array(W * H);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] / 255;
      return m;
    }
    const tSize = box * .17, sSize = box * .05;
    const t1 = mask('Her Triplets', tSize, gothic.weight, box * .006, top + box * .175);
    // subtitle in the most legible gothic so it reads clearly at a small size
    const sub = GOTHIC_FONTS.grenze;
    const s1 = mask('by Ingrid Huang', sSize, sub.weight, box * .012, top + box * .268, `"${sub.family}", serif`);
    const tA = boxBlur(t1.slice(), W, H, tSize * .025), tB = boxBlur(t1, W, H, tSize * .12);
    const sA = boxBlur(s1.slice(), W, H, sSize * .045),  sB = boxBlur(s1, W, H, sSize * .4);
    const out = new Uint8Array(W * H * 4);
    // store the rounded letter profile itself, so 8-bit steps aren't amplified in the shader
    const ss = x => x * x * (3 - 2 * x);
    const dome = (m, lo) => Math.sqrt(ss(Math.max(0, Math.min(1, (m - lo) / (1 - lo)))));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, o = ((H - 1 - y) * W + x) * 4;        // flip: GL origin is bottom-left
      out[o] = 255 * dome(tA[i], .3);
      out[o + 1] = 255 * dome(sA[i], .25);
      // concave meniscus skirt, shaped here (before 8-bit storage) to keep it smooth
      const sk = (m, g) => { const v = ss(Math.min(1, m * g)); return 255 * v * v; };
      out[o + 2] = sk(tB[i], 2.2);
      out[o + 3] = sk(sB[i], 3.5);
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
  }
  buildLetters();
  // rebuild once the gothic font is ready
  Promise.all([...new Set([gothic, GOTHIC_FONTS.grenze])].map(g =>
    new FontFace(g.family, `url(${g.src})`, { weight: String(g.weight) }).load().then(f => document.fonts.add(f))))
    .then(buildLetters, buildLetters);
  let rebuild;
  addEventListener('resize', () => { clearTimeout(rebuild); rebuild = setTimeout(buildLetters, 200); });
  const mouse = { x: -9, y: -9, tx: -9, ty: -9 }; // off-screen until the pointer moves
  addEventListener('pointermove', e => {
    if (mouse.x < -1) { mouse.x = e.clientX / innerWidth; mouse.y = 1 - e.clientY / innerHeight; }
    mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; });

  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 2); // full resolution for crisp highlights
    canvas.width = Math.floor(innerWidth * scale);
    canvas.height = Math.floor(innerHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  addEventListener('resize', resize); resize();

  const t0 = performance.now();
  (function frame() {
    mouse.x += (mouse.tx - mouse.x) * .06;
    mouse.y += (mouse.ty - mouse.y) * .06;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, (performance.now() - t0) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform2f(uRise, shared.rise[0], shared.rise[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  })();
})();

/* ---------- rising from / sinking into the water ----------
   Every element stays in place on screen. "Depth" (0 = at the surface, 1 = deep)
   controls how it looks: deeper means smaller, fainter, blurrier and more warped
   by the moving water above it. */
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
  const starts = [...document.querySelectorAll('.title-svg .depth')].map(el => +el.dataset.start || 0);
  const figures = items.filter(i => i.kind === 'figure');

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
    starts.forEach((st, i) => {
      const up = reduce ? 1 : ease(clamp((ms - st) / 5000));
      shared.rise[i] = 1 - Math.max(1 - up, sink);
    });
    titles.forEach(it => {
      const up = reduce ? 1 : ease(clamp((ms - it.start) / 5000));
      render(it, Math.max(1 - up, sink), s);
    });
    figures.forEach((it, i) => {
      const up = ease(clamp((P - .04 - i * .12) / .6));
      render(it, 1 - up, s);
    });
    requestAnimationFrame(frame);
  })(performance.now());
})();
