/* ============================================================
 * PokéQuest — Player & Party
 * - Player position, direction, animation frame
 * - Party (up to 6 creatures), each with current stats
 * - Inventory (items)
 * - Money, steps, badge tracking
 * ============================================================ */
(function (global) {
  'use strict';

  const Data = global.MS.Data;

  // Compute stat from base + level (simplified Pokémon formula, no IVs/EVs)
  function calcStat(base, level, isHP = false) {
    if (isHP) return Math.floor(((2 * base) * level) / 100) + level + 10;
    return Math.floor(((2 * base) * level) / 100) + 5;
  }

  function newCreature(speciesId, level) {
    const sp = Data.CREATURES[speciesId];
    if (!sp) throw new Error('Unknown species: ' + speciesId);
    const stats = {
      hp:  calcStat(sp.base.hp, level, true),
      atk: calcStat(sp.base.atk, level),
      def: calcStat(sp.base.def, level),
      spa: calcStat(sp.base.spa, level),
      spd: calcStat(sp.base.spd, level),
      spe: calcStat(sp.base.spe, level),
    };
    // Determine moves: pick up to 4 latest learnable for this level
    const learned = sp.learnset.filter(([lv]) => lv <= level).map(([, m]) => m);
    const moves = learned.slice(-4).map(id => {
      const m = Data.MOVES[id];
      return { id, pp: m ? m.pp : 0, ppMax: m ? m.pp : 0 };
    });
    const c = {
      speciesId,
      level,
      exp: Data.expForLevel(level),
      hp: stats.hp,
      stats,
      moves,
      status: Data.STATUS.NONE,
      nickname: null,
      // battle-only stat stages
    };
    return c;
  }

  function isFainted(c) { return c.hp <= 0; }
  function fullHeal(c) {
    c.hp = c.stats.hp;
    c.status = Data.STATUS.NONE;
    for (const m of c.moves) m.pp = m.ppMax;
  }

  function speciesName(c) {
    return c.nickname || Data.CREATURES[c.speciesId].name;
  }

  // Add experience and level up. Returns array of level-up events.
  function gainExp(c, amount) {
    const events = [];
    c.exp += amount;
    let oldLevel = c.level;
    while (c.level < 100 && c.exp >= Data.expForLevel(c.level + 1)) {
      c.level++;
      // recompute stats, preserving HP ratio
      const sp = Data.CREATURES[c.speciesId];
      const oldMaxHP = c.stats.hp;
      const newStats = {
        hp:  calcStat(sp.base.hp, c.level, true),
        atk: calcStat(sp.base.atk, c.level),
        def: calcStat(sp.base.def, c.level),
        spa: calcStat(sp.base.spa, c.level),
        spd: calcStat(sp.base.spd, c.level),
        spe: calcStat(sp.base.spe, c.level),
      };
      const hpDelta = newStats.hp - oldMaxHP;
      c.stats = newStats;
      c.hp = Math.min(c.stats.hp, c.hp + Math.max(0, hpDelta));
      events.push({ type: 'LEVEL_UP', name: speciesName(c), level: c.level });
      // Auto-learn new moves
      for (const [lv, mvId] of sp.learnset) {
        if (lv === c.level && !c.moves.find(m => m.id === mvId)) {
          if (c.moves.length < 4) {
            const m = Data.MOVES[mvId];
            c.moves.push({ id: mvId, pp: m.pp, ppMax: m.pp });
            events.push({ type: 'LEARNED', name: speciesName(c), move: m.name });
          }
        }
      }
    }
    if (c.level > oldLevel) c.exp = Math.max(c.exp, Data.expForLevel(c.level));
    return events;
  }

  // -----------------------------------------------------------
  // Player state factory
  // -----------------------------------------------------------
  function newPlayer(starterId) {
    const p = {
      name: 'Hero',
      mapId: 'HOMETOWN',
      x: 10, y: 13,
      px: 10 * 16, py: 13 * 16,  // pixel pos for animation
      dir: 'down',
      moveT: 0,                  // 0..1 walk progress between tiles
      animFrame: 0,
      steps: 0,
      money: 1500,
      party: [],
      box: [],                    // overflow PC storage
      bag: { POTION: 5, POKEBALL: 5 },
      pokedex: { seen: new Set(), caught: new Set() },
      flags: {},
    };
    if (starterId) {
      const starter = newCreature(starterId, 5);
      p.party.push(starter);
      p.pokedex.seen.add(starterId);
      p.pokedex.caught.add(starterId);
    }
    return p;
  }

  function addToParty(player, creature) {
    player.pokedex.seen.add(creature.speciesId);
    player.pokedex.caught.add(creature.speciesId);
    if (player.party.length < 6) {
      player.party.push(creature);
      return 'PARTY';
    }
    player.box.push(creature);
    return 'BOX';
  }

  function healParty(player) {
    for (const c of player.party) fullHeal(c);
  }

  function firstNonFainted(player) {
    return player.party.findIndex(c => !isFainted(c));
  }

  function allFainted(player) {
    return player.party.every(c => isFainted(c));
  }

  function serialize(p) {
    return JSON.stringify({
      name: p.name, mapId: p.mapId, x: p.x, y: p.y, dir: p.dir,
      steps: p.steps, money: p.money,
      party: p.party, box: p.box, bag: p.bag, flags: p.flags,
      seen: Array.from(p.pokedex.seen),
      caught: Array.from(p.pokedex.caught),
    });
  }

  function deserialize(json) {
    const data = JSON.parse(json);
    const p = newPlayer(null);
    Object.assign(p, {
      name: data.name, mapId: data.mapId, x: data.x, y: data.y, dir: data.dir,
      steps: data.steps || 0, money: data.money || 0,
      party: data.party || [], box: data.box || [], bag: data.bag || {}, flags: data.flags || {},
    });
    p.px = p.x * 16; p.py = p.y * 16;
    p.pokedex.seen = new Set(data.seen || []);
    p.pokedex.caught = new Set(data.caught || []);
    return p;
  }

  global.MS.Player = {
    newCreature, newPlayer, addToParty, healParty,
    firstNonFainted, allFainted, isFainted, fullHeal, gainExp, speciesName,
    serialize, deserialize, calcStat,
  };
})(window);
