import React, { useState, useRef, useEffect, useCallback } from "react";
import * as Tone from "tone";

/* ------------------------------------------------------------------ */
/*  TB-16 — Techno / Tech-House Groovebox                              */
/* ------------------------------------------------------------------ */

const STEPS = 16;
const getT = () => (typeof Tone.getTransport === "function" ? Tone.getTransport() : Tone.Transport);
const getD = () => (typeof Tone.getDraw === "function" ? Tone.getDraw() : Tone.Draw);

const TRACKS = [
  { id: "kick",  label: "KICK",   grp: "kick",  color: "#ff8a3d" },
  { id: "clap",  label: "CLAP",   grp: "clap",  color: "#ff5d7e" },
  { id: "rim",   label: "RIM",    grp: "rim",   color: "#b98cff" },
  { id: "hat",   label: "HAT",    grp: "hat",   color: "#3fd8ff", choke: "hh" },
  { id: "open",  label: "OPEN",   grp: "open",  color: "#5aa8ff", choke: "hh" },
  { id: "shkr",  label: "SHKR",   grp: "shkr",  color: "#2fe0c0" },
  { id: "perc",  label: "PERC",   grp: "perc",  color: "#ffd23d" },
  { id: "bass",  label: "BASS",   grp: "bass",  color: "#9ae63c", interval: 0 },
  { id: "bass5", label: "BASS 5", grp: "bass",  color: "#7fd130", interval: 7 },
  { id: "bass8", label: "BASS 8", grp: "bass",  color: "#c8f24a", interval: 12 },
  { id: "stab",  label: "STAB",   grp: "stab",  color: "#ff6bf0" },
];

const BANKS = ["A", "B", "C", "D"];

/* A classic techno arrangement: long uncluttered intro and outro so a DJ can
   mix in and out, a breakdown that drops the kick, and a peak that is simply
   held. Every section is a multiple of eight bars, which is the convention the
   whole genre counts in. At 140 BPM these 208 bars run just under six minutes. */
const ARR_TEMPLATE = () => [
  { name: "INTRO", bank: "A", bars: 32, note:
    "Nur Kick und Hats, aufgeräumt und lang. Der DJ braucht diese Zeit zum Einmixen. Alle 16 Takte ein Element dazu, sonst passiert hier bewusst wenig." },
  { name: "AUFBAU", bank: "A", bars: 16, note:
    "Percussion kommt dazu: Shaker, Rim, Open Hat. Master-Filter langsam öffnen. Noch kein Bass — die Spannung lebt davon, dass er fehlt." },
  { name: "GROOVE", bank: "B", bars: 32, note:
    "Der Bass setzt ein. Ab hier steht der eigentliche Track. Bei Tech House passiert alles Wesentliche zwischen den Kicks, nicht auf ihnen." },
  { name: "BREAK", bank: "C", bars: 16, note:
    "Kick raus, Stab und Reverb bleiben. Der Moment zum Durchatmen. Delay-Feedback hochziehen, Master-Filter etwas schließen." },
  { name: "STEIGERUNG", bank: "C", bars: 16, note:
    "Hats auf 16tel verdichten, Filter aufziehen, Clap dazu. Spannung ohne Kick — je länger du ihn weglässt, desto härter trifft er danach." },
  { name: "PEAK", bank: "D", bars: 48, note:
    "Alles drin. Der längste Abschnitt des Tracks — hier bleibt man. Veränderung nur in kleinen Dosen, ein Element rein oder raus pro 16 Takte." },
  { name: "GROOVE 2", bank: "B", bars: 32, note:
    "Zurück zum Kern, aber nicht identisch: ein Element weglassen wirkt hier besser als eines dazu." },
  { name: "OUTRO", bank: "A", bars: 16, note:
    "Das Intro rückwärts. Elemente nach und nach rausnehmen, am Ende nur Kick und Percussion, damit sauber weggemixt werden kann." },
];

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CHORDS = {
  min:  [0, 3, 7],
  min7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
  maj:  [0, 4, 7],
};

const DEFAULT_PARAMS = {
  kick: { tune: 48, decay: 0.42, punch: 0.045, level: 1.0, dly: 0, rev: 0 },
  clap: { tone: 1250, decay: 0.28, spread: 0.014, level: 0.75, dly: 0.12, rev: 0.28 },
  rim:  { tone: 1900, decay: 0.03, level: 0.7, dly: 0.18, rev: 0.14 },
  hat:  { tone: 8200, decay: 0.035, level: 0.7, dly: 0, rev: 0.06 },
  open: { tone: 8600, decay: 0.32, level: 0.6, dly: 0.06, rev: 0.16 },
  shkr: { tone: 6200, decay: 0.07, level: 0.6, dly: 0, rev: 0.1 },
  perc: { tune: 220, decay: 0.18, punch: 0.02, level: 0.7, dly: 0.22, rev: 0.2 },
  /* Acid comes from high resonance plus a deep filter envelope. Both are
     parameters now, and both start low: this is a tech-house sub, not a 303. */
  bass: { wave: "sawtooth", cutoff: 190, reso: 1, env: 0.4, decay: 0.2, gate: 0.45,
          glide: 0, level: 0.9, dly: 0, rev: 0 },
  stab: { cutoff: 2200, decay: 0.22, level: 0.6, dly: 0.38, rev: 0.35 },
};

const DEFAULT_MASTER = {
  bpm: 126, swing: 0.12, filter: 1, drive: 0, pump: 0.35,
  dfb: 0.32, dtime: "8n.", vol: 0.85,
};

/* control layout per sound group: [key, label, min, max, step, unit] */
const COMMON = [
  ["level", "LEVEL", 0, 1.4, 0.01, ""],
  ["dly", "DELAY", 0, 1, 0.01, ""],
  ["rev", "REVERB", 0, 1, 0.01, ""],
];
const EDIT = {
  kick: [["tune", "TUNE", 30, 70, 0.5, "Hz"], ["decay", "DECAY", 0.08, 1.2, 0.01, "s"], ["punch", "PUNCH", 0.005, 0.12, 0.001, ""], ...COMMON],
  clap: [["tone", "TONE", 400, 3200, 10, "Hz"], ["decay", "DECAY", 0.05, 0.8, 0.01, "s"], ["spread", "SPREAD", 0, 0.05, 0.002, "s"], ...COMMON],
  rim:  [["tone", "TONE", 700, 4000, 10, "Hz"], ["decay", "DECAY", 0.01, 0.2, 0.005, "s"], ...COMMON],
  hat:  [["tone", "TONE", 3000, 12000, 50, "Hz"], ["decay", "DECAY", 0.01, 0.2, 0.005, "s"], ...COMMON],
  open: [["tone", "TONE", 3000, 12000, 50, "Hz"], ["decay", "DECAY", 0.05, 1.2, 0.01, "s"], ...COMMON],
  shkr: [["tone", "TONE", 2000, 12000, 50, "Hz"], ["decay", "DECAY", 0.02, 0.4, 0.005, "s"], ...COMMON],
  perc: [["tune", "TUNE", 90, 600, 2, "Hz"], ["decay", "DECAY", 0.05, 0.9, 0.01, "s"], ["punch", "PUNCH", 0.005, 0.09, 0.001, ""], ...COMMON],
  bass: [["cutoff", "CUTOFF", 60, 2600, 10, "Hz"], ["reso", "RESO", 0, 12, 0.1, ""], ["env", "SWEEP", 0, 4, 0.1, "oct"], ["decay", "DECAY", 0.05, 0.8, 0.01, "s"], ["gate", "GATE", 0.2, 1.6, 0.05, ""], ["glide", "GLIDE", 0, 0.18, 0.005, "s"], ...COMMON],
  stab: [["cutoff", "CUTOFF", 300, 6000, 20, "Hz"], ["decay", "DECAY", 0.05, 1.2, 0.01, "s"], ...COMMON],
};

/* Four starting points per sound group. Timbre only — level, delay and reverb
   stay untouched so applying one never disturbs the mix. Every value sits
   inside the range its EDIT row allows. */
