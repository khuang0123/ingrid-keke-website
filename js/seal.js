/* Seal-script style Latin capitals, shared by the bronze seals and the paperweight.
   Glyphs are centre-lines in a unit cell (y down); curves are squared corners, like
   carved seal script. */
const SealScript = (() => {
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

  // Draw rows of letters as strokes, each letter stretched to fill its cell, with a
  // slight hand-carved waver. Caller sets strokeStyle; dx/dy offset the whole set.
  function drawRows(ctx, rows, r, stroke, dx = 0, dy = 0) {
    ctx.lineWidth = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'square';
    const gap = stroke * 1.6, rh = (r.h - gap * (rows.length - 1)) / rows.length;
    rows.forEach((row, ri) => {
      const n = row.length, cw = (r.w - gap * (n - 1)) / n;
      [...row].forEach((ch, ci) => {
        const x0 = r.x + ci * (cw + gap) + stroke / 2 + dx, y0 = r.y + ri * (rh + gap) + stroke / 2 + dy;
        const sx = cw - stroke, sy = rh - stroke, ph = ri * 3.1 + ci * 1.7;
        const wav = (x, y) => [x0 + (x + .022 * Math.sin(y * 6.3 + ph)) * sx,
                               y0 + (y + .022 * Math.sin(x * 5.7 + ph * 1.3)) * sy];
        ctx.beginPath();
        SEAL_GLYPHS[ch](wav, ctx);
        ctx.stroke();
      });
    });
  }

  function roundRect(ctx, r, rad) {
    ctx.beginPath();
    ctx.moveTo(r.x + rad, r.y); ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
    ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad); ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
    ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad); ctx.closePath();
  }
  const inset = (r, d) => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

  // the main seal's text and proportions, as used on the landing page
  const TITLE = ['HER', 'TRIP', 'LETS'], NAME = ['INGRID', 'HUANG'];
  const titleText = (ctx, seal, dx, dy) => drawRows(ctx, TITLE, inset(seal, seal.w * .09), seal.w * .036, dx, dy);

  return { drawRows, roundRect, inset, titleText, TITLE, NAME };
})();
