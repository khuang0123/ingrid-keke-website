/* ---------- water: fullscreen fragment shader ---------- */
(function () {
  const canvas = document.getElementById('water');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return; // CSS gradient fallback stays visible

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `
precision highp float;
uniform vec2 res; uniform float t; uniform vec2 mouse;

float sabs(float x, float k){ return sqrt(x*x + k); } // smooth |x|: sharp but clean creases

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

void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 s = (gl_FragCoord.xy - .5*res) / res.y;

  float ep = 1. / res.y;
  float hx = height(s + vec2(ep, 0.)) - height(s - vec2(ep, 0.));
  float hy = height(s + vec2(0., ep)) - height(s - vec2(0., ep));
  vec3 n = normalize(vec3(-hx, -hy, 2.*ep / .55));

  vec3 refl = env(reflect(vec3(0., 0., -1.), n));

  // clear aqua water beneath, glimpsed through the flatter parts
  vec2 refr = uv + n.xy * .1;
  vec3 under = mix(vec3(.40, .62, .66), vec3(.82, .94, .95), refr.y);

  float slope = 1. - n.z;
  float F = clamp(.62 + 3. * slope, 0., 1.);  // gentle sheen, more see-through water
  vec3 col = mix(under, refl, F);

  col *= vec3(.94, 1., 1.04);                 // cool watery tint
  col = col / (1. + col * .35) * 1.3;         // soften blown-out highlights
  // calm the brightest glare behind the centred title so the text stays legible
  float centre = exp(-dot(s * vec2(.9, 2.2), s * vec2(.9, 2.2)) * 3.);
  col = mix(col, min(col, vec3(.66, .76, .80)), centre * .7);
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
  const uRes = U('res'), uT = U('t'), uMouse = U('mouse');
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
  const titles = items.filter(i => i.kind !== 'figure');
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
