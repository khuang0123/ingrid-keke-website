/* ---------- origami pieces: kept in the 砚台, dragged onto a figure to see the fit ----------
   Each piece starts in the inkstone's well. Drag it anywhere (it stays where it is dropped);
   drop it on a figure and the folded piece shapes itself onto the body as the finished look,
   then its accessories appear. Drag the look off the figure to take the piece back.

   To add a piece: put its images in assets/pieces/<id>/ and add an entry below. Layer boxes
   are in figure units: the figure is 100 wide × 334 tall (head top 0, soles 334). They come
   from registering the fit drawing's croquis onto the template the page figures are traced
   from, so each layer sits exactly where it is in the drawing. */
const PIECES = [
  {
    id: '01',
    piece: 'assets/pieces/01/piece.webp',          // the origami piece as folded
    // the fitted look, exactly as in the fit drawing: the garment first, then the accessories
    fit: [
      { src: 'assets/pieces/01/dress.webp',    x: 7.11, y: 20.67, w: 70.44, h: 188.81 },
      { src: 'assets/pieces/01/hair.webp',     x: 32.93, y: -3.5, w: 29.34, h: 22.93 },
      { src: 'assets/pieces/01/bracelet.webp', x: 86.03, y: 112.6, w: 7.44, h: 20.25 },
      { src: 'assets/pieces/01/shoes.webp',    x: 40.37, y: 257.0, w: 19.22, h: 83.26 },
    ],
  },
  {
    id: '02',
    piece: 'assets/pieces/02/piece.webp',
    fit: [
      { src: 'assets/pieces/02/dress.webp',    x: -56.15, y: 44.58, w: 139.86, h: 247.81 },
      { src: 'assets/pieces/02/hair.webp',     x: 36.14, y: -2.58, w: 26.63, h: 35.37 },
      { src: 'assets/pieces/02/shoes.webp',    x: 43.26, y: 280.8, w: 13.82, h: 57.53 },
    ],
  },
  {
    id: '03',
    piece: 'assets/pieces/03/piece.webp',
    fit: [
      { src: 'assets/pieces/03/dress.webp',    x: -6.16, y: 47.47, w: 94.54, h: 241.7 },
      { src: 'assets/pieces/03/hair.webp',     x: 35.74, y: -0.51, w: 28.75, h: 32.39 },
      { src: 'assets/pieces/03/shoes.webp',    x: 38.17, y: 288.16, w: 23.89, h: 53.65 },
    ],
  },
];

