/* ============================================================
 * PokéQuest — Battle System
 *
 * Battle is a sub-state with its own update/draw. Sequential
 * actions resolved via a queue of "events". Each event has a
 * duration and animates over time.
 * ============================================================ */
(function (global) {
  'use strict';

  const Data = global.MS.Data;
  const Sprites = global.MS.Sprites;
  const Audio = global.MS.Audio;
  const PlayerLib = global.MS.Player;

  const W = 480, H = 320;

  // -----------------------------------------------------------
  // Damage formula
  // -----------------------------------------------------------
  function calcDamage(attacker, defender, move, isCrit) {
    if (move.power <= 0) return 0;
    const level = attacker.level;
    const isPhys = move.cat === Data.CAT.PHYSICAL;
    const A = isPhys ? attacker.stats.atk : attacker.stats.spa;
    const D = isPhys ? defender.stats.def : defender.stats.spd;
    const baseDmg = Math.floor(
      (Math.floor((2 * level / 5 + 2) * move.power * A / D) / 50) + 2
    );
    let dmg = baseDmg;
    if (isCrit) dmg = Math.floor(dmg * 1.5);
    // STAB
    const atkSpecies = Data.CREATURES[attacker.speciesId];
    if (atkSpecies.types.includes(move.type)) dmg = Math.floor(dmg * 1.5);
    // Type effectiveness
    const defSpecies = Data.CREATURES[defender.speciesId];
    const eff = Data.typeEffect(move.type, defSpecies.types);
    dmg = Math.floor(dmg * eff);
    // Random factor 0.85-1.0
    dmg = Math.floor(dmg * (0.85 + Math.random() * 0.15));
    return { damage: Math.max(0, dmg), eff };
  }

  function isCritical(attacker) {
    return Math.random() < 1 / 24;
  }

  function accuracyCheck(move, attacker, defender) {
    if (move.accuracy >= 100) return true;
    return Math.random() * 100 < move.accuracy;
  }

  function priority(action) {
    if (action.type === 'RUN') return 6;
    if (action.type === 'SWITCH') return 5;
    if (action.type === 'ITEM') return 5;
    if (action.type === 'MOVE') {
      const m = Data.MOVES[action.moveId];
      return m.priority || 0;
    }
    return 0;
  }

  // -----------------------------------------------------------
  // Battle state factory
  // -----------------------------------------------------------
  function startBattle(player, opponent, opts = {}) {
    return {
      type: opts.type || 'WILD', // 'WILD' or 'TRAINER'
      player, opponent,
      playerIdx: PlayerLib.firstNonFainted(player),
      opponentIdx: 0,
      // Animation/event queue
      events: [],
      eventT: 0,
      // Display HP (animates toward real HP)
      playerHpDisp: PlayerLib.firstNonFainted(player) >= 0 ? player.party[PlayerLib.firstNonFainted(player)].hp : 0,
      oppHpDisp: opponent.hp,
      // UI sub-state
      ui: 'INTRO',       // INTRO, MAIN, FIGHT, BAG, SWITCH, DIALOG, ENDING
      cursor: 0,
      sub: 0,
      // Particle systems
      particles: [],
      shake: 0,
      // Sprite jitter (attack lunges)
      pAtkOffset: 0,
      oAtkOffset: 0,
      pFlash: 0,
      oFlash: 0,
      pSpriteOffset: 0,  // for fainting
      oSpriteOffset: 0,
      // Capture state
      captureWobble: 0,
      ballAnim: null,
      // Result
      result: null, // 'WIN', 'LOSE', 'RUN', 'CAUGHT'
      // Text typing
      text: '',
      fullText: '',
      textT: 0,
      textDone: false,
      awaitConfirm: false,
      // Exp pending
      expGains: [],
      // Trainer-pause skips
      paused: false,
    };
  }

  // Event queue with "buffered" front-insertion when called from inside an FN
  let _pushTarget = null;
  function _push(b, ev) {
    if (_pushTarget) _pushTarget.push(ev);
    else b.events.push(ev);
  }
  function pushText(b, text, opts = {}) {
    _push(b, { kind: 'TEXT', text, dur: opts.dur || 0, wait: opts.wait !== false });
  }
  function pushDelay(b, ms) { _push(b, { kind: 'DELAY', dur: ms / 1000 }); }
  function pushFn(b, fn) { _push(b, { kind: 'FN', fn, dur: 0 }); }
  function runFn(b, fn) {
    _pushTarget = [];
    fn();
    const buf = _pushTarget;
    _pushTarget = null;
    if (buf.length) b.events = buf.concat(b.events);
  }

  // -----------------------------------------------------------
  // Particle helpers
  // -----------------------------------------------------------
  function spawnParticles(b, x, y, color, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = opts.angle != null ? opts.angle + (Math.random() - 0.5) * 0.7 : Math.random() * Math.PI * 2;
      const speed = (opts.speed || 60) + Math.random() * 40;
      b.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        color,
        size: opts.size || 2 + Math.random() * 2,
        gravity: opts.gravity || 0,
      });
    }
  }
  function updateParticles(b, dt) {
    for (let i = b.particles.length - 1; i >= 0; i--) {
      const p = b.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) b.particles.splice(i, 1);
    }
  }
  function drawParticles(b, ctx) {
    for (const p of b.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x - p.size/2), Math.floor(p.y - p.size/2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // -----------------------------------------------------------
  // Initialize the event queue for an action sequence
  // -----------------------------------------------------------
  function chooseFoeMove(b) {
    const foe = b.opponent;
    const usable = foe.moves.filter(m => m.pp > 0);
    const pool = usable.length ? usable : foe.moves;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  function setupTurn(b, playerAction) {
    playerAction.actor = 'PLAYER';
    const foeAction = { type: 'MOVE', moveId: chooseFoeMove(b), actor: 'OPP' };

    let actions = [playerAction, foeAction];
    actions.sort((a, b2) => {
      const pa = priority(a), pb = priority(b2);
      if (pa !== pb) return pb - pa;
      const aSpe = a.actor === 'PLAYER' ? getActiveP(b).stats.spe : b.opponent.stats.spe;
      const bSpe = b2.actor === 'PLAYER' ? getActiveP(b).stats.spe : b.opponent.stats.spe;
      if (aSpe !== bSpe) return bSpe - aSpe;
      return Math.random() < 0.5 ? -1 : 1;
    });

    for (const act of actions) {
      enqueueAction(b, act);
    }
    // End-of-turn status damage + battle end check
    pushFn(b, () => {
      if (b.result) return;
      tickStatus(b, 'PLAYER');
      tickStatus(b, 'OPP');
    });
    pushFn(b, () => { checkBattleEnd(b); });
  }

  function getActiveP(b) { return b.player.party[b.playerIdx]; }

  function enqueueAction(b, act) {
    if (act.type === 'MOVE') enqueueMove(b, act);
    else if (act.type === 'RUN') enqueueRun(b);
    else if (act.type === 'ITEM') enqueueItem(b, act);
    else if (act.type === 'SWITCH') enqueueSwitch(b, act);
  }

  function enqueueMove(b, act) {
    // Single FN per action — all sub-events are pushed to the FRONT
    // of the queue (via _pushTarget) so this action plays out before
    // the next one in the turn.
    pushFn(b, () => doMove(b, act));
  }

  function doMove(b, act) {
    if (b.result) return;
    const isP = act.actor === 'PLAYER';
    const attacker = isP ? getActiveP(b) : b.opponent;
    const defender = isP ? b.opponent : getActiveP(b);
    if (!attacker || !defender || attacker.hp <= 0 || defender.hp <= 0) return;

    const move = Data.MOVES[act.moveId];

    // Status checks
    if (attacker.status === Data.STATUS.PARALYSIS && Math.random() < 0.25) {
      pushText(b, `${PlayerLib.speciesName(attacker)} is paralyzed and can't move!`);
      return;
    }
    if (attacker.status === Data.STATUS.SLEEP) {
      if (Math.random() < 0.34) {
        attacker.status = Data.STATUS.NONE;
        pushText(b, `${PlayerLib.speciesName(attacker)} woke up!`);
      } else {
        pushText(b, `${PlayerLib.speciesName(attacker)} is fast asleep!`);
        return;
      }
    }
    if (attacker.status === Data.STATUS.FREEZE) {
      if (Math.random() < 0.20) {
        attacker.status = Data.STATUS.NONE;
        pushText(b, `${PlayerLib.speciesName(attacker)} thawed out!`);
      } else {
        pushText(b, `${PlayerLib.speciesName(attacker)} is frozen solid!`);
        return;
      }
    }

    // Deduct PP for player
    if (isP) {
      const m = attacker.moves.find(mm => mm.id === act.moveId);
      if (m && m.pp > 0) m.pp--;
    }

    pushText(b, `${PlayerLib.speciesName(attacker)} used ${move.name}!`);

    // Attack animation
    pushFn(b, () => {
      Audio.sfx(`attack_${move.type}`);
      if (isP) b.pAtkOffset = 1; else b.oAtkOffset = 1;
      const ax = isP ? 110 : 360, ay = isP ? 220 : 130;
      const tx = isP ? 360 : 110, ty = isP ? 130 : 220;
      const color = Data.TYPES[move.type].particle;
      const ang = Math.atan2(ty - ay, tx - ax);
      spawnParticles(b, ax, ay, color, 12, { angle: ang, speed: 220, size: 3 });
    });
    pushDelay(b, 350);

    pushFn(b, () => {
      if (!accuracyCheck(move, attacker, defender)) {
        pushText(b, `${PlayerLib.speciesName(attacker)}'s attack missed!`);
        return;
      }
      if (move.cat === Data.CAT.STATUS) {
        applyStatusEffect(b, attacker, defender, move, isP);
        return;
      }
      const crit = isCritical(attacker);
      const { damage, eff } = calcDamage(attacker, defender, move, crit);
      defender.hp = Math.max(0, defender.hp - damage);
      if (isP) { b.oFlash = 1; b.shake = 8; }
      else { b.pFlash = 1; b.shake = 8; }
      const tx = isP ? 360 : 110, ty = isP ? 130 : 220;
      const color = Data.TYPES[move.type].particle;
      spawnParticles(b, tx, ty, color, 14, { speed: 120, gravity: 60 });
      if (crit) Audio.sfx('crit'); else Audio.sfx('hit');
      if (move.effect && move.cat !== Data.CAT.STATUS) applyMoveSideEffect(b, attacker, defender, move, isP);
      const txt = (crit ? 'A critical hit! ' : '') + effectivenessText(eff);
      if (txt) pushText(b, txt);
    });
    pushDelay(b, 400);

    pushFn(b, () => {
      if (defender.hp <= 0) onFaint(b, isP);
    });
  }

  function applyMoveSideEffect(b, attacker, defender, move, attackerIsPlayer) {
    const e = move.effect;
    if (e.burn && Math.random() * 100 < e.burn && defender.status === Data.STATUS.NONE) {
      defender.status = Data.STATUS.BURN;
      pushText(b, `${PlayerLib.speciesName(defender)} was burned!`);
    }
    if (e.paralyze && Math.random() * 100 < e.paralyze && defender.status === Data.STATUS.NONE) {
      defender.status = Data.STATUS.PARALYSIS;
      pushText(b, `${PlayerLib.speciesName(defender)} was paralyzed!`);
    }
    if (e.freeze && Math.random() * 100 < e.freeze && defender.status === Data.STATUS.NONE) {
      defender.status = Data.STATUS.FREEZE;
      pushText(b, `${PlayerLib.speciesName(defender)} was frozen!`);
    }
  }

  function applyStatusEffect(b, attacker, defender, move, attackerIsPlayer) {
    const e = move.effect || {};
    if (e.lowerAtk) { defender.stats.atk = Math.max(1, Math.floor(defender.stats.atk * 0.85)); pushText(b, `${PlayerLib.speciesName(defender)}'s Attack fell!`); }
    if (e.lowerDef) { defender.stats.def = Math.max(1, Math.floor(defender.stats.def * 0.85)); pushText(b, `${PlayerLib.speciesName(defender)}'s Defense fell!`); }
    if (e.raiseDef) { attacker.stats.def = Math.floor(attacker.stats.def * 1.2); pushText(b, `${PlayerLib.speciesName(attacker)}'s Defense rose!`); }
    if (e.raiseSpe) { attacker.stats.spe = Math.floor(attacker.stats.spe * 1.3); pushText(b, `${PlayerLib.speciesName(attacker)}'s Speed rose!`); }
    if (e.paralyze === 100) {
      if (defender.status === Data.STATUS.NONE) {
        defender.status = Data.STATUS.PARALYSIS;
        pushText(b, `${PlayerLib.speciesName(defender)} was paralyzed!`);
      }
    }
  }

  function tickStatus(b, side) {
    const c = side === 'PLAYER' ? getActiveP(b) : b.opponent;
    if (!c || c.hp <= 0) return;
    if (c.status === Data.STATUS.BURN || c.status === Data.STATUS.POISON) {
      const dmg = Math.max(1, Math.floor(c.stats.hp / 8));
      c.hp = Math.max(0, c.hp - dmg);
      pushText(b, `${PlayerLib.speciesName(c)} is hurt by its ${c.status === Data.STATUS.BURN ? 'burn' : 'poison'}!`);
      pushFn(b, () => { if (c.hp <= 0) onFaint(b, side === 'PLAYER' ? false : true); });
    }
  }

  function effectivenessText(eff) {
    if (eff === 0) return 'It had no effect…';
    if (eff >= 2) return 'It was super effective!';
    if (eff > 0 && eff < 1) return "It's not very effective…";
    return '';
  }

  function onFaint(b, opponentSide /* true = opponent fainted */) {
    if (opponentSide) {
      pushText(b, `Wild ${PlayerLib.speciesName(b.opponent)} fainted!`);
      Audio.sfx('faint');
      pushFn(b, () => { b.oSpriteOffset = 1; });
      pushDelay(b, 400);
      // exp
      const exp = computeExpGain(b);
      pushText(b, `${PlayerLib.speciesName(getActiveP(b))} gained ${exp} EXP!`);
      pushFn(b, () => {
        const evs = PlayerLib.gainExp(getActiveP(b), exp);
        for (const ev of evs) {
          if (ev.type === 'LEVEL_UP') {
            Audio.sfx('levelup');
            pushText(b, `${ev.name} grew to Lv. ${ev.level}!`);
          } else if (ev.type === 'LEARNED') {
            pushText(b, `${ev.name} learned ${ev.move}!`);
          }
        }
      });
    } else {
      pushText(b, `${PlayerLib.speciesName(getActiveP(b))} fainted!`);
      Audio.sfx('faint');
      pushFn(b, () => { b.pSpriteOffset = 1; });
      pushDelay(b, 400);
      // Check for next pokemon
      pushFn(b, () => {
        if (PlayerLib.allFainted(b.player)) {
          b.result = 'LOSE';
        } else {
          // Force switch
          b.ui = 'SWITCH';
          b.cursor = 0;
          b.forceSwitch = true;
        }
      });
    }
  }

  function computeExpGain(b) {
    const foe = b.opponent;
    const sp = Data.CREATURES[foe.speciesId];
    const baseExp = 60; // simplified
    return Math.max(1, Math.floor(baseExp * foe.level / 7));
  }

  function checkBattleEnd(b) {
    if (b.opponent.hp <= 0 && !b.result) {
      b.result = 'WIN';
    }
  }

  // -----------------------------------------------------------
  // RUN / ITEM / SWITCH
  // -----------------------------------------------------------
  function enqueueRun(b) {
    pushFn(b, () => {
      if (b.result) return;
      const p = getActiveP(b);
      const o = b.opponent;
      const odds = Math.floor((p.stats.spe * 32) / (Math.max(1, o.stats.spe) / 4)) + 30;
      const success = b.type === 'WILD' && (Math.random() * 256 < odds);
      if (success) {
        Audio.sfx('cancel');
        pushText(b, 'Got away safely!');
        pushFn(b, () => { b.result = 'RUN'; });
      } else {
        pushText(b, "Can't escape!");
      }
    });
  }

  function enqueueItem(b, act) {
    pushFn(b, () => {
      if (b.result) return;
      const item = Data.ITEMS[act.itemId];
      if (!item) return;
      pushText(b, `${b.player.name} used ${item.name}!`);
      b.player.bag[act.itemId] = Math.max(0, (b.player.bag[act.itemId] || 0) - 1);
      if (item.use === 'heal') {
        const target = b.player.party[act.targetIdx];
        const heal = Math.min(target.stats.hp - target.hp, item.amount);
        target.hp += heal;
        pushFn(b, () => Audio.sfx('heal'));
        pushText(b, `${PlayerLib.speciesName(target)} recovered ${heal} HP!`);
      } else if (item.use === 'ball') {
        attemptCapture(b, item);
      } else if (item.use === 'revive') {
        const target = b.player.party[act.targetIdx];
        if (target.hp <= 0) {
          target.hp = Math.floor(target.stats.hp * item.amount);
          pushFn(b, () => Audio.sfx('heal'));
          pushText(b, `${PlayerLib.speciesName(target)} was revived!`);
        }
      }
    });
  }

  function enqueueSwitch(b, act) {
    pushFn(b, () => {
      if (b.result) return;
      const old = getActiveP(b);
      pushText(b, `Come back, ${PlayerLib.speciesName(old)}!`);
      pushFn(b, () => {
        b.playerIdx = act.idx;
        b.playerHpDisp = getActiveP(b).hp;
      });
      pushText(b, `Go, ${PlayerLib.speciesName(b.player.party[act.idx])}!`);
    });
  }

  // -----------------------------------------------------------
  // Capture mechanic
  // -----------------------------------------------------------
  function attemptCapture(b, ballItem) {
    const foe = b.opponent;
    const species = Data.CREATURES[foe.speciesId];
    const maxHP = foe.stats.hp;
    const hp = foe.hp;
    const rate = species.catchRate || 45;
    const statusBonus = (foe.status === Data.STATUS.SLEEP || foe.status === Data.STATUS.FREEZE) ? 2 : (foe.status !== Data.STATUS.NONE ? 1.5 : 1);
    const ballRate = ballItem.rate || 1;
    const a = ((3 * maxHP - 2 * hp) * rate * ballRate * statusBonus) / (3 * maxHP);
    const success = Math.random() * 255 < a;
    let wobbles = 0;
    if (success) wobbles = 4;
    else {
      // shake count
      const b1 = Math.floor(65535 / Math.pow(255 / Math.max(1, a), 0.1875));
      for (let i = 0; i < 4; i++) if (Math.random() * 65535 < b1) wobbles++;
    }
    Audio.sfx('capture');
    pushFn(b, () => {
      b.ballAnim = { t: 0, phase: 'throw', wobbles: 0, target: wobbles, success };
      b.oSpriteOffset = 1; // hide opponent
    });
    pushDelay(b, 2200 + wobbles * 600);
    pushFn(b, () => {
      if (success) {
        Audio.sfx('capture_success');
        pushText(b, `Gotcha! ${PlayerLib.speciesName(foe)} was caught!`);
        pushFn(b, () => {
          const where = PlayerLib.addToParty(b.player, foe);
          if (where === 'BOX') pushText(b, `${PlayerLib.speciesName(foe)} was sent to the PC.`);
          b.result = 'CAUGHT';
        });
      } else {
        Audio.sfx('capture_fail');
        if (wobbles === 0) pushText(b, 'Oh no! It broke free immediately!');
        else if (wobbles === 1) pushText(b, 'Aww — it appeared to be caught!');
        else if (wobbles === 2) pushText(b, 'Aargh — almost had it!');
        else pushText(b, 'Shoot! It was so close, too!');
        pushFn(b, () => { b.ballAnim = null; b.oSpriteOffset = 0; });
      }
    });
  }

  // -----------------------------------------------------------
  // Update / draw
  // -----------------------------------------------------------
  function update(b, dt, Input) {
    // Animate text
    if (b.fullText && !b.textDone) {
      b.textT += dt * 60; // chars/sec
      const n = Math.floor(b.textT);
      if (n >= b.fullText.length) { b.text = b.fullText; b.textDone = true; }
      else b.text = b.fullText.slice(0, n);
    }

    // HP bar tween
    const active = getActiveP(b);
    if (active) b.playerHpDisp += (active.hp - b.playerHpDisp) * Math.min(1, dt * 4);
    b.oppHpDisp += (b.opponent.hp - b.oppHpDisp) * Math.min(1, dt * 4);

    // shake decay
    b.shake *= 0.85;
    b.pFlash = Math.max(0, b.pFlash - dt * 5);
    b.oFlash = Math.max(0, b.oFlash - dt * 5);
    b.pAtkOffset = Math.max(0, b.pAtkOffset - dt * 2.5);
    b.oAtkOffset = Math.max(0, b.oAtkOffset - dt * 2.5);
    b.pSpriteOffset = Math.min(1, b.pSpriteOffset + dt * 1.2 * (b.pSpriteOffset > 0 ? 1 : 0));
    b.oSpriteOffset = Math.min(1, b.oSpriteOffset + dt * 1.2 * (b.oSpriteOffset > 0 ? 1 : 0));

    // particle update
    updateParticles(b, dt);

    // Ball anim
    if (b.ballAnim) {
      const a = b.ballAnim;
      a.t += dt;
      if (a.phase === 'throw' && a.t > 0.6) { a.phase = 'wobble'; a.t = 0; }
      else if (a.phase === 'wobble' && a.t > 0.6) {
        a.wobbles++;
        a.t = 0;
        if (a.wobbles >= a.target) a.phase = 'done';
      }
    }

    // Drive event queue
    if (b.events.length > 0) {
      const ev = b.events[0];
      if (ev.kind === 'TEXT') {
        if (!ev.started) {
          b.fullText = ev.text; b.text = ''; b.textT = 0; b.textDone = false; b.awaitConfirm = ev.wait;
          ev.started = true;
        }
        if (b.textDone) {
          if (!ev.wait) { b.events.shift(); b.fullText = ''; b.text = ''; }
          else if (Input.wasPressed('a') || Input.wasPressed('b')) {
            Audio.sfx('blip');
            b.events.shift();
            b.fullText = ''; b.text = '';
          }
        } else {
          if (Input.wasPressed('a')) {
            b.text = b.fullText;
            b.textDone = true;
          }
        }
      } else if (ev.kind === 'DELAY') {
        ev.dur -= dt;
        if (ev.dur <= 0) b.events.shift();
      } else if (ev.kind === 'FN') {
        b.events.shift();
        runFn(b, ev.fn);
      }
      return;
    }

    // Idle: handle UI input depending on mode
    if (b.result) return; // handled by main loop
    handleUI(b, Input);
  }

  function handleUI(b, Input) {
    if (b.ui === 'MAIN') {
      // 2x2 menu: FIGHT, BAG, SWITCH, RUN
      if (Input.wasPressed('left') || Input.wasPressed('right')) { b.cursor ^= 1; Audio.sfx('blip'); }
      if (Input.wasPressed('up') || Input.wasPressed('down')) { b.cursor ^= 2; Audio.sfx('blip'); }
      if (Input.wasPressed('a')) {
        Audio.sfx('select');
        if (b.cursor === 0) { b.ui = 'FIGHT'; b.sub = 0; }
        else if (b.cursor === 1) { b.ui = 'BAG'; b.sub = 0; }
        else if (b.cursor === 2) { b.ui = 'SWITCH'; b.sub = 0; }
        else if (b.cursor === 3) submitAction(b, { type: 'RUN' });
      }
    } else if (b.ui === 'FIGHT') {
      const moves = getActiveP(b).moves;
      if (Input.wasPressed('left') || Input.wasPressed('right')) { b.sub ^= 1; Audio.sfx('blip'); }
      if (Input.wasPressed('up') || Input.wasPressed('down')) { b.sub ^= 2; Audio.sfx('blip'); }
      if (b.sub >= moves.length) b.sub = moves.length - 1;
      if (Input.wasPressed('b')) { b.ui = 'MAIN'; Audio.sfx('cancel'); }
      if (Input.wasPressed('a')) {
        if (b.sub < moves.length && moves[b.sub].pp > 0) {
          Audio.sfx('select');
          submitAction(b, { type: 'MOVE', moveId: moves[b.sub].id });
        } else {
          Audio.sfx('cancel');
        }
      }
    } else if (b.ui === 'BAG') {
      const items = Object.keys(b.player.bag).filter(k => b.player.bag[k] > 0);
      if (Input.wasPressed('up')) { b.sub = (b.sub - 1 + items.length) % items.length; Audio.sfx('blip'); }
      if (Input.wasPressed('down')) { b.sub = (b.sub + 1) % items.length; Audio.sfx('blip'); }
      if (Input.wasPressed('b')) { b.ui = 'MAIN'; Audio.sfx('cancel'); }
      if (Input.wasPressed('a') && items.length) {
        const itemId = items[b.sub];
        const item = Data.ITEMS[itemId];
        Audio.sfx('select');
        if (item.use === 'ball') {
          submitAction(b, { type: 'ITEM', itemId });
        } else if (item.use === 'heal' || item.use === 'revive') {
          // Use on active for simplicity
          submitAction(b, { type: 'ITEM', itemId, targetIdx: b.playerIdx });
        }
      }
    } else if (b.ui === 'SWITCH') {
      const party = b.player.party;
      if (Input.wasPressed('up')) { b.sub = (b.sub - 1 + party.length) % party.length; Audio.sfx('blip'); }
      if (Input.wasPressed('down')) { b.sub = (b.sub + 1) % party.length; Audio.sfx('blip'); }
      if (Input.wasPressed('b') && !b.forceSwitch) { b.ui = 'MAIN'; Audio.sfx('cancel'); }
      if (Input.wasPressed('a')) {
        if (b.sub === b.playerIdx || party[b.sub].hp <= 0) { Audio.sfx('cancel'); }
        else {
          Audio.sfx('select');
          if (b.forceSwitch) {
            b.playerIdx = b.sub;
            b.playerHpDisp = getActiveP(b).hp;
            b.forceSwitch = false;
            b.ui = 'MAIN'; b.cursor = 0;
            pushText(b, `Go, ${PlayerLib.speciesName(getActiveP(b))}!`);
          } else {
            submitAction(b, { type: 'SWITCH', idx: b.sub });
          }
        }
      }
    }
  }

  function submitAction(b, action) {
    b.ui = 'MAIN'; b.cursor = 0;
    setupTurn(b, action);
  }

  function startIntroEvents(b) {
    b.ui = 'MAIN';
    const foeName = PlayerLib.speciesName(b.opponent);
    pushText(b, `A wild ${foeName} appeared!`);
    pushText(b, `Go, ${PlayerLib.speciesName(getActiveP(b))}!`);
  }

  // -----------------------------------------------------------
  // Drawing
  // -----------------------------------------------------------
  function draw(b, ctx, UI) {
    const shx = (Math.random() - 0.5) * b.shake;
    const shy = (Math.random() - 0.5) * b.shake;
    ctx.save();
    ctx.translate(shx, shy);

    // Background — gradient sky-to-ground with arena floor
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1c2632');
    grad.addColorStop(0.55, '#2a3645');
    grad.addColorStop(1, '#3e5a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Sun glow
    ctx.fillStyle = 'rgba(255, 220, 100, 0.18)';
    for (let r = 60; r > 0; r -= 10) {
      ctx.beginPath();
      ctx.arc(W - 80, 60, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Platforms
    drawPlatform(ctx, W - 120, 200, 120, '#806340');  // opp
    drawPlatform(ctx, 0, 270, 140, '#5a7b3c');         // player

    // Opponent sprite (front)
    const oppSprite = Sprites.getCreatureSprite(b.opponent.speciesId, { back: false, size: 80 });
    if (oppSprite && b.oSpriteOffset < 1 && (!b.ballAnim || b.ballAnim.phase !== 'done')) {
      const ox = 320 - 40 + b.oAtkOffset * -15;
      const oy = 150 - 60 + b.oSpriteOffset * 30;
      const flash = b.oFlash;
      if (flash > 0) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(flash * 30);
      }
      ctx.drawImage(oppSprite, ox, oy);
      ctx.globalAlpha = 1;
    }

    // Player sprite (back) — only if active
    const active = getActiveP(b);
    if (active && active.hp > 0) {
      const back = Sprites.getCreatureSprite(active.speciesId, { back: true, size: 100 });
      if (back) {
        const px = 30 + b.pAtkOffset * 15;
        const py = 200 - 50 + b.pSpriteOffset * 40;
        if (b.pFlash > 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(b.pFlash * 30);
        ctx.drawImage(back, px, py);
        ctx.globalAlpha = 1;
      }
    }

    // Particles
    drawParticles(b, ctx);

    // Ball animation
    if (b.ballAnim) drawBallAnim(b, ctx);

    // HUD info boxes
    drawInfoBox(ctx, b.opponent, b.oppHpDisp, 20, 24, false);
    if (active) drawInfoBox(ctx, active, b.playerHpDisp, W - 200, 200, true);

    // Bottom text/menu panel
    drawBottomPanel(b, ctx);

    ctx.restore();
  }

  function drawPlatform(ctx, x, y, w, color) {
    ctx.fillStyle = color;
    for (let r = 0; r < 14; r++) {
      const rw = w - r * 2;
      ctx.fillRect(x + r, y + r, rw, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 2, y + 14, w - 4, 6);
  }

  function drawInfoBox(ctx, c, hpDisp, x, y, isPlayer) {
    ctx.fillStyle = '#1c2632';
    roundRect(ctx, x, y, 180, isPlayer ? 56 : 40, 6, true);
    ctx.strokeStyle = '#3a4a5c';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, 180, isPlayer ? 56 : 40, 6, false, true);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Trebuchet MS"';
    ctx.textBaseline = 'top';
    ctx.fillText(PlayerLib.speciesName(c).toUpperCase(), x + 8, y + 6);
    ctx.fillText(`Lv${c.level}`, x + 145, y + 6);
    // HP bar
    const barX = x + 8, barY = y + 22, barW = 164, barH = 6;
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(barX, barY, barW, barH);
    const ratio = Math.max(0, hpDisp / c.stats.hp);
    let col = '#3aff60'; if (ratio < 0.5) col = '#ffce3a'; if (ratio < 0.25) col = '#ff5a3a';
    ctx.fillStyle = col;
    ctx.fillRect(barX, barY, Math.floor(barW * ratio), barH);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    if (isPlayer) {
      ctx.fillText(`${Math.ceil(hpDisp)} / ${c.stats.hp}`, barX, y + 32);
      // exp bar
      const eMin = Data.expForLevel(c.level);
      const eMax = Data.expForLevel(c.level + 1);
      const eRatio = Math.max(0, Math.min(1, (c.exp - eMin) / Math.max(1, eMax - eMin)));
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(barX, y + 46, barW, 3);
      ctx.fillStyle = '#3aa6ff';
      ctx.fillRect(barX, y + 46, Math.floor(barW * eRatio), 3);
    }
    // Status badge
    if (c.status !== Data.STATUS.NONE) {
      const badge = c.status.slice(0, 3);
      const sc = c.status === Data.STATUS.BURN ? '#ff5a3a'
        : c.status === Data.STATUS.PARALYSIS ? '#ffce3a'
        : c.status === Data.STATUS.POISON ? '#a070ff'
        : c.status === Data.STATUS.SLEEP ? '#6890f0'
        : c.status === Data.STATUS.FREEZE ? '#98d8d8' : '#fff';
      ctx.fillStyle = sc;
      ctx.fillRect(x + 110, y + 6, 30, 14);
      ctx.fillStyle = '#0a0e14';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(badge, x + 116, y + 8);
    }
  }

  function drawBottomPanel(b, ctx) {
    const y = 240;
    ctx.fillStyle = '#1c2632';
    ctx.fillRect(0, y, W, H - y);
    ctx.strokeStyle = '#3a4a5c';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, y + 2, W - 4, H - y - 4);

    ctx.fillStyle = '#fff';
    ctx.font = '14px "Trebuchet MS"';
    ctx.textBaseline = 'top';

    if (b.text) {
      // Wrap text into 2 lines if needed
      const lines = wrapText(ctx, b.text, W - 30);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 14, y + 14 + i * 20);
      }
      if (b.textDone && b.awaitConfirm) {
        // ▼ blinking
        if (Math.floor(performance.now() / 400) % 2 === 0) {
          ctx.fillText('▼', W - 28, y + 50);
        }
      }
      return;
    }

    if (b.ui === 'MAIN') drawMainMenu(b, ctx, y);
    else if (b.ui === 'FIGHT') drawFightMenu(b, ctx, y);
    else if (b.ui === 'BAG') drawBagMenu(b, ctx, y);
    else if (b.ui === 'SWITCH') drawSwitchMenu(b, ctx, y);
  }

  function drawMainMenu(b, ctx, y) {
    const opts = ['FIGHT', 'BAG', 'TEAM', 'RUN'];
    const cols = 2, rows = 2;
    const boxW = 160, boxH = 30;
    for (let i = 0; i < opts.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const bx = 260 + col * (boxW + 8);
      const by = y + 10 + row * (boxH + 4);
      ctx.fillStyle = b.cursor === i ? '#3b4cca' : '#0a0e14';
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeStyle = '#3a4a5c';
      ctx.strokeRect(bx, by, boxW, boxH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Trebuchet MS"';
      ctx.fillText(opts[i], bx + 16, by + 8);
    }
    // Left side: status text
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Trebuchet MS"';
    ctx.fillText(`What will`, 14, y + 14);
    ctx.fillText(`${PlayerLib.speciesName(getActiveP(b))} do?`, 14, y + 34);
  }

  function drawFightMenu(b, ctx, y) {
    const moves = getActiveP(b).moves;
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const bx = 14 + col * 230;
      const by = y + 10 + row * 30;
      ctx.fillStyle = b.sub === i ? '#3b4cca' : '#0a0e14';
      ctx.fillRect(bx, by, 220, 26);
      ctx.strokeStyle = '#3a4a5c';
      ctx.strokeRect(bx, by, 220, 26);
      if (i < moves.length) {
        const move = Data.MOVES[moves[i].id];
        ctx.fillStyle = Data.TYPES[move.type].color;
        ctx.fillRect(bx + 6, by + 7, 12, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "Trebuchet MS"';
        ctx.fillText(move.name, bx + 24, by + 6);
        ctx.font = '10px monospace';
        ctx.fillStyle = moves[i].pp === 0 ? '#ff5a3a' : '#aaa';
        ctx.fillText(`PP ${moves[i].pp}/${moves[i].ppMax}`, bx + 150, by + 9);
      } else {
        ctx.fillStyle = '#444';
        ctx.font = '12px "Trebuchet MS"';
        ctx.fillText('—', bx + 8, by + 6);
      }
    }
  }

  function drawBagMenu(b, ctx, y) {
    const items = Object.keys(b.player.bag).filter(k => b.player.bag[k] > 0);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Trebuchet MS"';
    ctx.fillText('BAG', 14, y + 8);
    const maxShow = 4;
    const start = Math.max(0, Math.min(items.length - maxShow, b.sub - 1));
    for (let i = 0; i < Math.min(maxShow, items.length); i++) {
      const idx = start + i;
      const k = items[idx];
      const item = Data.ITEMS[k];
      const by = y + 24 + i * 14;
      ctx.fillStyle = b.sub === idx ? '#ffce3a' : '#fff';
      ctx.font = '12px "Trebuchet MS"';
      ctx.fillText(`${b.sub === idx ? '▶ ' : '  '}${item.name}`, 14, by);
      ctx.textAlign = 'right';
      ctx.fillText(`x${b.player.bag[k]}`, W - 14, by);
      ctx.textAlign = 'left';
    }
    if (items.length === 0) {
      ctx.fillStyle = '#aaa';
      ctx.fillText('No items.', 14, y + 36);
    }
    ctx.fillStyle = '#aaa';
    ctx.font = '10px "Trebuchet MS"';
    ctx.fillText('B = back', 14, y + 78);
  }

  function drawSwitchMenu(b, ctx, y) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Trebuchet MS"';
    ctx.fillText('TEAM', 14, y + 8);
    const party = b.player.party;
    for (let i = 0; i < party.length; i++) {
      const c = party[i];
      const by = y + 24 + i * 11;
      ctx.fillStyle = b.sub === i ? '#ffce3a' : (i === b.playerIdx ? '#888' : '#fff');
      ctx.font = '11px "Trebuchet MS"';
      const ratio = c.hp / c.stats.hp;
      const hpcolor = ratio > 0.5 ? '#3aff60' : ratio > 0.25 ? '#ffce3a' : '#ff5a3a';
      ctx.fillText(`${b.sub === i ? '▶' : ' '} ${PlayerLib.speciesName(c)}  Lv${c.level}`, 14, by);
      // hp bar mini
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(200, by + 3, 60, 4);
      ctx.fillStyle = c.hp <= 0 ? '#555' : hpcolor;
      ctx.fillRect(200, by + 3, Math.max(0, Math.floor(60 * ratio)), 4);
      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      ctx.fillText(c.hp <= 0 ? 'FNT' : `${c.hp}/${c.stats.hp}`, 268, by);
    }
    ctx.fillStyle = '#aaa';
    ctx.font = '10px "Trebuchet MS"';
    ctx.fillText(b.forceSwitch ? 'Choose next critter!' : 'B = back', 14, y + 78);
  }

  function drawBallAnim(b, ctx) {
    const a = b.ballAnim;
    const ball = Sprites.getBallSprite();
    let bx, by;
    const tx = 360, ty = 140;
    if (a.phase === 'throw') {
      const t = a.t / 0.6;
      bx = 90 + (tx - 90) * t;
      by = 220 + (ty - 220) * t - Math.sin(t * Math.PI) * 80;
      ctx.save();
      ctx.translate(bx + 8, by + 8);
      ctx.rotate(t * Math.PI * 3);
      ctx.drawImage(ball, -8, -8);
      ctx.restore();
    } else if (a.phase === 'wobble') {
      bx = tx; by = ty;
      const w = Math.sin(a.t * 16) * 4 * (a.wobbles < a.target ? 1 : 0);
      ctx.drawImage(ball, bx + w, by);
    } else {
      bx = tx; by = ty;
      ctx.drawImage(ball, bx, by);
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth) {
        lines.push(line); line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  global.MS.Battle = {
    startBattle, startIntroEvents, update, draw,
    calcDamage, isCritical, getActiveP,
  };
})(window);