const SOUND_PRESETS = {
  kick: [
    ["TECH HOUSE",  { tune: 46, decay: 0.36, punch: 0.05 }],
    ["909 TROCKEN", { tune: 52, decay: 0.28, punch: 0.03 }],
    ["PEAK HART",   { tune: 55, decay: 0.3, punch: 0.018 }],
    ["COCOON TIEF", { tune: 42, decay: 0.55, punch: 0.065 }],
    ["808 SUB",     { tune: 34, decay: 0.95, punch: 0.085 }],
    ["KLICK",       { tune: 60, decay: 0.2, punch: 0.008 }],
  ],
  bass: [
    ["TECH HOUSE",  { wave: "sawtooth", cutoff: 190, reso: 1, env: 0.4, decay: 0.2, gate: 0.45, glide: 0 }],
    ["SUB ROUND",   { wave: "sine", cutoff: 400, reso: 0, env: 0.2, decay: 0.3, gate: 0.5, glide: 0 }],
    ["PEAK ROLL",   { wave: "sawtooth", cutoff: 300, reso: 1.8, env: 0.7, decay: 0.15, gate: 0.4, glide: 0 }],
    ["808 SUB",     { wave: "sine", cutoff: 700, reso: 0, env: 0, decay: 0.65, gate: 1.2, glide: 0.02 }],
    ["ELECTRO",     { wave: "square", cutoff: 620, reso: 3, env: 1.1, decay: 0.28, gate: 0.85, glide: 0.01 }],
    ["ACID",        { wave: "sawtooth", cutoff: 480, reso: 9, env: 3, decay: 0.2, gate: 0.6, glide: 0.05 }],
  ],
  hat: [
    ["TECH HOUSE",  { tone: 9000, decay: 0.028 }],
    ["909 TIGHT",   { tone: 10000, decay: 0.02 }],
    ["808 METALL",  { tone: 11500, decay: 0.035 }],
    ["WEICH",       { tone: 6200, decay: 0.045 }],
    ["LANG",        { tone: 7000, decay: 0.075 }],
    ["TICK",        { tone: 12000, decay: 0.014 }],
  ],
  open: [
    ["TECH HOUSE",  { tone: 8600, decay: 0.28 }],
    ["KURZ",        { tone: 9000, decay: 0.16 }],
    ["909 OFFEN",   { tone: 9500, decay: 0.42 }],
    ["ZISCHEND",    { tone: 11000, decay: 0.35 }],
    ["DUNKEL",      { tone: 5500, decay: 0.45 }],
    ["LANG",        { tone: 8000, decay: 0.8 }],
  ],
  clap: [
    ["TECH HOUSE",  { tone: 1500, decay: 0.22, spread: 0.012 }],
    ["909 BREIT",   { tone: 1100, decay: 0.42, spread: 0.03 }],
    ["TROCKEN",     { tone: 1700, decay: 0.14, spread: 0.006 }],
    ["808 SCHARF",  { tone: 2400, decay: 0.18, spread: 0.01 }],
    ["WEICH",       { tone: 900, decay: 0.3, spread: 0.022 }],
    ["KURZ",        { tone: 2000, decay: 0.1, spread: 0.004 }],
  ],
  rim: [
    ["808 RIM",     { tone: 1700, decay: 0.02 }],
    ["HOLZ",        { tone: 1400, decay: 0.03 }],
    ["HOCH",        { tone: 3200, decay: 0.018 }],
    ["WEICH",       { tone: 1100, decay: 0.055 }],
    ["TICK",        { tone: 2600, decay: 0.014 }],
    ["LANG",        { tone: 2000, decay: 0.09 }],
  ],
  shkr: [
    ["TECH HOUSE",  { tone: 7200, decay: 0.06 }],
    ["FEIN",        { tone: 8500, decay: 0.045 }],
    ["TROCKEN",     { tone: 6500, decay: 0.035 }],
    ["LANG",        { tone: 5500, decay: 0.16 }],
    ["RAUSCH",      { tone: 3500, decay: 0.24 }],
    ["HELL",        { tone: 10000, decay: 0.05 }],
  ],
  perc: [
    ["CONGA",       { tune: 260, decay: 0.28, punch: 0.03 }],
    ["TOM TIEF",    { tune: 130, decay: 0.45, punch: 0.05 }],
    ["808 COWBELL", { tune: 540, decay: 0.14, punch: 0.008 }],
    ["BLOCK",       { tune: 480, decay: 0.1, punch: 0.012 }],
    ["TRIBAL",      { tune: 190, decay: 0.6, punch: 0.04 }],
    ["KURZ",        { tune: 330, decay: 0.12, punch: 0.018 }],
  ],
  stab: [
    ["TECH HOUSE",  { cutoff: 1600, decay: 0.16 }],
    ["KURZ",        { cutoff: 1400, decay: 0.1 }],
    ["HELL",        { cutoff: 4200, decay: 0.18 }],
    ["WEIT",        { cutoff: 2600, decay: 0.5 }],
    ["DUNKEL",      { cutoff: 800, decay: 0.3 }],
    ["FLÄCHE",      { cutoff: 1800, decay: 0.95 }],
  ],
};

/* Sample voices are keyed by track, not by sound group: every lane holds its
   own file. Level / delay / reverb stay on the group channel, so they are not
   duplicated here. */
const DEFAULT_SMPL = { pitch: 0, start: 0, len: 4 };

const EDIT_SMPL = [
  ["pitch", "PITCH", -24, 24, 1, "st"],
  ["start", "START", 0, 0.5, 0.001, "s"],
  ["len", "LENGTH", 0.02, 4, 0.01, "s"],
];

/* ---------------------------- patterns ---------------------------- */

const emptyPattern = () => {
  const p = {};
  TRACKS.forEach((t) => (p[t.id] = new Array(STEPS).fill(0)));
  return p;
};

const mk = (spec) => {
  const p = emptyPattern();
  Object.entries(spec).forEach(([k, v]) => {
    const [on = [], acc = []] = v;
    on.forEach((s) => (p[k][s] = 1));
    acc.forEach((s) => (p[k][s] = 2));
  });
  return p;
};

const PRESETS = [
  {
    name: "TECH HOUSE", bpm: 125, swing: 0.18,
    pattern: mk({
      kick: [[4, 8, 12], [0]],
      clap: [[4, 12]],
      open: [[2, 6, 10, 14]],
      shkr: [[1, 3, 5, 7, 9, 11, 13, 15]],
      rim:  [[6, 14]],
      perc: [[7]],
      bass: [[3, 7, 11], [15]],
      bass8:[[11]],
      stab: [[6, 14]],
    }),
  },
  {
    name: "PEAK TIME", bpm: 138, swing: 0,
    pattern: mk({
      kick: [[], [0, 4, 8, 12]],
      hat:  [[0, 2, 4, 6, 8, 10, 12, 14], [1, 3, 5, 7, 9, 11, 13, 15]],
      open: [[2, 10]],
      clap: [[4, 12]],
      rim:  [[7, 15]],
      perc: [[14]],
      bass: [[2, 6, 10], [14]],
      bass5:[[15]],
      stab: [[6], [14]],
    }),
  },
  {
    name: "MINIMAL DUB", bpm: 124, swing: 0.1,
    pattern: mk({
      kick: [[0, 4, 8, 12]],
      rim:  [[6, 14]],
      shkr: [[3, 7, 11, 15]],
      hat:  [[2, 10]],
      stab: [[6], [15]],
      bass: [[3, 11]],
      perc: [[9]],
    }),
    tweak: { stab: { dly: 0.6, rev: 0.5, decay: 0.14 }, rim: { dly: 0.45 } },
    master: { pump: 0.5, dfb: 0.45 },
  },
  {
    name: "ROLLING", bpm: 130, swing: 0.06,
    pattern: mk({
      kick: [[4, 8, 12], [0]],
      clap: [[12]],
      hat:  [[0, 2, 4, 6, 8, 10, 12, 14]],
      open: [[6, 14]],
      shkr: [[1, 5, 9, 13]],
      perc: [[5, 13]],
      bass: [[2, 3, 6, 10, 11], [14]],
      bass8:[[7, 15]],
    }),
    master: { pump: 0.45 },
  },
];

