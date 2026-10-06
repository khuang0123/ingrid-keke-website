/* ---------- water: fullscreen fragment shader ---------- */
(function () {
  const canvas = document.getElementById('water');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return; // CSS gradient fallback stays visible

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `
precision highp float;
uniform vec2 res; uniform float t; uniform vec2 mouse; uniform float scroll;

float sabs(float x, float k){ return sqrt(x*x + k); } // smooth |x|: sharp but clean creases

// liquid surface: iteratively warped flow gives long curving folds like poured silk/metal
float height(vec2 s){
  float tt = t * .18;
  vec2 p = (s + vec2(0., scroll * .35)) * 1.3;
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

  // rippling rim along a rounded (superellipse) frame — smooth, no corner seams
  vec2 hb = vec2(.5*res.x/res.y, .5) - .025;
  vec2 a = abs(s) / hb;
  float e = (pow(pow(a.x, 8.) + pow(a.y, 8.), 1./8.) - 1.) * .5;
  e += .005 * sin(s.y*8. + tt*2.) + .005 * sin(s.x*7. - tt*1.6);
  h += .07 * exp(-sabs(e, .00003) * 70.);
  return h;
}

vec3 env(vec3 r){
  vec3 dark  = vec3(.16, .22, .26);
  vec3 mid   = vec3(.48, .58, .62);
  vec3 light = vec3(.80, .89, .92);
  float g = r.y*.85 + r.x*.4;
  vec3 c = mix(dark, mid, smoothstep(-.8, -.05, g));
  c = mix(c, light, smoothstep(.05, .7, g));
  // crisp soft-box highlights
  c += vec3(1.)           * smoothstep(.90, .94, dot(r, normalize(vec3(-.55, .55, .62))));
  c += vec3(.86, .97, 1.) * smoothstep(.92, .955, dot(r, normalize(vec3( .65,-.35, .65)))) * .8;
  c += vec3(.90, .98, 1.) * exp(-abs(r.y - .30) * 60.) * .8;   // thin horizon line
  // dark streaks that trace the flow
  c *= 1. - .80 * exp(-abs(r.x + .26) * 22.);
  c *= 1. - .60 * exp(-abs(r.y + .28) * 22.);
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
  float F = clamp(.78 + 3. * slope, 0., 1.);  // mostly liquid mirror, a little see-through
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
  const uRes = U('res'), uT = U('t'), uMouse = U('mouse'), uScroll = U('scroll');
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
    gl.uniform1f(uScroll, scrollY / innerHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  })();
})();

/* ---------- hero text: emerge after 1s ---------- */
setTimeout(() => {
  document.querySelectorAll('.line').forEach(el => el.classList.add('go'));
}, 1000);

/* ---------- figures: emerge as user scrolls ---------- */
(function () {
  const section = document.getElementById('figures');
  const figs = [...section.querySelectorAll('.figure')];
  const ease = x => 1 - Math.pow(1 - x, 3);
  const clamp = x => Math.max(0, Math.min(1, x));

  function update() {
    const rect = section.getBoundingClientRect();
    // progress 0 when section top is at 85% of viewport, 1 once ~55% of the section has scrolled by
    const start = innerHeight * .85;
    const span = innerHeight * 1.35;
    const prog = clamp((start - rect.top) / span);

    figs.forEach(fig => {
      const delay = parseFloat(fig.dataset.delay) || 0;
      const p = clamp((prog - delay * .6) / .5);
      const e = ease(p);
      fig.style.opacity = e;
      fig.style.transform = `translateY(${(1 - e) * 70}vh)`;
      fig.style.filter = `blur(${(1 - e) * 24}px)`;
      fig.firstElementChild.classList.toggle('on', p >= 1);
    });
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
