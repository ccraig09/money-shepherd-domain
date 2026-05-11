/* ============================================================
 * PokéQuest — Input
 * Keyboard + on-screen touch buttons. Edge detection + held.
 * ============================================================ */
(function (global) {
  'use strict';

  const held = new Set();
  const pressed = new Set();   // edge-down this frame
  const released = new Set();  // edge-up this frame

  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right',
    W: 'up', A: 'left', S: 'down', D: 'right',
    z: 'a', Z: 'a', ' ': 'a', Enter: 'start',
    x: 'b', X: 'b', Escape: 'b',
    Shift: 'run', m: 'mute', M: 'mute',
  };

  // We use raw key code so 's' for save works without conflict (use Ctrl+S? Just remap)
  const SAVE_KEY = 'p'; // P for "save game"

  function bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = KEYMAP[e.key] || (e.key.toLowerCase ? KEYMAP[e.key.toLowerCase()] : null);
      if (k) {
        e.preventDefault();
        if (!held.has(k)) pressed.add(k);
        held.add(k);
      }
      if (e.key === SAVE_KEY || e.key === SAVE_KEY.toUpperCase()) {
        pressed.add('save');
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.key] || (e.key.toLowerCase ? KEYMAP[e.key.toLowerCase()] : null);
      if (k) {
        e.preventDefault();
        held.delete(k);
        released.add(k);
      }
    });

    // On-screen buttons
    const btns = document.querySelectorAll('[data-key]');
    btns.forEach((btn) => {
      const keyEvent = btn.getAttribute('data-key');
      const k = KEYMAP[keyEvent];
      const press = (e) => {
        e.preventDefault();
        if (k) {
          if (!held.has(k)) pressed.add(k);
          held.add(k);
        }
      };
      const up = (e) => {
        e.preventDefault();
        if (k) { held.delete(k); released.add(k); }
      };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    });

    // Prevent context menu on long-press
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest && e.target.closest('#frame')) e.preventDefault();
    });
  }

  function isDown(k) { return held.has(k); }
  function wasPressed(k) { return pressed.has(k); }

  function endFrame() {
    pressed.clear();
    released.clear();
  }

  global.MS.Input = { bind, isDown, wasPressed, endFrame };
})(window);