const chance = (p) => Math.random() < p;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const randomPattern = () => {
  const p = emptyPattern();
  [0, 4, 8, 12].forEach((s) => (p.kick[s] = s === 0 ? 2 : 1));
  if (chance(0.25)) p.kick[pick([7, 14, 15])] = 1;
  (chance(0.5) ? [4, 12] : [12]).forEach((s) => (p.clap[s] = 1));
  if (chance(0.5)) [2, 6, 10, 14].forEach((s) => (p.hat[s] = 1));
  else for (let i = 0; i < 16; i++) if (chance(0.75)) p.hat[i] = i % 2 ? 2 : 1;
  if (chance(0.6)) [2, 6, 10, 14].forEach((s) => chance(0.8) && (p.open[s] = 1));
  for (let i = 1; i < 16; i += 2) if (chance(0.55)) p.shkr[i] = 1;
  [pick([3, 6, 7]), pick([11, 14, 15])].forEach((s) => chance(0.7) && (p.rim[s] = 1));
  if (chance(0.6)) p.perc[pick([5, 7, 9, 13, 15])] = 1;
  const bassTpl = pick([[3, 7, 11, 15], [2, 6, 10, 14], [2, 3, 6, 10, 11, 14], [1, 3, 7, 9, 11, 15]]);
  bassTpl.forEach((s) => (p.bass[s] = chance(0.2) ? 2 : 1));
  if (chance(0.5)) p.bass8[pick(bassTpl)] = 1;
  if (chance(0.35)) p.bass5[pick(bassTpl)] = 1;
  const stabN = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < stabN; i++) p.stab[pick([2, 6, 10, 14, 15])] = 1;
  return p;
};

/* ---------------------------- storage ----------------------------- */
/* localStorage-backed store matching the async shape the slot UI expects */

const storage = {
  async list(prefix) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return { keys };
  },
  async get(key) {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error("empty slot: " + key);
    return { value };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
  },
};

/* ---------------------------- audio ------------------------------- */

function buildEngine() {
  const limiter = new Tone.Limiter(-1).toDestination();
  const comp = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.005, release: 0.12 }).connect(limiter);
  const master = new Tone.Gain(DEFAULT_MASTER.vol).connect(comp);
  const filter = new Tone.Filter({ type: "lowpass", frequency: 20000, Q: 1.2, rolloff: -24 }).connect(master);
  const drive = new Tone.Distortion({ distortion: 0, wet: 0 }).connect(filter);
  const bus = new Tone.Gain(1).connect(drive);
  const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.32, wet: 1 }).connect(bus);
  const reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: 1 }).connect(bus);
  try { const g = reverb.generate(); if (g && g.catch) g.catch(() => {}); } catch (e) {}
  const duck = new Tone.Gain(1).connect(bus);

  const ch = {};
  const mkCh = (dest, lvl) => {
    const gain = new Tone.Gain(lvl);
    const dly = new Tone.Gain(0);
    const rev = new Tone.Gain(0);
    gain.connect(dest); gain.connect(dly); gain.connect(rev);
    dly.connect(delay); rev.connect(reverb);
    return { gain, dly, rev };
  };
  ["kick", "clap", "rim", "hat", "open", "shkr", "perc"].forEach((k) => (ch[k] = mkCh(bus, DEFAULT_PARAMS[k].level)));
  ch.bass = mkCh(duck, DEFAULT_PARAMS.bass.level);
  ch.stab = mkCh(duck, DEFAULT_PARAMS.stab.level);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.045, octaves: 6, oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.02 },
  }).connect(ch.kick.gain);
  kick.volume.value = -3;

  const clapF = new Tone.Filter({ type: "bandpass", frequency: 1250, Q: 1.4 }).connect(ch.clap.gain);
  const clap = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.02 },
  }).connect(clapF);
  clap.volume.value = -10;

  const rimF = new Tone.Filter({ type: "bandpass", frequency: 1900, Q: 7 }).connect(ch.rim.gain);
  const rim = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.0005, decay: 0.03, sustain: 0, release: 0.01 },
  }).connect(rimF);
  rim.volume.value = -6;

  const hatF = new Tone.Filter({ type: "highpass", frequency: 8200, rolloff: -24 }).connect(ch.hat.gain);
  const hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 },
  }).connect(hatF);
  hat.volume.value = -10;

  const openF = new Tone.Filter({ type: "highpass", frequency: 8600, rolloff: -24 }).connect(ch.open.gain);
  const open = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.05 },
  }).connect(openF);
  open.volume.value = -14;

  const shkrF = new Tone.Filter({ type: "highpass", frequency: 6200, rolloff: -12 }).connect(ch.shkr.gain);
  const shkr = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.004, decay: 0.07, sustain: 0, release: 0.02 },
  }).connect(shkrF);
  shkr.volume.value = -6;

  const perc = new Tone.MembraneSynth({
    pitchDecay: 0.02, octaves: 3, oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.02 },
  }).connect(ch.perc.gain);
  perc.volume.value = -8;

  const bass = new Tone.MonoSynth({
    oscillator: { type: DEFAULT_PARAMS.bass.wave },
    filter: { type: "lowpass", Q: DEFAULT_PARAMS.bass.reso, rolloff: -24 },
    envelope: { attack: 0.004, decay: DEFAULT_PARAMS.bass.decay, sustain: 0.22, release: 0.06 },
    filterEnvelope: { attack: 0.004, decay: 0.12, sustain: 0.22, release: 0.1,
      baseFrequency: DEFAULT_PARAMS.bass.cutoff, octaves: DEFAULT_PARAMS.bass.env },
  }).connect(ch.bass.gain);
  bass.volume.value = -6;

  const stabF = new Tone.Filter({ type: "lowpass", frequency: 2200, Q: 1.5 }).connect(ch.stab.gain);
  const stab = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.003, decay: 0.22, sustain: 0, release: 0.12 },
  }).connect(stabF);
  stab.volume.value = -14;

  /* One player per track, routed into that track's group channel so the whole
     send / duck / drive / master chain applies unchanged. The gain in front
     carries per-hit velocity, which Tone.Player has no notion of. */
  const smpl = {};
  TRACKS.forEach((t) => {
    const gain = new Tone.Gain(1).connect(ch[t.grp].gain);
    const player = new Tone.Player({ fadeOut: 0.008 }).connect(gain);
    smpl[t.id] = { player, gain };
  });

  return {
    limiter, comp, master, filter, drive, bus, delay, reverb, duck, ch, smpl,
    kick, clap, clapF, rim, rimF, hat, hatF, open, openF, shkr, shkrF, perc, bass, stab, stabF,
  };
}

/* ------------------------------ UI -------------------------------- */

