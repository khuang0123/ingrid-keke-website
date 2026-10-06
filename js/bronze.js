/* ---------- landing: a static, draped bronze sheet with the seals pressed into it ----------
   Rendered once (and on resize) in a fragment shader: the seals are soft height fields
   shaded with the same metal as the sheet. */
(function () {
  const canvas = document.getElementById('bronze');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return drawFallback(canvas);

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `
precision highp float;
uniform vec2 res; uniform float dpr;
uniform sampler2D txt;   // r: main seal height  g: name seal height  b: carved strokes  a: raised strokes

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

float height(vec2 s){
  vec2 uv = s * vec2(res.y / res.x, 1.) + .5;
  float h = sheet(s);
  vec4 a = texture2D(txt, uv);
  // seals pressed up out of the sheet: carved letters in the main seal, raised in the name seal
  h += .022 * a.r + .016 * a.g;
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
  vec4 a = texture2D(txt, uv);
  float relief = clamp(a.r + a.g, 0., 1.);
  alb = mix(alb, gold, relief * .4);
  // carved strokes hold dark green patina; the name seal's cut-away ground does too
  float ground2 = smoothstep(.1, .25, a.g) * (1. - smoothstep(.4, .6, a.g));
  alb = mix(alb, vec3(.05, .075, .06), clamp(a.b * .8 + ground2 * .7, 0., 1.));
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
  const uRes = U('res'), uDpr = U('dpr');

  // ---- relief masks: draw the seals, blur them into soft height fields ----
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
  const texTxt = makeTex(0, 'txt');

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

    // ---- seals (see js/seal.js), with chipped, stone-carved edges ----
    const { seal1, seal2, Sz } = sealLayout(W, H);
    const blank = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); };
    ctx.fillStyle = ctx.strokeStyle = '#fff';

    // main seal (letters carved into a solid block)
    blank(); SealScript.roundRect(ctx, seal1, Sz * .025); ctx.fill();
    const block1 = rough(alpha(), Sz * .02, .3);
    blank(); SealScript.titleText(ctx, seal1);
    const carve1 = rough(alpha(), Sz * .01, .4);

    // name seal (raised letters and border, background cut away)
    const st2 = seal2.h * .065;
    blank(); SealScript.roundRect(ctx, seal2, Sz * .015); ctx.fill();
    const block2 = rough(alpha(), Sz * .015, .3);
    blank(); ctx.lineWidth = st2;
    SealScript.roundRect(ctx, SealScript.inset(seal2, st2 / 2), Sz * .012); ctx.stroke();
    SealScript.drawRows(ctx, SealScript.NAME, SealScript.inset(seal2, st2 * 2.6), st2 * .9);
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
  }

  function draw() {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * scale);
    canvas.height = Math.floor(innerHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uDpr, scale);
  }
  resize(); buildRelief(); draw();
  let rebuild;
  addEventListener('resize', () => { resize(); draw(); clearTimeout(rebuild); rebuild = setTimeout(() => { buildRelief(); draw(); }, 200); });
})();

// where the seals sit on the landing page (canvas px)
function sealLayout(W, H) {
  const Sz = Math.min(H * .46, W * .5);                       // main seal size
  const cx = W / 2, top = H * .5 - Sz * .7;
  const seal1 = { x: cx - Sz / 2, y: top, w: Sz, h: Sz };
  const seal2 = { w: Sz * .8, h: Sz * .34 };
  seal2.x = cx - seal2.w / 2; seal2.y = top + Sz + Sz * .08;
  return { seal1, seal2, Sz };
}

// no WebGL: flat bronze gradient (from CSS) with the seals drawn on top
function drawFallback(canvas) {
  const dpr = Math.min(devicePixelRatio || 1, 2), ctx = canvas.getContext('2d');
  const paint = () => {
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { seal1, seal2, Sz } = sealLayout(innerWidth, innerHeight);
    ctx.fillStyle = 'rgba(150, 110, 65, .55)';
    SealScript.roundRect(ctx, seal1, Sz * .025); ctx.fill();
    ctx.strokeStyle = '#1b231d'; SealScript.titleText(ctx, seal1);
    const st2 = seal2.h * .065;
    ctx.lineWidth = st2; SealScript.roundRect(ctx, SealScript.inset(seal2, st2 / 2), Sz * .012); ctx.stroke();
    ctx.strokeStyle = '#c9a46e';
    SealScript.drawRows(ctx, SealScript.NAME, SealScript.inset(seal2, st2 * 2.6), st2 * .9);
  };
  paint(); addEventListener('resize', paint);
}
