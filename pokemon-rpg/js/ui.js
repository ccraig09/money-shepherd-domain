/* ============================================================
 * PokéQuest — UI: dialogs, menus, title screen, transitions
 * ============================================================ */
(function (global) {
  'use strict';

  const Data = global.MS.Data;
  const Sprites = global.MS.Sprites;
  const Audio = global.MS.Audio;
  const PlayerLib = global.MS.Player;

  const W = 480, H = 320;

  // -----------------------------------------------------------
  // Dialog
  // -----------------------------------------------------------
  function newDialog(lines, onDone) {
    return {
      lines: Array.isArray(lines) ? lines : [lines],
      idx: 0, text: '', t: 0, done: false, onDone, awaiting: false,
    };
  }
  function updateDialog(d, dt, Input) {
    if (d.idx >= d.lines.length) return true;
    const full = d.lines[d.idx];
    if (!d.awaiting) {
      d.t += dt * 60;
      const n = Math.floor(d.t);
      if (n >= full.length) { d.text = full; d.awaiting = true; }
      else d.text = full.slice(0, n);
    }
    if (d.awaiting && (Input.wasPressed('a') || Input.wasPressed('b'))) {
      Audio.sfx('blip');
      d.idx++; d.t = 0; d.awaiting = false; d.text = '';
      if (d.idx >= d.lines.length) { d.done = true; if (d.onDone) d.onDone(); return true; }
    }
    if (!d.awaiting && Input.wasPressed('a')) {
      d.text = full; d.t = full.length; d.awaiting = true;
    }
    return false;
  }
  function drawDialog(d, ctx) {
    const y = 224;
    ctx.fillStyle = '#1c2632';
    ctx.fillRect(8, y, W - 16, 88);
    ctx.strokeStyle = '#3a4a5c';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, y + 2, W - 20, 84);
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Trebuchet MS"';
    ctx.textBaseline = 'top';
    const lines = wrapText(ctx, d.text, W - 40);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 22, y + 14 + i * 20);
    }
    if (d.awaiting && Math.floor(performance.now() / 400) % 2 === 0) {
      ctx.fillStyle = '#ffce3a';
      ctx.fillText('▼', W - 36, y + 64);
    }
  }

  // -----------------------------------------------------------
  // Title screen
  // -----------------------------------------------------------
  function drawTitle(ctx, anim) {
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0e14');
    grad.addColorStop(0.6, '#1c2632');
    grad.addColorStop(1, '#3b4cca');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 60; i++) {
      const x = (i * 37 + anim * 0.3) % W;
      const y = (i * 19 + 30) % 200;
      ctx.fillStyle = i % 7 === 0 ? '#ffd84a' : '#ffffff';
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }

    // Title
    ctx.fillStyle = '#ffd84a';
    ctx.font = 'bold 48px "Trebuchet MS"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PokéQuest', W / 2 + 2, 100 + 2); // shadow
    ctx.fillStyle = '#ffce3a';
    ctx.fillText('PokéQuest', W / 2, 100);
    ctx.strokeStyle = '#3b4cca';
    ctx.lineWidth = 2;
    ctx.strokeText('PokéQuest', W / 2, 100);

    ctx.fillStyle = '#fff';
    ctx.font = '14px "Trebuchet MS"';
    ctx.fillText('A Critter RPG Adventure', W / 2, 140);

    // Featured creatures animation
    const featured = ['FLAREPUP', 'AQUALET', 'SPROUTLING', 'SHOCKMOUSE'];
    for (let i = 0; i < featured.length; i++) {
      const sp = Sprites.getCreatureSprite(featured[i], { back: false, size: 56 });
      if (sp) {
        const x = (W / 2 - 110) + i * 60;
        const y = 170 + Math.sin(anim * 0.003 + i) * 4;
        ctx.drawImage(sp, x, y);
      }
    }

    // Prompt
    if (Math.floor(anim / 400) % 2 === 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Trebuchet MS"';
      ctx.fillText('Press Z / Enter to Start', W / 2, 270);
    }

    ctx.font = '10px "Trebuchet MS"';
    ctx.fillStyle = '#8a93a3';
    ctx.fillText('Procedural sprites — generated in your browser', W / 2, 300);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  // -----------------------------------------------------------
  // Starter selection
  // -----------------------------------------------------------
  function drawStarter(ctx, cursor, anim) {
    ctx.fillStyle = '#1c2632';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px "Trebuchet MS"';
    ctx.textAlign = 'center';
    ctx.fillText('Choose your starter critter!', W / 2, 30);

    const starters = [
      { id: 'FLAREPUP',   desc: 'A spunky fire pup. Fast and brave.' },
      { id: 'AQUALET',    desc: 'A sturdy water turtle. Loyal defender.' },
      { id: 'SPROUTLING', desc: 'A leafy plant critter. Clever scrapper.' },
    ];

    for (let i = 0; i < 3; i++) {
      const sx = 40 + i * 140;
      const sy = 70;
      const selected = i === cursor;
      ctx.fillStyle = selected ? '#3b4cca' : '#0a0e14';
      ctx.fillRect(sx, sy, 120, 140);
      ctx.strokeStyle = selected ? '#ffd84a' : '#3a4a5c';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, 120, 140);
      const sp = Sprites.getCreatureSprite(starters[i].id, { back: false, size: 80 });
      const off = selected ? Math.sin(anim * 0.006) * 3 : 0;
      ctx.drawImage(sp, sx + 20, sy + 16 + off);

      const cr = Data.CREATURES[starters[i].id];
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Trebuchet MS"';
      ctx.fillText(cr.name, sx + 60, sy + 110);
      ctx.font = '10px "Trebuchet MS"';
      ctx.fillStyle = Data.TYPES[cr.types[0]].color;
      ctx.fillText(cr.types[0], sx + 60, sy + 124);
    }

    // Description
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Trebuchet MS"';
    const desc = starters[cursor].desc;
    ctx.fillText(desc, W / 2, 230);

    ctx.font = '11px "Trebuchet MS"';
    ctx.fillStyle = '#aaa';
    ctx.fillText('◀ ▶  Z to confirm', W / 2, 260);
    ctx.textAlign = 'left';
  }

  // -----------------------------------------------------------
  // Main menu (overworld pause)
  // -----------------------------------------------------------
  function drawMainMenu(ctx, cursor, player) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    const x = 320, y = 20, w = 150, h = 280;
    ctx.fillStyle = '#1c2632';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#3a4a5c';
    ctx.strokeRect(x, y, w, h);
    const items = ['CRITTERS', 'BAG', 'POKEDEX', 'SAVE', 'CLOSE'];
    ctx.font = '14px "Trebuchet MS"';
    for (let i = 0; i < items.length; i++) {
      ctx.fillStyle = cursor === i ? '#ffce3a' : '#fff';
      ctx.fillText(`${cursor === i ? '▶' : ' '} ${items[i]}`, x + 14, y + 24 + i * 28);
    }
    // Player info
    ctx.fillStyle = '#fff';
    ctx.font = '11px "Trebuchet MS"';
    ctx.fillText(`MONEY: $${player.money}`, x + 14, y + 200);
    ctx.fillText(`STEPS: ${player.steps}`, x + 14, y + 218);
    ctx.fillText(`DEX:   ${player.pokedex.caught.size}/${Object.keys(Data.CREATURES).length}`, x + 14, y + 236);
  }

  // -----------------------------------------------------------
  // Party screen
  // -----------------------------------------------------------
  function drawPartyScreen(ctx, player, cursor) {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Trebuchet MS"';
    ctx.fillText('YOUR TEAM', 20, 16);

    for (let i = 0; i < 6; i++) {
      const x = 20 + (i % 2) * 220;
      const y = 40 + Math.floor(i / 2) * 86;
      const c = player.party[i];
      ctx.fillStyle = cursor === i ? '#3b4cca' : '#1c2632';
      ctx.fillRect(x, y, 210, 76);
      ctx.strokeStyle = '#3a4a5c';
      ctx.strokeRect(x, y, 210, 76);
      if (!c) {
        ctx.fillStyle = '#444';
        ctx.font = '14px "Trebuchet MS"';
        ctx.fillText('— empty —', x + 70, y + 36);
        continue;
      }
      const sp = Sprites.getCreatureSprite(c.speciesId, { back: false, size: 64 });
      if (sp) ctx.drawImage(sp, x + 4, y + 6);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px "Trebuchet MS"';
      ctx.fillText(PlayerLib.speciesName(c), x + 76, y + 10);
      ctx.font = '11px "Trebuchet MS"';
      ctx.fillText(`Lv. ${c.level}`, x + 76, y + 28);
      const ratio = c.hp / c.stats.hp;
      const color = ratio > 0.5 ? '#3aff60' : ratio > 0.25 ? '#ffce3a' : '#ff5a3a';
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(x + 76, y + 46, 120, 6);
      ctx.fillStyle = c.hp <= 0 ? '#555' : color;
      ctx.fillRect(x + 76, y + 46, Math.floor(120 * ratio), 6);
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(c.hp <= 0 ? 'FAINTED' : `${c.hp}/${c.stats.hp}`, x + 76, y + 56);
      if (c.status !== Data.STATUS.NONE) {
        ctx.fillStyle = '#ffce3a';
        ctx.fillText(c.status, x + 150, y + 56);
      }
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '11px "Trebuchet MS"';
    ctx.fillText('X = back', 20, H - 18);
    ctx.textAlign = 'left';
  }

  // -----------------------------------------------------------
  // Bag screen
  // -----------------------------------------------------------
  function drawBagScreen(ctx, player, cursor) {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Trebuchet MS"';
    ctx.fillText('BAG', 20, 16);
    const items = Object.keys(player.bag).filter(k => player.bag[k] > 0);
    for (let i = 0; i < items.length; i++) {
      const k = items[i];
      const item = Data.ITEMS[k];
      const y = 50 + i * 24;
      ctx.fillStyle = cursor === i ? '#ffce3a' : '#fff';
      ctx.font = '13px "Trebuchet MS"';
      ctx.fillText(`${cursor === i ? '▶' : ' '} ${item.name}`, 24, y);
      ctx.textAlign = 'right';
      ctx.fillText(`x ${player.bag[k]}`, W - 24, y);
      ctx.textAlign = 'left';
    }
    if (items.length === 0) {
      ctx.fillStyle = '#aaa';
      ctx.fillText('Your bag is empty.', 24, 60);
    }
    if (items.length > 0) {
      const k = items[cursor];
      ctx.fillStyle = '#aaa';
      ctx.font = '11px "Trebuchet MS"';
      ctx.fillText(Data.ITEMS[k].desc, 24, H - 40);
    }
    ctx.fillStyle = '#aaa';
    ctx.font = '11px "Trebuchet MS"';
    ctx.fillText('X = back', 24, H - 18);
  }

  // -----------------------------------------------------------
  // Pokedex screen
  // -----------------------------------------------------------
  function drawDex(ctx, player, cursor, scroll) {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Trebuchet MS"';
    ctx.fillText('CRITTER DEX', 20, 16);
    const all = Object.keys(Data.CREATURES);
    ctx.font = '12px "Trebuchet MS"';
    ctx.fillText(`Seen ${player.pokedex.seen.size}   Caught ${player.pokedex.caught.size}`, 240, 16);

    // List on left
    const maxRows = 10;
    const start = Math.max(0, Math.min(all.length - maxRows, scroll));
    for (let i = 0; i < maxRows && start + i < all.length; i++) {
      const id = all[start + i];
      const cr = Data.CREATURES[id];
      const y = 44 + i * 22;
      const seen = player.pokedex.seen.has(id);
      const caught = player.pokedex.caught.has(id);
      ctx.fillStyle = cursor === start + i ? '#3b4cca' : '#1c2632';
      ctx.fillRect(20, y, 200, 20);
      ctx.fillStyle = caught ? '#ffd84a' : seen ? '#fff' : '#444';
      ctx.font = '11px monospace';
      ctx.fillText(`#${String(start + i + 1).padStart(2, '0')}`, 26, y + 4);
      ctx.font = '12px "Trebuchet MS"';
      ctx.fillText(seen ? cr.name : '???', 60, y + 4);
      if (caught) ctx.fillText('✓', 200, y + 4);
    }

    // Detail on right
    const sel = all[cursor];
    if (sel) {
      const cr = Data.CREATURES[sel];
      const seen = player.pokedex.seen.has(sel);
      ctx.fillStyle = '#1c2632';
      ctx.fillRect(230, 44, W - 250, 220);
      ctx.strokeStyle = '#3a4a5c';
      ctx.strokeRect(230, 44, W - 250, 220);
      if (seen) {
        const sp = Sprites.getCreatureSprite(sel, { back: false, size: 96 });
        ctx.drawImage(sp, 256, 70);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px "Trebuchet MS"';
        ctx.fillText(cr.name, 360, 80);
        ctx.font = '11px "Trebuchet MS"';
        for (let i = 0; i < cr.types.length; i++) {
          const t = cr.types[i];
          ctx.fillStyle = Data.TYPES[t].color;
          ctx.fillRect(360 + i * 50, 100, 44, 16);
          ctx.fillStyle = '#0a0e14';
          ctx.fillText(t, 366 + i * 50, 102);
        }
        const stats = cr.base;
        ctx.fillStyle = '#fff';
        ctx.font = '11px monospace';
        ctx.fillText(`HP  ${stats.hp}`, 260, 180);
        ctx.fillText(`ATK ${stats.atk}`, 260, 196);
        ctx.fillText(`DEF ${stats.def}`, 260, 212);
        ctx.fillText(`SPA ${stats.spa}`, 360, 180);
        ctx.fillText(`SPD ${stats.spd}`, 360, 196);
        ctx.fillText(`SPE ${stats.spe}`, 360, 212);
      } else {
        ctx.fillStyle = '#666';
        ctx.font = '14px "Trebuchet MS"';
        ctx.fillText('Not yet seen.', 256, 130);
      }
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '11px "Trebuchet MS"';
    ctx.fillText('▲▼ navigate · X = back', 20, H - 18);
  }

  // -----------------------------------------------------------
  // Shop
  // -----------------------------------------------------------
  const SHOP_INVENTORY = ['POTION', 'SUPER_POT', 'HYPER_POT', 'POKEBALL', 'GREATBALL', 'ULTRABALL', 'REVIVE'];

  function drawShop(ctx, player, cursor) {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Trebuchet MS"';
    ctx.fillText('CRITTER MART', 20, 16);
    ctx.font = '12px "Trebuchet MS"';
    ctx.textAlign = 'right';
    ctx.fillText(`$ ${player.money}`, W - 20, 16);
    ctx.textAlign = 'left';

    for (let i = 0; i < SHOP_INVENTORY.length; i++) {
      const k = SHOP_INVENTORY[i];
      const item = Data.ITEMS[k];
      const y = 50 + i * 26;
      ctx.fillStyle = cursor === i ? '#3b4cca' : '#1c2632';
      ctx.fillRect(20, y - 4, W - 40, 24);
      ctx.fillStyle = '#fff';
      ctx.font = '13px "Trebuchet MS"';
      ctx.fillText(item.name, 28, y);
      ctx.textAlign = 'right';
      ctx.fillText(`$${item.price}`, W - 24, y);
      ctx.textAlign = 'left';
    }

    if (SHOP_INVENTORY[cursor]) {
      ctx.fillStyle = '#aaa';
      ctx.font = '11px "Trebuchet MS"';
      ctx.fillText(Data.ITEMS[SHOP_INVENTORY[cursor]].desc, 24, H - 36);
    }
    ctx.fillStyle = '#aaa';
    ctx.font = '11px "Trebuchet MS"';
    ctx.fillText('Z = buy · X = leave', 24, H - 18);
  }

  // -----------------------------------------------------------
  // Toast notification
  // -----------------------------------------------------------
  function drawToast(ctx, message, t) {
    const y = 20 + Math.min(0, (t - 0.2) * -200);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(W / 2 - 100, y, 200, 30);
    ctx.strokeStyle = '#ffce3a';
    ctx.strokeRect(W / 2 - 100, y, 200, 30);
    ctx.fillStyle = '#ffce3a';
    ctx.font = '12px "Trebuchet MS"';
    ctx.textAlign = 'center';
    ctx.fillText(message, W / 2, y + 10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  // -----------------------------------------------------------
  // Transitions
  // -----------------------------------------------------------
  function drawBattleTransition(ctx, t) {
    // Spiral/flash
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2 + t * 8;
      const r1 = Math.max(0, t * 400 - 40);
      const r2 = Math.max(0, t * 400);
      ctx.fillStyle = i % 2 === 0 ? '#0a0e14' : '#3b4cca';
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.arc(W / 2, H / 2, r2, a, a + Math.PI * 2 / segments);
      ctx.closePath();
      ctx.fill();
    }
    if (t > 0.85) {
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // -----------------------------------------------------------
  // wrap text helper
  // -----------------------------------------------------------
  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    for (const raw of text.split('\n')) {
      const words = raw.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth) {
          if (line) lines.push(line); line = w;
        } else line = test;
      }
      if (line) lines.push(line);
      else lines.push('');
    }
    return lines;
  }

  global.MS.UI = {
    newDialog, updateDialog, drawDialog,
    drawTitle, drawStarter, drawMainMenu,
    drawPartyScreen, drawBagScreen, drawDex,
    drawShop, SHOP_INVENTORY,
    drawToast, drawBattleTransition, wrapText,
  };
})(window);