(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dragLayer = document.createElement('div');
  dragLayer.className = 'drag-layer';
  document.body.appendChild(dragLayer);

  const img = (src, cls) => { const i = new Image(); i.src = src; i.className = cls; i.draggable = false; i.alt = ''; return i; };

  // state per piece: where = 'stone' | 'paper' (u, v: fraction of the paper) | 'fit' (fig index)
  const items = PIECES.map(p => {
    const el = img(p.piece, 'piece');
    el.setAttribute('aria-label', 'Origami piece ' + p.id + ' — drag onto a figure');
    return { p, el, where: 'stone', look: null };
  });

  // ---- layout ----
  const S = () => window.PaperScene;
  // pieces lie stacked in the well, each at full size, a little askew like a loose pile
  const PILE = [[0, 0, 0], [-7, 9, -4], [8, -6, 3.5], [-4, -10, -2], [6, 12, 2.5]];
  function pieceSize(it) {
    const w = S().well, ar = it.el.naturalWidth / it.el.naturalHeight || .38;
    let h = w.h * .9, wd = h * ar;
    if (wd > w.w * .9) { wd = w.w * .9; h = wd / ar; }
    return { w: wd, h };
  }
  function stoneSlot(it, i) {
    const w = S().well, { w: wd, h } = pieceSize(it), [dx, dy, rot] = PILE[i % PILE.length];
    return { x: w.x + (w.w - wd) / 2 + dx, y: w.y + (w.h - h) / 2 + dy, w: wd, h, rot };
  }
  const setBox = (el, r) => Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  function figureFrame(f) {                          // the figure's 100 × 334 unit box, in .paper px
    const u = f.h / 334;
    return { x: f.cx - 50 * u, y: f.top, w: 100 * u, h: f.h, u };
  }

  function layout() {
    if (!S()) return;
    const inStone = items.filter(it => it.where === 'stone');
    items.forEach(it => {
      if (it.where === 'stone') {
        const i = inStone.indexOf(it), r = stoneSlot(it, i);
        S().stone.appendChild(it.el); setBox(it.el, r);
        it.el.style.transform = `rotate(${r.rot}deg)`;
        it.el.style.zIndex = inStone.length - i;               // the first piece lies on top
      } else if (it.where === 'paper') {
        const pr = S().paper.getBoundingClientRect(), r = pieceSize(it);
        S().paper.appendChild(it.el);
        it.el.style.transform = it.el.style.zIndex = '';
        setBox(it.el, { x: it.u * pr.width - r.w / 2, y: it.v * pr.height - r.h / 2, w: r.w, h: r.h });
      } else if (it.look) {
        setBox(it.look, figureFrame(S().figures[it.fig]));
      }
    });
  }

  // ---- the fitted look ----
  function buildLook(it, fig) {
    const look = document.createElement('div');
    look.className = 'look';
    look.setAttribute('aria-label', 'Fitted look ' + it.p.id + ' — drag to take it off');
    it.p.fit.forEach((L, k) => {
      const e = img(L.src, k === 0 ? 'layer garment' : 'layer accessory');
      Object.assign(e.style, {
        left: L.x + '%', top: (L.y / 334 * 100) + '%', width: L.w + '%', height: (L.h / 334 * 100) + '%',
      });
      look.appendChild(e);
    });
    setBox(look, figureFrame(S().figures[fig]));
    S().paper.appendChild(look);
    look.querySelectorAll('.layer').forEach(l => l.addEventListener('pointerdown', e => takeOff(it, e)));
    return look;
  }

  function fitOnto(it, fig, from) {
    // anyone already wearing a look on this figure goes back to the inkstone
    items.forEach(o => { if (o !== it && o.where === 'fit' && o.fig === fig) { removeLook(o, false); o.where = 'stone'; } });
    it.where = 'fit'; it.fig = fig;
    S().figures[fig].el.classList.add('dressed');
    const look = it.look = buildLook(it, fig);
    const [garment, ...acc] = look.children;
    const target = garment.getBoundingClientRect();
    layout();
    if (reduce) { it.el.remove(); return; }

    // the folded piece shapes itself onto the body …
    const fly = it.el; dragLayer.appendChild(fly);
    setBox(fly, from);
    garment.style.opacity = 0; acc.forEach(a => (a.style.opacity = 0));
    const dur = 900, easing = 'cubic-bezier(.3, .1, .2, 1)';
    fly.animate([
      { left: from.x + 'px', top: from.y + 'px', width: from.w + 'px', height: from.h + 'px', transform: 'rotate(0deg)', opacity: 1 },
      { transform: 'rotate(-4deg) scale(1.04)', opacity: 1, offset: .45 },
      { left: target.left + 'px', top: target.top + 'px', width: target.width + 'px', height: target.height + 'px', transform: 'rotate(0deg)', opacity: 0 },
    ], { duration: dur, easing }).finished.then(() => fly.remove());
    garment.animate([{ opacity: 0, filter: 'blur(3px)' }, { opacity: 0, offset: .35 }, { opacity: 1, filter: 'blur(0)' }],
      { duration: dur, easing }).finished.then(() => (garment.style.opacity = ''));
    // … then its accessories appear, one after another, like ink settling into the paper
    acc.forEach((a, k) => a.animate(
      [{ opacity: 0, filter: 'blur(6px)', transform: a.style.transform + ' scale(.85)' },
       { opacity: 1, filter: 'blur(0)', transform: a.style.transform }],
      { duration: 650, delay: dur * .8 + k * 220, easing: 'ease-out', fill: 'backwards' }
    ).finished.then(() => (a.style.opacity = '')));
  }

  function removeLook(it, animate = true) {
    const look = it.look; it.look = null;
    if (!look) return;
    if (it.fig != null && !items.some(o => o !== it && o.look && o.fig === it.fig))
      S().figures[it.fig].el.classList.remove('dressed');
    if (!animate || reduce) return look.remove();
    look.style.pointerEvents = 'none';
    look.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => look.remove());
  }

  // ---- dragging ----
  let drag = null;
  function startDrag(it, e, rect) {
    e.preventDefault();
    dragLayer.appendChild(it.el);
    it.el.style.transform = it.el.style.zIndex = '';
    setBox(it.el, { x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    it.el.classList.add('lifted');
    drag = { it, dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, h: rect.height, id: e.pointerId };
  }
  items.forEach(it => it.el.addEventListener('pointerdown', e => {
    if (e.button && e.button !== 0) return;
    // lift it at its own (unrotated) size, centred where it lies
    const b = it.el.getBoundingClientRect(), w = it.el.offsetWidth, h = it.el.offsetHeight;
    startDrag(it, e, { left: b.left + (b.width - w) / 2, top: b.top + (b.height - h) / 2, width: w, height: h });
  }));

  function takeOff(it, e) {                          // pick the look back up as the folded piece
    if (e.button && e.button !== 0) return;
    const r = pieceSize(it);
    removeLook(it);
    it.where = 'paper';
    startDrag(it, e, { left: e.clientX - r.w / 2, top: e.clientY - r.h * .35, width: r.w, height: r.h });
  }

  addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.it.el.style.left = (e.clientX - drag.dx) + 'px';
    drag.it.el.style.top = (e.clientY - drag.dy) + 'px';
    const f = figureAt(e.clientX, e.clientY);
    document.querySelectorAll('.figure-hint').forEach(h => h.remove());
    if (f >= 0) hint(f);
  });

  function figureAt(x, y) {
    const pr = S().paper.getBoundingClientRect();
    let best = -1, bd = Infinity;
    S().figures.forEach((f, i) => {
      const fr = figureFrame(f), cx = pr.left + f.cx, top = pr.top + fr.y;
      const dx = Math.abs(x - cx), inside = dx < fr.w * .38 && y > top - fr.h * .05 && y < top + fr.h * 1.02;
      if (inside && dx < bd) { bd = dx; best = i; }
    });
    return best;
  }
  function hint(i) {                                 // a faint glow behind the figure under the piece
    const h = document.createElement('div');
    h.className = 'figure-hint';
    setBox(h, figureFrame(S().figures[i]));
    S().paper.querySelector('canvas').after(h);      // beneath the figures
  }

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { it } = drag; drag = null;
    it.el.classList.remove('lifted');
    document.querySelectorAll('.figure-hint').forEach(h => h.remove());
    const r = it.el.getBoundingClientRect(), from = { x: r.left, y: r.top, w: r.width, h: r.height };
    const fig = figureAt(e.clientX, e.clientY);
    const sr = S().stone.getBoundingClientRect(), w = S().well;
    const overWell = e.clientX > sr.left + w.x && e.clientX < sr.left + w.x + w.w && e.clientY > sr.top + w.y && e.clientY < sr.top + w.y + w.h;
    if (fig >= 0) return fitOnto(it, fig, from);
    if (overWell) { it.where = 'stone'; return layout(); }
    const pr = S().paper.getBoundingClientRect();            // anywhere else: it stays where it was dropped
    it.where = 'paper';
    it.u = (r.left + r.width / 2 - pr.left) / pr.width; it.v = (r.top + r.height / 2 - pr.top) / pr.height;
    layout();
  }
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);

  addEventListener('paperscene', layout);
  items.forEach(it => it.el.addEventListener('load', layout, { once: true }));
  layout();
})();
