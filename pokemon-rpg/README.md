# PokéQuest — A Critter RPG

A self-contained, browser-native Pokémon-style RPG. Open `index.html` in any
modern browser. No build step. No bundler. No external assets — every sprite,
tile, and sound is generated procedurally at runtime.

## Quick start

```bash
# from this directory
python3 -m http.server 8080
# or:
npx serve .
# or just double-click index.html
```

Then open <http://localhost:8080> (or the file directly — both work).

## Controls

| Key             | Action                              |
| --------------- | ----------------------------------- |
| Arrow keys / WASD | Move                              |
| `Z` / Space     | Confirm / Talk / Read sign          |
| `X` / Esc       | Cancel / Open menu                  |
| `Enter`         | Start / Pause                       |
| `P`             | Save game (localStorage)            |
| `M`             | Mute / unmute                       |

On mobile or touch screens, an on-screen D-pad and A/B/Start appear.

## Features

- **16 unique critters** across 11 elemental types — all sprites procedurally
  drawn in JavaScript at boot. Front and back battle sprites.
- **7 maps**: Verdant Town, the Critter Center (heal), the Critter Mart (shop),
  Route 1, Verdant Forest, Coastal Cave, Summit Peak.
- **Full turn-based battles**: physical/special/status moves, type-effectiveness
  chart, STAB, criticals, status effects (Burn, Paralysis, Poison, Sleep,
  Freeze), priority moves, and a faithful damage formula.
- **Capture mechanic**: throw Critter Balls with wobble animation and shake
  count odds based on remaining HP, status, ball quality, and species catch
  rate.
- **Full party management**: 6-slot team + overflow PC, switch, heal items,
  revives.
- **Pokédex**: tracks Seen / Caught, shows base stats and types.
- **Procedural chiptune**: ambient music per zone (town / route / cave /
  battle / victory) plus per-type attack SFX, all synthesized with the
  WebAudio API.
- **Pixel-art rendering** at 480×320 logical, integer-scaled with
  `image-rendering: pixelated`.
- **Save / load**: writes JSON to `localStorage`. Press `P` anywhere outside
  battle, or use the in-menu **SAVE** option.

## Architecture

```
pokemon-rpg/
├── index.html
├── css/style.css
└── js/
    ├── data.js     — types, type chart, 16 creatures, 54 moves, items
    ├── sprites.js  — procedural sprite/tile generation (zero external assets)
    ├── audio.js    — WebAudio SFX + music tracks
    ├── input.js    — keyboard + touch
    ├── world.js    — 7 hand-designed maps, NPCs, signs, warps, encounters
    ├── player.js   — player state, party, stats, EXP curve, save/load
    ├── battle.js   — turn-based battle, animations, particles, capture
    ├── ui.js       — dialog system, menus, title, pokedex, shop
    └── game.js     — state machine + main loop
```

No frameworks. No dependencies. Pure ES5+/ES2018 JavaScript that runs from
`file://`.

## Walkthrough

1. Pick a starter: Flarepup (Fire), Aqualet (Water), or Sproutling (Grass).
2. Explore Verdant Town — talk to NPCs, visit the **Critter Center** to heal,
   the **Critter Mart** to buy Potions and Critter Balls.
3. Head **south** through the path tile to Route 1 — step into tall grass for
   wild encounters.
4. Continue south through Verdant Forest, Coastal Cave, and up to Summit Peak,
   where the strongest critters live.

## Tips

- Type matchups matter. Water beats Fire. Electric beats Water. Ground beats
  Electric. The HUD shows colored type indicators next to move names.
- Catch with low HP and status conditions (sleep/freeze are best).
- HP, level, and EXP all save with your game.
