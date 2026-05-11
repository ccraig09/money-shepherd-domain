/* ============================================================
 * PokéQuest — Procedural Sprite & Tile Generation
 * All art is drawn at runtime onto offscreen canvases.
 * Pixel-art style: 32x32 creatures (front), 64x64 (back),
 * 16x16 tiles, character sprites.
 * ============================================================ */
(function (global) {
  'use strict';

  const Data = global.MS.Data;

  // Cache for generated sprites
  const cache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { c, ctx };
  }

  // -----------------------------------------------------------
  // Color helpers
  // -----------------------------------------------------------
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    const m = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * pct)));
    return `#${((m(r) << 16) | (m(g) << 8) | m(b)).toString(16).padStart(6, '0')}`;
  }

  // -----------------------------------------------------------
  // Primitive shapes (cell = single pixel at sprite scale)
  // -----------------------------------------------------------
  function px(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  function fillEllipse(ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
          ctx.fillRect(cx + x, cy + y, 1, 1);
        }
      }
    }
  }

  function strokeEllipse(ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const v = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (v <= 1 && v > 0.7) ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  // -----------------------------------------------------------
  // Creature renderer — by blueprint
  // -----------------------------------------------------------
  function drawCreature(ctx, design, size, opts = {}) {
    const back = !!opts.back;
    const w = size, h = size;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2) + 2;

    const P = design.primary;
    const S = design.secondary;
    const A = design.accent;
    const E = design.eye;
    const shadow = shade(P, -0.25);
    const hi = shade(S, 0.15);

    ctx.save();
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    const sw = Math.floor(size * 0.45);
    const sh = Math.max(2, Math.floor(size * 0.06));
    for (let y = 0; y < sh; y++) {
      for (let x = -sw; x <= sw; x++) {
        if ((x * x) / (sw * sw) + (y * y) / (sh * sh) <= 1) {
          ctx.fillRect(cx + x, h - 2 + y, 1, 1);
        }
      }
    }

    switch (design.body) {
      case 'fox-pup': drawFoxBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, false); break;
      case 'fox-large': drawFoxBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, true); break;
      case 'turtle': drawTurtleBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, false); break;
      case 'turtle-large': drawTurtleBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, true); break;
      case 'plant': drawPlantBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, false); break;
      case 'plant-large': drawPlantBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, true); break;
      case 'mouse': drawMouseBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, false); break;
      case 'mouse-large': drawMouseBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, true); break;
      case 'rock': drawRockBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back); break;
      case 'bird': drawBirdBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, false); break;
      case 'bird-phoenix': drawBirdBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, true); break;
      case 'cat': drawCatBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back); break;
      case 'orb': drawOrbBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back); break;
      case 'dragon-small': drawDragonBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back); break;
      case 'bull': drawBullBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back); break;
      case 'serpent': drawSerpentBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back); break;
      default: drawDefaultBlob(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back);
    }

    ctx.restore();
  }

  function drawEye(ctx, x, y, color, size = 1) {
    // eye whites
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - size, y, size * 2 + 1, 1);
    ctx.fillRect(x, y - 1, 1, size * 2 + 1);
    // pupil
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  function drawDefaultBlob(ctx, cx, cy, size, P, S, A, E, shadow, hi) {
    const r = Math.floor(size * 0.35);
    fillEllipse(ctx, cx, cy, r, r, P);
    fillEllipse(ctx, cx, cy + 1, r - 1, r - 1, S);
    drawEye(ctx, cx - 3, cy - 1, A);
    drawEye(ctx, cx + 3, cy - 1, A);
  }

  // Fox-style: pointy ears, fluffy tail
  function drawFoxBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, large) {
    const r = Math.floor(size * (large ? 0.36 : 0.32));
    // tail (behind body)
    if (!back) {
      const tx = cx - r - 2, ty = cy + 1;
      const tailColor = design.features.includes('flame-tail') ? '#ffb74d' : P;
      fillEllipse(ctx, tx, ty, 3, 4, tailColor);
      fillEllipse(ctx, tx - 1, ty + 1, 2, 3, S);
      if (design.features.includes('flame-tail')) {
        fillEllipse(ctx, tx, ty - 3, 2, 2, '#ff5722');
        fillEllipse(ctx, tx - 1, ty - 5, 1, 2, '#ffeb3b');
      }
    }
    // body
    fillEllipse(ctx, cx, cy + 3, r, r - 2, P);
    fillEllipse(ctx, cx, cy + 5, r - 2, r - 3, S);
    // head
    const hy = cy - 2;
    fillEllipse(ctx, cx, hy, r - 1, r - 2, P);
    // ears
    ctx.fillStyle = P;
    ctx.fillRect(cx - r + 1, hy - r + 1, 2, 3);
    ctx.fillRect(cx + r - 2, hy - r + 1, 2, 3);
    ctx.fillStyle = A;
    ctx.fillRect(cx - r + 2, hy - r + 2, 1, 1);
    ctx.fillRect(cx + r - 2, hy - r + 2, 1, 1);
    // mane
    if (design.features.includes('mane')) {
      fillEllipse(ctx, cx, hy + 2, r, 2, hi);
    }
    if (!back) {
      drawEye(ctx, cx - 3, hy, A);
      drawEye(ctx, cx + 3, hy, A);
      // nose
      ctx.fillStyle = A;
      ctx.fillRect(cx, hy + 2, 1, 1);
    } else {
      // back view: just ear backs
      ctx.fillStyle = shadow;
      ctx.fillRect(cx - r + 1, hy - r + 2, 2, 2);
      ctx.fillRect(cx + r - 2, hy - r + 2, 2, 2);
    }
    // legs
    ctx.fillStyle = shadow;
    ctx.fillRect(cx - r + 1, cy + r + 1, 2, 2);
    ctx.fillRect(cx + r - 2, cy + r + 1, 2, 2);
  }

  function drawTurtleBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, large) {
    const r = Math.floor(size * (large ? 0.40 : 0.35));
    // shell
    const shellColor = design.features.includes('shell-steel') ? '#b8b8d0' : shade(P, -0.15);
    fillEllipse(ctx, cx, cy + 1, r, r - 2, shellColor);
    fillEllipse(ctx, cx, cy, r - 2, r - 4, shade(shellColor, 0.15));
    // shell pattern
    ctx.fillStyle = A;
    px(ctx, cx, cy, A);
    px(ctx, cx - 3, cy - 1, A);
    px(ctx, cx + 3, cy - 1, A);
    px(ctx, cx - 2, cy + 2, A);
    px(ctx, cx + 2, cy + 2, A);
    if (design.features.includes('spike-shell')) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = shade(shellColor, -0.2);
        ctx.fillRect(cx - r + 2 + i * 3, cy - r + 2, 1, 2);
      }
    }
    // head
    if (!back) {
      fillEllipse(ctx, cx, cy - r + 2, 3, 3, S);
      drawEye(ctx, cx - 1, cy - r + 1, A);
      drawEye(ctx, cx + 2, cy - r + 1, A);
    } else {
      fillEllipse(ctx, cx, cy - r + 2, 3, 3, shade(S, -0.2));
    }
    // flippers
    ctx.fillStyle = S;
    ctx.fillRect(cx - r - 1, cy + 1, 3, 2);
    ctx.fillRect(cx + r - 1, cy + 1, 3, 2);
  }

  function drawPlantBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, large) {
    const r = Math.floor(size * (large ? 0.36 : 0.32));
    // body (rounded plant pot)
    fillEllipse(ctx, cx, cy + 2, r, r - 1, P);
    fillEllipse(ctx, cx, cy + 4, r - 2, r - 3, hi);
    // leaf crown
    ctx.fillStyle = shade(P, 0.1);
    ctx.fillRect(cx - 1, cy - r, 2, 3);
    ctx.fillRect(cx - 3, cy - r + 1, 1, 2);
    ctx.fillRect(cx + 2, cy - r + 1, 1, 2);
    ctx.fillRect(cx - 5, cy - r + 2, 1, 2);
    ctx.fillRect(cx + 4, cy - r + 2, 1, 2);
    // bud
    if (design.features.includes('bud-tail')) {
      ctx.fillStyle = '#f06a96';
      ctx.fillRect(cx + r - 1, cy - 2, 2, 2);
    }
    // thorn mane
    if (design.features.includes('thorn-mane')) {
      ctx.fillStyle = A;
      for (let i = -2; i <= 2; i++) ctx.fillRect(cx + i * 2, cy - 1, 1, 2);
    }
    if (!back) {
      drawEye(ctx, cx - 3, cy + 1, A);
      drawEye(ctx, cx + 3, cy + 1, A);
      // mouth/fang
      if (design.features.includes('fang')) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx, cy + 3, 1, 2);
        ctx.fillRect(cx + 1, cy + 3, 1, 2);
      }
    }
  }

  function drawMouseBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, large) {
    const r = Math.floor(size * (large ? 0.34 : 0.30));
    // tail
    if (!back) {
      ctx.fillStyle = A;
      if (design.features.includes('lightning-tail')) {
        ctx.fillRect(cx + r, cy + 2, 1, 1);
        ctx.fillRect(cx + r + 1, cy + 1, 1, 1);
        ctx.fillRect(cx + r + 2, cy + 2, 1, 1);
        ctx.fillRect(cx + r + 3, cy + 1, 1, 1);
        ctx.fillRect(cx + r + 4, cy, 1, 2);
        ctx.fillStyle = shade('#ffd84a', 0);
        ctx.fillRect(cx + r + 4, cy - 1, 2, 1);
      } else {
        ctx.fillRect(cx + r, cy + 2, 3, 1);
        ctx.fillRect(cx + r + 3, cy + 1, 1, 1);
      }
    }
    // body
    fillEllipse(ctx, cx, cy + 2, r, r - 1, P);
    fillEllipse(ctx, cx, cy + 3, r - 2, r - 2, hi);
    // ears (round)
    ctx.fillStyle = P;
    fillEllipse(ctx, cx - r + 1, cy - r + 2, 2, 2, P);
    fillEllipse(ctx, cx + r - 1, cy - r + 2, 2, 2, P);
    ctx.fillStyle = A;
    px(ctx, cx - r + 1, cy - r + 2, A);
    px(ctx, cx + r - 1, cy - r + 2, A);
    // cheek sparks
    if (design.features.includes('cheek-spark')) {
      ctx.fillStyle = '#ff5722';
      ctx.fillRect(cx - r + 1, cy + 1, 2, 1);
      ctx.fillRect(cx + r - 2, cy + 1, 2, 1);
    }
    if (!back) {
      drawEye(ctx, cx - 3, cy - 1, A);
      drawEye(ctx, cx + 3, cy - 1, A);
      // nose
      ctx.fillStyle = A;
      ctx.fillRect(cx, cy + 1, 1, 1);
    }
    // mane
    if (design.features.includes('mane')) {
      fillEllipse(ctx, cx, cy + 1, r, 2, '#ffaa00');
    }
  }

  function drawRockBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back) {
    const r = Math.floor(size * 0.38);
    // craggy boulder body
    ctx.fillStyle = P;
    ctx.fillRect(cx - r, cy, r * 2, r);
    ctx.fillRect(cx - r + 2, cy - 3, r * 2 - 4, 4);
    ctx.fillRect(cx - r - 1, cy + 2, 2, r - 3);
    ctx.fillRect(cx + r - 1, cy + 2, 2, r - 3);
    // highlights
    ctx.fillStyle = S;
    ctx.fillRect(cx - r + 2, cy + 1, 3, 2);
    ctx.fillRect(cx - r + 1, cy + 4, 2, 2);
    // shadow
    ctx.fillStyle = shadow;
    ctx.fillRect(cx + r - 4, cy + r - 4, 3, 2);
    ctx.fillRect(cx - r + 1, cy + r - 1, r * 2 - 2, 1);
    // horn
    if (design.features.includes('horn')) {
      ctx.fillStyle = '#dcdcdc';
      ctx.fillRect(cx - 1, cy - r - 2, 2, 4);
      ctx.fillRect(cx, cy - r - 4, 1, 2);
    }
    if (!back) {
      drawEye(ctx, cx - 3, cy + 1, A);
      drawEye(ctx, cx + 3, cy + 1, A);
      // mouth
      ctx.fillStyle = A;
      ctx.fillRect(cx - 2, cy + 5, 5, 1);
    }
  }

  function drawBirdBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back, phoenix) {
    const r = Math.floor(size * 0.30);
    // wings
    if (!back) {
      const wColor = phoenix ? '#ff9800' : P;
      ctx.fillStyle = wColor;
      ctx.fillRect(cx - r - 3, cy, 3, 5);
      ctx.fillRect(cx + r, cy, 3, 5);
      ctx.fillStyle = phoenix ? '#ffeb3b' : S;
      ctx.fillRect(cx - r - 2, cy + 1, 2, 3);
      ctx.fillRect(cx + r + 1, cy + 1, 2, 3);
    }
    // body
    fillEllipse(ctx, cx, cy + 2, r, r, P);
    fillEllipse(ctx, cx, cy + 4, r - 1, r - 2, S);
    // head
    fillEllipse(ctx, cx, cy - r, 3, 3, P);
    // beak
    ctx.fillStyle = '#ffa726';
    ctx.fillRect(cx - 1, cy - r + 2, 2, 1);
    ctx.fillRect(cx, cy - r + 3, 1, 1);
    // crest
    ctx.fillStyle = phoenix ? '#ff5722' : S;
    ctx.fillRect(cx - 1, cy - r - 3, 2, 2);
    ctx.fillRect(cx, cy - r - 4, 1, 1);
    if (!back) {
      drawEye(ctx, cx - 2, cy - r, A);
      drawEye(ctx, cx + 2, cy - r, A);
    }
    // feet
    ctx.fillStyle = '#ffa726';
    ctx.fillRect(cx - 2, cy + r + 1, 1, 2);
    ctx.fillRect(cx + 1, cy + r + 1, 1, 2);
    // tail flame
    if (design.features.includes('tail-flame')) {
      ctx.fillStyle = '#ff5722';
      ctx.fillRect(cx + r - 1, cy + 1, 3, 2);
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(cx + r, cy + 2, 2, 1);
    }
  }

  function drawCatBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back) {
    const r = Math.floor(size * 0.32);
    // tail (whip)
    if (!back) {
      ctx.fillStyle = P;
      ctx.fillRect(cx + r, cy + 1, 1, 1);
      ctx.fillRect(cx + r + 1, cy, 1, 1);
      ctx.fillRect(cx + r + 2, cy - 1, 1, 1);
      ctx.fillRect(cx + r + 3, cy, 1, 1);
    }
    // body
    fillEllipse(ctx, cx, cy + 3, r, r - 2, P);
    fillEllipse(ctx, cx, cy + 4, r - 2, r - 3, hi);
    // head
    fillEllipse(ctx, cx, cy - 1, r - 1, r - 2, P);
    // ears (tufted, pointy)
    ctx.fillStyle = P;
    ctx.fillRect(cx - r + 2, cy - r, 2, 3);
    ctx.fillRect(cx + r - 3, cy - r, 2, 3);
    ctx.fillRect(cx - r + 3, cy - r - 1, 1, 1);
    ctx.fillRect(cx + r - 3, cy - r - 1, 1, 1);
    if (!back) {
      drawEye(ctx, cx - 3, cy, E);
      drawEye(ctx, cx + 3, cy, E);
      ctx.fillStyle = '#fff';
      // fangs
      if (design.features.includes('fang')) {
        ctx.fillRect(cx - 1, cy + 3, 1, 2);
        ctx.fillRect(cx + 1, cy + 3, 1, 2);
      }
    }
  }

  function drawOrbBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back) {
    const r = Math.floor(size * 0.30);
    const float = design.features.includes('floating') ? -2 : 0;
    // aura
    if (design.features.includes('aura')) {
      ctx.fillStyle = 'rgba(240, 106, 150, 0.18)';
      for (let yy = -r - 3; yy <= r + 3; yy++) {
        for (let xx = -r - 3; xx <= r + 3; xx++) {
          const v = (xx * xx) / ((r + 3) * (r + 3)) + (yy * yy) / ((r + 3) * (r + 3));
          if (v <= 1 && v > 0.55) ctx.fillRect(cx + xx, cy + yy + float, 1, 1);
        }
      }
    }
    fillEllipse(ctx, cx, cy + float, r, r, P);
    fillEllipse(ctx, cx - 1, cy - 1 + float, r - 2, r - 3, hi);
    if (!back) {
      drawEye(ctx, cx - 3, cy + float, A);
      drawEye(ctx, cx + 3, cy + float, A);
      // third eye
      if (design.features.includes('third-eye')) {
        drawEye(ctx, cx, cy - r + 2 + float, A);
      }
    }
  }

  function drawDragonBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back) {
    const r = Math.floor(size * 0.30);
    // tail
    if (!back) {
      ctx.fillStyle = P;
      ctx.fillRect(cx + r - 1, cy + 4, 3, 2);
      ctx.fillRect(cx + r + 1, cy + 2, 2, 2);
      // tail spike
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx + r + 3, cy + 2, 1, 2);
    }
    // body
    fillEllipse(ctx, cx, cy + 2, r, r - 1, P);
    fillEllipse(ctx, cx - 1, cy + 3, r - 2, r - 2, hi);
    // head
    fillEllipse(ctx, cx, cy - 2, r - 1, r - 2, P);
    // horns
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 3, cy - r, 1, 3);
    ctx.fillRect(cx + 3, cy - r, 1, 3);
    // wings
    if (!back) {
      ctx.fillStyle = S;
      ctx.fillRect(cx - r - 1, cy, 2, 3);
      ctx.fillRect(cx + r, cy, 2, 3);
    }
    if (!back) {
      drawEye(ctx, cx - 3, cy - 2, A);
      drawEye(ctx, cx + 3, cy - 2, A);
    }
  }

  function drawBullBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back) {
    const r = Math.floor(size * 0.34);
    // body
    fillEllipse(ctx, cx, cy + 3, r, r - 2, P);
    fillEllipse(ctx, cx, cy + 4, r - 2, r - 3, hi);
    // head plate
    fillEllipse(ctx, cx, cy - 2, r - 1, r - 3, P);
    ctx.fillStyle = shade(P, 0.2);
    ctx.fillRect(cx - 3, cy - 3, 7, 2);
    // horns
    if (design.features.includes('horn-double')) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - r + 1, cy - r + 1, 1, 3);
      ctx.fillRect(cx - r, cy - r + 2, 1, 2);
      ctx.fillRect(cx + r - 1, cy - r + 1, 1, 3);
      ctx.fillRect(cx + r, cy - r + 2, 1, 2);
    }
    // armor plates
    ctx.fillStyle = A;
    ctx.fillRect(cx - r + 1, cy + r - 1, r * 2 - 2, 1);
    if (!back) {
      drawEye(ctx, cx - 3, cy - 2, E);
      drawEye(ctx, cx + 3, cy - 2, E);
      // nose ring
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(cx - 1, cy + 1, 2, 1);
    }
    // hooves
    ctx.fillStyle = A;
    ctx.fillRect(cx - r + 2, cy + r + 1, 2, 2);
    ctx.fillRect(cx + r - 3, cy + r + 1, 2, 2);
  }

  function drawSerpentBody(ctx, cx, cy, size, P, S, A, E, shadow, hi, design, back) {
    const r = Math.floor(size * 0.30);
    // coiling body
    fillEllipse(ctx, cx, cy + 3, r + 1, r - 2, P);
    fillEllipse(ctx, cx - r, cy, 3, 3, P);
    fillEllipse(ctx, cx + r, cy, 3, 3, P);
    fillEllipse(ctx, cx, cy + 4, r - 1, r - 3, hi);
    // head
    fillEllipse(ctx, cx, cy - 2, r - 1, r - 2, P);
    // fins
    if (design.features.includes('fin')) {
      ctx.fillStyle = S;
      ctx.fillRect(cx - r, cy - r + 1, 2, 3);
      ctx.fillRect(cx + r - 1, cy - r + 1, 2, 3);
    }
    // pearl
    if (design.features.includes('pearl')) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx, cy + 1, 1, 1);
      ctx.fillStyle = hi;
      ctx.fillRect(cx - 1, cy + 1, 1, 1);
    }
    if (!back) {
      drawEye(ctx, cx - 3, cy - 2, A);
      drawEye(ctx, cx + 3, cy - 2, A);
      if (design.features.includes('third-eye')) {
        drawEye(ctx, cx, cy - r + 1, A);
      }
    }
  }

  // -----------------------------------------------------------
  // Public API: get sprite
  // -----------------------------------------------------------
  function getCreatureSprite(id, opts = {}) {
    const back = !!opts.back;
    const size = opts.size || (back ? 64 : 64);
    const key = `creature:${id}:${size}:${back ? 'b' : 'f'}`;
    if (cache.has(key)) return cache.get(key);

    const cr = Data.CREATURES[id];
    if (!cr) return null;
    const { c, ctx } = makeCanvas(size, size);
    // Render at base 32 and scale up if needed
    const baseSize = 32;
    const off = makeCanvas(baseSize, baseSize);
    drawCreature(off.ctx, cr.design, baseSize, { back });
    // scale up nearest-neighbor
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off.c, 0, 0, baseSize, baseSize, 0, 0, size, size);
    cache.set(key, c);
    return c;
  }

  // -----------------------------------------------------------
  // Tile generation — 16x16 tiles for the overworld
  // -----------------------------------------------------------
  const TILE = 16;
  const TILES = {};

  function makeTile(name, drawFn) {
    const { c, ctx } = makeCanvas(TILE, TILE);
    drawFn(ctx);
    TILES[name] = c;
  }

  function noise2(x, y, seed = 0) {
    const s = Math.sin((x * 374.91 + y * 921.13 + seed) * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  function buildTiles() {
    // GRASS
    makeTile('grass', (ctx) => {
      ctx.fillStyle = '#5fb04a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#7ec46a';
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(noise2(i, 1, 1) * TILE);
        const y = Math.floor(noise2(i, 2, 1) * TILE);
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = '#3e8536';
      ctx.fillRect(2, 4, 1, 1); ctx.fillRect(10, 8, 1, 1); ctx.fillRect(5, 12, 1, 1);
    });
    // TALL_GRASS (encounter zones)
    makeTile('tall_grass', (ctx) => {
      ctx.fillStyle = '#4ea03e';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#83cf6a';
      for (let i = 0; i < TILE; i += 2) {
        ctx.fillRect(i, 0, 1, 4);
        ctx.fillRect(i + 1, 4, 1, 4);
        ctx.fillRect(i, 8, 1, 4);
        ctx.fillRect(i + 1, 12, 1, 4);
      }
      ctx.fillStyle = '#2e6e26';
      for (let i = 0; i < TILE; i += 4) ctx.fillRect(i, 7, 1, 2);
    });
    // PATH
    makeTile('path', (ctx) => {
      ctx.fillStyle = '#c9a36a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#b08a4e';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect((i * 5) % TILE, (i * 3) % TILE, 1, 1);
      }
      ctx.fillStyle = '#dab686';
      ctx.fillRect(3, 2, 1, 1); ctx.fillRect(11, 6, 1, 1); ctx.fillRect(6, 13, 1, 1);
    });
    // WATER
    makeTile('water', (ctx) => {
      ctx.fillStyle = '#2a6cff';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#5fa1ff';
      ctx.fillRect(0, 4, TILE, 1);
      ctx.fillRect(0, 11, TILE, 1);
      ctx.fillStyle = '#a8d0ff';
      ctx.fillRect(2, 4, 4, 1);
      ctx.fillRect(10, 11, 4, 1);
    });
    // SAND
    makeTile('sand', (ctx) => {
      ctx.fillStyle = '#f5deb3';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#e3c98c';
      for (let i = 0; i < 8; i++) ctx.fillRect((i * 7) % TILE, (i * 5) % TILE, 1, 1);
    });
    // TREE (solid)
    makeTile('tree', (ctx) => {
      ctx.fillStyle = '#3a7c2e';
      ctx.fillRect(0, 0, TILE, TILE);
      // trunk
      ctx.fillStyle = '#6b3f1d';
      ctx.fillRect(6, 10, 4, 6);
      // foliage
      ctx.fillStyle = '#2e6e26';
      ctx.fillRect(2, 2, 12, 8);
      ctx.fillStyle = '#5cb053';
      ctx.fillRect(3, 3, 4, 3);
      ctx.fillRect(9, 4, 4, 3);
      ctx.fillStyle = '#1f4f1a';
      ctx.fillRect(2, 8, 12, 1);
    });
    // ROCK (solid)
    makeTile('rock', (ctx) => {
      ctx.fillStyle = '#6b6b6b';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#9b9b9b';
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#bababa';
      ctx.fillRect(3, 3, 5, 4);
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(2, 13, 12, 1);
      ctx.fillRect(13, 2, 1, 12);
    });
    // FLOWER (decorative, passable)
    makeTile('flower', (ctx) => {
      ctx.fillStyle = '#5fb04a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#ff7799';
      ctx.fillRect(7, 6, 2, 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(6, 7, 1, 1); ctx.fillRect(9, 7, 1, 1);
      ctx.fillRect(7, 5, 1, 1); ctx.fillRect(8, 8, 1, 1);
    });
    // FENCE
    makeTile('fence', (ctx) => {
      ctx.fillStyle = '#5fb04a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#6b3f1d';
      ctx.fillRect(0, 6, TILE, 2);
      ctx.fillRect(3, 4, 2, 8);
      ctx.fillRect(11, 4, 2, 8);
    });
    // BUILDING WALL
    makeTile('wall', (ctx) => {
      ctx.fillStyle = '#aa6f4a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#8a4f30';
      ctx.fillRect(0, 0, TILE, 2);
      ctx.fillRect(0, 14, TILE, 2);
      ctx.fillStyle = '#c98a64';
      for (let y = 2; y < 14; y += 4) {
        ctx.fillRect(0, y, TILE, 1);
        for (let x = 0; x < TILE; x += 4) ctx.fillRect(x, y, 1, 4);
      }
    });
    // ROOF (RED — Center)
    makeTile('roof_red', (ctx) => {
      ctx.fillStyle = '#d04040';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#a02020';
      for (let y = 0; y < TILE; y += 3) ctx.fillRect(0, y, TILE, 1);
      ctx.fillStyle = '#f06060';
      ctx.fillRect(0, 0, TILE, 1);
    });
    // ROOF (BLUE — Mart)
    makeTile('roof_blue', (ctx) => {
      ctx.fillStyle = '#3b4cca';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#1f307a';
      for (let y = 0; y < TILE; y += 3) ctx.fillRect(0, y, TILE, 1);
      ctx.fillStyle = '#5e70e0';
      ctx.fillRect(0, 0, TILE, 1);
    });
    // DOOR
    makeTile('door', (ctx) => {
      ctx.fillStyle = '#aa6f4a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#3a2510';
      ctx.fillRect(3, 1, 10, 15);
      ctx.fillStyle = '#1a1505';
      ctx.fillRect(4, 2, 8, 14);
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(11, 8, 1, 1);
    });
    // FLOOR (interior)
    makeTile('floor', (ctx) => {
      ctx.fillStyle = '#dcccaa';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#c9b88a';
      ctx.fillRect(0, 0, TILE, 1);
      ctx.fillRect(0, 8, TILE, 1);
    });
    // CAVE FLOOR
    makeTile('cave_floor', (ctx) => {
      ctx.fillStyle = '#4a4a55';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#3a3a45';
      for (let i = 0; i < 6; i++) ctx.fillRect((i * 7) % TILE, (i * 3) % TILE, 1, 1);
      ctx.fillStyle = '#5e5e6a';
      ctx.fillRect(2, 3, 1, 1); ctx.fillRect(11, 9, 1, 1);
    });
    // CAVE WALL
    makeTile('cave_wall', (ctx) => {
      ctx.fillStyle = '#22222a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#33333d';
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(0, 14, TILE, 2);
    });
    // SNOW
    makeTile('snow', (ctx) => {
      ctx.fillStyle = '#dfeaf4';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) ctx.fillRect((i * 5) % TILE, (i * 7) % TILE, 1, 1);
      ctx.fillStyle = '#c7d6e5';
      ctx.fillRect(2, 12, 4, 1);
    });
    // SIGN
    makeTile('sign', (ctx) => {
      ctx.fillStyle = '#5fb04a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#6b3f1d';
      ctx.fillRect(7, 8, 2, 8);
      ctx.fillRect(3, 3, 10, 6);
      ctx.fillStyle = '#c9a36a';
      ctx.fillRect(4, 4, 8, 4);
    });
    // LEDGE (jump-down only)
    makeTile('ledge', (ctx) => {
      ctx.fillStyle = '#5fb04a';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.fillStyle = '#3e8536';
      ctx.fillRect(0, 11, TILE, 5);
      ctx.fillStyle = '#2a5e22';
      ctx.fillRect(0, 14, TILE, 2);
    });
  }

  function getTile(name) { return TILES[name]; }

  // -----------------------------------------------------------
  // Player sprite — 16x16, 4 directions, 2 frames each
  // -----------------------------------------------------------
  const PLAYER_FRAMES = {};
  function buildPlayer() {
    const dirs = ['down', 'up', 'left', 'right'];
    for (const dir of dirs) {
      for (let f = 0; f < 2; f++) {
        const key = `${dir}_${f}`;
        const { c, ctx } = makeCanvas(16, 16);
        drawPlayer(ctx, dir, f);
        PLAYER_FRAMES[key] = c;
      }
    }
  }
  function drawPlayer(ctx, dir, frame) {
    // body
    const cap = '#dc3545';
    const hair = '#3a2510';
    const skin = '#f1c27d';
    const shirt = '#ffd84a';
    const pants = '#3b4cca';
    const shoe = '#222';
    // hat
    ctx.fillStyle = cap;
    ctx.fillRect(4, 2, 8, 3);
    ctx.fillRect(3, 4, 10, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(7, 3, 2, 1);
    // hair
    ctx.fillStyle = hair;
    ctx.fillRect(4, 5, 8, 1);
    // face
    ctx.fillStyle = skin;
    ctx.fillRect(5, 6, 6, 3);
    // eyes
    ctx.fillStyle = '#000';
    if (dir === 'down') {
      ctx.fillRect(6, 7, 1, 1); ctx.fillRect(9, 7, 1, 1);
    } else if (dir === 'up') {
      // hair back
      ctx.fillStyle = hair;
      ctx.fillRect(5, 7, 6, 1);
    } else if (dir === 'left') {
      ctx.fillRect(6, 7, 1, 1);
    } else {
      ctx.fillRect(9, 7, 1, 1);
    }
    // shirt
    ctx.fillStyle = shirt;
    ctx.fillRect(4, 9, 8, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(7, 10, 2, 1);
    // arms
    ctx.fillStyle = skin;
    ctx.fillRect(3, 10, 1, 2);
    ctx.fillRect(12, 10, 1, 2);
    // pants
    ctx.fillStyle = pants;
    ctx.fillRect(4, 12, 8, 2);
    // legs / shoes — alternate by frame
    ctx.fillStyle = shoe;
    if (frame === 0) {
      ctx.fillRect(5, 14, 2, 2);
      ctx.fillRect(9, 14, 2, 2);
    } else {
      ctx.fillRect(4, 14, 2, 2);
      ctx.fillRect(10, 14, 2, 2);
    }
  }

  function getPlayerFrame(dir, frame) {
    return PLAYER_FRAMES[`${dir}_${frame}`];
  }

  // NPC sprites — small variations
  const NPC_FRAMES = {};
  function buildNPCs() {
    const variants = [
      { id: 'nurse', cap: '#fff', hair: '#ff7799', shirt: '#ff9bb0' },
      { id: 'clerk', cap: null,   hair: '#3a2510', shirt: '#5e70e0' },
      { id: 'oldman', cap: '#7c624a', hair: '#cccccc', shirt: '#88c47a' },
      { id: 'kid',   cap: '#3b4cca', hair: '#3a2510', shirt: '#ffd84a' },
      { id: 'sage',  cap: '#5b3a8a', hair: '#fff',    shirt: '#7a52d4' },
    ];
    for (const v of variants) {
      for (let f = 0; f < 2; f++) {
        const { c, ctx } = makeCanvas(16, 16);
        drawNPC(ctx, v, f);
        NPC_FRAMES[`${v.id}_${f}`] = c;
      }
    }
  }
  function drawNPC(ctx, v, frame) {
    if (v.cap) {
      ctx.fillStyle = v.cap;
      ctx.fillRect(4, 2, 8, 3);
      ctx.fillRect(3, 4, 10, 1);
    }
    ctx.fillStyle = v.hair;
    ctx.fillRect(4, 5, 8, 1);
    ctx.fillStyle = '#f1c27d';
    ctx.fillRect(5, 6, 6, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(6, 7, 1, 1); ctx.fillRect(9, 7, 1, 1);
    ctx.fillStyle = v.shirt;
    ctx.fillRect(4, 9, 8, 3);
    ctx.fillStyle = '#f1c27d';
    ctx.fillRect(3, 10, 1, 2); ctx.fillRect(12, 10, 1, 2);
    ctx.fillStyle = '#222';
    ctx.fillRect(4, 12, 8, 2);
    if (frame === 0) {
      ctx.fillRect(5, 14, 2, 2); ctx.fillRect(9, 14, 2, 2);
    } else {
      ctx.fillRect(4, 14, 2, 2); ctx.fillRect(10, 14, 2, 2);
    }
  }
  function getNPCFrame(id, frame) {
    return NPC_FRAMES[`${id}_${frame}`] || NPC_FRAMES['clerk_0'];
  }

  // -----------------------------------------------------------
  // Pokéball icon
  // -----------------------------------------------------------
  let _ballSprite = null;
  function getBallSprite() {
    if (_ballSprite) return _ballSprite;
    const { c, ctx } = makeCanvas(16, 16);
    fillEllipse(ctx, 8, 8, 6, 6, '#ffffff');
    // top half red
    ctx.fillStyle = '#d04040';
    for (let y = 0; y < 7; y++) {
      for (let x = 2; x < 14; x++) {
        const dy = y - 8, dx = x - 8;
        if ((dx*dx)/36 + (dy*dy)/36 <= 1) ctx.fillRect(x, y, 1, 1);
      }
    }
    // band
    ctx.fillStyle = '#222';
    for (let x = 2; x < 14; x++) {
      const dy = -0.5, dx = x - 8;
      if ((dx*dx)/36 + (dy*dy)/36 <= 1) ctx.fillRect(x, 7, 1, 2);
    }
    // button
    ctx.fillStyle = '#fff';
    ctx.fillRect(7, 7, 2, 2);
    ctx.fillStyle = '#888';
    ctx.fillRect(7, 7, 1, 1);
    _ballSprite = c;
    return c;
  }

  // -----------------------------------------------------------
  // Initialize sprites at boot
  // -----------------------------------------------------------
  function initSprites() {
    buildTiles();
    buildPlayer();
    buildNPCs();
    getBallSprite();
    // Pre-render creature sprites
    for (const id of Object.keys(Data.CREATURES)) {
      getCreatureSprite(id, { back: false, size: 64 });
      getCreatureSprite(id, { back: true, size: 80 });
    }
  }

  global.MS.Sprites = {
    initSprites,
    getCreatureSprite,
    getTile,
    getPlayerFrame,
    getNPCFrame,
    getBallSprite,
    TILE,
  };
})(window);
