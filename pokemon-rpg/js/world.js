/* ============================================================
 * PokéQuest — World maps, NPCs, warps, encounter zones
 * Tile glyphs:
 *  . grass       , flower     ~ water      = path        T tree
 *  R rock        # tall_grass s sand       n snow
 *  c cave_floor  C cave_wall  W wall       D door        f floor
 *  G sign        r roof_red   b roof_blue
 * Solid tiles in SOLID set. All maps are uniformly 20 wide x 15 tall
 * (except interiors which are 10x9).
 * ============================================================ */
(function (global) {
  'use strict';

  const TILE = 16;
  const SOLID = new Set(['T', 'R', 'W', 'C', 'r', 'b', 'G', '~']);
  const TILE_NAME = {
    '.': 'grass', ',': 'flower', '~': 'water', '=': 'path', 'T': 'tree',
    'R': 'rock', '#': 'tall_grass', 's': 'sand', 'n': 'snow',
    'c': 'cave_floor', 'C': 'cave_wall', 'W': 'wall', 'D': 'door', 'f': 'floor',
    'G': 'sign', 'r': 'roof_red', 'b': 'roof_blue',
  };

  // -----------------------------------------------------------
  // MAPS — each row must be exactly `width` chars.
  // -----------------------------------------------------------
  const MAPS = {
    HOMETOWN: {
      name: 'Verdant Town',
      music: 'town',
      tiles: [
        'TTTTTTTTTTTTTTTTTTTT', // 0
        'T..,..,...........TT', // 1
        'T...rrrr....bbbb..TT', // 2 roofs
        'T...WWWW....WWWW..TT', // 3 walls
        'T...WDWW....WDWW..TT', // 4 doors @ x=5 and x=13
        'T...====....====..TT', // 5 path in front
        'T==================T', // 6 main road
        'T....,..G.,.......TT', // 7
        'T..........,......TT', // 8
        'T...,...........,.TT', // 9
        'T..,..............TT', // 10
        'T......,.........,TT', // 11
        'T..,...,......,...TT', // 12
        'T.................TT', // 13
        'TTTTTTTTTT==TTTTTTTT', // 14
      ],
      warps: [
        { x: 5, y: 4, target: 'CENTER', tx: 4, ty: 6, dir: 'down' },
        { x: 13, y: 4, target: 'MART', tx: 4, ty: 6, dir: 'down' },
        { x: 10, y: 14, target: 'ROUTE1', tx: 10, ty: 1, dir: 'down' },
        { x: 11, y: 14, target: 'ROUTE1', tx: 11, ty: 1, dir: 'down' },
      ],
      npcs: [
        { id: 'oldman', x: 8, y: 8, dir: 'down', dialog: [
          'Welcome to Verdant Town!',
          'The Critter Center heals your team — the Mart sells supplies.',
          'Head south to find wild critters in the tall grass.',
        ]},
        { id: 'kid', x: 14, y: 11, dir: 'left', dialog: [
          'I caught a Sproutling yesterday!',
          'Press Z facing tall grass to look for some yourself.',
        ]},
      ],
      signs: [
        { x: 8, y: 7, text: 'VERDANT TOWN\n"Where the journey begins."' },
      ],
    },

    CENTER: {
      name: 'Critter Center',
      music: 'town',
      interior: true,
      tiles: [
        'WWWWWWWWWW', // 0
        'WffffffffW', // 1
        'WffffffffW', // 2  nurse stands here at x=4, y=2
        'WffffffffW', // 3
        'WffffffffW', // 4
        'WffffffffW', // 5
        'WffffffffW', // 6
        'WfffDffffW', // 7 door at x=4
        'WWWWWWWWWW', // 8
      ],
      warps: [
        { x: 4, y: 7, target: 'HOMETOWN', tx: 5, ty: 5, dir: 'down' },
      ],
      npcs: [
        { id: 'nurse', x: 4, y: 2, dir: 'down', dialog: [
          'Hello! I can heal your critters to full health.',
        ], onTalk: 'HEAL_PARTY' },
      ],
      signs: [],
    },

    MART: {
      name: 'Critter Mart',
      music: 'town',
      interior: true,
      tiles: [
        'WWWWWWWWWW',
        'WffffffffW',
        'WffffffffW',
        'WffffffffW',
        'WffffffffW',
        'WffffffffW',
        'WffffffffW',
        'WfffDffffW',
        'WWWWWWWWWW',
      ],
      warps: [
        { x: 4, y: 7, target: 'HOMETOWN', tx: 13, ty: 5, dir: 'down' },
      ],
      npcs: [
        { id: 'clerk', x: 3, y: 2, dir: 'down', dialog: [
          'Welcome to the Critter Mart! What can I get you?',
        ], onTalk: 'OPEN_SHOP' },
      ],
      signs: [],
    },

    ROUTE1: {
      name: 'Route 1',
      music: 'overworld',
      tiles: [
        'TTTTTTTTTT==TTTTTTTT',
        'T.,.....,.==,.....TT',
        'T.....####==##....TT',
        'T..,..####==##...,TT',
        'T.....####==##....TT',
        'T..R..####==##..,.TT',
        'T..,..####==##....TT',
        'T.....####==##.R..TT',
        'T..,..####==##....TT',
        'T.....####==##..,.TT',
        'T..,..####==##....TT',
        'T..G..####==##.,..TT',
        'T..,..####==##....TT',
        'T.,...####==##..,.TT',
        'TTTTTTTT====TTTTTTTT',
      ],
      warps: [
        { x: 8, y: 14, target: 'FOREST', tx: 8, ty: 1, dir: 'down' },
        { x: 9, y: 14, target: 'FOREST', tx: 9, ty: 1, dir: 'down' },
        { x: 10, y: 14, target: 'FOREST', tx: 10, ty: 1, dir: 'down' },
        { x: 11, y: 14, target: 'FOREST', tx: 11, ty: 1, dir: 'down' },
        { x: 10, y: 0, target: 'HOMETOWN', tx: 10, ty: 13, dir: 'up' },
        { x: 11, y: 0, target: 'HOMETOWN', tx: 11, ty: 13, dir: 'up' },
      ],
      npcs: [
        { id: 'sage', x: 16, y: 8, dir: 'left', dialog: [
          'The wild critters here are young — perfect for training.',
          'Press Z in tall grass to fight, or use a Critter Ball to catch them!'
        ]},
      ],
      signs: [
        { x: 3, y: 11, text: 'ROUTE 1\nA winding path south.\nWild critters in the grass.' },
      ],
      encounters: 'ROUTE1',
    },

    FOREST: {
      name: 'Verdant Forest',
      music: 'overworld',
      tiles: [
        'TTTTTTTT====TTTTTTTT',
        'TTTTT,..====.,..TTTT',
        'TT...########..,.TTT',
        'TT.##############TTT',
        'TT###############,TT',
        'TT,##############.TT',
        'TT###############.TT',
        'TT.##############.TT',
        'TT,##############.TT',
        'TT.##############.TT',
        'TT,##############.TT',
        'TT...############.TT',
        'TT.G.############.TT',
        'TTT......######...TT',
        'TTTTTTTTT===TTTTTTTT',
      ],
      warps: [
        { x: 8, y: 0, target: 'ROUTE1', tx: 8, ty: 13, dir: 'up' },
        { x: 9, y: 0, target: 'ROUTE1', tx: 9, ty: 13, dir: 'up' },
        { x: 10, y: 0, target: 'ROUTE1', tx: 10, ty: 13, dir: 'up' },
        { x: 11, y: 0, target: 'ROUTE1', tx: 11, ty: 13, dir: 'up' },
        { x: 9, y: 14, target: 'CAVE', tx: 9, ty: 1, dir: 'down' },
        { x: 10, y: 14, target: 'CAVE', tx: 10, ty: 1, dir: 'down' },
        { x: 11, y: 14, target: 'CAVE', tx: 11, ty: 1, dir: 'down' },
      ],
      npcs: [
        { id: 'kid', x: 4, y: 7, dir: 'down', dialog: [
          'I lost my Mindling somewhere in the woods!',
          'If you see one, please be kind to it.'
        ]},
      ],
      signs: [
        { x: 3, y: 12, text: 'VERDANT FOREST\nMind your step — critters\nlurk in every patch.' },
      ],
      encounters: 'FOREST',
    },

    CAVE: {
      name: 'Coastal Cave',
      music: 'cave',
      tiles: [
        'CCCCCCCCC===CCCCCCCC',
        'CCcccccccccccccccCCC',
        'CCcccccccccccccccCCC',
        'CCcccccCcccccccccCCC',
        'CCccccccccccccCccCCC',
        'CCcccccccccccccccCCC',
        'CCccCcccccccCccccCCC',
        'CCccccccccccccccccCC',
        'CCcccccccCccccccccCC',
        'CCccccccccccccccccCC',
        'CCccccccccCccccccCCC',
        'CCcccccccccccccccCCC',
        'CCccccccccccccccCCCC',
        'CCCcccccccccccccCCCC',
        'CCCCCCCCC===CCCCCCCC',
      ],
      warps: [
        { x: 9, y: 0, target: 'FOREST', tx: 9, ty: 13, dir: 'up' },
        { x: 10, y: 0, target: 'FOREST', tx: 10, ty: 13, dir: 'up' },
        { x: 11, y: 0, target: 'FOREST', tx: 11, ty: 13, dir: 'up' },
        { x: 9, y: 14, target: 'SUMMIT', tx: 9, ty: 1, dir: 'down' },
        { x: 10, y: 14, target: 'SUMMIT', tx: 10, ty: 1, dir: 'down' },
        { x: 11, y: 14, target: 'SUMMIT', tx: 11, ty: 1, dir: 'down' },
      ],
      npcs: [],
      signs: [],
      encounters: 'CAVE',
      encounterChance: 0.18,
    },

    SUMMIT: {
      name: 'Summit Peak',
      music: 'overworld',
      tiles: [
        'CCCCCCCCC===CCCCCCCC',
        'CCnnnnnnnnnnnnnnnCCC',
        'Cnnnnn########nnnCCC',
        'Cnnn############nCCC',
        'Cnn##############CCC',
        'Cnn##############nCC',
        'Cn###############nCC',
        'Cn###############nCC',
        'Cn###############nCC',
        'Cnn##############nCC',
        'Cnn##############CCC',
        'CCnnG###########nCCC',
        'CCnnnnnn######nnnCCC',
        'CCCnnnnnnnnnnnnnCCCC',
        'CCCCCCCCCCCCCCCCCCCC',
      ],
      warps: [
        { x: 9, y: 0, target: 'CAVE', tx: 9, ty: 13, dir: 'up' },
        { x: 10, y: 0, target: 'CAVE', tx: 10, ty: 13, dir: 'up' },
        { x: 11, y: 0, target: 'CAVE', tx: 11, ty: 13, dir: 'up' },
      ],
      npcs: [
        { id: 'sage', x: 6, y: 7, dir: 'down', dialog: [
          'You\'ve climbed far, trainer.',
          'The strongest critters call this peak home.',
          'Show them the bond you share with your team!'
        ]},
      ],
      signs: [
        { x: 4, y: 11, text: 'SUMMIT PEAK\n"Where legends nest."' },
      ],
      encounters: 'SUMMIT',
    },
  };

  // Validate dimensions (dev-time safety)
  function validate() {
    for (const key of Object.keys(MAPS)) {
      const m = MAPS[key];
      const w = m.tiles[0].length;
      for (const r of m.tiles) {
        if (r.length !== w) console.warn(`Map ${key} has inconsistent row width`, r.length, 'vs', w);
      }
      m.width = w;
      m.height = m.tiles.length;
    }
  }
  validate();

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function getMap(id) { return MAPS[id]; }
  function getTileChar(map, x, y) {
    if (y < 0 || y >= map.height || x < 0 || x >= map.width) return map.interior ? 'W' : 'T';
    return map.tiles[y][x];
  }
  function isSolid(map, x, y) {
    const ch = getTileChar(map, x, y);
    return SOLID.has(ch);
  }
  function isTallGrass(map, x, y) { return getTileChar(map, x, y) === '#'; }
  function isDoor(map, x, y) { return getTileChar(map, x, y) === 'D'; }

  function findWarp(map, x, y) {
    if (!map.warps) return null;
    return map.warps.find(w => w.x === x && w.y === y) || null;
  }
  function findNPC(map, x, y) {
    if (!map.npcs) return null;
    return map.npcs.find(n => n.x === x && n.y === y) || null;
  }
  function findSign(map, x, y) {
    if (!map.signs) return null;
    return map.signs.find(s => s.x === x && s.y === y) || null;
  }

  // -----------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------
  function draw(ctx, map, camX, camY, viewW, viewH, Sprites) {
    const startX = Math.max(0, Math.floor(camX / TILE));
    const startY = Math.max(0, Math.floor(camY / TILE));
    const endX = Math.min(map.width, Math.ceil((camX + viewW) / TILE));
    const endY = Math.min(map.height, Math.ceil((camY + viewH) / TILE));

    // Fill background (out-of-map area)
    ctx.fillStyle = map.interior ? '#1a1408' : '#0a0e14';
    ctx.fillRect(0, 0, viewW, viewH);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const ch = map.tiles[y][x];
        const tileName = TILE_NAME[ch];
        if (!tileName) continue;
        const img = Sprites.getTile(tileName);
        if (img) ctx.drawImage(img, x * TILE - camX, y * TILE - camY);
      }
    }
  }

  function getEncounterRoll(map) { return map.encounterChance || 0.10; }

  global.MS.World = {
    MAPS, getMap, getTileChar, isSolid, isTallGrass, isDoor,
    findWarp, findNPC, findSign,
    draw, getEncounterRoll, TILE, SOLID, TILE_NAME,
  };
})(window);