const CSS = `
.tb{--bg:#121016;--panel:#1b1821;--panel2:#242030;--edge:rgba(255,255,255,.08);
--txt:#d8d0e2;--dim:#8b809a;--lcd:#ffb454;
min-height:100%;padding:12px 10px 26px;box-sizing:border-box;color:var(--txt);
background:radial-gradient(130% 70% at 50% -10%,#26202f 0%,#121016 62%);
font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
-webkit-tap-highlight-color:transparent;}
.tb *{box-sizing:border-box}
.wrap{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.panel{background:linear-gradient(180deg,#1f1b28,#171420);border:1px solid var(--edge);
border-radius:12px;padding:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 8px 22px rgba(0,0,0,.45)}
.brand{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 2px}
.brand b{font-size:15px;letter-spacing:.22em;font-weight:700;color:#efe8f7}
.brand span{font-size:9px;letter-spacing:.18em;color:var(--dim)}
.lcd{position:relative;overflow:hidden;background:#0c0906;border:1px solid #3d3120;border-radius:8px;
padding:8px 10px;color:var(--lcd);text-shadow:0 0 7px rgba(255,180,84,.45);
box-shadow:inset 0 0 22px rgba(255,150,40,.12)}
.lcd:after{content:"";position:absolute;inset:0;pointer-events:none;
background:repeating-linear-gradient(180deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px)}
.lcd .l1{display:flex;justify-content:space-between;font-size:9px;letter-spacing:.16em;opacity:.72}
.lcd .l2{font-size:17px;letter-spacing:.06em;margin:3px 0 1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lcd .l3{display:flex;justify-content:space-between;font-size:9px;letter-spacing:.14em;opacity:.72}
.row{display:flex;align-items:center;gap:4px}
.name{width:56px;flex:0 0 56px;text-align:left;font-size:9px;letter-spacing:.1em;padding:4px 2px;
background:none;border:0;color:var(--dim);cursor:pointer;font-family:inherit}
.name.sel{color:#fff}
.mute{width:15px;flex:0 0 15px;height:15px;border-radius:4px;border:1px solid var(--edge);
background:#191622;cursor:pointer;padding:0}
.mute.on{background:#4a1220;border-color:#8d2439}
.grid{flex:1;display:flex;gap:2px;min-width:0}
.step{flex:1 1 0;min-width:0;height:22px;border-radius:3px;border:1px solid rgba(255,255,255,.05);
background:rgba(255,255,255,.045);padding:0;cursor:pointer;transition:transform 70ms,box-shadow 70ms,background 70ms}
.step.q{background:rgba(255,255,255,.085)}
.step.cur{border-color:rgba(255,255,255,.55)}
.step:active{transform:scale(.9)}
.seq{display:flex;flex-direction:column;gap:3px}
.ruler{display:flex;gap:2px;padding-left:79px;margin-bottom:1px}
.ruler i{flex:1 1 0;font-size:7px;font-style:normal;text-align:center;color:var(--dim)}
.ruler i.on{color:var(--lcd)}
.bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.btn{font-family:inherit;font-size:9px;letter-spacing:.12em;color:var(--txt);background:#221e2c;
border:1px solid var(--edge);border-radius:7px;padding:7px 9px;cursor:pointer}
.btn:hover{background:#2b2637}
.btn.act{background:#3a2a12;border-color:#8a6224;color:#ffcb7a}
.play{flex:0 0 74px;height:44px;border-radius:10px;border:1px solid #8a6224;background:linear-gradient(180deg,#3a2a12,#241a0c);
color:#ffcb7a;font-family:inherit;font-size:11px;letter-spacing:.14em;cursor:pointer}
.play.on{background:linear-gradient(180deg,#ffb454,#e08a1e);color:#1a1206;border-color:#ffd08a}
.ctrls{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:9px 10px}
.ctl label{display:flex;justify-content:space-between;font-size:8px;letter-spacing:.12em;color:var(--dim);margin-bottom:3px}
.ctl label em{font-style:normal;color:var(--lcd)}
.tb input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:16px;background:transparent;margin:0;display:block}
.tb input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:3px;background:#332c40}
.tb input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;margin-top:-5px;border-radius:50%;
background:#ffb454;border:1px solid #7a5210;cursor:pointer}
.tb input[type=range]::-moz-range-track{height:4px;border-radius:3px;background:#332c40}
.tb input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#ffb454;border:1px solid #7a5210;cursor:pointer}
.tb select{font-family:inherit;font-size:9px;background:#221e2c;color:var(--txt);border:1px solid var(--edge);
border-radius:7px;padding:6px 7px}
.hd{font-size:8px;letter-spacing:.2em;color:var(--dim);margin:0 0 8px}
.tb button:focus-visible,.tb input:focus-visible,.tb select:focus-visible{outline:2px solid #ffb454;outline-offset:2px}
.foot{font-size:9px;line-height:1.6;color:var(--dim);text-align:center;letter-spacing:.04em}
.pool{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.chip{font-family:inherit;font-size:9px;letter-spacing:.06em;color:var(--txt);background:#221e2c;
border:1px solid var(--edge);border-radius:6px;padding:5px 8px;cursor:pointer;max-width:150px;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip.act{background:#3a2a12;border-color:#8a6224;color:#ffcb7a}
.drop{border:1px dashed rgba(255,255,255,.18);border-radius:8px;padding:12px 10px;text-align:center;
font-size:9px;letter-spacing:.12em;color:var(--dim);cursor:pointer}
.drop.over{border-color:#ffb454;color:#ffb454;background:rgba(255,180,84,.06)}
.lbl{font-size:8px;letter-spacing:.16em;color:var(--dim)}
.arr{display:flex;flex-direction:column;gap:2px;margin-top:10px}
.sec{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;
padding:6px 7px;border-radius:7px;border:1px solid transparent;background:rgba(255,255,255,.03);cursor:pointer}
.sec.sel{background:#241f30;border-color:var(--edge)}
.sec.now{border-color:#2fe0c0;box-shadow:0 0 8px rgba(47,224,192,.25)}
.sec b{font-size:9px;letter-spacing:.14em;font-weight:400;color:var(--txt)}
.sec.now b{color:#7ffbe4}
.bars{display:inline-flex;align-items:center;gap:5px}
.bars i{font-style:normal;font-size:10px;color:var(--lcd);min-width:18px;text-align:center;
font-variant-numeric:tabular-nums}
.mini{font-family:inherit;font-size:9px;line-height:1;color:var(--txt);background:#221e2c;
border:1px solid var(--edge);border-radius:5px;padding:4px 7px;cursor:pointer}
.mini:hover{background:#2d2739}
.dur{font-size:9px;color:var(--dim);min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.sec.now .dur{color:#7ffbe4}
.note{font-size:10px;line-height:1.65;color:var(--txt);margin:10px 0 0;padding:9px 11px;
background:rgba(255,180,84,.06);border-left:2px solid var(--lcd);border-radius:0 7px 7px 0}
.btn.now{border-color:#2fe0c0;color:#7ffbe4;box-shadow:0 0 8px rgba(47,224,192,.35)}
.name.smp{color:#2fe0c0}
.name.smp.sel{color:#7ffbe4}
@media (prefers-reduced-motion:reduce){.tb *{transition:none!important}}
`;

