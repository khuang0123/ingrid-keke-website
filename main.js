/* ---------- water: fullscreen fragment shader ---------- */
(function () {
  const canvas = document.getElementById('water');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return; // CSS gradient fallback stays visible

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `
precision highp float;
uniform vec2 res; uniform float t; uniform vec2 mouse; uniform float scroll;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*f*(f*(f*6.-15.)+10.); // quintic: smooth normals
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}

// liquid surface height: big slow folds + a rippling rim along the screen edge
float height(vec2 s){
  float tt = t * .35;
  vec2 p = s + vec2(0., scroll * .35);
  vec2 q = p;
  q += .30 * vec2(sin(q.y*1.4 + tt*.9), cos(q.x*1.2 - tt*.7));
  q += .15 * vec2(noise(q*1.3 + tt*.3) - .5, noise(q*1.3 - tt*.3 + 4.) - .5) * 2.;

  float h = 0.;
  h += sin(q.x*1.7 + q.y*0.8 + tt) * .50;
  h += sin(q.y*2.2 - q.x*1.4 - tt*.8) * .35;
  h += sin(q.x*3.1 + q.y*2.6 + tt*1.3) * .12;
  h += (noise(q*1.1 + tt*.15) - .5) * 1.1;

  // mouse ripple
  vec2 m = (mouse - .5) * vec2(res.x/res.y, 1.);
  float d = length(s - m);
  h += sin(d*30. - t*3.) * exp(-d*6.) * .06;

  // folded rim hugging a rounded frame, like the edge of a liquid-metal pool
  vec2 hb = vec2(.5*res.x/res.y, .5);
  float e = sdRoundBox(s, hb - .035, .09);
  float wob = .5 + .5*sin(s.y*5. + s.x*3. + tt*1.1) * sin(s.x*4. - s.y*2. - tt*.7);
  h += exp(-abs(e + .012*sin(s.y*9. + tt*2.)) * 26.) * (.55 + .5*wob);
  h += smoothstep(-.02, .02, e) * .6;
  return h;
}

vec3 env(vec3 r){
  vec3 dark  = vec3(.07, .12, .15);
  vec3 light = vec3(.86, .95, .97);
  vec3 c = mix(dark, light, smoothstep(-.75, .75, r.y*.9 + r.x*.35));
  // soft-box highlights
  c += vec3(1.)            * pow(max(dot(r, normalize(vec3(-.55, .55, .62))), 0.), 36.) * 1.1;
  c += vec3(.85, .97, 1.)  * pow(max(dot(r, normalize(vec3( .65,-.35, .65))), 0.), 22.) * .55;
  c += vec3(.75, .92, 1.)  * pow(max(dot(r, normalize(vec3( .10, .80, .55))), 0.), 60.) * .6;
  // faint studio banding for the chrome feel
  c *= .88 + .12 * sin(r.x*8. + r.y*5.);
  return c;
}

void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 s = (gl_FragCoord.xy - .5*res) / res.y;

  float ep = 1.5 / res.y;
  float h  = height(s);
  float hx = height(s + vec2(ep, 0.)) - height(s - vec2(ep, 0.));
  float hy = height(s + vec2(0., ep)) - height(s - vec2(0., ep));
  vec3 n = normalize(vec3(-hx, -hy, 2.*ep / .13));

  vec3 r = reflect(vec3(0., 0., -1.), n);
  vec3 refl = env(r);

  // what lies beneath: a pale aqua body seen through the surface
  vec2 refr = uv + n.xy * .08;
  vec3 under = mix(vec3(.30, .48, .54), vec3(.62, .78, .80), refr.y);
  under = mix(under, vec3(.46, .52, .66), smoothstep(.2, 1., refr.x) * .25);
  float caust = pow(1. - abs(noise(refr*9. + t*.25) * 2. - 1.), 8.);
  under += vec3(.75, 1., 1.) * caust * .10;

  float slope = 1. - n.z;
  float F = clamp(.38 + 6. * slope, 0., 1.);  // flat = see-through, folds = mirror
  vec3 col = mix(under, refl, F);

  col *= vec3(.94, 1., 1.03);                 // cool watery tint
  col = mix(col, vec3(dot(col, vec3(.333))), .15); // keep it silvery
  col *= 1. - .25 * dot(uv - .5, uv - .5);

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
  const mouse = { x: .5, y: .5, tx: .5, ty: .5 };
  addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; });

  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 1.5) * .8; // keep it light
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
