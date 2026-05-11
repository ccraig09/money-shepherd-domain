/* ============================================================
 * PokéQuest — Main game loop & state machine
 *
 * States:
 *   BOOT       — loading sprites
 *   TITLE      — title screen
 *   STARTER    — starter selection
 *   OVERWORLD  — exploring map
 *   DIALOG     — talking to NPC / reading sign
 *   MENU       — main pause menu
 *   PARTY      — viewing team
 *   BAG        — viewing items
 *   DEX        — pokedex
 *   SHOP       — buying items
 *   TRANSITION — pre-battle transition
 *   BATTLE     — in battle (delegates to Battle module)
 *   POSTBATTLE — fade back to overworld
 *   GAMEOVER   — all party fainted
 * ============================================================ */
(function (global) {
  'use strict';

  const Data = global.MS.Data;
  const Sprites = global.MS.Sprites;
  const Audio = global.MS.Audio;
  const Input = global.MS.Input;
  const World = global.MS.World;
  const PlayerLib = global.MS.Player;
  const Battle = global.MS.Battle;
  const UI = global.MS.UI;

  const W = 480, H = 320;
  const TILE = 16;
  const VIEW_W = W, VIEW_H = H;

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // -----------------------------------------------------------
  // Game state container
  // -----------------------------------------------------------
  const G = {
    state: 'BOOT',
    sub: 0, cursor: 0, scroll: 0,
    player: null,
    map: null,
    cam: { x: 0, y: 0 },
    dialog: null,
    battle: null,
    transitionT: 0,
    titleAnim: 0,
    toast: null,
    npcAnim: 0,
    pendingTalk: null,
    lastSaveTime: 0,
    fadeAlpha: 0,
    fadeDir: 0,    // -1 fade out, 1 fade in
    fadeNext: null,
    musicTrack: null,
    starterCursor: 1,
  };

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function setMap(mapId) {
    G.map = World.getMap(mapId);
    G.player.mapId = mapId;
    if (G.map.music && G.map.music !== G.musicTrack) {
      G.musicTrack = G.map.music;
      Audio.startTrack(G.map.music);
    }
  }

  function centerCamera() {
    const cx = G.player.px + 8 - W / 2;
    const cy = G.player.py + 8 - H / 2;
    const maxX = G.map.width * TILE - W;
    const maxY = G.map.height * TILE - H;
    G.cam.x = Math.max(0, Math.min(maxX < 0 ? 0 : maxX, cx));
    G.cam.y = Math.max(0, Math.min(maxY < 0 ? 0 : maxY, cy));
  }

  function showToast(msg, dur = 2.0) {
    G.toast = { msg, t: 0, dur };
  }

  function fadeTo(state, onMid) {
    G.fadeDir = -1;
    G.fadeNext = { state, onMid };
  }

  // -----------------------------------------------------------
  // BOOT
  // -----------------------------------------------------------
  function boot() {
    Sprites.initSprites();
    // Try load save
    const save = loadGame();
    if (save) {
      G.player = save;
      setMap(G.player.mapId);
      G.state = 'OVERWORLD';
      centerCamera();
      showToast('Game loaded.');
    } else {
      G.state = 'TITLE';
    }
  }

  // -----------------------------------------------------------
  // Save / Load
  // -----------------------------------------------------------
  function saveGame() {
    if (!G.player) return;
    try {
      localStorage.setItem('pokequest_save', PlayerLib.serialize(G.player));
      Audio.sfx('save');
      showToast('Game saved.');
      G.lastSaveTime = Date.now();
    } catch (e) {
      showToast('Save failed.');
    }
  }

  function loadGame() {
    try {
      const json = localStorage.getItem('pokequest_save');
      if (!json) return null;
      return PlayerLib.deserialize(json);
    } catch (e) {
      return null;
    }
  }

  function clearSave() {
    try { localStorage.removeItem('pokequest_save'); } catch (e) {}
  }

  // -----------------------------------------------------------
  // Movement
  // -----------------------------------------------------------
  function tryMove(dx, dy, dir) {
    G.player.dir = dir;
    if (G.player.moveT > 0) return; // already moving
    const nx = G.player.x + dx;
    const ny = G.player.y + dy;
    // NPC blocks
    if (World.findNPC(G.map, nx, ny)) {
      G.player.x = G.player.x; // bonk
      Audio.sfx('bump');
      return;
    }
    if (World.isSolid(G.map, nx, ny)) {
      Audio.sfx('bump');
      return;
    }
    G.player.x = nx;
    G.player.y = ny;
    G.player.moveT = 1;
    G.player.steps++;
    Audio.sfx('step');
    // Encounter check on tall grass
    if (World.isTallGrass(G.map, nx, ny)) {
      const chance = World.getEncounterRoll(G.map);
      if (Math.random() < chance) {
        triggerEncounter();
      }
    }
  }

  function triggerEncounter() {
    const tableId = G.map.encounters;
    if (!tableId) return;
    const table = Data.ENCOUNTERS[tableId];
    if (!table) return;
    const total = table.reduce((a, b) => a + b.weight, 0);
    let r = Math.random() * total;
    let pick = table[0];
    for (const e of table) { r -= e.weight; if (r <= 0) { pick = e; break; } }
    const lvl = pick.lvl[0] + Math.floor(Math.random() * (pick.lvl[1] - pick.lvl[0] + 1));
    const opponent = PlayerLib.newCreature(pick.id, lvl);
    G.player.pokedex.seen.add(pick.id);

    Audio.sfx('encounter');
    Audio.stopTrack();
    G.battle = Battle.startBattle(G.player, opponent, { type: 'WILD' });
    Battle.startIntroEvents(G.battle);
    G.state = 'TRANSITION';
    G.transitionT = 0;
  }

  function tryInteract() {
    // The tile we are facing
    let dx = 0, dy = 0;
    if (G.player.dir === 'up') dy = -1;
    else if (G.player.dir === 'down') dy = 1;
    else if (G.player.dir === 'left') dx = -1;
    else if (G.player.dir === 'right') dx = 1;
    const tx = G.player.x + dx, ty = G.player.y + dy;

    const npc = World.findNPC(G.map, tx, ty);
    if (npc) {
      G.dialog = UI.newDialog(npc.dialog, () => {
        if (npc.onTalk === 'HEAL_PARTY') {
          PlayerLib.healParty(G.player);
          Audio.sfx('heal');
          showToast('Your team is fully healed!');
        } else if (npc.onTalk === 'OPEN_SHOP') {
          G.state = 'SHOP'; G.cursor = 0;
        }
      });
      G.state = 'DIALOG';
      // make NPC face the player
      if (G.player.dir === 'up') npc.dir = 'down';
      else if (G.player.dir === 'down') npc.dir = 'up';
      else if (G.player.dir === 'left') npc.dir = 'right';
      else if (G.player.dir === 'right') npc.dir = 'left';
      Audio.sfx('menu');
      return;
    }
    const sign = World.findSign(G.map, tx, ty);
    if (sign) {
      G.dialog = UI.newDialog(sign.text.split('\n').map(s => s.trim()).filter(Boolean).join('\n'));
      G.state = 'DIALOG';
      Audio.sfx('menu');
    }
  }

  // -----------------------------------------------------------
  // Update — main per-frame entrypoint
  // -----------------------------------------------------------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    Input.endFrame();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    G.titleAnim += dt * 1000;
    G.npcAnim += dt;
    // fade animation
    if (G.fadeDir !== 0) {
      G.fadeAlpha += G.fadeDir * dt * 2;
      if (G.fadeAlpha <= 0 && G.fadeDir === 1) { G.fadeAlpha = 0; G.fadeDir = 0; }
      if (G.fadeAlpha >= 1 && G.fadeDir === -1) {
        G.fadeAlpha = 1;
        if (G.fadeNext) {
          if (G.fadeNext.onMid) G.fadeNext.onMid();
          G.state = G.fadeNext.state;
          G.fadeNext = null;
        }
        G.fadeDir = 1;
      }
    }
    if (G.toast) {
      G.toast.t += dt;
      if (G.toast.t > G.toast.dur) G.toast = null;
    }
    if (Input.wasPressed('mute')) {
      G._muted = !G._muted; Audio.setMuted(G._muted);
      showToast(G._muted ? 'Sound off' : 'Sound on');
    }

    if (G.state === 'BOOT') return;
    if (G.state === 'TITLE') updateTitle();
    else if (G.state === 'STARTER') updateStarter();
    else if (G.state === 'OVERWORLD') updateOverworld(dt);
    else if (G.state === 'DIALOG') updateDialog(dt);
    else if (G.state === 'MENU') updateMenu();
    else if (G.state === 'PARTY') updateParty();
    else if (G.state === 'BAG') updateBag();
    else if (G.state === 'DEX') updateDex();
    else if (G.state === 'SHOP') updateShop();
    else if (G.state === 'TRANSITION') updateTransition(dt);
    else if (G.state === 'BATTLE') updateBattle(dt);
    else if (G.state === 'POSTBATTLE') updatePostBattle(dt);
    else if (G.state === 'GAMEOVER') updateGameOver();
  }

  function updateTitle() {
    if (Input.wasPressed('a') || Input.wasPressed('start')) {
      Audio.unlock();
      Audio.sfx('select');
      const save = loadGame();
      if (save) {
        G.player = save;
        setMap(G.player.mapId);
        G.state = 'OVERWORLD';
        centerCamera();
      } else {
        G.state = 'STARTER';
        G.starterCursor = 1;
        Audio.startTrack('town');
      }
    }
    if (Input.wasPressed('b')) {
      // Clear save (debug)
      clearSave();
      showToast('Save cleared.');
    }
  }

  function updateStarter() {
    if (Input.wasPressed('left')) { G.starterCursor = (G.starterCursor + 2) % 3; Audio.sfx('blip'); }
    if (Input.wasPressed('right')) { G.starterCursor = (G.starterCursor + 1) % 3; Audio.sfx('blip'); }
    if (Input.wasPressed('a')) {
      Audio.sfx('select');
      const starters = ['FLAREPUP', 'AQUALET', 'SPROUTLING'];
      G.player = PlayerLib.newPlayer(starters[G.starterCursor]);
      setMap('HOMETOWN');
      G.state = 'OVERWORLD';
      centerCamera();
      showToast(`You chose ${Data.CREATURES[starters[G.starterCursor]].name}!`, 2.5);
    }
  }

  function updateOverworld(dt) {
    // Update walk tween
    if (G.player.moveT > 0) {
      G.player.moveT = Math.max(0, G.player.moveT - dt * 6);
      const t = 1 - G.player.moveT;
      const targetPx = G.player.x * TILE;
      const targetPy = G.player.y * TILE;
      const dx = G.player.dir === 'left' ? TILE : G.player.dir === 'right' ? -TILE : 0;
      const dy = G.player.dir === 'up' ? TILE : G.player.dir === 'down' ? -TILE : 0;
      G.player.px = targetPx + dx * G.player.moveT;
      G.player.py = targetPy + dy * G.player.moveT;
      if (G.player.moveT === 0) {
        G.player.px = targetPx;
        G.player.py = targetPy;
        // Animate frame
        G.player.animFrame = (G.player.animFrame + 1) % 2;
        // Check warp
        const warp = World.findWarp(G.map, G.player.x, G.player.y);
        if (warp) doWarp(warp);
      }
    } else if (G.fadeDir === 0) {
      // Input (disabled while a fade transition is running)
      if (Input.wasPressed('save')) { saveGame(); return; }
      if (Input.wasPressed('start') || Input.wasPressed('b')) {
        G.state = 'MENU'; G.cursor = 0; Audio.sfx('menu');
        return;
      }
      if (Input.wasPressed('a')) {
        tryInteract();
        return;
      }
      if (Input.isDown('up')) tryMove(0, -1, 'up');
      else if (Input.isDown('down')) tryMove(0, 1, 'down');
      else if (Input.isDown('left')) tryMove(-1, 0, 'left');
      else if (Input.isDown('right')) tryMove(1, 0, 'right');
    }
    centerCamera();
  }

  function doWarp(warp) {
    Audio.sfx('door');
    fadeTo('OVERWORLD', () => {
      setMap(warp.target);
      G.player.x = warp.tx;
      G.player.y = warp.ty;
      G.player.px = warp.tx * TILE;
      G.player.py = warp.ty * TILE;
      G.player.dir = warp.dir || G.player.dir;
      G.player.moveT = 0;
      centerCamera();
    });
  }

  function updateDialog(dt) {
    const done = UI.updateDialog(G.dialog, dt, Input);
    if (done) {
      G.state = 'OVERWORLD';
      G.dialog = null;
    }
  }

  function updateMenu() {
    if (Input.wasPressed('up')) { G.cursor = (G.cursor + 4) % 5; Audio.sfx('blip'); }
    if (Input.wasPressed('down')) { G.cursor = (G.cursor + 1) % 5; Audio.sfx('blip'); }
    if (Input.wasPressed('b')) { G.state = 'OVERWORLD'; Audio.sfx('cancel'); return; }
    if (Input.wasPressed('a')) {
      Audio.sfx('select');
      if (G.cursor === 0) { G.state = 'PARTY'; G.cursor = 0; }
      else if (G.cursor === 1) { G.state = 'BAG'; G.cursor = 0; }
      else if (G.cursor === 2) { G.state = 'DEX'; G.cursor = 0; G.scroll = 0; }
      else if (G.cursor === 3) { saveGame(); G.state = 'OVERWORLD'; }
      else if (G.cursor === 4) G.state = 'OVERWORLD';
    }
  }

  function updateParty() {
    const n = 6;
    if (Input.wasPressed('left') || Input.wasPressed('right')) { G.cursor ^= 1; Audio.sfx('blip'); }
    if (Input.wasPressed('up')) { G.cursor = (G.cursor - 2 + n) % n; Audio.sfx('blip'); }
    if (Input.wasPressed('down')) { G.cursor = (G.cursor + 2) % n; Audio.sfx('blip'); }
    if (Input.wasPressed('b')) { G.state = 'MENU'; G.cursor = 0; Audio.sfx('cancel'); }
  }

  function updateBag() {
    const items = Object.keys(G.player.bag).filter(k => G.player.bag[k] > 0);
    if (Input.wasPressed('up')) { G.cursor = Math.max(0, G.cursor - 1); Audio.sfx('blip'); }
    if (Input.wasPressed('down')) { G.cursor = Math.min(items.length - 1, G.cursor + 1); Audio.sfx('blip'); }
    if (Input.wasPressed('b')) { G.state = 'MENU'; G.cursor = 1; Audio.sfx('cancel'); }
    // Use heal items outside battle
    if (Input.wasPressed('a') && items.length) {
      const k = items[G.cursor];
      const item = Data.ITEMS[k];
      if (item.use === 'heal') {
        // pick first hurt creature
        const target = G.player.party.find(c => c.hp < c.stats.hp && c.hp > 0);
        if (target) {
          const heal = Math.min(target.stats.hp - target.hp, item.amount);
          target.hp += heal;
          G.player.bag[k]--;
          Audio.sfx('heal');
          showToast(`${PlayerLib.speciesName(target)} +${heal} HP`);
        } else showToast('No critter needs healing.');
      } else if (item.use === 'revive') {
        const target = G.player.party.find(c => c.hp <= 0);
        if (target) {
          target.hp = Math.floor(target.stats.hp * item.amount);
          G.player.bag[k]--;
          Audio.sfx('heal');
          showToast(`${PlayerLib.speciesName(target)} revived!`);
        } else showToast('No fainted critters.');
      } else {
        showToast('Save it for battle.');
      }
    }
  }

  function updateDex() {
    const all = Object.keys(Data.CREATURES);
    if (Input.wasPressed('up')) { G.cursor = Math.max(0, G.cursor - 1); Audio.sfx('blip'); }
    if (Input.wasPressed('down')) { G.cursor = Math.min(all.length - 1, G.cursor + 1); Audio.sfx('blip'); }
    if (G.cursor < G.scroll) G.scroll = G.cursor;
    if (G.cursor >= G.scroll + 10) G.scroll = G.cursor - 9;
    if (Input.wasPressed('b')) { G.state = 'MENU'; G.cursor = 2; Audio.sfx('cancel'); }
  }

  function updateShop() {
    const inv = UI.SHOP_INVENTORY;
    if (Input.wasPressed('up')) { G.cursor = Math.max(0, G.cursor - 1); Audio.sfx('blip'); }
    if (Input.wasPressed('down')) { G.cursor = Math.min(inv.length - 1, G.cursor + 1); Audio.sfx('blip'); }
    if (Input.wasPressed('b')) { G.state = 'OVERWORLD'; Audio.sfx('cancel'); return; }
    if (Input.wasPressed('a')) {
      const k = inv[G.cursor];
      const item = Data.ITEMS[k];
      if (G.player.money >= item.price) {
        G.player.money -= item.price;
        G.player.bag[k] = (G.player.bag[k] || 0) + 1;
        Audio.sfx('select');
        showToast(`Bought ${item.name}.`);
      } else {
        Audio.sfx('cancel');
        showToast("You can't afford that.");
      }
    }
  }

  function updateTransition(dt) {
    G.transitionT += dt * 1.2;
    if (G.transitionT >= 1) {
      G.state = 'BATTLE';
      Audio.startTrack('battle');
    }
  }

  function updateBattle(dt) {
    Battle.update(G.battle, dt, Input);
    if (G.battle.result) {
      // wait briefly then exit
      G.state = 'POSTBATTLE';
      G.transitionT = 0;
    }
  }

  function updatePostBattle(dt) {
    G.transitionT += dt;
    if (G.transitionT > 0.6) {
      const result = G.battle.result;
      G.battle = null;
      Audio.stopTrack();
      if (result === 'LOSE') {
        G.state = 'GAMEOVER';
      } else {
        // Heal warp back to town only on lose (not implemented). Just resume.
        G.state = 'OVERWORLD';
        if (G.map.music) { G.musicTrack = G.map.music; Audio.startTrack(G.map.music); }
      }
    }
  }

  function updateGameOver() {
    if (Input.wasPressed('a') || Input.wasPressed('start')) {
      // Heal party and return to hometown
      PlayerLib.healParty(G.player);
      G.player.x = 10; G.player.y = 13;
      G.player.px = G.player.x * TILE; G.player.py = G.player.y * TILE;
      G.player.dir = 'up';
      setMap('HOMETOWN');
      centerCamera();
      G.state = 'OVERWORLD';
      showToast('You woke up at home.');
    }
  }

  // -----------------------------------------------------------
  // Draw
  // -----------------------------------------------------------
  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (G.state === 'BOOT') drawBoot();
    else if (G.state === 'TITLE') UI.drawTitle(ctx, G.titleAnim);
    else if (G.state === 'STARTER') UI.drawStarter(ctx, G.starterCursor, G.titleAnim);
    else if (G.state === 'OVERWORLD' || G.state === 'DIALOG' || G.state === 'MENU' || G.state === 'TRANSITION') {
      drawOverworld();
      if (G.state === 'DIALOG' && G.dialog) UI.drawDialog(G.dialog, ctx);
      if (G.state === 'MENU') UI.drawMainMenu(ctx, G.cursor, G.player);
      if (G.state === 'TRANSITION') UI.drawBattleTransition(ctx, G.transitionT);
    }
    else if (G.state === 'PARTY') UI.drawPartyScreen(ctx, G.player, G.cursor);
    else if (G.state === 'BAG')   UI.drawBagScreen(ctx, G.player, G.cursor);
    else if (G.state === 'DEX')   UI.drawDex(ctx, G.player, G.cursor, G.scroll);
    else if (G.state === 'SHOP')  UI.drawShop(ctx, G.player, G.cursor);
    else if (G.state === 'BATTLE' || G.state === 'POSTBATTLE') {
      if (G.battle) Battle.draw(G.battle, ctx, UI);
      if (G.state === 'POSTBATTLE') {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, G.transitionT * 2)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    else if (G.state === 'GAMEOVER') drawGameOver();

    // Toast
    if (G.toast) UI.drawToast(ctx, G.toast.msg, G.toast.t / G.toast.dur);

    // Fade overlay
    if (G.fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${G.fadeAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBoot() {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffce3a';
    ctx.font = '14px "Trebuchet MS"';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', W / 2, H / 2);
    ctx.textAlign = 'left';
  }

  function drawOverworld() {
    World.draw(ctx, G.map, G.cam.x, G.cam.y, VIEW_W, VIEW_H, Sprites);
    // NPCs
    for (const npc of (G.map.npcs || [])) {
      const f = Math.floor(G.npcAnim * 2) % 2;
      const img = Sprites.getNPCFrame(npc.id, f);
      ctx.drawImage(img, npc.x * TILE - G.cam.x, npc.y * TILE - G.cam.y);
    }
    // Player
    const pf = Sprites.getPlayerFrame(G.player.dir, G.player.moveT > 0 ? G.player.animFrame ^ 1 : 0);
    ctx.drawImage(pf, G.player.px - G.cam.x, G.player.py - G.cam.y);

    // Map name banner (subtle)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(8, 8, 140, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Trebuchet MS"';
    ctx.fillText(G.map.name, 14, 14);
  }

  function drawGameOver() {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff5a3a';
    ctx.font = 'bold 32px "Trebuchet MS"';
    ctx.textAlign = 'center';
    ctx.fillText('Your team blacked out!', W / 2, H / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Trebuchet MS"';
    ctx.fillText('Press Z to return home.', W / 2, H / 2 + 20);
    ctx.textAlign = 'left';
  }

  // -----------------------------------------------------------
  // Boot
  // -----------------------------------------------------------
  Input.bind();
  // Unlock audio on first interaction
  const unlockOnce = () => {
    Audio.unlock();
    window.removeEventListener('click', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
    window.removeEventListener('touchstart', unlockOnce);
  };
  window.addEventListener('click', unlockOnce);
  window.addEventListener('keydown', unlockOnce);
  window.addEventListener('touchstart', unlockOnce);

  boot();
  requestAnimationFrame(loop);

  global.MS.Game = G;
})(window);
