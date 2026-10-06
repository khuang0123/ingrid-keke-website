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
  f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= .5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - .5*res) / res.y;
  p.y += scroll * .25;

  float tt = t * .12;
  // domain-warped flow
  vec2 q = vec2(fbm(p*1.6 + tt), fbm(p*1.6 - tt + 3.));
  vec2 r = vec2(fbm(p*2.4 + 2.*q + vec2(1.7, 9.2) + tt*1.3),
                fbm(p*2.4 + 2.*q + vec2(8.3, 2.8) - tt*1.1));
  float f = fbm(p*1.8 + 2.4*r);

  // mouse ripple
  vec2 m = (mouse - .5) * vec2(res.x/res.y, 1.);
  float d = length(p - m);
  float ripple = sin(d*38. - t*3.) * exp(-d*5.) * .035;
  f += ripple;

  // caustic ridges
  float c = 1. - abs(fbm(p*5. + r*2. + tt*2.) * 2. - 1.);
  c = pow(c, 6.);

  vec3 deep   = vec3(.01, .09, .17);
  vec3 teal   = vec3(.00, .45, .55);
  vec3 cyan   = vec3(.35, .92, .95);
  vec3 violet = vec3(.42, .30, .85);

  vec3 col = mix(deep, teal, smoothstep(.2, .7, f));
  col = mix(col, violet, smoothstep(.45, .95, r.x) * .45);
  col += cyan * c * .22;
  col += cyan * smoothstep(.62, .9, f) * .12;

  // soft depth gradient + vignette
  col *= mix(.75, 1.1, uv.y);
  col *= 1. - .45 * dot(uv - .5, uv - .5) * 2.;

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
    const scale = Math.min(devicePixelRatio || 1, 1.25) * .75; // keep it light
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
