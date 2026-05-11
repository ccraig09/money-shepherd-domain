/* ============================================================
 * PokéQuest — Audio Engine (WebAudio chiptune SFX + music)
 * ============================================================ */
(function (global) {
  'use strict';

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let started = false;
  let muted = false;
  let currentTrack = null; // { stop }

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);
    return ctx;
  }

  function unlock() {
    ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  function tone(freq, dur, type = 'square', vol = 0.3, when = 0, target = sfxGain) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(target);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function sweep(freq1, freq2, dur, type = 'square', vol = 0.3, when = 0, target = sfxGain) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(target);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.2, when = 0, target = sfxGain) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 1800;
    src.connect(filt);
    filt.connect(g);
    g.connect(target);
    src.start(t);
  }

  // -----------------------------------------------------------
  // SFX library
  // -----------------------------------------------------------
  function sfx(name) {
    ensure();
    switch (name) {
      case 'blip':
        tone(880, 0.06, 'square', 0.18);
        break;
      case 'select':
        tone(1320, 0.05, 'square', 0.2);
        break;
      case 'cancel':
        tone(440, 0.08, 'square', 0.18);
        break;
      case 'menu':
        tone(660, 0.05, 'triangle', 0.2);
        tone(990, 0.05, 'triangle', 0.2, 0.05);
        break;
      case 'step':
        tone(220, 0.03, 'triangle', 0.06);
        break;
      case 'bump':
        tone(140, 0.08, 'square', 0.15);
        break;
      case 'encounter':
        sweep(220, 880, 0.5, 'square', 0.25);
        sweep(220, 880, 0.5, 'square', 0.25, 0.15);
        break;
      case 'hit':
        noise(0.15, 0.3);
        tone(180, 0.08, 'sawtooth', 0.2);
        break;
      case 'crit':
        noise(0.2, 0.4);
        sweep(880, 220, 0.2, 'square', 0.25);
        break;
      case 'super':
        sweep(880, 1760, 0.18, 'square', 0.28);
        sweep(660, 1320, 0.18, 'square', 0.28, 0.08);
        break;
      case 'weak':
        sweep(440, 220, 0.3, 'triangle', 0.18);
        break;
      case 'faint':
        sweep(660, 80, 0.6, 'sawtooth', 0.25);
        break;
      case 'heal':
        tone(660, 0.1, 'triangle', 0.25);
        tone(880, 0.1, 'triangle', 0.25, 0.1);
        tone(1320, 0.15, 'triangle', 0.25, 0.2);
        break;
      case 'capture':
        tone(440, 0.08, 'square', 0.2);
        tone(660, 0.08, 'square', 0.2, 0.1);
        tone(880, 0.12, 'square', 0.25, 0.2);
        break;
      case 'capture_success':
        tone(660, 0.1, 'square', 0.25);
        tone(880, 0.1, 'square', 0.25, 0.1);
        tone(1100, 0.1, 'square', 0.25, 0.2);
        tone(1320, 0.3, 'square', 0.3, 0.3);
        break;
      case 'capture_fail':
        sweep(880, 220, 0.4, 'sawtooth', 0.25);
        noise(0.3, 0.15);
        break;
      case 'levelup':
        const notes = [523, 659, 784, 1047];
        notes.forEach((n, i) => tone(n, 0.12, 'square', 0.25, i * 0.08));
        break;
      case 'fanfare':
        const fan = [523, 659, 784, 659, 784, 1047, 1319];
        fan.forEach((n, i) => tone(n, 0.12, 'square', 0.25, i * 0.1));
        break;
      case 'save':
        tone(880, 0.08, 'triangle', 0.2);
        tone(1100, 0.12, 'triangle', 0.25, 0.08);
        break;
      case 'door':
        sweep(440, 220, 0.2, 'square', 0.2);
        break;
      // type-specific attack sounds
      case 'attack_NORMAL':  tone(440, 0.08, 'square', 0.2); noise(0.1, 0.15, 0.04); break;
      case 'attack_FIRE':    sweep(880, 220, 0.25, 'sawtooth', 0.25); noise(0.25, 0.2); break;
      case 'attack_WATER':   sweep(220, 880, 0.25, 'sine', 0.2); noise(0.2, 0.1, 0.05); break;
      case 'attack_GRASS':   sweep(440, 880, 0.18, 'triangle', 0.22); tone(660, 0.08, 'square', 0.15, 0.18); break;
      case 'attack_ELECTRIC':
        tone(1760, 0.04, 'square', 0.25);
        tone(2200, 0.04, 'square', 0.25, 0.05);
        tone(1760, 0.04, 'square', 0.25, 0.1);
        noise(0.15, 0.2, 0.05);
        break;
      case 'attack_ICE':     sweep(1760, 440, 0.3, 'triangle', 0.22); break;
      case 'attack_FIGHT':   tone(220, 0.05, 'square', 0.3); tone(180, 0.08, 'sawtooth', 0.25, 0.05); break;
      case 'attack_PSYCHIC': sweep(440, 1760, 0.4, 'sine', 0.2); break;
      case 'attack_DARK':    sweep(220, 110, 0.3, 'sawtooth', 0.3); break;
      case 'attack_STEEL':   tone(440, 0.06, 'square', 0.25); tone(660, 0.06, 'square', 0.25, 0.06); break;
      case 'attack_DRAGON':  sweep(110, 440, 0.4, 'sawtooth', 0.3); noise(0.3, 0.15); break;
      case 'attack_GHOST':   sweep(220, 110, 0.5, 'sine', 0.2); break;
      case 'attack_FLYING':  sweep(880, 1760, 0.3, 'sine', 0.18); break;
      case 'attack_GROUND':  tone(80, 0.2, 'sawtooth', 0.3); noise(0.25, 0.3); break;
      default: tone(660, 0.08, 'square', 0.2);
    }
  }

  // -----------------------------------------------------------
  // Music — looping chiptune tracks
  // -----------------------------------------------------------
  const TRACKS = {
    overworld: {
      bpm: 130,
      pattern: [
        // beat: [melody, bass]
        ['C5', 'C3'], ['E5', 'C3'], ['G5', 'G3'], ['E5', 'G3'],
        ['A5', 'A3'], ['G5', 'A3'], ['E5', 'F3'], ['C5', 'F3'],
        ['D5', 'G3'], ['F5', 'G3'], ['A5', 'D4'], ['F5', 'D4'],
        ['E5', 'C3'], ['G5', 'C3'], ['C6', 'G3'], ['G5', 'G3'],
      ],
    },
    town: {
      bpm: 110,
      pattern: [
        ['E5','C3'], ['G5','C3'], ['C6','E3'], ['G5','E3'],
        ['A5','F3'], ['C6','F3'], ['E6','G3'], ['C6','G3'],
        ['G5','A3'], ['B5','A3'], ['D6','F3'], ['B5','F3'],
        ['C6','C3'], ['E6','C3'], ['G6','G3'], ['E6','G3'],
      ],
    },
    cave: {
      bpm: 90,
      pattern: [
        ['A4','A2'], ['C5','A2'], ['E5','E3'], ['C5','E3'],
        ['D5','D3'], ['F5','D3'], ['A5','A3'], ['F5','A3'],
        ['E5','E3'], ['G5','E3'], ['B5','G3'], ['G5','G3'],
        ['A5','A2'], ['C6','A2'], ['E6','E3'], ['A5','E3'],
      ],
    },
    battle: {
      bpm: 160,
      pattern: [
        ['C5','C3'], ['Eb5','C3'], ['G5','G3'], ['Eb5','G3'],
        ['F5','F3'], ['Ab5','F3'], ['C6','C4'], ['Ab5','C4'],
        ['G5','G3'], ['Bb5','G3'], ['D6','D4'], ['Bb5','D4'],
        ['Eb5','C3'], ['G5','C3'], ['Bb5','G3'], ['Eb6','G3'],
      ],
    },
    victory: {
      bpm: 140,
      pattern: [
        ['C5','C3'], ['E5','C3'], ['G5','C3'], ['C6','G3'],
        ['E6','C3'], ['G6','E3'], ['C7','G3'], ['G6','C4'],
      ],
      once: true,
    },
  };

  const NOTE_FREQ = (() => {
    const base = { C: -9, 'C#': -8, Db: -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4,
      'F#': -3, Gb: -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2 };
    const map = {};
    for (let oct = 1; oct < 8; oct++) {
      for (const note of Object.keys(base)) {
        const semis = base[note] + (oct - 4) * 12;
        const freq = 440 * Math.pow(2, semis / 12);
        map[`${note}${oct}`] = freq;
      }
    }
    return map;
  })();

  function startTrack(name) {
    ensure();
    if (!ctx || muted) return;
    stopTrack();
    const tk = TRACKS[name];
    if (!tk) return;
    const stepDur = 60 / tk.bpm / 2; // 8th notes
    let step = 0;
    let stopped = false;
    let nextTime = ctx.currentTime + 0.05;

    function scheduleNext() {
      if (stopped) return;
      const [melody, bass] = tk.pattern[step % tk.pattern.length];
      const mF = NOTE_FREQ[melody];
      const bF = NOTE_FREQ[bass];
      if (mF) tone(mF, stepDur * 0.9, 'square', 0.15, nextTime - ctx.currentTime, musicGain);
      if (bF) tone(bF, stepDur * 0.9, 'triangle', 0.18, nextTime - ctx.currentTime, musicGain);
      // light drum
      if (step % 2 === 0) noise(0.03, 0.04, nextTime - ctx.currentTime, musicGain);
      step++;
      nextTime += stepDur;
      if (tk.once && step >= tk.pattern.length) { stopped = true; return; }
      const ms = Math.max(0, (nextTime - ctx.currentTime - 0.1) * 1000);
      setTimeout(scheduleNext, ms);
    }
    scheduleNext();
    currentTrack = { name, stop: () => { stopped = true; } };
  }

  function stopTrack() {
    if (currentTrack) currentTrack.stop();
    currentTrack = null;
  }

  function setMuted(v) {
    muted = !!v;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.7;
  }

  global.MS.Audio = { sfx, startTrack, stopTrack, unlock, setMuted, ensure };
})(window);
