/* ============================================================
 * PokéQuest — Data Layer
 * Types, type chart, moves, creatures.
 * ============================================================ */
(function (global) {
  'use strict';

  const TYPES = {
    NORMAL:   { name: 'Normal',   color: '#a8a878', particle: '#d0d090' },
    FIRE:     { name: 'Fire',     color: '#f08030', particle: '#ffae5e' },
    WATER:    { name: 'Water',    color: '#6890f0', particle: '#9ec0ff' },
    GRASS:    { name: 'Grass',    color: '#78c850', particle: '#a8e878' },
    ELECTRIC: { name: 'Electric', color: '#f8d030', particle: '#fff070' },
    ICE:      { name: 'Ice',      color: '#98d8d8', particle: '#d4f0f0' },
    FIGHT:    { name: 'Fight',    color: '#c03028', particle: '#e87060' },
    PSYCHIC:  { name: 'Psychic',  color: '#f85888', particle: '#ff90b8' },
    DARK:     { name: 'Dark',     color: '#705848', particle: '#a08878' },
    STEEL:    { name: 'Steel',    color: '#b8b8d0', particle: '#d8d8e8' },
    DRAGON:   { name: 'Dragon',   color: '#7038f8', particle: '#a070ff' },
    GHOST:    { name: 'Ghost',    color: '#705898', particle: '#a088c0' },
    FLYING:   { name: 'Flying',   color: '#a890f0', particle: '#d0bcff' },
    GROUND:   { name: 'Ground',   color: '#e0c068', particle: '#f0d898' },
  };

  // Type effectiveness multipliers. [attacker][defender] = mult.
  // 1 default. 2 super effective, 0.5 not very effective, 0 no effect.
  const TYPE_CHART = (() => {
    const t = {};
    for (const k of Object.keys(TYPES)) t[k] = {};
    const set = (a, b, m) => { t[a][b] = m; };
    // Fire
    set('FIRE','GRASS',2); set('FIRE','ICE',2); set('FIRE','STEEL',2);
    set('FIRE','WATER',0.5); set('FIRE','FIRE',0.5); set('FIRE','DRAGON',0.5);
    // Water
    set('WATER','FIRE',2); set('WATER','GROUND',2);
    set('WATER','WATER',0.5); set('WATER','GRASS',0.5); set('WATER','DRAGON',0.5);
    // Grass
    set('GRASS','WATER',2); set('GRASS','GROUND',2);
    set('GRASS','FIRE',0.5); set('GRASS','GRASS',0.5); set('GRASS','FLYING',0.5);
    set('GRASS','STEEL',0.5); set('GRASS','DRAGON',0.5);
    // Electric
    set('ELECTRIC','WATER',2); set('ELECTRIC','FLYING',2);
    set('ELECTRIC','ELECTRIC',0.5); set('ELECTRIC','GRASS',0.5); set('ELECTRIC','DRAGON',0.5);
    set('ELECTRIC','GROUND',0);
    // Ice
    set('ICE','GRASS',2); set('ICE','GROUND',2); set('ICE','FLYING',2); set('ICE','DRAGON',2);
    set('ICE','FIRE',0.5); set('ICE','WATER',0.5); set('ICE','ICE',0.5); set('ICE','STEEL',0.5);
    // Fight
    set('FIGHT','NORMAL',2); set('FIGHT','ICE',2); set('FIGHT','DARK',2); set('FIGHT','STEEL',2);
    set('FIGHT','FLYING',0.5); set('FIGHT','PSYCHIC',0.5); set('FIGHT','GHOST',0);
    // Psychic
    set('PSYCHIC','FIGHT',2); set('PSYCHIC','PSYCHIC',0.5); set('PSYCHIC','STEEL',0.5);
    set('PSYCHIC','DARK',0);
    // Dark
    set('DARK','PSYCHIC',2); set('DARK','GHOST',2);
    set('DARK','FIGHT',0.5); set('DARK','DARK',0.5);
    // Steel
    set('STEEL','ICE',2);
    set('STEEL','FIRE',0.5); set('STEEL','WATER',0.5); set('STEEL','ELECTRIC',0.5); set('STEEL','STEEL',0.5);
    // Dragon
    set('DRAGON','DRAGON',2); set('DRAGON','STEEL',0.5);
    // Ghost
    set('GHOST','PSYCHIC',2); set('GHOST','GHOST',2); set('GHOST','NORMAL',0); set('GHOST','DARK',0.5);
    // Flying
    set('FLYING','GRASS',2); set('FLYING','FIGHT',2);
    set('FLYING','ELECTRIC',0.5); set('FLYING','STEEL',0.5);
    // Ground
    set('GROUND','FIRE',2); set('GROUND','ELECTRIC',2); set('GROUND','STEEL',2);
    set('GROUND','GRASS',0.5); set('GROUND','FLYING',0);
    // Normal
    set('NORMAL','GHOST',0); set('NORMAL','STEEL',0.5);
    return t;
  })();

  function typeEffect(attackType, defenderTypes) {
    let mult = 1;
    for (const d of defenderTypes) {
      const v = TYPE_CHART[attackType] && TYPE_CHART[attackType][d];
      if (v !== undefined) mult *= v;
    }
    return mult;
  }

  // Move categories
  const CAT = { PHYSICAL: 'PHYSICAL', SPECIAL: 'SPECIAL', STATUS: 'STATUS' };

  // Status effects
  const STATUS = {
    NONE: 'NONE', BURN: 'BURN', POISON: 'POISON', PARALYSIS: 'PARALYSIS',
    SLEEP: 'SLEEP', FREEZE: 'FREEZE',
  };

  // Move library. Power: damage. accuracy: 0-100. effect: optional status/percent.
  const MOVES = {
    TACKLE:      { name: 'Tackle',      type: 'NORMAL',   cat: CAT.PHYSICAL, power: 40, accuracy: 100, pp: 35 },
    SCRATCH:     { name: 'Scratch',     type: 'NORMAL',   cat: CAT.PHYSICAL, power: 40, accuracy: 100, pp: 35 },
    QUICK_ATTACK:{ name: 'Quick Attack',type: 'NORMAL',   cat: CAT.PHYSICAL, power: 40, accuracy: 100, pp: 30, priority: 1 },
    BITE:        { name: 'Bite',        type: 'DARK',     cat: CAT.PHYSICAL, power: 60, accuracy: 100, pp: 25 },
    BODY_SLAM:   { name: 'Body Slam',   type: 'NORMAL',   cat: CAT.PHYSICAL, power: 85, accuracy: 100, pp: 15, effect: { paralyze: 30 } },
    HYPER_BEAM:  { name: 'Hyper Beam',  type: 'NORMAL',   cat: CAT.SPECIAL,  power: 150, accuracy: 90, pp: 5 },

    EMBER:       { name: 'Ember',       type: 'FIRE',     cat: CAT.SPECIAL,  power: 40, accuracy: 100, pp: 25, effect: { burn: 10 } },
    FLAMETHROWER:{ name: 'Flamethrower',type: 'FIRE',     cat: CAT.SPECIAL,  power: 90, accuracy: 100, pp: 15, effect: { burn: 10 } },
    FIRE_FANG:   { name: 'Fire Fang',   type: 'FIRE',     cat: CAT.PHYSICAL, power: 65, accuracy: 95, pp: 15, effect: { burn: 10 } },
    FIRE_BLAST:  { name: 'Fire Blast',  type: 'FIRE',     cat: CAT.SPECIAL,  power: 110, accuracy: 85, pp: 5, effect: { burn: 30 } },

    WATER_GUN:   { name: 'Water Gun',   type: 'WATER',    cat: CAT.SPECIAL,  power: 40, accuracy: 100, pp: 25 },
    BUBBLE:      { name: 'Bubble',      type: 'WATER',    cat: CAT.SPECIAL,  power: 40, accuracy: 100, pp: 30 },
    SURF:        { name: 'Surf',        type: 'WATER',    cat: CAT.SPECIAL,  power: 90, accuracy: 100, pp: 15 },
    HYDRO_PUMP:  { name: 'Hydro Pump',  type: 'WATER',    cat: CAT.SPECIAL,  power: 110, accuracy: 80, pp: 5 },

    VINE_WHIP:   { name: 'Vine Whip',   type: 'GRASS',    cat: CAT.PHYSICAL, power: 45, accuracy: 100, pp: 25 },
    RAZOR_LEAF:  { name: 'Razor Leaf',  type: 'GRASS',    cat: CAT.PHYSICAL, power: 55, accuracy: 95, pp: 25 },
    LEAF_BLADE:  { name: 'Leaf Blade',  type: 'GRASS',    cat: CAT.PHYSICAL, power: 90, accuracy: 100, pp: 15 },
    SOLAR_BEAM:  { name: 'Solar Beam',  type: 'GRASS',    cat: CAT.SPECIAL,  power: 120, accuracy: 100, pp: 10 },

    THUNDERSHOCK:{ name: 'ThunderShock',type: 'ELECTRIC', cat: CAT.SPECIAL,  power: 40, accuracy: 100, pp: 30, effect: { paralyze: 10 } },
    SPARK:       { name: 'Spark',       type: 'ELECTRIC', cat: CAT.PHYSICAL, power: 65, accuracy: 100, pp: 20, effect: { paralyze: 30 } },
    THUNDERBOLT: { name: 'Thunderbolt', type: 'ELECTRIC', cat: CAT.SPECIAL,  power: 90, accuracy: 100, pp: 15, effect: { paralyze: 10 } },
    THUNDER:     { name: 'Thunder',     type: 'ELECTRIC', cat: CAT.SPECIAL,  power: 110, accuracy: 70, pp: 10, effect: { paralyze: 30 } },

    ICE_SHARD:   { name: 'Ice Shard',   type: 'ICE',      cat: CAT.PHYSICAL, power: 40, accuracy: 100, pp: 30, priority: 1 },
    ICE_BEAM:    { name: 'Ice Beam',    type: 'ICE',      cat: CAT.SPECIAL,  power: 90, accuracy: 100, pp: 10, effect: { freeze: 10 } },
    BLIZZARD:    { name: 'Blizzard',    type: 'ICE',      cat: CAT.SPECIAL,  power: 110, accuracy: 70, pp: 5, effect: { freeze: 10 } },

    KARATE_CHOP: { name: 'Karate Chop', type: 'FIGHT',    cat: CAT.PHYSICAL, power: 50, accuracy: 100, pp: 25 },
    LOW_KICK:    { name: 'Low Kick',    type: 'FIGHT',    cat: CAT.PHYSICAL, power: 60, accuracy: 100, pp: 20 },
    BRICK_BREAK: { name: 'Brick Break', type: 'FIGHT',    cat: CAT.PHYSICAL, power: 75, accuracy: 100, pp: 15 },
    CLOSE_COMBAT:{ name: 'Close Combat',type: 'FIGHT',    cat: CAT.PHYSICAL, power: 120, accuracy: 100, pp: 5 },

    CONFUSION:   { name: 'Confusion',   type: 'PSYCHIC',  cat: CAT.SPECIAL,  power: 50, accuracy: 100, pp: 25 },
    PSYBEAM:     { name: 'Psybeam',     type: 'PSYCHIC',  cat: CAT.SPECIAL,  power: 65, accuracy: 100, pp: 20 },
    PSYCHIC:     { name: 'Psychic',     type: 'PSYCHIC',  cat: CAT.SPECIAL,  power: 90, accuracy: 100, pp: 10 },

    PURSUIT:     { name: 'Pursuit',     type: 'DARK',     cat: CAT.PHYSICAL, power: 40, accuracy: 100, pp: 20 },
    CRUNCH:      { name: 'Crunch',      type: 'DARK',     cat: CAT.PHYSICAL, power: 80, accuracy: 100, pp: 15 },
    DARK_PULSE:  { name: 'Dark Pulse',  type: 'DARK',     cat: CAT.SPECIAL,  power: 80, accuracy: 100, pp: 15 },

    METAL_CLAW:  { name: 'Metal Claw',  type: 'STEEL',    cat: CAT.PHYSICAL, power: 50, accuracy: 95, pp: 35 },
    IRON_HEAD:   { name: 'Iron Head',   type: 'STEEL',    cat: CAT.PHYSICAL, power: 80, accuracy: 100, pp: 15 },
    FLASH_CANNON:{ name: 'Flash Cannon',type: 'STEEL',    cat: CAT.SPECIAL,  power: 80, accuracy: 100, pp: 10 },

    DRAGON_BREATH:{ name:'Dragon Breath',type:'DRAGON',   cat: CAT.SPECIAL,  power: 60, accuracy: 100, pp: 20, effect: { paralyze: 30 } },
    DRAGON_PULSE:{ name: 'Dragon Pulse',type: 'DRAGON',   cat: CAT.SPECIAL,  power: 85, accuracy: 100, pp: 10 },
    OUTRAGE:     { name: 'Outrage',     type: 'DRAGON',   cat: CAT.PHYSICAL, power: 120, accuracy: 100, pp: 5 },

    SHADOW_SNEAK:{ name: 'Shadow Sneak',type: 'GHOST',    cat: CAT.PHYSICAL, power: 40, accuracy: 100, pp: 30, priority: 1 },
    SHADOW_BALL: { name: 'Shadow Ball', type: 'GHOST',    cat: CAT.SPECIAL,  power: 80, accuracy: 100, pp: 15 },

    GUST:        { name: 'Gust',        type: 'FLYING',   cat: CAT.SPECIAL,  power: 40, accuracy: 100, pp: 35 },
    WING_ATTACK: { name: 'Wing Attack', type: 'FLYING',   cat: CAT.PHYSICAL, power: 60, accuracy: 100, pp: 35 },
    AIR_SLASH:   { name: 'Air Slash',   type: 'FLYING',   cat: CAT.SPECIAL,  power: 75, accuracy: 95, pp: 15 },

    ROCK_THROW:  { name: 'Rock Throw',  type: 'GROUND',   cat: CAT.PHYSICAL, power: 50, accuracy: 90, pp: 15 },
    EARTHQUAKE:  { name: 'Earthquake',  type: 'GROUND',   cat: CAT.PHYSICAL, power: 100, accuracy: 100, pp: 10 },

    // Status moves
    GROWL:       { name: 'Growl',       type: 'NORMAL',   cat: CAT.STATUS,   power: 0, accuracy: 100, pp: 40, effect: { lowerAtk: 1 } },
    LEER:        { name: 'Leer',        type: 'NORMAL',   cat: CAT.STATUS,   power: 0, accuracy: 100, pp: 30, effect: { lowerDef: 1 } },
    THUNDER_WAVE:{ name: 'Thunder Wave',type: 'ELECTRIC', cat: CAT.STATUS,   power: 0, accuracy: 90, pp: 20, effect: { paralyze: 100 } },
    HARDEN:      { name: 'Harden',      type: 'NORMAL',   cat: CAT.STATUS,   power: 0, accuracy: 100, pp: 30, effect: { raiseDef: 1 } },
    AGILITY:     { name: 'Agility',     type: 'PSYCHIC',  cat: CAT.STATUS,   power: 0, accuracy: 100, pp: 30, effect: { raiseSpe: 2 } },
    TAILWHIP:    { name: 'Tail Whip',   type: 'NORMAL',   cat: CAT.STATUS,   power: 0, accuracy: 100, pp: 30, effect: { lowerDef: 1 } },
  };

  /* Creature blueprints — 16 unique critters.
     Each blueprint includes:
      - name, types
      - base stats { hp, atk, def, spa, spd, spe }
      - moves at given levels
      - sprite design (rendered procedurally by sprites.js)
      - rarity tier (used for encounter weighting)
  */
  const CREATURES = {
    FLAREPUP: {
      id: 'FLAREPUP', name: 'Flarepup', types: ['FIRE'],
      base: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
      learnset: [
        [1,'SCRATCH'], [1,'GROWL'], [4,'EMBER'], [9,'QUICK_ATTACK'],
        [14,'FIRE_FANG'], [20,'BITE'], [28,'FLAMETHROWER'], [40,'FIRE_BLAST'],
      ],
      catchRate: 45,
      design: { body: 'fox-pup', primary: '#ff7043', secondary: '#ffb04a', accent: '#3a1a08', eye: '#e2f7ff', features: ['fox-ear', 'tail-puff'] },
    },
    AQUALET: {
      id: 'AQUALET', name: 'Aqualet', types: ['WATER'],
      base: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 },
      learnset: [
        [1,'TACKLE'], [1,'LEER'], [4,'WATER_GUN'], [10,'BUBBLE'],
        [15,'BITE'], [22,'HARDEN'], [30,'SURF'], [42,'HYDRO_PUMP'],
      ],
      catchRate: 45,
      design: { body: 'turtle', primary: '#3aa6ff', secondary: '#c9efff', accent: '#1c4b80', eye: '#fff', features: ['shell-blue', 'flipper'] },
    },
    SPROUTLING: {
      id: 'SPROUTLING', name: 'Sproutling', types: ['GRASS'],
      base: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 },
      learnset: [
        [1,'TACKLE'], [3,'GROWL'], [7,'VINE_WHIP'], [13,'RAZOR_LEAF'],
        [20,'BITE'], [27,'LEAF_BLADE'], [36,'SOLAR_BEAM'],
      ],
      catchRate: 45,
      design: { body: 'plant', primary: '#5fc555', secondary: '#aedf72', accent: '#2c5e2a', eye: '#1b1b1b', features: ['leaf-crown', 'bud-tail'] },
    },
    SHOCKMOUSE: {
      id: 'SHOCKMOUSE', name: 'Shockmouse', types: ['ELECTRIC'],
      base: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
      learnset: [
        [1,'QUICK_ATTACK'], [1,'GROWL'], [5,'THUNDERSHOCK'], [10,'TAILWHIP'],
        [13,'THUNDER_WAVE'], [18,'SPARK'], [26,'THUNDERBOLT'], [38,'THUNDER'],
      ],
      catchRate: 75,
      design: { body: 'mouse', primary: '#ffd84a', secondary: '#fff2a8', accent: '#7a4b00', eye: '#000', features: ['cheek-spark', 'zigzag-tail'] },
    },
    CINDERLOPE: {
      id: 'CINDERLOPE', name: 'Cinderlope', types: ['FIRE'],
      base: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
      learnset: [
        [1,'SCRATCH'], [1,'EMBER'], [16,'FIRE_FANG'], [22,'QUICK_ATTACK'],
        [30,'BITE'], [38,'FLAMETHROWER'], [50,'FIRE_BLAST'],
      ],
      catchRate: 18,
      design: { body: 'fox-large', primary: '#ff5c1a', secondary: '#ffcc66', accent: '#3a1a08', eye: '#fff', features: ['fox-ear', 'flame-tail', 'mane'] },
    },
    TIDALSHELL: {
      id: 'TIDALSHELL', name: 'Tidalshell', types: ['WATER','STEEL'],
      base: { hp: 79, atk: 83, def: 100, spa: 85, spd: 105, spe: 78 },
      learnset: [
        [1,'TACKLE'], [1,'WATER_GUN'], [16,'BITE'], [22,'METAL_CLAW'],
        [30,'SURF'], [38,'IRON_HEAD'], [50,'HYDRO_PUMP'],
      ],
      catchRate: 18,
      design: { body: 'turtle-large', primary: '#1976d2', secondary: '#82caff', accent: '#0d3858', eye: '#fff', features: ['shell-steel', 'spike-shell'] },
    },
    BLOOMTHORN: {
      id: 'BLOOMTHORN', name: 'Bloomthorn', types: ['GRASS','DARK'],
      base: { hp: 80, atk: 100, def: 78, spa: 84, spd: 85, spe: 78 },
      learnset: [
        [1,'TACKLE'], [1,'VINE_WHIP'], [16,'RAZOR_LEAF'], [22,'BITE'],
        [30,'LEAF_BLADE'], [38,'CRUNCH'], [50,'SOLAR_BEAM'],
      ],
      catchRate: 18,
      design: { body: 'plant-large', primary: '#3b8e3b', secondary: '#9fd44f', accent: '#1b3b1b', eye: '#ff2222', features: ['leaf-crown', 'thorn-mane', 'fang'] },
    },
    VOLTAIL: {
      id: 'VOLTAIL', name: 'Voltail', types: ['ELECTRIC'],
      base: { hp: 60, atk: 90, def: 55, spa: 90, spd: 80, spe: 110 },
      learnset: [
        [1,'QUICK_ATTACK'], [1,'THUNDERSHOCK'], [16,'SPARK'], [22,'THUNDER_WAVE'],
        [30,'THUNDERBOLT'], [38,'IRON_HEAD'], [50,'THUNDER'],
      ],
      catchRate: 30,
      design: { body: 'mouse-large', primary: '#ffe14a', secondary: '#ffaa00', accent: '#7a4b00', eye: '#1b1b1b', features: ['cheek-spark', 'lightning-tail', 'mane'] },
    },
    PEBBLIX: {
      id: 'PEBBLIX', name: 'Pebblix', types: ['GROUND','STEEL'],
      base: { hp: 55, atk: 70, def: 105, spa: 25, spd: 60, spe: 25 },
      learnset: [
        [1,'TACKLE'], [1,'HARDEN'], [6,'ROCK_THROW'], [14,'METAL_CLAW'],
        [22,'IRON_HEAD'], [30,'EARTHQUAKE'], [40,'FLASH_CANNON'],
      ],
      catchRate: 90,
      design: { body: 'rock', primary: '#9c8367', secondary: '#c3a47e', accent: '#3b2a18', eye: '#fff', features: ['stone-armor', 'horn'] },
    },
    FROSTBEAK: {
      id: 'FROSTBEAK', name: 'Frostbeak', types: ['ICE','FLYING'],
      base: { hp: 55, atk: 60, def: 50, spa: 80, spd: 75, spe: 95 },
      learnset: [
        [1,'GUST'], [1,'QUICK_ATTACK'], [6,'ICE_SHARD'], [14,'WING_ATTACK'],
        [22,'AIR_SLASH'], [30,'ICE_BEAM'], [40,'BLIZZARD'],
      ],
      catchRate: 60,
      design: { body: 'bird', primary: '#aee0f5', secondary: '#ffffff', accent: '#2a5f7a', eye: '#000', features: ['wing-blue', 'crest-ice'] },
    },
    SHADOWCLAW: {
      id: 'SHADOWCLAW', name: 'Shadowclaw', types: ['DARK','GHOST'],
      base: { hp: 65, atk: 110, def: 60, spa: 65, spd: 60, spe: 95 },
      learnset: [
        [1,'SCRATCH'], [1,'PURSUIT'], [10,'BITE'], [16,'SHADOW_SNEAK'],
        [24,'CRUNCH'], [32,'SHADOW_BALL'], [42,'DARK_PULSE'],
      ],
      catchRate: 30,
      design: { body: 'cat', primary: '#3a2f55', secondary: '#7d619a', accent: '#0e0a1f', eye: '#ffd84a', features: ['ear-tuft', 'tail-whip', 'fang'] },
    },
    MINDLING: {
      id: 'MINDLING', name: 'Mindling', types: ['PSYCHIC'],
      base: { hp: 60, atk: 40, def: 55, spa: 105, spd: 95, spe: 70 },
      learnset: [
        [1,'CONFUSION'], [1,'GROWL'], [12,'PSYBEAM'], [20,'AGILITY'],
        [28,'PSYCHIC'], [38,'DARK_PULSE'],
      ],
      catchRate: 45,
      design: { body: 'orb', primary: '#f06a96', secondary: '#ffd0e0', accent: '#5e0e2a', eye: '#fff', features: ['floating', 'aura', 'third-eye'] },
    },
    DRAKELET: {
      id: 'DRAKELET', name: 'Drakelet', types: ['DRAGON'],
      base: { hp: 50, atk: 64, def: 50, spa: 45, spd: 50, spe: 41 },
      learnset: [
        [1,'TACKLE'], [1,'LEER'], [8,'DRAGON_BREATH'], [14,'BITE'],
        [22,'CRUNCH'], [30,'DRAGON_PULSE'], [42,'OUTRAGE'],
      ],
      catchRate: 45,
      design: { body: 'dragon-small', primary: '#6a52d4', secondary: '#b7a6ff', accent: '#1b0e5e', eye: '#ffd84a', features: ['horn', 'wing-small', 'tail-spike'] },
    },
    SKYFLAME: {
      id: 'SKYFLAME', name: 'Skyflame', types: ['FIRE','FLYING'],
      base: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
      learnset: [
        [1,'GUST'], [1,'EMBER'], [16,'WING_ATTACK'], [22,'FIRE_FANG'],
        [30,'AIR_SLASH'], [38,'FLAMETHROWER'], [50,'FIRE_BLAST'],
      ],
      catchRate: 15,
      design: { body: 'bird-phoenix', primary: '#ff5722', secondary: '#ffeb3b', accent: '#5e1700', eye: '#fff', features: ['wing-flame', 'crest-flame', 'tail-flame'] },
    },
    STEELHORN: {
      id: 'STEELHORN', name: 'Steelhorn', types: ['STEEL','FIGHT'],
      base: { hp: 90, atk: 120, def: 100, spa: 50, spd: 70, spe: 50 },
      learnset: [
        [1,'TACKLE'], [1,'LEER'], [10,'KARATE_CHOP'], [18,'METAL_CLAW'],
        [26,'BRICK_BREAK'], [34,'IRON_HEAD'], [44,'CLOSE_COMBAT'],
      ],
      catchRate: 20,
      design: { body: 'bull', primary: '#7a8a99', secondary: '#cdd3da', accent: '#1b2535', eye: '#ff2222', features: ['horn-double', 'plate-armor', 'hoof'] },
    },
    MYSTIQUA: {
      id: 'MYSTIQUA', name: 'Mystiqua', types: ['PSYCHIC','WATER'],
      base: { hp: 95, atk: 75, def: 80, spa: 100, spd: 110, spe: 75 },
      learnset: [
        [1,'WATER_GUN'], [1,'CONFUSION'], [16,'PSYBEAM'], [22,'SURF'],
        [30,'PSYCHIC'], [40,'HYDRO_PUMP'],
      ],
      catchRate: 25,
      design: { body: 'serpent', primary: '#5ec8e7', secondary: '#e0c8ff', accent: '#22425e', eye: '#fff', features: ['fin', 'pearl', 'third-eye'] },
    },
  };

  // Encounter tables (per map)
  const ENCOUNTERS = {
    ROUTE1: [
      { id: 'SHOCKMOUSE', weight: 35, lvl: [3, 5] },
      { id: 'SPROUTLING', weight: 25, lvl: [3, 5] },
      { id: 'FLAREPUP',   weight: 15, lvl: [4, 6] },
      { id: 'AQUALET',    weight: 15, lvl: [4, 6] },
      { id: 'PEBBLIX',    weight: 10, lvl: [4, 7] },
    ],
    FOREST: [
      { id: 'SPROUTLING', weight: 30, lvl: [6, 9] },
      { id: 'BLOOMTHORN', weight: 5,  lvl: [12, 14] },
      { id: 'SHADOWCLAW', weight: 15, lvl: [8, 11] },
      { id: 'MINDLING',   weight: 15, lvl: [7, 10] },
      { id: 'FROSTBEAK',  weight: 15, lvl: [7, 10] },
      { id: 'DRAKELET',   weight: 5,  lvl: [10, 12] },
      { id: 'SHOCKMOUSE', weight: 15, lvl: [6, 9] },
    ],
    CAVE: [
      { id: 'PEBBLIX',    weight: 35, lvl: [10, 13] },
      { id: 'AQUALET',    weight: 15, lvl: [12, 14] },
      { id: 'TIDALSHELL', weight: 5,  lvl: [18, 20] },
      { id: 'DRAKELET',   weight: 15, lvl: [12, 15] },
      { id: 'SHADOWCLAW', weight: 15, lvl: [11, 14] },
      { id: 'MYSTIQUA',   weight: 5,  lvl: [18, 22] },
      { id: 'STEELHORN',  weight: 10, lvl: [16, 18] },
    ],
    SUMMIT: [
      { id: 'FROSTBEAK',  weight: 25, lvl: [16, 20] },
      { id: 'SKYFLAME',   weight: 8,  lvl: [22, 26] },
      { id: 'CINDERLOPE', weight: 8,  lvl: [22, 26] },
      { id: 'STEELHORN',  weight: 20, lvl: [18, 22] },
      { id: 'DRAKELET',   weight: 20, lvl: [16, 20] },
      { id: 'MINDLING',   weight: 19, lvl: [16, 20] },
    ],
  };

  // Items
  const ITEMS = {
    POTION:    { id: 'POTION',    name: 'Potion',     desc: 'Heals 20 HP.',  use: 'heal',  amount: 20,  price: 200 },
    SUPER_POT: { id: 'SUPER_POT', name: 'Super Potion', desc: 'Heals 60 HP.', use: 'heal', amount: 60,  price: 700 },
    HYPER_POT: { id: 'HYPER_POT', name: 'Hyper Potion', desc: 'Heals 200 HP.', use: 'heal', amount: 200, price: 1500 },
    REVIVE:    { id: 'REVIVE',    name: 'Revive',     desc: 'Revives w/ 1/2 HP.', use: 'revive', amount: 0.5, price: 1500 },
    POKEBALL:  { id: 'POKEBALL',  name: 'Critter Ball', desc: 'Catches a wild critter.', use: 'ball', rate: 1.0, price: 200 },
    GREATBALL: { id: 'GREATBALL', name: 'Great Ball',   desc: 'Better catch rate.',    use: 'ball', rate: 1.5, price: 600 },
    ULTRABALL: { id: 'ULTRABALL', name: 'Ultra Ball',   desc: 'High catch rate.',      use: 'ball', rate: 2.0, price: 1200 },
  };

  // Exp curve (medium-fast: n^3)
  function expForLevel(level) { return Math.floor(Math.pow(level, 3)); }
  function levelFromExp(exp) {
    let lv = 1; while (expForLevel(lv + 1) <= exp && lv < 100) lv++;
    return lv;
  }

  global.MS = global.MS || {};
  global.MS.Data = {
    TYPES, TYPE_CHART, typeEffect, CAT, STATUS, MOVES, CREATURES, ENCOUNTERS, ITEMS,
    expForLevel, levelFromExp,
  };
})(window);