function Ctl({ label, value, min, max, step, unit, onChange }) {
  const shown = value >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return (
    <div className="ctl">
      <label>
        {label}
        <em>{shown}{unit}</em>
      </label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export default function Groovebox() {
  const [banks, setBanks] = useState(() => ({
    A: PRESETS[0].pattern, B: emptyPattern(), C: emptyPattern(), D: emptyPattern(),
  }));
  const [bank, setBank] = useState("A");          // the bank being edited
  const [arr, setArr] = useState(ARR_TEMPLATE);
  const [secSel, setSecSel] = useState(0);   // section whose note is shown
  const [secAt, setSecAt] = useState(-1);    // section being played
  const [barAt, setBarAt] = useState(0);     // bar within that section
  const [song, setSong] = useState(false);
  const [playBank, setPlayBank] = useState("A");  // the bank currently sounding
  const [copyArm, setCopyArm] = useState(false);

  /* Everything downstream still works on one pattern; it is just the selected
     bank now, so the sequencer, presets, dice and slots need no changes. */
  const pattern = banks[bank];
  const setPattern = useCallback((next) => setBanks((b) => ({
    ...b, [bank]: typeof next === "function" ? next(b[bank]) : next,
  })), [bank]);
  const [params, setParams] = useState(() => JSON.parse(JSON.stringify(DEFAULT_PARAMS)));
  const [master, setMaster] = useState(() => ({ ...DEFAULT_MASTER, bpm: PRESETS[0].bpm, swing: PRESETS[0].swing }));
  const [mutes, setMutes] = useState({});
  const [root, setRoot] = useState(9); // A
  const [chord, setChord] = useState("min7");
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [sel, setSel] = useState("kick");
  const [name, setName] = useState(PRESETS[0].name);
  const [readout, setReadout] = useState("KICK");
  const [slots, setSlots] = useState({});
  const [saveMode, setSaveMode] = useState(false);
  const [pool, setPool] = useState([]);      // loaded files: [{ id, name, buffer }]
  const [assign, setAssign] = useState({});  // track id -> pool id
  const [srcs, setSrcs] = useState({});      // track id -> "sample" | "synth"
  const [smpl, setSmpl] = useState({});      // track id -> DEFAULT_SMPL shape
  const [over, setOver] = useState(false);
  const [sndPre, setSndPre] = useState({}); // sound group -> applied preset name
  const fileRef = useRef(null);

  const eng = useRef(null);
  const patRef = useRef(pattern);
  const parRef = useRef(params);
  const masRef = useRef(master);
  const mutRef = useRef(mutes);
  const musRef = useRef({ root, chord });
  const bnkRef = useRef(banks);
  const selBankRef = useRef(bank);
  const arrRef = useRef(arr);
  const songRef = useRef(song);
  const nowBankRef = useRef("A");   // bank the clock is reading
  const secIdxRef = useRef(0);      // section the clock is in
  const barIdxRef = useRef(0);      // bar within that section
  const srcRef = useRef(srcs);
  const smpRef = useRef(smpl);
  const posRef = useRef(0);

  patRef.current = pattern;
  parRef.current = params;
  masRef.current = master;
  mutRef.current = mutes;
  musRef.current = { root, chord };
  bnkRef.current = banks;
  selBankRef.current = bank;
  arrRef.current = arr;
  songRef.current = song;
  srcRef.current = srcs;
  smpRef.current = smpl;

  /* ---- build / dispose engine ---- */
  useEffect(() => {
    /* Tone drives its clock from a Worker built out of a Blob so the timing
       survives a backgrounded tab. A strict Content-Security-Policy can refuse
       that, and the transport would then silently never advance. The refusal is
       asynchronous, so probe with a real round-trip rather than a try/catch,
       and fall back to Tone's timeout clock. Audio only starts on the first
       PLAY, long after this settles. */
    let stale = false;
    (async () => {
      const ok = await new Promise((resolve) => {
        try {
          const url = URL.createObjectURL(
            new Blob(["onmessage=()=>postMessage(1)"], { type: "text/javascript" }));
          const w = new Worker(url);
          const finish = (v) => {
            try { w.terminate(); } catch (e) {}
            URL.revokeObjectURL(url);
            resolve(v);
          };
          const timer = setTimeout(() => finish(false), 500);
          w.onmessage = () => { clearTimeout(timer); finish(true); };
          w.onerror = () => { clearTimeout(timer); finish(false); };
          w.postMessage(0);
        } catch (err) { resolve(false); }
      });
      if (!stale && !ok) { try { Tone.getContext().clockSource = "timeout"; } catch (e) {} }
    })();

    eng.current = buildEngine();
    const t = getT();
    t.bpm.value = masRef.current.bpm;
    t.swing = masRef.current.swing;
    t.swingSubdivision = "16n";
    const id = t.scheduleRepeat((time) => tick(time), "16n");
    return () => {
      stale = true;
      try { t.clear(id); t.stop(); } catch (e) {}
      const e0 = eng.current;
      if (e0) Object.values(e0.smpl || {}).forEach((v) => {
        [v.player, v.gain].forEach((n) => { try { n.dispose(); } catch (e) {} });
      });
      if (e0) Object.entries(e0).forEach(([key, n]) => {
        if (key === "smpl") return;
        if (n && typeof n.dispose === "function") { try { n.dispose(); } catch (e) {} }
        else if (n && n.gain && n.dly) { [n.gain, n.dly, n.rev].forEach((g) => { try { g.dispose(); } catch (e) {} }); }
        else if (n && typeof n === "object") Object.values(n).forEach((c) => {
          if (c && c.gain && typeof c.gain.dispose === "function") { try { c.gain.dispose(); c.dly.dispose(); c.rev.dispose(); } catch (e) {} }
        });
      });
      eng.current = null;
    };
    // eslint-disable-next-line
  }, []);

  /* ---- play an assigned sample; false when the lane has none ---- */
  const playSample = useCallback((id, time, vel) => {
    const e = eng.current; if (!e) return false;
    const v = e.smpl[id];
    if (!v || !v.player.loaded) return false;

    const track = TRACKS.find((t) => t.id === id);
    /* a closed hat cuts the open one, same as the synth path */
    if (track.choke) {
      TRACKS.forEach((o) => {
        if (o.id === id || o.choke !== track.choke) return;
        const ov = e.smpl[o.id];
        if (ov && ov.player.loaded && ov.player.state === "started") {
          try { ov.player.stop(time); } catch (err) {}
        }
      });
    }

    const sp = smpRef.current[id] || DEFAULT_SMPL;
    const dur = v.player.buffer.duration;
    const off = Math.min(sp.start, Math.max(0, dur - 0.01));
    const len = Math.max(0.01, Math.min(sp.len, dur - off));
    v.player.playbackRate = Math.pow(2, (sp.pitch + (track.interval || 0)) / 12);
    v.gain.gain.setValueAtTime(vel, time);
    v.player.start(time, off, len);
    return true;
  }, []);

  /* ---- trigger a single voice ---- */
  const fire = useCallback((id, time, vel) => {
    const e = eng.current; if (!e) return;
    const p = parRef.current;
    const m = musRef.current;
    const sixteenth = 60 / (masRef.current.bpm * 4);
    try {
      if (srcRef.current[id] === "sample" && playSample(id, time, vel)) return;
      switch (id) {
        case "kick":
          e.kick.triggerAttackRelease(p.kick.tune, p.kick.decay, time, vel); break;
        case "clap": {
          const s = p.clap.spread;
          if (s > 0.001) {
            e.clap.triggerAttackRelease(0.01, time, vel * 0.55);
            e.clap.triggerAttackRelease(0.01, time + s, vel * 0.75);
            e.clap.triggerAttackRelease(p.clap.decay, time + s * 2, vel);
          } else {
            e.clap.triggerAttackRelease(p.clap.decay, time, vel);
          }
          break;
        }
        case "rim": e.rim.triggerAttackRelease(p.rim.decay, time, vel); break;
        case "hat":
          try { e.open.triggerRelease(time); } catch (err) {}
          e.hat.triggerAttackRelease(p.hat.decay, time, vel); break;
        case "open": e.open.triggerAttackRelease(p.open.decay, time, vel); break;
        case "shkr": e.shkr.triggerAttackRelease(p.shkr.decay, time, vel); break;
        case "perc": e.perc.triggerAttackRelease(p.perc.tune, p.perc.decay, time, vel); break;
        case "bass": case "bass5": case "bass8": {
          const iv = TRACKS.find((t) => t.id === id).interval;
          const midi = 24 + m.root + iv; // C1-based root
          e.bass.triggerAttackRelease(Tone.Frequency(midi, "midi").toFrequency(), sixteenth * p.bass.gate, time, vel);
          break;
        }
        case "stab": {
          const freqs = CHORDS[m.chord].map((i) =>
            Tone.Frequency(48 + m.root + i, "midi").toFrequency());
          e.stab.triggerAttackRelease(freqs, p.stab.decay, time, vel * 0.9);
          break;
        }
        default: break;
      }
    } catch (err) { /* keep the clock running */ }
  }, [playSample]);

  /* ---- the 16th-note clock ---- */
  const tick = useCallback((time) => {
    const e = eng.current; if (!e) return;
    const s = posRef.current % STEPS;

    /* Bank changes land on the bar line, never mid-pattern. In song mode the
       chain advances one slot per bar; empty slots are skipped. */
    if (s === 0) {
      const sections = arrRef.current;
      if (songRef.current && sections.length) {
        if (posRef.current > 0) {
          barIdxRef.current += 1;
          if (barIdxRef.current >= (sections[secIdxRef.current] || {}).bars) {
            barIdxRef.current = 0;
            secIdxRef.current = (secIdxRef.current + 1) % sections.length;
          }
        }
        const sec = sections[secIdxRef.current];
        nowBankRef.current = bnkRef.current[sec.bank] ? sec.bank : selBankRef.current;
        const si = secIdxRef.current, bi = barIdxRef.current;
        getD().schedule(() => { setSecAt(si); setBarAt(bi); }, time);
      } else {
        nowBankRef.current = selBankRef.current;
        getD().schedule(() => setSecAt(-1), time);
      }
      const nb = nowBankRef.current;
      getD().schedule(() => setPlayBank((b) => (b === nb ? b : nb)), time);
    }

    const pat = bnkRef.current[nowBankRef.current] || bnkRef.current[selBankRef.current];
    const mut = mutRef.current;
    const pump = masRef.current.pump;

    if (pat.kick[s] && pump > 0) {
      try {
        const g = e.duck.gain;
        g.cancelScheduledValues(time);
        g.setValueAtTime(Math.max(0.05, 1 - pump), time);
        g.linearRampToValueAtTime(1, time + 0.16 + pump * 0.12);
      } catch (err) {}
    }
    TRACKS.forEach((t) => {
      const v = pat[t.id][s];
      if (!v || mut[t.id]) return;
      fire(t.id, time, v === 2 ? 1 : 0.72);
    });
    getD().schedule(() => setStep(s), time);
    posRef.current++;
  }, [fire]);

  /* ---- apply parameters ---- */
  useEffect(() => {
    const e = eng.current; if (!e) return;
    const p = params;
    e.kick.envelope.decay = p.kick.decay; e.kick.pitchDecay = p.kick.punch;
    e.clapF.frequency.value = p.clap.tone; e.clap.envelope.decay = p.clap.decay;
    e.rimF.frequency.value = p.rim.tone; e.rim.envelope.decay = p.rim.decay;
    e.hatF.frequency.value = p.hat.tone; e.hat.envelope.decay = p.hat.decay;
    e.openF.frequency.value = p.open.tone; e.open.envelope.decay = p.open.decay;
    e.shkrF.frequency.value = p.shkr.tone; e.shkr.envelope.decay = p.shkr.decay;
    e.perc.envelope.decay = p.perc.decay; e.perc.pitchDecay = p.perc.punch;
    e.bass.filterEnvelope.baseFrequency = p.bass.cutoff;
    e.bass.filterEnvelope.octaves = p.bass.env;
    if (e.bass.oscillator.type !== p.bass.wave) e.bass.oscillator.type = p.bass.wave;
    e.bass.filter.Q.value = p.bass.reso;
    e.bass.envelope.decay = p.bass.decay;
    e.bass.portamento = p.bass.glide;
    e.stabF.frequency.value = p.stab.cutoff;
    try { e.stab.set({ envelope: { decay: p.stab.decay } }); } catch (err) {}
    Object.keys(e.ch).forEach((k) => {
      e.ch[k].gain.gain.value = p[k].level;
      e.ch[k].dly.gain.value = p[k].dly;
      e.ch[k].rev.gain.value = p[k].rev;
    });
  }, [params]);

  /* ---- hand the assigned buffers to the players ---- */
  useEffect(() => {
    const e = eng.current; if (!e) return;
    TRACKS.forEach((t) => {
      const v = e.smpl[t.id];
      const item = pool.find((x) => x.id === assign[t.id]);
      if (item && v.player.buffer !== item.buffer) v.player.buffer = item.buffer;
    });
  }, [assign, pool]);

  /* ---- apply master ---- */
  useEffect(() => {
    const e = eng.current; if (!e) return;
    const t = getT();
    t.bpm.value = master.bpm;
    t.swing = master.swing;
    try {
      e.filter.frequency.rampTo(120 * Math.pow(165, master.filter), 0.05);
      e.drive.distortion = master.drive;
      e.drive.wet.value = master.drive > 0.01 ? 1 : 0;
      e.delay.feedback.rampTo(master.dfb, 0.05);
      e.delay.delayTime.value = master.dtime;
      e.master.gain.rampTo(master.vol, 0.05);
    } catch (err) {}
  }, [master]);

  /* ---- transport ---- */
  const toggle = useCallback(async () => {
    const t = getT();
    if (playing) {
      t.stop(); posRef.current = 0; secIdxRef.current = 0; barIdxRef.current = 0;
      setStep(-1); setSecAt(-1); setBarAt(0); setPlaying(false);
    } else {
      await Tone.start();
      posRef.current = 0; secIdxRef.current = 0; barIdxRef.current = 0;
      t.position = 0; t.start();
      setPlaying(true);
    }
  }, [playing]);

  useEffect(() => {
    const onKey = (ev) => {
      const tag = (ev.target && ev.target.tagName) || "";
      if (ev.code === "Space" && !["INPUT", "SELECT", "TEXTAREA"].includes(tag)) {
        ev.preventDefault(); toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  /* ---- sample loading ---- */
  const loadFiles = useCallback(async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setReadout("LADE " + list.length + " DATEI(EN) …");
    const ctx = Tone.getContext();
    const added = [];
    for (const f of list) {
      try {
        const ab = await f.arrayBuffer();
        const audio = typeof ctx.decodeAudioData === "function"
          ? await ctx.decodeAudioData(ab)
          : await ctx.rawContext.decodeAudioData(ab);
        added.push({
          id: f.name + ":" + f.size + ":" + Math.random().toString(36).slice(2, 7),
          name: f.name.replace(/\.[^.]+$/, ""),
          buffer: new Tone.ToneAudioBuffer(audio),
        });
      } catch (err) { /* skip anything the browser cannot decode */ }
    }
    if (!added.length) { setReadout("KEINE DATEI LESBAR"); return; }
    setPool((prev) => [...prev, ...added]);
    setReadout(added.length + " SAMPLE(S) GELADEN");
  }, []);

  const assignTo = (trackId, poolId) => {
    const item = pool.find((x) => x.id === poolId);
    setAssign((a) => ({ ...a, [trackId]: poolId }));
    setSrcs((v) => ({ ...v, [trackId]: "sample" }));
    setSmpl((v) => (v[trackId] ? v : { ...v, [trackId]: { ...DEFAULT_SMPL } }));
    setReadout(TRACKS.find((t) => t.id === trackId).label + " \u2190 " + (item ? item.name : ""));
  };

  /* ---- storage slots ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.list("tb16:");
        const found = {};
        (res && res.keys ? res.keys : []).forEach((k) => (found[k.replace("tb16:", "")] = true));
        setSlots(found);
      } catch (err) { /* no slots yet */ }
    })();
  }, []);

  const slotAction = async (n) => {
    const key = "tb16:" + n;
    if (saveMode) {
      try {
        await storage.set(key, JSON.stringify({
          name, banks, arr, song, bank, params, master, mutes, root, chord }));
        setSlots((s) => ({ ...s, [n]: true }));
        setReadout("GESPEICHERT AUF " + n);
      } catch (err) { setReadout("SPEICHERN FEHLGESCHLAGEN"); }
      setSaveMode(false);
    } else {
      try {
        const r = await storage.get(key);
        const d = JSON.parse(r.value);
        if (d.banks) {
          setBanks(d.banks);
          if (d.arr) setArr(d.arr);
          else if (d.chain) {
            /* slots written when the chain was eight single bars */
            setArr(d.chain.filter(Boolean).map((b, i) => ({
              name: "TEIL " + (i + 1), bank: b, bars: 1, note: "",
            })));
          }
          setSong(!!d.song);
          setBank(d.bank && d.banks[d.bank] ? d.bank : "A");
        } else if (d.pattern) {
          /* slots written before banks existed */
          setBanks({ A: d.pattern, B: emptyPattern(), C: emptyPattern(), D: emptyPattern() });
          setSong(false); setBank("A");
        }
        setParams(d.params); setMaster(d.master);
        setMutes(d.mutes || {}); setRoot(d.root ?? 9); setChord(d.chord || "min7");
        setName(d.name || "SLOT " + n); setReadout("GELADEN VON " + n);
      } catch (err) { setReadout("SLOT " + n + " IST LEER"); }
    }
  };

  /* ---- editing ---- */
  const cycle = (tid, i) => {
    setPattern((p) => {
      const next = { ...p, [tid]: p[tid].slice() };
      next[tid][i] = (next[tid][i] + 1) % 3;
      return next;
    });
    setSel(tid);
  };

  const selectTrack = async (tid) => {
    setSel(tid);
    setReadout(TRACKS.find((t) => t.id === tid).label);
    if (!playing) {
      try { await Tone.start(); fire(tid, Tone.now() + 0.02, 1); } catch (err) {}
    }
  };

  const tapBank = (b) => {
    if (copyArm) {
      if (b !== bank) {
        setBanks((x) => ({ ...x, [b]: JSON.parse(JSON.stringify(x[bank])) }));
        setReadout("BANK " + bank + " KOPIERT NACH " + b);
      } else setReadout("BANK " + b);
      setCopyArm(false);
    } else setReadout("BANK " + b);
    setBank(b);
  };

  const editSec = (i, patch) =>
    setArr((a) => a.map((sc, k) => (k === i ? { ...sc, ...patch } : sc)));

  const cycleSecBank = (i) => {
    const at = BANKS.indexOf(arr[i].bank);
    editSec(i, { bank: BANKS[(at + 1) % BANKS.length] });
  };

  /* Sections move in steps of eight bars — that is the grid the genre counts in. */
  const addBars = (i, d) =>
    editSec(i, { bars: Math.max(8, Math.min(64, arr[i].bars + d)) });

  const barSeconds = 4 * (60 / master.bpm);
  const clock = (bars) => {
    const t = Math.round(bars * barSeconds);
    return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  };
  const totalBars = arr.reduce((n, sc) => n + sc.bars, 0);

  const bankFilled = (b) =>
    TRACKS.some((t) => banks[b] && banks[b][t.id].some((v) => v));

  const loadPreset = (pr) => {
    setPattern(pr.pattern);
    setName(pr.name);
    setMutes({});
    setMaster((m) => ({ ...m, bpm: pr.bpm, swing: pr.swing, ...(pr.master || {}) }));
    if (pr.tweak) {
      setParams((p) => {
        const n = JSON.parse(JSON.stringify(p));
        Object.entries(pr.tweak).forEach(([g, vals]) => Object.assign(n[g], vals));
        return n;
      });
    }
    setReadout(pr.name);
  };

  const grp = TRACKS.find((t) => t.id === sel).grp;
  const setP = (k, v) => {
    setParams((p) => ({ ...p, [grp]: { ...p[grp], [k]: v } }));
    setSndPre((s) => (s[grp] ? { ...s, [grp]: null } : s)); // no longer the preset
    setReadout(TRACKS.find((t) => t.id === sel).label + " " + k.toUpperCase());
  };

  const applySound = async (name, vals) => {
    setParams((p) => ({ ...p, [grp]: { ...p[grp], ...vals } }));
    setSndPre((s) => ({ ...s, [grp]: name }));
    setReadout(TRACKS.find((t) => t.id === sel).label + " \u00b7 " + name);
    if (playing) return;
    try { await Tone.start(); } catch (err) {}
    /* let the params effect commit before auditioning */
    setTimeout(() => { try { fire(sel, Tone.now() + 0.02, 1); } catch (err) {} }, 0);
  };
  const setM = (k, v) => { setMaster((m) => ({ ...m, [k]: v })); setReadout("MASTER " + k.toUpperCase()); };

  const isSmp = srcs[sel] === "sample";
  const sp = smpl[sel] || DEFAULT_SMPL;
  const setSP = (k, v) => {
    setSmpl((x) => ({ ...x, [sel]: { ...(x[sel] || DEFAULT_SMPL), [k]: v } }));
    setReadout(TRACKS.find((t) => t.id === sel).label + " " + k.toUpperCase());
  };

  return (
    <div
      className="tb"
      onDragOver={(ev) => { ev.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(ev) => { ev.preventDefault(); setOver(false); loadFiles(ev.dataTransfer.files); }}
    >
      <style>{CSS}</style>
      <div className="wrap">

        <div className="brand">
          <b>TB·16</b>
          <span>TECHNO / TECH HOUSE GROOVEBOX</span>
        </div>

        <div className="lcd">
          <div className="l1">
            <span>BANK {playing ? playBank : bank}{song ? " \u00b7 SONG" : ""}</span>
            <span>{name}</span>
          </div>
          <div className="l2">{readout}</div>
          <div className="l3">
            <span>{playing ? "▶ LÄUFT" : "■ GESTOPPT"}</span>
            <span>{NOTES[root]} MIN · {Math.round(master.bpm)} BPM · STEP {step < 0 ? "–" : step + 1}</span>
          </div>
        </div>

        <div className="panel">
          <div className="bar" style={{ marginBottom: 10 }}>
            <button className={"play" + (playing ? " on" : "")} onClick={toggle}>
              {playing ? "STOP" : "PLAY"}
            </button>
            <div style={{ flex: 1, minWidth: 120 }}>
              <Ctl label="TEMPO" unit="" value={master.bpm} min={100} max={150} step={1} onChange={(v) => setM("bpm", v)} />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <Ctl label="SWING" unit="" value={master.swing} min={0} max={0.6} step={0.01} onChange={(v) => setM("swing", v)} />
            </div>
          </div>

          <div className="ruler">
            {Array.from({ length: STEPS }, (_, i) => (
              <i key={i} className={i === step ? "on" : ""}>{i % 4 === 0 ? i / 4 + 1 : "·"}</i>
            ))}
          </div>

          <div className="seq">
            {TRACKS.map((t) => (
              <div className="row" key={t.id}>
                <button
                  className={"name" + (sel === t.id ? " sel" : "") + (srcs[t.id] === "sample" ? " smp" : "")}
                  onClick={() => selectTrack(t.id)}
                >
                  {t.label}
                </button>
                <button
                  className={"mute" + (mutes[t.id] ? " on" : "")}
                  aria-label={"Mute " + t.label}
                  onClick={() => setMutes((m) => ({ ...m, [t.id]: !m[t.id] }))}
                  style={{ background: mutes[t.id] ? "#4a1220" : undefined }}
                />
                <div className="grid">
                  {pattern[t.id].map((v, i) => (
                    <button
                      key={i}
                      className={"step" + (Math.floor(i / 4) % 2 === 0 ? " q" : "") + (i === step ? " cur" : "")}
                      aria-label={t.label + " Step " + (i + 1)}
                      onClick={() => cycle(t.id, i)}
                      style={v ? {
                        background: t.color,
                        opacity: v === 2 ? 1 : 0.62,
                        boxShadow: (v === 2 ? "0 0 10px " : "0 0 5px ") + t.color,
                      } : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <p className="hd">SOUND · {TRACKS.find((t) => t.id === sel).label}</p>
          {assign[sel] && (
            <div className="bar" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 8, letterSpacing: ".16em", color: "#8b809a" }}>QUELLE</span>
              <button className={"btn" + (isSmp ? "" : " act")}
                onClick={() => setSrcs((v) => ({ ...v, [sel]: "synth" }))}>SYNTH</button>
              <button className={"btn" + (isSmp ? " act" : "")}
                onClick={() => setSrcs((v) => ({ ...v, [sel]: "sample" }))}>SAMPLE</button>
            </div>
          )}
          {!isSmp && SOUND_PRESETS[grp] && (
            <div className="pool" style={{ margin: "0 0 12px" }}>
              {SOUND_PRESETS[grp].map(([name, vals]) => (
                <button key={name}
                  className={"chip" + (sndPre[grp] === name ? " act" : "")}
                  onClick={() => applySound(name, vals)}>{name}</button>
              ))}
            </div>
          )}
          {!isSmp && grp === "bass" && (
            <div className="bar" style={{ marginBottom: 10 }}>
              <span className="lbl">WELLE</span>
              {[["sine", "SINE"], ["triangle", "TRI"], ["sawtooth", "SAW"], ["square", "SQR"]].map(([v, l]) => (
                <button key={v} className={"btn" + (params.bass.wave === v ? " act" : "")}
                  onClick={() => setP("wave", v)}>{l}</button>
              ))}
            </div>
          )}
          <div className="ctrls">
            {isSmp ? (
              <>
                {EDIT_SMPL.map(([k, label, min, max, st, unit]) => (
                  <Ctl key={k} label={label} unit={unit} min={min} max={max} step={st}
                    value={sp[k]} onChange={(v) => setSP(k, v)} />
                ))}
                {COMMON.map(([k, label, min, max, st, unit]) => (
                  <Ctl key={k} label={label} unit={unit} min={min} max={max} step={st}
                    value={params[grp][k]} onChange={(v) => setP(k, v)} />
                ))}
              </>
            ) : (
              EDIT[grp].map(([k, label, min, max, st, unit]) => (
                <Ctl key={k} label={label} unit={unit} min={min} max={max} step={st}
                  value={params[grp][k]} onChange={(v) => setP(k, v)} />
              ))
            )}
          </div>
          {grp === "stab" && (
            <div className="bar" style={{ marginTop: 10 }}>
              <span style={{ fontSize: 8, letterSpacing: ".16em", color: "#8b809a" }}>AKKORD</span>
              <select value={chord} onChange={(e) => setChord(e.target.value)}>
                {Object.keys(CHORDS).map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="panel">
          <p className="hd">SAMPLES</p>
          <div className={"drop" + (over ? " over" : "")} onClick={() => fileRef.current && fileRef.current.click()}>
            {pool.length
              ? "WAV / MP3 HIERHER ZIEHEN ODER KLICKEN"
              : "NOCH KEINE SAMPLES \u2014 WAV / MP3 HIERHER ZIEHEN ODER KLICKEN"}
          </div>
          <input
            ref={fileRef} type="file" accept="audio/*" multiple
            style={{ display: "none" }}
            onChange={(ev) => { loadFiles(ev.target.files); ev.target.value = ""; }}
          />
          {pool.length > 0 && (
            <>
              <div className="pool">
                {pool.map((x) => (
                  <button key={x.id}
                    className={"chip" + (assign[sel] === x.id ? " act" : "")}
                    title={x.name}
                    onClick={() => assignTo(sel, x.id)}>{x.name}</button>
                ))}
              </div>
              <p className="foot" style={{ marginTop: 8, textAlign: "left" }}>
                Sample antippen, um es auf {TRACKS.find((t) => t.id === sel).label} zu legen.
              </p>
            </>
          )}
        </div>

        <div className="panel">
          <p className="hd">MASTER</p>
          <div className="ctrls">
            <Ctl label="FILTER" unit="" value={master.filter} min={0} max={1} step={0.01} onChange={(v) => setM("filter", v)} />
            <Ctl label="DRIVE" unit="" value={master.drive} min={0} max={0.8} step={0.01} onChange={(v) => setM("drive", v)} />
            <Ctl label="PUMP" unit="" value={master.pump} min={0} max={0.9} step={0.01} onChange={(v) => setM("pump", v)} />
            <Ctl label="DLY FEEDBACK" unit="" value={master.dfb} min={0} max={0.7} step={0.01} onChange={(v) => setM("dfb", v)} />
            <Ctl label="VOLUME" unit="" value={master.vol} min={0} max={1.2} step={0.01} onChange={(v) => setM("vol", v)} />
          </div>
          <div className="bar" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 8, letterSpacing: ".16em", color: "#8b809a" }}>DELAY</span>
            {[["16n", "1/16"], ["8n", "1/8"], ["8n.", "3/16"], ["4n", "1/4"]].map(([v, l]) => (
              <button key={v} className={"btn" + (master.dtime === v ? " act" : "")} onClick={() => setM("dtime", v)}>{l}</button>
            ))}
            <span style={{ fontSize: 8, letterSpacing: ".16em", color: "#8b809a", marginLeft: 6 }}>KEY</span>
            <select value={root} onChange={(e) => setRoot(parseInt(e.target.value, 10))}>
              {NOTES.map((n, i) => <option key={n} value={i}>{n} min</option>)}
            </select>
          </div>
        </div>

        <div className="panel">
          <p className="hd">SONG</p>
          <div className="bar">
            <span className="lbl">BANK</span>
            {BANKS.map((b) => (
              <button key={b}
                className={"btn" + (bank === b ? " act" : "") + (playing && playBank === b ? " now" : "")}
                onClick={() => tapBank(b)}>
                {b}{bankFilled(b) ? "" : " \u00b7"}
              </button>
            ))}
            <button className={"btn" + (copyArm ? " act" : "")}
              onClick={() => { setCopyArm((v) => !v); setReadout(copyArm ? "BEREIT" : "ZIELBANK W\u00c4HLEN"); }}>
              {copyArm ? "ZIEL \u2026" : "KOPIEREN"}
            </button>
          </div>
          <div className="bar" style={{ marginTop: 10 }}>
            <button className={"btn" + (song ? " act" : "")}
              onClick={() => { setSong((v) => !v); setReadout(song ? "LOOP" : "ARRANGEMENT"); }}>
              {song ? "ARRANGEMENT AN" : "ARRANGEMENT AUS"}
            </button>
            <button className="btn" onClick={() => {
              setArr(ARR_TEMPLATE());
              setMaster((m) => ({ ...m, bpm: 140 }));
              setSecSel(0);
              setReadout("TECHNO 140 GELADEN");
            }}>TECHNO 140</button>
            <span className="lbl">GESAMT {clock(totalBars)} · {totalBars} TAKTE</span>
          </div>

          <div className="arr">
            {arr.map((sc, i) => (
              <div key={sc.name + i}
                className={"sec" + (secSel === i ? " sel" : "") + (secAt === i ? " now" : "")}
                onClick={() => setSecSel(i)}>
                <b>{sc.name}</b>
                <button className="mini" aria-label={sc.name + " Bank"}
                  onClick={(ev) => { ev.stopPropagation(); cycleSecBank(i); }}>{sc.bank}</button>
                <span className="bars">
                  <button className="mini" aria-label="Weniger Takte"
                    onClick={(ev) => { ev.stopPropagation(); addBars(i, -8); }}>−</button>
                  <i>{sc.bars}</i>
                  <button className="mini" aria-label="Mehr Takte"
                    onClick={(ev) => { ev.stopPropagation(); addBars(i, 8); }}>+</button>
                </span>
                <span className="dur">{secAt === i ? barAt + 1 + "/" + sc.bars : clock(sc.bars)}</span>
              </div>
            ))}
          </div>

          {arr[secSel] && arr[secSel].note && (
            <p className="note">{arr[secSel].note}</p>
          )}

          <p className="foot" style={{ textAlign: "left", marginTop: 8 }}>
            Jeder Abschnitt spielt eine Bank über die angegebene Zahl Takte.
            Abschnitt antippen für den Hinweis dazu. Bankwechsel greifen immer
            erst zur nächsten Taktgrenze.
          </p>
        </div>

        <div className="panel">
          <p className="hd">PATTERN</p>
          <div className="bar">
            {PRESETS.map((pr) => (
              <button key={pr.name} className={"btn" + (name === pr.name ? " act" : "")} onClick={() => loadPreset(pr)}>{pr.name}</button>
            ))}
            <button className="btn" onClick={() => { setPattern(randomPattern()); setName("ZUFALL"); setReadout("NEUER GROOVE"); }}>WÜRFELN</button>
            <button className="btn" onClick={() => { setPattern(emptyPattern()); setName("LEER"); setReadout("PATTERN GELÖSCHT"); }}>LEEREN</button>
          </div>
          <div className="bar" style={{ marginTop: 10 }}>
            <button className={"btn" + (saveMode ? " act" : "")} onClick={() => { setSaveMode((s) => !s); setReadout(saveMode ? "BEREIT" : "SLOT ZUM SPEICHERN WÄHLEN"); }}>
              {saveMode ? "SPEICHERN …" : "SPEICHERN"}
            </button>
            {["1", "2", "3", "4"].map((n) => (
              <button key={n} className={"btn" + (slots[n] ? " act" : "")} onClick={() => slotAction(n)}>{n}</button>
            ))}
            <span style={{ fontSize: 8, letterSpacing: ".14em", color: "#8b809a" }}>
              {saveMode ? "SLOT WÄHLEN" : "TIPPEN ZUM LADEN"}
            </span>
          </div>
        </div>

        <p className="foot">
          Step antippen: aus → an → Akzent. Spurname antippen: anhören und zum Schrauben auswählen.<br />
          Leertaste startet und stoppt. Kopfhörer aufsetzen, sonst fehlt der Bass.
        </p>
      </div>
    </div>
  );
}
