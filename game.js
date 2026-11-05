/* =========================================================
   斩名录 / THE NAME BLADE —— 30 秒割草切片
   操作：WASD 移动 · J 斩 · K 闪身斩 · E 名册（满槽）· R 重来
   ========================================================= */
(() => {
'use strict';

let W = 1280, H = 720;
let PORTRAIT = false;
let BOOTED = false;
const WORLD_W = 2600;
const ARENA = { x1: 80, x2: WORLD_W - 80, y1: 380, y2: 690 };
const CAM = { x: 640, y: 360 };
const TAU = Math.PI * 2;
const F_SERIF = '"Songti SC","STSong","Noto Serif SC",serif';
const F_SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
const F_NUM = '"DIN Alternate","Avenir Next Condensed","PingFang SC",sans-serif';

const canvas = document.getElementById('c');
const g = canvas.getContext('2d');
const DPR = Math.min(1.25, window.devicePixelRatio || 1);
canvas.width = W * DPR;
canvas.height = H * DPR;
function resizeCanvas() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const aspect = vw / Math.max(1, vh);
  PORTRAIT = aspect < 0.95;
  if (PORTRAIT) {
    W = 720; H = 1280;
    ARENA.y1 = 420; ARENA.y2 = 1200;
    CAM.y = 860;
  } else {
    W = Math.round(Math.max(1280, Math.min(1760, 720 * aspect)));
    H = 720;
    ARENA.y1 = 380; ARENA.y2 = 690;
    CAM.y = 360;
  }
  if (BOOTED) { P.y = clamp(P.y, ARENA.y1, ARENA.y2); layoutTouch(); }
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const sign = v => v < 0 ? -1 : 1;

/* ---------------- 音频 ---------------- */
let AC = null, MASTER = null, NOISE = null, muted = false;

function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  MASTER = AC.createGain();
  MASTER.gain.value = 0.5;
  MASTER.connect(AC.destination);
  const len = Math.floor(AC.sampleRate * 2);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  NOISE = buf;
  ambient();
}

function tone(freq, dur, o = {}) {
  if (!AC || muted) return;
  const { type = 'sine', vol = 0.15, to = null, delay = 0, attack = 0.006 } = o;
  const t0 = AC.currentTime + delay;
  const osc = AC.createOscillator(), gn = AC.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gn); gn.connect(MASTER);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function noiseHit(dur, vol, freq, ftype = 'bandpass', delay = 0, q = 1, toFreq = 0) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + delay;
  const src = AC.createBufferSource(); src.buffer = NOISE;
  const f = AC.createBiquadFilter(); f.type = ftype;
  f.frequency.setValueAtTime(freq, t0);
  if (toFreq) f.frequency.exponentialRampToValueAtTime(Math.max(40, toFreq), t0 + dur);
  f.Q.value = q;
  const gn = AC.createGain();
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(gn); gn.connect(MASTER);
  src.start(t0); src.stop(t0 + dur + 0.03);
}

function ambient() {
  if (!AC) return;
  const t0 = AC.currentTime;
  [55, 82.5, 110].forEach((f, i) => {
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const gn = AC.createGain(); gn.gain.value = 0.045 / (i + 1);
    o.connect(lp); lp.connect(gn); gn.connect(MASTER); o.start(t0);
  });
  const src = AC.createBufferSource(); src.buffer = NOISE; src.loop = true;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
  const gn = AC.createGain(); gn.gain.value = 0.025;
  src.connect(bp); bp.connect(gn); gn.connect(MASTER); src.start(t0);
}

const SFX = {
  slash() { noiseHit(0.12, 0.14, 2200, 'bandpass', 0, 1.2, 600); },
  hit() {
    noiseHit(0.09, 0.28, 900, 'bandpass', 0, 0.9);
    tone(190, 0.12, { type: 'square', vol: 0.05, to: 90 });
    tone(90, 0.16, { type: 'sine', vol: 0.16, to: 50 });
  },
  kill() {
    noiseHit(0.16, 0.20, 500, 'lowpass', 0, 0.7);
    tone(140, 0.20, { type: 'sine', vol: 0.12, to: 60 });
  },
  hurt() {
    noiseHit(0.2, 0.35, 400, 'lowpass');
    tone(110, 0.28, { type: 'sine', vol: 0.28, to: 40 });
  },
  ult() {
    tone(55, 1.0, { type: 'sine', vol: 0.4, to: 30 });
    noiseHit(0.6, 0.35, 2600, 'bandpass', 0, 0.7, 200);
    tone(1200, 0.4, { type: 'sawtooth', vol: 0.06, to: 180 });
    tone(2400, 0.25, { type: 'triangle', vol: 0.06, to: 600, delay: 0.05 });
  },
  dash() { noiseHit(0.16, 0.12, 700, 'bandpass', 0, 1.4, 2200); },
  chargeStart() { tone(180, 0.22, { type: 'sawtooth', vol: 0.035, to: 110 }); },
  heavySwing() {
    noiseHit(0.24, 0.22, 1300, 'bandpass', 0, 0.8, 180);
    tone(85, 0.24, { type: 'sine', vol: 0.22, to: 38 });
  },
  multiKill() {
    tone(880, 0.30, { type: 'triangle', vol: 0.06 });
    tone(1320, 0.24, { type: 'sine', vol: 0.04, delay: 0.04 });
  },
  kenbiki() {
    noiseHit(0.30, 0.20, 4200, 'highpass', 0, 0.7, 900);
    tone(2400, 0.45, { type: 'sine', vol: 0.06, to: 600 });
    tone(62, 0.5, { type: 'sine', vol: 0.24, to: 30 });
  },
  bow() {
    noiseHit(0.09, 0.12, 3200, 'highpass');
    tone(700, 0.1, { type: 'triangle', vol: 0.05, to: 1300 });
  },
  fuse() { tone(1200, 0.35, { type: 'square', vol: 0.03, to: 1700 }); },
  explode() {
    noiseHit(0.5, 0.42, 420, 'lowpass');
    tone(72, 0.5, { type: 'sine', vol: 0.35, to: 30 });
  },
  roar() {
    tone(68, 0.9, { type: 'sawtooth', vol: 0.18, to: 42 });
    noiseHit(0.7, 0.24, 320, 'lowpass');
  },
  cutin() {
    tone(58, 0.55, { type: 'sine', vol: 0.36, to: 28 });
    noiseHit(0.28, 0.22, 3200, 'highpass', 0, 0.7, 700);
    tone(1800, 0.45, { type: 'triangle', vol: 0.06, to: 520, delay: 0.05 });
  },
  bossSlash() {
    noiseHit(0.3, 0.26, 900, 'bandpass', 0, 0.8, 200);
    tone(80, 0.3, { type: 'sine', vol: 0.25, to: 35 });
  },
  clang() {
    tone(2200, 0.14, { type: 'triangle', vol: 0.07 });
    tone(3300, 0.09, { type: 'sine', vol: 0.05 });
    noiseHit(0.07, 0.20, 3800, 'highpass', 0, 0.8);
  },
  streak() {
    tone(660, 0.8, { type: 'sine', vol: 0.07 });
    tone(990, 0.6, { type: 'sine', vol: 0.04, delay: 0.02 });
  },
  bloodmoon() {
    tone(48, 2.0, { type: 'sine', vol: 0.25, to: 36 });
    tone(320, 1.6, { type: 'sine', vol: 0.05, to: 160 });
  }
};

/* ---------------- 状态 ---------------- */
const G = {
  mode: 'title', paused: false, upgrade: null, weaponPick: null, weapon: 'mingce', weaponName: '名 册', cutin: null, taken: new Set(), eliteDone: false, elite2Done: false, execT: 0, execX: 0, execY: 0,
  t: 0, runT: 0, stage: 1, stageKills: 0, stageQuota: 0, stageClearT: 0, victory: false, score: 0, kills: 0,
  combo: 0, comboT: 0, maxCombo: 0,
  meter: 0,
  hitstop: 0, shake: 0, shakeX: 0, shakeY: 0, kickX: 0, kickY: 0,
  slowT: 0, punch: 0,
  flash: 0, flashColor: '#fff',
  bloodMoon: false,
  redMix: 0,
  ult: null,
  banner: null,
  streak: 0,
  endT: 0,
  spawnT: 0,
  timeScale: 1,
  best: readBest()
};

function readBest() {
  try { return Number(localStorage.getItem('tide_best') || 0) || 0; } catch (e) { return 0; }
}

const P = {
  x: 640, y: 580, face: 1, aim: Math.PI,
  hp: 10, maxHp: 10, speed: 330,
  attackT: 0, attackDur: 0.3, step: 0, attackAngle: 0,
  dashT: 0, dashCd: 0, dashX: 1, dashY: 0, dashHits: null,
  invuln: 0, hurtT: 0, run: 0, animT: 0,
  charging: false, charge: 0, holding: false, holdT: 0, charged: false, buffer: 0, lastStep: 0, lastHeavy: false, kenbikiT: 0,
  dmgBonus: 0, speedMul: 1, rangeMul: 1, dashCdMul: 1, ultGainMul: 1,
  runPhase: 0, trail: [], dustT: 0,
  hasWave: false, hasChain: false, hasBurn: false, hasFrost: false, lifesteal: 0, chainCd: 0,
  firestorm: false, iceblade: false, splitWave: false, shatter: false, bloodburn: false
};

const enemies = [];
const projectiles = [];
const waves = [];
const bolts = [];
const parts = [];
const slashes = [];
const texts = [];
const rings = [];
const decals = [];
const motes = [];
const rain = [];

const RATE_COLOR = { D: '#8a93a8', C: '#7fe3ff', B: '#7dffb0', A: '#ffd36e', S: '#ff9a3c', SS: '#ff5f70', SSS: '#ffffff' };
const RATE_MULT = { D: 1, C: 1.2, B: 1.5, A: 2, S: 3, SS: 4, SSS: 6 };

function ratingOf(c) {
  if (c >= 140) return 'SSS';
  if (c >= 100) return 'SS';
  if (c >= 70) return 'S';
  if (c >= 45) return 'A';
  if (c >= 25) return 'B';
  if (c >= 10) return 'C';
  return 'D';
}
function mult() { return RATE_MULT[ratingOf(G.combo)]; }

/* ---------------- 输入 ---------------- */
const keys = {};

window.addEventListener('keydown', e => {
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyE', 'KeyR', 'KeyM',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (!AC) audioInit();
  onPress(e.code);
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'KeyJ' || e.code === 'Space') attackRelease();
});
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const IS_TOUCH = new URLSearchParams(location.search).get('touch') === '1' ||
  (window.matchMedia && matchMedia('(pointer: coarse)').matches);
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, kx: 0, ky: 0 };
const TBTN = [
  { id: 'atk', x: W - 112, y: H - 138, r: 74, label: '斩' },
  { id: 'dash', x: W - 246, y: H - 86, r: 50, label: '闪' },
  { id: 'ult', x: W - 252, y: H - 212, r: 48, label: '名册' },
  { id: 'pause', x: W - 40, y: 34, r: 22, label: '' }
];
if (typeof layoutTouch === 'function') layoutTouch();
function layoutTouch() {
  TBTN[0].x = W - (PORTRAIT ? 95 : 112); TBTN[0].y = H - (PORTRAIT ? 210 : 138);
  TBTN[1].x = W - (PORTRAIT ? 195 : 246); TBTN[1].y = H - (PORTRAIT ? 105 : 86);
  TBTN[2].x = W - (PORTRAIT ? 195 : 252); TBTN[2].y = H - (PORTRAIT ? 315 : 212);
  TBTN[3].x = W - 40;  TBTN[3].y = 34;
}

function togglePause() {
  if (G.mode !== 'play' || G.upgrade || G.talent || G.weaponPick) return;
  G.paused = !G.paused;
}
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function tryFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req) {
    try {
      const p = req.call(el);
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  try {
    if (screen.orientation && screen.orientation.lock) {
      const p = screen.orientation.lock('landscape');
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) {}
}

canvas.addEventListener('pointerdown', (e) => {
  audioInit();
  tryFullscreen();
  const p = canvasPos(e);
  if (G.mode === 'play' && G.paused && !G.talent && !G.upgrade && !G.weaponPick) {
    for (let i = 0; i < 4; i++) {
      const r = pauseRowRect(i);
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { pauseAction(i); return; }
    }
    return;
  }
  if (G.mode === 'result' && G.endT > 0.6) {
    const r = shareRect();
    const oy = PORTRAIT ? (H - 720) / 2 : 0;
    if (p.x >= r.x && p.x <= r.x + r.w && p.y - oy >= r.y && p.y - oy <= r.y + r.h) { saveShareCard(); return; }
  }
  if (G.mode === 'play' && (G.talent || G.upgrade || G.weaponPick)) {
    const rects = cardRects();
    for (let i = 0; i < 3; i++) {
      const r = rects[i];
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { chooseCard(i); return; }
    }
    return;
  }
  if (G.mode === 'title') { startGame(); return; }
  if (G.mode !== 'play') return;
  const b = TBTN.find(t => Math.hypot(p.x - t.x, p.y - t.y) < t.r + 14);
  if (b) {
    e.preventDefault();
    if (b.id === 'atk') { attackPress(); b.touchId = e.pointerId; }
    else if (b.id === 'dash') dash();
    else if (b.id === 'ult') tryUlt();
    else if (b.id === 'pause') togglePause();
    return;
  }
  if (p.x < W * 0.55 && !joy.active) {
    joy.active = true; joy.id = e.pointerId;
    joy.ox = p.x; joy.oy = p.y; joy.x = 0; joy.y = 0; joy.kx = 0; joy.ky = 0;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  const p = canvasPos(e);
  const dx = p.x - joy.ox, dy = p.y - joy.oy;
  const d = Math.hypot(dx, dy) || 1;
  const cl = Math.min(1, d / 78);
  joy.x = dx / d * cl;
  joy.y = dy / d * cl;
  joy.kx = dx / d * Math.min(d, 78);
  joy.ky = dy / d * Math.min(d, 78);
});
function endTouch(e) {
  if (joy.active && e.pointerId === joy.id) {
    joy.active = false; joy.x = 0; joy.y = 0;
  }
  const atk = TBTN.find(t => t.id === 'atk');
  if (atk && atk.touchId === e.pointerId) { attackRelease(); atk.touchId = null; }
}
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);
canvas.addEventListener('pointerleave', endTouch);

function onPress(code) {
  if (G.mode === 'play' && (G.talent || G.upgrade || G.weaponPick)) {
    const i = code === 'Digit1' ? 0 : code === 'Digit2' ? 1 : code === 'Digit3' ? 2 : -1;
    if (i >= 0) chooseCard(i);
    return;
  }
  if (code === 'Escape' || code === 'KeyP') {
    if (G.mode === 'play') G.paused = !G.paused;
    return;
  }
  if (code === 'KeyM') {
    muted = !muted;
    if (MASTER) MASTER.gain.value = muted ? 0 : 0.5;
    return;
  }
  if (G.mode === 'title') { if (code !== 'KeyM') startGame(); return; }
  if (G.mode === 'result') { if (code === 'KeyS') { saveShareCard(); return; } if (G.endT > 0.7 && (code === 'KeyR' || code === 'Space' || code === 'Enter')) startGame(); return; }
  if (G.mode !== 'play' || G.ult) return;
  if (code === 'KeyJ' || code === 'Space') attackPress();
  else if (code === 'KeyK') dash();
  else if (code === 'KeyE') tryUlt();
}

/* ---------------- 图像素材 ---------------- */
const IMG = {
  normal: new Image(),
  red: new Image(),
  su: new Image(),
  bust: new Image(),
  dusk: new Image(),
  cutin: new Image(),
  card: new Image()
};
IMG.normal.src = 'art/bg-arena.png';
IMG.red.src = 'art/bg-red.png';
IMG.su.src = 'art/su-v2.png';
IMG.bust.src = 'art/su-bust.png';
IMG.dusk.src = 'art/bg-dusk.png';
IMG.cutin.src = 'art/cutin.png';
IMG.card.src = 'art/su-card.png';
const CUT = {};
const CUTP = {
  head: [40, -730], torso: [0, 0], armL: [-140, -650], armR: [260, -650], legL: [-60, -50], legR: [140, -50]
};
const CUTM = {};
for (const k of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) {
  const im = new Image();
  im.src = 'art/parts/' + k + '.webp';
  CUT[k] = im;
}
CUTM.head = { w: 428, h: 410, px: 187, py: 384 };
CUTM.torso = { w: 649, h: 771, px: 233, py: 755 };
CUTM.armL = { w: 633, h: 359, px: 608, py: 16 };
CUTM.armR = { w: 590, h: 208, px: 45, py: 83 };
CUTM.legL = { w: 335, h: 1058, px: 264, py: 65 };
CUTM.legR = { w: 381, h: 1191, px: 135, py: 65 };

const PART = { body: new Image(), legL: new Image(), legR: new Image() };
PART.body.src = 'art/frames/rig-body.webp';
PART.legL.src = 'art/frames/rig-legL.webp';
PART.legR.src = 'art/frames/rig-legR.webp';
const SW_FRAMES = [];
for (let i = 1; i <= 8; i++) {
  const img = new Image();
  img.src = 'art/frames/sw-' + i + '.webp';
  SW_FRAMES.push(img);
}

function scaledCanvas(img) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const b = c.getContext('2d');
  b.drawImage(img, 0, 0, W, H);
  return c;
}
const bgN = document.createElement('canvas'); bgN.width = W; bgN.height = H;
const bgD = document.createElement('canvas'); bgD.width = W; bgD.height = H;
const bgR = document.createElement('canvas'); bgR.width = W; bgR.height = H;
IMG.normal.onload = () => { bgN.getContext('2d').drawImage(IMG.normal, 0, 0, W, H); };
IMG.red.onload = () => { bgR.getContext('2d').drawImage(IMG.red, 0, 0, W, H); };
IMG.dusk.onload = () => { bgD.getContext('2d').drawImage(IMG.dusk, 0, 0, W, H); };

/* ---------------- 背景 ---------------- */
const bg = document.createElement('canvas');
bg.width = W; bg.height = H;

function buildBG() {
  const b = bg.getContext('2d');
  // 天空
  const sky = b.createLinearGradient(0, 0, 0, 340);
  sky.addColorStop(0, '#05060c');
  sky.addColorStop(0.55, '#0d0c1c');
  sky.addColorStop(1, '#2a1526');
  b.fillStyle = sky;
  b.fillRect(0, 0, W, 340);

  // 血月
  const MX = 985, MY = 112, MR = 66;
  const halo = b.createRadialGradient(MX, MY, 10, MX, MY, MR * 4);
  halo.addColorStop(0, 'rgba(255,80,90,0.30)');
  halo.addColorStop(0.5, 'rgba(180,40,60,0.10)');
  halo.addColorStop(1, 'rgba(120,20,40,0)');
  b.fillStyle = halo;
  b.beginPath(); b.arc(MX, MY, MR * 4, 0, TAU); b.fill();
  const disc = b.createRadialGradient(MX - 16, MY - 18, 4, MX, MY, MR);
  disc.addColorStop(0, '#ff8a86');
  disc.addColorStop(0.55, '#e0414f');
  disc.addColorStop(1, '#9c1f30');
  b.fillStyle = disc;
  b.beginPath(); b.arc(MX, MY, MR, 0, TAU); b.fill();
  b.fillStyle = 'rgba(90,10,20,0.25)';
  b.beginPath(); b.arc(MX + 20, MY + 10, 14, 0, TAU); b.fill();
  b.beginPath(); b.arc(MX - 22, MY - 20, 8, 0, TAU); b.fill();

  // 鸟居剪影
  drawTorii(b, 120, 300, 1.25, '#08070d');
  drawTorii(b, 1140, 316, 0.95, '#0a080f');

  // 地面
  const gr = b.createLinearGradient(0, 300, 0, H);
  gr.addColorStop(0, '#141220');
  gr.addColorStop(0.25, '#0c0b14');
  gr.addColorStop(1, '#05050a');
  b.fillStyle = gr;
  b.fillRect(0, 300, W, H - 300);

  // 地面中央的血色反光
  const glow = b.createRadialGradient(640, 560, 20, 640, 560, 620);
  glow.addColorStop(0, 'rgba(140,26,44,0.16)');
  glow.addColorStop(0.55, 'rgba(80,16,30,0.07)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = glow;
  b.fillRect(0, 300, W, H - 300);

  // 竞技场环
  b.save();
  b.translate(640, 500);
  b.scale(1, 0.42);
  b.strokeStyle = 'rgba(150,170,220,0.10)';
  b.lineWidth = 3;
  b.beginPath(); b.arc(0, 0, 560, 0, TAU); b.stroke();
  b.strokeStyle = 'rgba(150,170,220,0.05)';
  b.lineWidth = 14;
  b.beginPath(); b.arc(0, 0, 530, 0, TAU); b.stroke();
  b.restore();

  // 裂纹
  b.strokeStyle = 'rgba(120,130,170,0.06)';
  b.lineWidth = 1.4;
  for (let i = 0; i < 40; i++) {
    let x = rnd(0, W), y = rnd(320, H);
    b.beginPath(); b.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += rnd(-40, 40); y += rnd(-22, 22);
      b.lineTo(x, y);
    }
    b.stroke();
  }

  // 水洼反光
  for (let i = 0; i < 9; i++) {
    const x = rnd(100, 1180), y = rnd(380, 660);
    const r = rnd(30, 90);
    const p = b.createRadialGradient(x, y, 2, x, y, r);
    p.addColorStop(0, 'rgba(120,150,220,0.05)');
    p.addColorStop(1, 'rgba(120,150,220,0)');
    b.fillStyle = p;
    b.beginPath(); b.ellipse(x, y, r, r * 0.35, 0, 0, TAU); b.fill();
  }

  // 地平线雾
  const fog = b.createLinearGradient(0, 280, 0, 380);
  fog.addColorStop(0, 'rgba(80,60,110,0)');
  fog.addColorStop(0.6, 'rgba(90,70,120,0.10)');
  fog.addColorStop(1, 'rgba(60,40,80,0)');
  b.fillStyle = fog;
  b.fillRect(0, 280, W, 110);
}

function drawTorii(b, x, y, s, col) {
  b.save();
  b.translate(x, y);
  b.scale(s, s);
  b.fillStyle = col;
  b.fillRect(-46, -150, 13, 150);
  b.fillRect(33, -150, 13, 150);
  b.fillRect(-72, -158, 144, 9);
  b.fillRect(-62, -132, 124, 8);
  b.beginPath();
  b.moveTo(-72, -158);
  b.quadraticCurveTo(0, -178, 72, -158);
  b.lineTo(72, -166);
  b.quadraticCurveTo(0, -188, -72, -166);
  b.closePath();
  b.fill();
  b.restore();
}

buildBG();

// 黄昏暖色地面
const groundDusk = document.createElement('canvas');
groundDusk.width = WORLD_W; groundDusk.height = 390;
{
  const b = groundDusk.getContext('2d');
  const grad = b.createLinearGradient(0, 0, 0, 390);
  grad.addColorStop(0, '#6b5242');
  grad.addColorStop(0.45, '#4a362c');
  grad.addColorStop(1, '#2a1e19');
  b.fillStyle = grad;
  b.fillRect(0, 0, WORLD_W, 390);
  for (let row = 0; row < 12; row++) {
    const y = row * 34;
    const off = row % 2 ? 48 : 0;
    for (let x = -96; x < WORLD_W; x += 96) {
      const px = x + off;
      b.strokeStyle = `rgba(255,210,170,${0.04 + Math.random() * 0.05})`;
      b.lineWidth = 1;
      b.strokeRect(px, y, 96, 34);
      b.fillStyle = `rgba(255,220,180,${Math.random() * 0.03})`;
      b.fillRect(px + 2, y + 2, 92, 3);
    }
  }
  b.strokeStyle = 'rgba(190,150,120,0.10)';
  for (let i = 0; i < 90; i++) {
    let x = Math.random() * WORLD_W, y = Math.random() * 390;
    b.lineWidth = 0.8;
    b.beginPath(); b.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x += rnd(-34, 34); y += rnd(-12, 12); b.lineTo(x, y); }
    b.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * WORLD_W, y = 40 + Math.random() * 330, r = rnd(18, 64);
    const p = b.createRadialGradient(x, y, 2, x, y, r);
    p.addColorStop(0, 'rgba(255,190,120,0.16)');
    p.addColorStop(1, 'rgba(255,190,120,0)');
    b.fillStyle = p;
    b.beginPath(); b.ellipse(x, y, r, r * 0.32, 0, 0, TAU); b.fill();
  }
  const fog = b.createLinearGradient(0, 0, 0, 90);
  fog.addColorStop(0, 'rgba(28,14,12,0.98)');
  fog.addColorStop(0.5, 'rgba(36,18,16,0.75)');
  fog.addColorStop(1, 'rgba(36,18,16,0)');
  b.fillStyle = fog;
  b.fillRect(0, 0, WORLD_W, 90);
}

// 战场地标（随镜头滚动）
const PROPS = [];
{
  let x = 160;
  while (x < WORLD_W - 120) {
    const r = Math.random();
    PROPS.push({ x, y: rnd(430, 655), type: r < 0.4 ? 'lantern' : r < 0.72 ? 'banner' : 'rock', s: rnd(0.8, 1.15) });
    x += rnd(190, 330);
  }
}

function updateWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.t += dt;
    w.x += Math.cos(w.ang) * 900 * dt;
    w.y += Math.sin(w.ang) * 900 * dt;
    w.hitSet = w.hitSet || new Set();
    for (const e of enemies) {
      if (e.dead || w.hitSet.has(e)) continue;
      if (Math.hypot(e.x - w.x, e.y - w.y) < 56) {
        w.hitSet.add(e);
        hitEnemy(e, 2, w.ang, 0, true);
        if (P.iceblade) e.slowT = 1.8;
      }
    }
    if (w.t > 0.38) waves.splice(i, 1);
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    bolts[i].life -= dt;
    if (bolts[i].life <= 0) bolts.splice(i, 1);
  }
}

function drawWaves() {
  for (const w of waves) {
    const k = w.t / 0.38;
    g.save();
    g.translate(w.x, w.y);
    g.rotate(w.ang);
    g.globalAlpha = 1 - k;
    g.strokeStyle = '#bfe8ff';
    g.lineWidth = 5;
    g.beginPath(); g.arc(0, 0, 46, -0.9, 0.9); g.stroke();
    g.strokeStyle = 'rgba(255,150,170,0.7)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 40, -0.95, 0.95); g.stroke();
    g.restore();
  }
  for (const b of bolts) {
    g.save();
    g.globalAlpha = Math.max(0, b.life / 0.18);
    g.strokeStyle = '#9fe6ff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(b.x1, b.y1);
    g.lineTo((b.x1 + b.x2) / 2 + rnd(-12, 12), (b.y1 + b.y2) / 2 + rnd(-12, 12));
    g.lineTo(b.x2, b.y2);
    g.stroke();
    g.restore();
  }
}

function drawProps() {
  for (const p of PROPS) {
    if (p.x < CAM.x - 760 || p.x > CAM.x + 760) continue;
    g.save();
    g.translate(p.x, p.y);
    g.scale(p.s, p.s);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.ellipse(0, 2, 26, 7, 0, 0, TAU); g.fill();
    if (p.type === 'lantern') {
      g.fillStyle = '#1b1f2b';
      g.fillRect(-5, -54, 10, 54);
      g.fillRect(-12, -2, 24, 5);
      g.fillStyle = '#232838';
      g.fillRect(-11, -78, 22, 24);
      g.save();
      g.shadowColor = '#ffb45a';
      g.shadowBlur = 14;
      g.fillStyle = '#ffca7a';
      g.fillRect(-7, -74, 14, 16);
      g.restore();
      g.fillStyle = '#171b26';
      g.beginPath();
      g.moveTo(-16, -82); g.lineTo(0, -94); g.lineTo(16, -82); g.lineTo(12, -78); g.lineTo(-12, -78);
      g.closePath(); g.fill();
    } else if (p.type === 'banner') {
      g.fillStyle = '#1a1e2a';
      g.fillRect(-2, -96, 4, 96);
      g.fillStyle = '#5c1420';
      g.beginPath();
      g.moveTo(2, -94);
      g.lineTo(38, -88);
      g.lineTo(30, -58);
      g.lineTo(40, -52);
      g.lineTo(26, -34);
      g.lineTo(2, -40);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(255,120,130,0.25)';
      g.lineWidth = 1;
      g.stroke();
    } else {
      g.fillStyle = '#1a1f2b';
      g.beginPath(); g.ellipse(0, -10, 28, 18, 0.1, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(160,180,215,0.12)';
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, -10, 28, 18, 0.1, 0, TAU); g.stroke();
    }
    g.restore();
  }
}

// 地平线雾带（屏幕空间，遮住地面接缝）
const horizonFog = document.createElement('canvas');
horizonFog.width = W; horizonFog.height = 300;
{
  const f = horizonFog.getContext('2d');
  const fg = f.createLinearGradient(0, 0, 0, 300);
  fg.addColorStop(0, 'rgba(8,10,18,0.98)');
  fg.addColorStop(0.35, 'rgba(10,13,22,0.85)');
  fg.addColorStop(0.7, 'rgba(10,13,22,0.35)');
  fg.addColorStop(1, 'rgba(10,13,22,0)');
  f.fillStyle = fg;
  f.fillRect(0, 0, W, 180);
}

// 可滚动的地面（世界坐标 2600x340）
const groundCanvas = document.createElement('canvas');
groundCanvas.width = WORLD_W; groundCanvas.height = 390;
{
  const b = groundCanvas.getContext('2d');
  const grad = b.createLinearGradient(0, 0, 0, 390);
  grad.addColorStop(0, '#37405a');
  grad.addColorStop(0.45, '#262e44');
  grad.addColorStop(1, '#161c2a');
  b.fillStyle = grad;
  b.fillRect(0, 0, WORLD_W, 390);
  // 石板
  for (let row = 0; row < 12; row++) {
    const y = row * 34;
    const off = row % 2 ? 48 : 0;
    for (let x = -96; x < WORLD_W; x += 96) {
      const px = x + off;
      b.strokeStyle = `rgba(170,190,225,${0.04 + Math.random() * 0.05})`;
      b.lineWidth = 1;
      b.strokeRect(px, y, 96, 34);
      b.fillStyle = `rgba(200,220,255,${Math.random() * 0.025})`;
      b.fillRect(px + 2, y + 2, 92, 3);
    }
  }
  // 裂纹
  b.strokeStyle = 'rgba(120,135,170,0.10)';
  for (let i = 0; i < 90; i++) {
    let x = Math.random() * WORLD_W, y = Math.random() * 340;
    b.lineWidth = 0.8;
    b.beginPath(); b.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x += rnd(-34, 34); y += rnd(-12, 12); b.lineTo(x, y); }
    b.stroke();
  }
  // 月光水洼
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * WORLD_W, y = 40 + Math.random() * 280, r = rnd(18, 64);
    const p = b.createRadialGradient(x, y, 2, x, y, r);
    p.addColorStop(0, 'rgba(170,200,255,0.10)');
    p.addColorStop(1, 'rgba(170,200,255,0)');
    b.fillStyle = p;
    b.beginPath(); b.ellipse(x, y, r, r * 0.32, 0, 0, TAU); b.fill();
  }
  // 顶部融入夜空
  const fog = b.createLinearGradient(0, 0, 0, 90);
  fog.addColorStop(0, 'rgba(8,10,18,1)');
  fog.addColorStop(0.5, 'rgba(9,11,20,0.75)');
  fog.addColorStop(1, 'rgba(9,11,20,0)');
  b.fillStyle = fog;
  b.fillRect(0, 0, WORLD_W, 90);
}


// 预渲染叠加层 / 光环，减少每帧渐变与阴影开销
const overlayCanvas = document.createElement('canvas');
overlayCanvas.width = W; overlayCanvas.height = H;
{
  const o = overlayCanvas.getContext('2d');
  const ov = o.createLinearGradient(0, 0, 0, H);
  ov.addColorStop(0, 'rgba(3,4,9,0.42)');
  ov.addColorStop(0.42, 'rgba(3,4,9,0.20)');
  ov.addColorStop(0.72, 'rgba(3,4,9,0.30)');
  ov.addColorStop(1, 'rgba(3,4,9,0.62)');
  o.fillStyle = ov;
  o.fillRect(0, 0, W, H);
  const vg = o.createRadialGradient(640, 420, 160, 640, 420, 720);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  o.fillStyle = vg;
  o.fillRect(0, 0, W, H);
}

const overlayDusk = document.createElement('canvas');
overlayDusk.width = W; overlayDusk.height = H;
{
  const o = overlayDusk.getContext('2d');
  const ov = o.createLinearGradient(0, 0, 0, H);
  ov.addColorStop(0, 'rgba(40,20,20,0.10)');
  ov.addColorStop(0.45, 'rgba(40,20,20,0.04)');
  ov.addColorStop(1, 'rgba(20,8,10,0.30)');
  o.fillStyle = ov;
  o.fillRect(0, 0, W, H);
}

const vignetteCanvas = document.createElement('canvas');
vignetteCanvas.width = W; vignetteCanvas.height = H;
{
  const v = vignetteCanvas.getContext('2d');
  const vg = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.7, 'rgba(0,0,0,0.30)');
  vg.addColorStop(1, 'rgba(0,0,0,0.8)');
  v.fillStyle = vg;
  v.fillRect(0, 0, W, H);
}

const auraCanvas = document.createElement('canvas');
auraCanvas.width = 256; auraCanvas.height = 256;
{
  const a = auraCanvas.getContext('2d');
  const ag = a.createRadialGradient(128, 128, 6, 128, 128, 126);
  ag.addColorStop(0, 'rgba(140,220,255,0.45)');
  ag.addColorStop(1, 'rgba(120,210,255,0)');
  a.fillStyle = ag;
  a.fillRect(0, 0, 256, 256);
}

const enemyAura = document.createElement('canvas');
enemyAura.width = 192; enemyAura.height = 192;
{
  const a = enemyAura.getContext('2d');
  const ag = a.createRadialGradient(96, 96, 4, 96, 96, 94);
  ag.addColorStop(0, 'rgba(255,90,105,0.32)');
  ag.addColorStop(1, 'rgba(255,80,95,0)');
  a.fillStyle = ag;
  a.fillRect(0, 0, 192, 192);
}

// 主角动作帧（即梦动作表切分）
const SU_FRAMES = [
  { src: 'art/frames/su-0.webp', ax: 187, ay: 351, yfix: 0 },
  { src: 'art/frames/su-1.webp', ax: 285, ay: 349, yfix: 0 },
  { src: 'art/frames/su-2.webp', ax: 245, ay: 345, yfix: 0 },
  { src: 'art/frames/su-3.webp', ax: 165, ay: 457, yfix: 0 },
  { src: 'art/frames/su-4.webp', ax: 329, ay: 401, yfix: 0 },
  { src: 'art/frames/su-5.webp', ax: 279, ay: 367, yfix: 0 },
  { src: 'art/frames/su-6.webp', ax: 472, ay: 471, sBase: 0.15, feet: true },
  { src: 'art/frames/su-7.webp', ax: 462, ay: 681, sBase: 0.15, feet: true },
  { src: 'art/frames/su-8.webp', ax: 540, ay: 1640, sBase: 0.115, feet: true },
  { src: 'art/frames/su-9.webp', ax: 600, ay: 1640, sBase: 0.115, feet: true }
];
let suLoaded = 0;
SU_FRAMES.forEach(f => {
  f.img = new Image();
  f.img.onload = () => { suLoaded++; };
  f.img.src = f.src;
});

// 敌人 / Boss 立绘
const ENEMY_ART = {
  grunt:  { src: 'art/enemies/e-0.webp', h: 96 },
  crawler:{ src: 'art/enemies/e-0.webp', h: 74 },
  brute:  { src: 'art/enemies/e-3.webp', h: 116 },
  archer: { src: 'art/enemies/e-1.webp', h: 100 },
  bomber: { src: 'art/enemies/e-2.webp', h: 88 },
  shield: { src: 'art/enemies/e-3.webp', h: 112 },
  shadow: { src: 'art/enemies/e-0.webp', h: 92 }
};
const ENEMY_TINT = {
  grunt: 'rgba(150,168,200,0.46)',
  crawler: 'rgba(150,168,200,0.46)',
  archer: 'rgba(120,200,220,0.38)',
  bomber: 'rgba(220,125,95,0.42)',
  shield: 'rgba(210,180,120,0.36)',
  brute: 'rgba(210,180,120,0.36)',
  shadow: 'rgba(255,70,90,0.55)'
};
function tintCanvas(img, color) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
Object.entries(ENEMY_ART).forEach(([k, a]) => {
  a.img = new Image();
  a.img.onload = () => { a.tinted = tintCanvas(a.img, ENEMY_TINT[k] || 'rgba(160,170,190,0.4)'); };
  a.img.src = a.src;
});
const BOSS_ART = [
  { src: 'art/boss/b-0.webp', foot: 1.0 },
  { src: 'art/boss/b-1.webp', foot: 1.0 },
  { src: 'art/boss/b-2.webp', foot: 1.0 }
];
BOSS_ART.forEach(a => { a.img = new Image(); a.img.src = a.src; });

function drawEnemySprite(e) {
  const art = ENEMY_ART[e.kind];
  if (!art || !art.img.complete || !art.img.naturalWidth) return false;
  const img = art.tinted || art.img;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return false;
  const s = (art.h / ih) * depth(e.y);
  const k = e.state === 'wind' ? clamp(1 - e.st / (e.kind === 'brute' ? 0.7 : 0.5), 0, 1) : 0;
  if (k > 0) {
    g.save();
    g.globalAlpha = 0.10 + k * 0.25;
    g.fillStyle = '#ff3b4e';
    g.beginPath(); g.ellipse(e.x, e.y - 50 * s, 34 * s, 50 * s, 0, 0, TAU); g.fill();
    g.restore();
  }
  g.save();
  g.globalAlpha = 0.8;
  g.drawImage(enemyAura, e.x - 96, e.y - 128, 192, 192);
  g.restore();
  g.save();
  g.translate(e.x, e.y - (e.z || 0));
  g.scale(e.face * s, s);
  g.drawImage(img, -iw / 2, -ih);
  g.restore();
  if (e.hitFlash > 0.35) {
    g.save();
    g.globalAlpha = e.hitFlash * 0.4;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(e.x, e.y - 44 * s, 18 * s, 26 * s, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  if (e.kind === 'bomber' && e.state === 'fuse') {
    g.save();
    g.globalAlpha = 0.5 + Math.sin(G.t * 30) * 0.3;
    g.fillStyle = '#ff5a3c';
    g.beginPath(); g.arc(e.x, e.y - 30 * s, 10 * s, 0, TAU); g.fill();
    g.restore();
  }
  if (!e.dead && e.hp < e.maxHp) {
    const w = 30;
    g.save();
    g.globalAlpha = 0.8;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(e.x - w / 2, e.y - 118 * s, w, 3);
    g.fillStyle = '#ff5f70';
    g.fillRect(e.x - w / 2, e.y - 118 * s, w * (e.hp / e.maxHp), 3);
    g.restore();
  }
  return true;
}

function drawBladeTrail() {
  if (P.trail.length < 2) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 1; i < P.trail.length; i++) {
    const a = P.trail[i].life / 0.14;
    g.globalAlpha = a * 0.5;
    g.strokeStyle = i % 3 === 0 ? '#ff9aa4' : '#dff6ff';
    g.lineWidth = 2 + a * 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(P.trail[i - 1].x, P.trail[i - 1].y);
    g.lineTo(P.trail[i].x, P.trail[i].y);
    g.stroke();
  }
  g.restore();
}

function drawRig() {
  const s = 1.04 * depth(P.y);
  const t = P.animT;
  const run = P.run ? 1 : 0;
  const ph = P.runPhase;
  const hurt = P.hurtT > 0.2;
  const dodge = P.state === 'dodge';
  const swinging = P.attackT > 0;
  const k = swinging ? 1 - P.attackT / P.attackDur : 0;
  const heavy = swinging && (P.lastHeavy || P.lastStep === WPN().steps - 1);

  let blade = -0.6, armF = 0.3, lean = 0, crouch = 0.05, headTilt = 0;
  if (hurt) {
    blade = -1.2; armF = 0.9; lean = -0.3; crouch = 0.18; headTilt = -0.15;
  } else if (dodge) {
    blade = -1.1; armF = 0.8; lean = -0.28; crouch = 0.28;
  } else if (swinging) {
    if (!heavy) {
      if (k < 0.24) {
        const e = easeOut(k / 0.24);
        blade = lerp(-0.6, -2.45, e); armF = lerp(0.3, 2.15, e);
        lean = -0.06 * e; crouch = 0.12;
      } else if (k < 0.58) {
        const e = easeOut((k - 0.24) / 0.34);
        blade = lerp(-2.45, 1.05, e); armF = lerp(2.15, 0.85, e);
        lean = 0.18; crouch = 0.15;
      } else {
        const e = (k - 0.58) / 0.42;
        blade = lerp(1.05, -0.6, e); armF = lerp(0.85, 0.3, e);
        lean = 0.12 * (1 - e); crouch = 0.1;
      }
    } else {
      if (k < 0.34) {
        const e = easeOut(k / 0.34);
        blade = lerp(-0.6, -2.7, e); armF = lerp(0.3, 2.4, e);
        lean = -0.1 * e; crouch = 0.14;
      } else if (k < 0.7) {
        const e = easeOut((k - 0.34) / 0.36);
        blade = lerp(-2.7, 1.1, e); armF = lerp(2.4, 0.75, e);
        lean = 0.24; crouch = 0.2;
      } else {
        const e = (k - 0.7) / 0.3;
        blade = lerp(1.1, -0.6, e); armF = lerp(0.75, 0.3, e);
        lean = 0.14 * (1 - e);
      }
    }
  } else if (P.holding) {
    const c = Math.min(1, P.holdT / 0.42);
    blade = lerp(-0.6, -1.95, c); armF = lerp(0.3, 1.55, c);
    crouch = 0.11; lean = -0.04 * c;
  } else if (run) {
    blade = -0.75 + Math.sin(ph) * 0.07; armF = 0.35; lean = 0.14; crouch = 0.1;
  } else {
    blade = -0.6 + Math.sin(t * 1.3) * 0.03; armF = 0.3;
    crouch = 0.05 + Math.sin(t * 1.7) * 0.012;
  }

  const bob = run ? Math.abs(Math.sin(ph * 2)) * 2.6 : Math.sin(t * 1.7) * 1.1;
  const hipY = -92 + crouch * 22 + bob;
  const shY = -162 + crouch * 28 + bob;
  const headY = -184 + crouch * 30 + bob;
  const legSwing = run ? Math.sin(ph) * 24 : 0;
  const armSwing = run ? Math.sin(ph + Math.PI) * 10 : 0;
  const sway = Math.sin(t * 2.1) * 4 + (run ? Math.sin(ph) * 6 : 0);

  // 刀尖世界坐标（拖尾）
  const handX = Math.sin(armF) * 44 + 4;
  const handY = shY + Math.cos(armF) * 44;
  const bladeLen = 150;
  const bx = Math.sin(blade), by = Math.cos(blade);
  const tipX = handX + bx * bladeLen, tipY = handY + by * bladeLen;
  for (const q of P.trail) q.life -= 0.016;
  if (P.trail.length > 16) P.trail.shift();
  P.trail = P.trail.filter(q => q.life > 0);
  if (swinging) {
    P.trail.push({ x: P.x + P.face * s * tipX, y: P.y + s * tipY, life: 0.14 });
  }

  drawBladeTrail();

  // 跑步扬尘
  if (run && !swinging) {
    P.dustT -= 0.016;
    if (P.dustT <= 0) {
      P.dustT = 0.11;
      parts.push({ x: P.x - P.face * 10, y: P.y - 2, vx: -P.face * 40, vy: -20, life: 0.4, max: 0.4, size: 3, color: 'rgba(200,190,170,0.45)', type: 'petal', g: 60, drag: 2, rot: 0, vr: 0 });
    }
  }

  g.save();
  g.translate(P.x, P.y);
  g.scale(P.face * s, s);
  if (P.dashT > 0) {
    for (let i = 1; i <= 3; i++) {
      g.globalAlpha = 0.16 * (1 - i * 0.24);
      g.fillStyle = '#bfe8ff';
      g.beginPath();
      g.ellipse(-P.face * i * 20, -92, 9, 62, 0.18 * P.face, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // 围巾（身后）
  g.fillStyle = '#b02a3c';
  g.globalAlpha = 0.9;
  g.beginPath();
  g.moveTo(0, shY + 10);
  g.quadraticCurveTo(-34, shY + 4 + sway * 0.5, -66 - Math.abs(lean) * 30, shY + 40 + sway);
  g.quadraticCurveTo(-34, shY + 44 + sway, -4, shY + 22);
  g.closePath();
  g.fill();
  g.globalAlpha *= 0.55;
  g.beginPath();
  g.moveTo(-6, shY + 22);
  g.quadraticCurveTo(-30, shY + 34 + sway * 0.6, -44, shY + 66 + sway * 1.2);
  g.quadraticCurveTo(-24, shY + 52, -2, shY + 30);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;

  // 风衣后摆（两条）
  for (let i = 0; i < 2; i++) {
    const len = 90 + i * 22;
    const sw = sway * (1 + i * 0.5);
    g.fillStyle = i === 0 ? '#10131f' : '#181c2b';
    g.beginPath();
    g.moveTo(-8 - i * 4, hipY - 10);
    g.quadraticCurveTo(-34 - i * 12 + sw, hipY + len * 0.5, -30 - i * 20 + sw * 1.4, hipY + len);
    g.quadraticCurveTo(-12 - i * 6, hipY + len * 0.55, 2, hipY + 4);
    g.closePath();
    g.fill();
  }

  // 后腿
  const backFootX = -14 - legSwing;
  const backFootY = -2 - (run ? Math.max(0, -Math.sin(ph)) * 8 : 0);
  g.strokeStyle = '#0a0c14';
  g.lineWidth = 13;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-3, hipY);
  g.quadraticCurveTo(-8 - legSwing * 0.4, hipY + 44, backFootX, backFootY);
  g.stroke();

  // 后臂
  g.strokeStyle = '#0a0c14';
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(-6, shY + 12);
  g.quadraticCurveTo(-18, shY + 34, -14 + armSwing * 0.5, shY + 58);
  g.stroke();

  // 前腿
  const frontFootX = 14 + legSwing;
  const frontFootY = -2 - (run ? Math.max(0, Math.sin(ph)) * 8 : 0);
  g.strokeStyle = '#0a0c14';
  g.lineWidth = 13;
  g.beginPath();
  g.moveTo(3, hipY);
  g.quadraticCurveTo(10 + legSwing * 0.4, hipY + 42, frontFootX, frontFootY);
  g.stroke();

  // 躯干
  g.fillStyle = '#0b0d16';
  g.beginPath();
  g.moveTo(-14, shY + 2);
  g.quadraticCurveTo(0, shY - 4, 14, shY + 2);
  g.lineTo(11, hipY - 2);
  g.quadraticCurveTo(0, hipY + 6, -11, hipY - 2);
  g.closePath();
  g.fill();

  // 灰色羽织（左肩）
  g.fillStyle = '#404757';
  g.beginPath();
  g.moveTo(-14, shY + 2);
  g.quadraticCurveTo(-30, shY + 26, -26 + sway * 0.5, shY + 74);
  g.quadraticCurveTo(-12, shY + 52, -2, shY + 36);
  g.lineTo(6, shY + 8);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,120,130,0.3)';
  g.lineWidth = 1;
  g.stroke();

  // 腰带
  g.strokeStyle = '#c03246';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(-10, hipY - 4);
  g.lineTo(11, hipY - 2);
  g.stroke();

  // 头（简化版）
  g.fillStyle = '#e9ddcf';
  g.fillRect(-3.5, shY + 2, 7, 10);
  g.save();
  g.translate(2 + lean * 10, headY);
  g.rotate(headTilt + lean * 0.25);
  g.fillStyle = '#f0ddc8';
  g.beginPath();
  g.ellipse(0, 0, 9.5, 11.5, 0.06, 0, TAU);
  g.fill();
  g.fillStyle = '#11141f';
  g.beginPath();
  g.moveTo(-10, 1);
  g.quadraticCurveTo(-11.5, -12, 0, -13);
  g.quadraticCurveTo(11.5, -12, 10.5, 1);
  g.quadraticCurveTo(8, -6.5, 0, -7);
  g.quadraticCurveTo(-8, -6.5, -10, 1);
  g.closePath();
  g.fill();
  g.beginPath(); g.moveTo(-7.5, -8); g.lineTo(-3.5, -1.5); g.lineTo(-1.5, -8.5); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(2, -8.5); g.lineTo(5, -1.5); g.lineTo(7.5, -8); g.closePath(); g.fill();
  g.save();
  g.shadowColor = '#7fe3ff';
  g.shadowBlur = 7;
  g.fillStyle = '#8fe9ff';
  g.fillRect(2.5, 1.0, 5, 1.6);
  g.restore();
  g.restore();

  // 前臂 + 刀
  g.strokeStyle = '#0b0d16';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(5, shY + 12);
  g.quadraticCurveTo(Math.sin(armF) * 20 + 8, shY + Math.cos(armF) * 20, handX, handY);
  g.stroke();
  g.strokeStyle = '#7fe3ff';
  g.globalAlpha *= 0.35;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(6, shY + 14);
  g.quadraticCurveTo(Math.sin(armF) * 20 + 9, shY + Math.cos(armF) * 20, handX - 2, handY - 2);
  g.stroke();
  g.globalAlpha /= 0.35;

  // 刀
  g.save();
  g.lineCap = 'round';
  g.shadowColor = '#bfe8ff';
  g.shadowBlur = 14;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(handX, handY); g.lineTo(tipX, tipY); g.stroke();
  g.strokeStyle = 'rgba(127,227,255,0.55)';
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(handX, handY); g.lineTo(handX + bx * bladeLen * 0.55, handY + by * bladeLen * 0.55); g.stroke();
  g.restore();

  // 轮廓光
  g.strokeStyle = 'rgba(150,230,255,0.45)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-1, headY - 14);
  g.quadraticCurveTo(-20, shY - 4, -22, shY + 52);
  g.stroke();

  g.restore();
}

function drawSwingFrame(idx, lean, bob) {
  const img = SW_FRAMES[idx - 1];
  if (!img || !img.complete || !img.naturalWidth) return false;
  const s = 0.25 * depth(P.y);
  const ax = [285, 295, 299, 283, 308, 263, 303, 285][idx - 1];
  const ay = img.naturalHeight;
  g.save();
  g.translate(P.x, P.y + bob);
  g.scale(P.face * s, s);
  if (lean) g.rotate(lean * P.face);
  g.drawImage(img, -ax, -ay);
  g.restore();
  return true;
}

function drawCutout(aL, aR, lean, bob) {
  if (!PART.body.complete || !PART.body.naturalWidth) return false;
  const s = 0.25 * depth(P.y);
  const HIP = 470, IH = 852;
  g.save();
  g.translate(P.x, P.y + bob);
  g.scale(P.face * s, s);
  for (const [img, hipX, ang] of [[PART.legR, 315, aR], [PART.legL, 225, aL]]) {
    g.save();
    g.translate(hipX, HIP - IH);
    g.rotate(ang);
    g.translate(-hipX, -(HIP - IH));
    g.drawImage(img, 0, -IH);
    g.restore();
  }
  g.save();
  g.translate(270, HIP - IH);
  g.rotate(lean);
  g.translate(-270, -(HIP - IH));
  g.drawImage(PART.body, 0, -IH);
  g.restore();
  g.restore();
  return true;
}

function drawPart(name, angle) {
  const img = CUT[name], m = CUTM[name];
  if (!img || !img.complete || !img.naturalWidth) return false;
  const j = CUTP[name];
  g.save();
  g.translate(j[0], j[1]);
  g.rotate(angle || 0);
  g.drawImage(img, -m.px, -m.py);
  g.restore();
  return true;
}

function drawCutoutPlayer() {
  for (const k in CUT) if (!CUT[k].complete || !CUT[k].naturalWidth) return false;
  const s = 0.092 * depth(P.y);
  const t = P.animT;
  const run = P.run ? 1 : 0;
  const ph = P.runPhase;
  const swinging = P.attackT > 0;
  const k = swinging ? 1 - P.attackT / P.attackDur : 0;
  const heavy = swinging && (P.lastHeavy || P.lastStep === WPN().steps - 1);
  const hurt = P.hurtT > 0.2;
  const dodge = P.state === 'dodge';

  let lean = 0, armL = -1.15, armR = 1.15, legL = 0.06, legR = -0.06, bob = 0, head = 0;
  if (hurt) { lean = -0.25; armL = -0.7; armR = 0.6; }
  else if (dodge) { lean = -0.22; armL = -0.8; armR = 1.3; }
  else if (swinging) {
    if (k < 0.24) {
      const e = k / 0.24;
      armL = -1.15 + (-2.5 + 1.15) * e;
      lean = -0.05 * e;
    } else if (k < 0.58) {
      const e = (k - 0.24) / 0.34;
      armL = -2.5 + (0.7 + 2.5) * e;
      lean = 0.16 * e;
    } else {
      const e = (k - 0.58) / 0.42;
      armL = 0.7 + (-1.15 - 0.7) * e;
      lean = 0.1 * (1 - e);
    }
    if (heavy) { armL -= 0.3; lean += 0.06; }
  } else if (run) {
    lean = 0.12;
    legL = 0.5 * Math.sin(ph);
    legR = -0.5 * Math.sin(ph);
    armL = -1.15 + 0.16 * Math.sin(ph + Math.PI);
    armR = 1.15 + 0.2 * Math.sin(ph);
    bob = -Math.abs(Math.sin(ph * 2)) * 5;
    head = 0.03 * Math.sin(ph);
  } else {
    bob = Math.sin(t * 1.7) * 2;
    armL = -1.15 + Math.sin(t * 1.3) * 0.02;
    head = Math.sin(t * 1.1) * 0.01;
  }

  // 刀尖世界坐标 → 拖尾
  const shx = CUTP.armL[0], shy = CUTP.armL[1];
  const tipx = shx + Math.cos(armL) * (-580) - Math.sin(armL) * 120;
  const tipy = shy + Math.sin(armL) * (-580) + Math.cos(armL) * 120;
  for (const q of P.trail) q.life -= 0.016;
  if (P.trail.length > 22) P.trail.shift();
  P.trail = P.trail.filter(q => q.life > 0);
  if (swinging) {
    P.trail.push({ x: P.x + P.face * s * tipx, y: P.y + bob + s * tipy, life: 0.2 });
  }
  if (P.trail.length > 1) drawBladeTrail();

  g.save();
  g.translate(P.x, P.y + bob);
  g.scale(P.face * s, s);
  drawPart('legR', legR);
  drawPart('legL', legL);
  drawPart('armR', armR);
  drawPart('torso', lean);
  drawPart('head', lean * 0.4 + head);
  drawPart('armL', armL);
  g.restore();
  return true;
}

function drawPlayerSprite() {
  if (!location.search.includes('rig=1') && drawCutoutPlayer()) return true;
  drawRig();
  return true;
}

function initWeather() {
  rain.length = 0;
  for (let i = 0; i < 130; i++) rain.push({ x: rnd(0, W), y: rnd(0, H), z: rnd(0.35, 1), len: rnd(9, 24) });
  motes.length = 0;
  for (let i = 0; i < 26; i++) motes.push({ x: rnd(0, W), y: rnd(320, 660), vx: rnd(-6, 6), vy: rnd(-16, -5), r: rnd(0.8, 2), a: rnd(0.1, 0.35), ph: rnd(0, TAU) });
}
initWeather();

/* ---------------- 工具 ---------------- */
function text(str, x, y, o = {}) {
  const { size = 16, color = '#fff', align = 'left', family = F_SANS,
    weight = 400, alpha = 1, spacing = 0, glow = 0, glowColor = null, baseline = 'alphabetic' } = o;
  g.save();
  g.globalAlpha *= alpha;
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = align;
  g.textBaseline = baseline;
  if (spacing) { try { g.letterSpacing = spacing + 'px'; } catch (e) {} }
  if (glow) { g.shadowColor = glowColor || color; g.shadowBlur = glow; }
  g.fillStyle = color;
  g.fillText(str, x, y);
  g.restore();
}

function roundRect(x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function addShake(v) { G.shake = Math.max(G.shake, v); }
function addFlash(color, a) { G.flashColor = color; G.flash = Math.max(G.flash, a); }

function depth(y) { return 0.84 + clamp((y - 380) / 310, 0, 1) * 0.26; }

function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/* ---------------- 特效 ---------------- */
function sparks(x, y, n, color, spd = 420, dir = 0, spread = TAU, grav = 0) {
  if (parts.length > 420) return;
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(-spread / 2, spread / 2);
    const s = rnd(spd * 0.3, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, life: rnd(0.2, 0.5), max: 0.5, size: rnd(1, 2.6), color, type: 'spark', g: grav, drag: 3 });
  }
}
function petals(x, y, n, color, spd = 260) {
  if (parts.length > 420) return;
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(30, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 40, life: rnd(0.5, 1.2), max: 1.2, size: rnd(1.6, 4), color, type: 'petal', g: 120, drag: 1.4, rot: rnd(0, TAU), vr: rnd(-6, 6) });
  }
}
function ring(x, y, r0, r1, color, w = 2, life = 0.35) {
  rings.push({ x, y, r: r0, r1, color, w, life, max: life });
}
function slashFx(x, y, ang, r, half, color, life = 0.2, w = 8) {
  slashes.push({ x, y, ang, r, half, color, life, max: life, w });
}
function floatText(t, x, y, color = '#fff', size = 15) {
  texts.push({ t, x, y, color, size, life: 0.7, max: 0.7, vy: -48 });
}
function glyph(x, y, ch) {
  texts.push({ t: ch, x, y, color: 'rgba(255,120,130,0.85)', size: 13, life: 0.9, max: 0.9, vy: -60 });
}
function splat(x, y) {
  if (decals.length > 70) decals.shift();
  decals.push({ x, y, r: rnd(8, 22), a: rnd(0.15, 0.32), rot: rnd(0, TAU) });
}

/* ---------------- 玩家 ---------------- */
function nearestEnemy(maxD = 9999, cone = null) {
  let best = null, bd = maxD;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - P.x, e.y - P.y);
    if (d >= bd) continue;
    if (cone !== null) {
      const a = Math.atan2(e.y - P.y, e.x - P.x);
      if (Math.abs(angDiff(a, cone)) > 1.25) continue;
    }
    bd = d; best = e;
  }
  return best;
}

function attackPress() {
  if (G.ult || G.cutin || P.dashT > 0 || P.hurtT > 0.15) return;
  P.holding = true;
  P.holdT = 0;
  P.charged = false;
  if (P.attackT > 0) { P.buffer = 1; return; }
  attack(false);
}

function attackRelease() {
  P.holding = false;
  P.holdT = 0;
}

function attack(heavy) {
  if (P.attackT > 0) { P.buffer = heavy ? 2 : 1; return; }
  if (P.dashT > 0 || P.hurtT > 0.15 || G.ult) return;
  const near = nearestEnemy(320, P.aim) || nearestEnemy(340);
  if (near) P.aim = Math.atan2(near.y - P.y, near.x - P.x);
  P.attackAngle = P.aim;
  P.face = Math.cos(P.aim) >= 0 ? 1 : -1;

  const WP = WPN();
  let range, half, dmg, launch = 0, step = 0;
  if (heavy) {
    P.lastHeavy = true;
    P.attackT = WP.heavyDur; P.attackDur = WP.heavyDur;
    P.step = 0;
    range = WP.heavyRange * P.rangeMul; half = 1.8; dmg = WP.heavyDmg + P.dmgBonus; launch = WP.heavyLaunch;
    P.x = clamp(P.x + Math.cos(P.aim) * 30, ARENA.x1, ARENA.x2);
    P.y = clamp(P.y + Math.sin(P.aim) * 22, ARENA.y1, ARENA.y2);
    addShake(9);
    G.punch = Math.max(G.punch, 0.7);
    SFX.heavySwing();
  } else {
    step = P.step;
    P.lastHeavy = false;
    P.lastStep = step;
    P.step = (P.step + 1) % WP.steps;
    P.attackT = WP.dur; P.attackDur = WP.dur;
    range = WP.range[step] * P.rangeMul;
    half = WP.half[step];
    dmg = WP.dmg[step] + P.dmgBonus;
    if (step === WP.steps - 1) launch = WP.launchLast;
    P.x = clamp(P.x + Math.cos(P.aim) * WP.lunge, ARENA.x1, ARENA.x2);
    P.y = clamp(P.y + Math.sin(P.aim) * WP.lunge * 0.7, ARENA.y1, ARENA.y2);
    SFX.slash();
  }

  if (P.hasWave) {
    waves.push({ x: P.x, y: P.y - 46, ang: P.aim, t: 0 });
    if (P.splitWave) {
      waves.push({ x: P.x, y: P.y - 46, ang: P.aim - 0.28, t: 0 });
      waves.push({ x: P.x, y: P.y - 46, ang: P.aim + 0.28, t: 0 });
    }
  }
  const beforeKills = G.kills;
  let hits = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - P.x, dy = (e.y - P.y) * 1.25;
    const d = Math.hypot(dx, dy);
    if (d > range + e.r) continue;
    if (Math.abs(angDiff(Math.atan2(dy, dx), P.aim)) > half) continue;
    hitEnemy(e, dmg, Math.atan2(dy, dx), launch);
    hits++;
  }

  if (heavy) {
    slashFx(P.x, P.y, P.aim, range, half, '#ffd0d6', 0.34, 16);
    slashFx(P.x, P.y, P.aim, range * 0.8, half * 0.9, '#ffffff', 0.24, 7);
  } else {
    slashFx(P.x, P.y, P.aim, range, half, step === 2 ? '#ffd0d6' : '#e8f4ff', 0.22, step === 2 ? 12 : 7);
  }

  if (hits > 0) {
    G.hitstop = heavy ? 0.09 : Math.min(0.07, 0.024 + hits * 0.006);
    addShake(heavy ? 12 : 4 + Math.min(7, hits * 0.8));
  }

  // 一次斩杀 3 人以上 → 短暂慢镜
  if (G.kills - beforeKills >= 3) {
    G.slowT = 0.32;
    G.punch = Math.max(G.punch, 0.55);
    addFlash('#ffffff', 0.18);
    floatText('斩 ！', P.x, P.y - 120, '#ffffff', 26);
    SFX.multiKill();
  }
}

function hitEnemy(e, dmg, ang, launch, noChain, noExplode) {
  if (e.dead) return;
  if (e.kind === 'shield' && e.guard > 0) {
    e.guard--;
    e.hitFlash = 1;
    e.kx += Math.cos(ang) * 40;
    e.ky += Math.sin(ang) * 30;
    G.combo++;
    G.comboT = 3.0;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    G.score += Math.round(6 * mult());
    sparks(e.x, e.y - 52, 9, '#ffd36e', 300, ang, 1.4);
    floatText(e.guard > 0 ? '铛' : '破盾', e.x, e.y - 84, '#ffd36e', e.guard > 0 ? 15 : 19);
    SFX.clang();
    if (e.guard === 0) { G.meter = Math.min(100, G.meter + 4); addShake(5); }
    return;
  }
  let deal = dmg;
  if (e.kind === 'oni') {
    if (e.invuln > 0) {
      sparks(e.x, e.y - 90, 5, '#ff8a96', 200);
      floatText('无 效', e.x, e.y - 150, '#ff8a96', 15);
      return;
    }
    if (e.state === 'break') deal *= 2;
  }
  if (P.shatter && e.slowT > 0) deal = Math.round(deal * 1.6);
  e.hp -= deal;
  e.hitFlash = 1;
  if (P.hasBurn) e.burn = 3;
  if (P.hasFrost) e.slowT = 1.8;
  if (e.kind !== 'oni') {
    e.kx += Math.cos(ang) * (launch ? 320 : 620);
    e.ky += Math.sin(ang) * (launch ? 200 : 380);
    e.stun = Math.max(e.stun || 0, launch ? 0.38 : 0.26);
    if (launch) { e.vz = Math.max(e.vz || 0, launch); e.z = Math.max(e.z || 0, 1); }
  }
  if (P.hasChain && !noChain && P.chainCd <= 0) {
    P.chainCd = 0.25;
    let n = 0;
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) < 170) {
        bolts.push({ x1: e.x, y1: e.y - 40, x2: o.x, y2: o.y - 40, life: 0.18 });
        hitEnemy(o, 1, Math.atan2(o.y - e.y, o.x - e.x), 0, true, noExplode);
        if (P.firestorm) o.burn = 3;
        if (++n >= 2) break;
      }
    }
  }
  G.combo++;
  G.comboT = 3.0;
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.meter = Math.min(100, G.meter + 0.9 * P.ultGainMul);
  G.score += Math.round(6 * mult());
  sparks(e.x, e.y - 46 * e.scale, 9, '#ffffff', 320, ang, 1.5);
  sparks(e.x, e.y - 46 * e.scale, 5, '#ff6a78', 220, ang, 1.1);
  ring(e.x, e.y - 42 * e.scale, 4, 34, '#ffffff', 1.6, 0.18);
  G.kickX += Math.cos(ang) * 5;
  G.kickY += Math.sin(ang) * 3;
  floatText(String(deal), e.x + rnd(-8, 8), e.y - 78, e.kind === 'oni' ? '#ffd36e' : '#fff1f2', e.kind === 'oni' ? 20 : 16);
  SFX.hit();
  if (e.hp <= 0) killEnemy(e, ang, noExplode);
}

function killEnemy(e, ang, noExplode) {
  if (e.dead) return;
  e.dead = true;
  e.deadT = 0;
  e.hitFlash = 0;
  if (P.lifesteal > 0) P.hp = Math.min(P.maxHp, P.hp + P.lifesteal);
  if (!noExplode && P.shatter && e.slowT > 0) {
    ring(e.x, e.y - 30, 10, 80, '#9fe6ff', 3, 0.28);
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) < 100) hitEnemy(o, 2, Math.atan2(o.y - e.y, o.x - e.x), 0, true, true);
    }
  }
  if (!noExplode && e.burn > 0) {
    ring(e.x, e.y - 30, 12, 90, '#ff9a4d', 3, 0.3);
    addFlash('#ff7a3d', 0.08);
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) < 110) hitEnemy(o, 2, Math.atan2(o.y - e.y, o.x - e.x), 0, true, true);
    }
  }
  if (ang != null) {
    e.kx = Math.cos(ang) * 620;
    e.ky = Math.sin(ang) * 360;
    e.vz = 300;
    e.z = 1;
  }
  G.kills++;
  if (G.kills % 20 === 0) {
    G.execT = 0.6;
    G.execX = e.x;
    G.execY = e.y;
    G.hitstop = Math.max(G.hitstop, 0.09);
    addFlash('#ffffff', 0.25);
    addShake(14);
  }
  G.combo += 2;
  G.comboT = 3.0;
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  if (!G.ult) G.meter = Math.min(100, G.meter + 4 * P.ultGainMul);
  G.score += Math.round(100 * mult());
  if (e.kind === 'oni') {
    petals(e.x, e.y - 90, 60, '#ff4d63', 420);
    sparks(e.x, e.y - 90, 40, '#ffd0d6', 600);
    ring(e.x, e.y, 20, 320, '#ffffff', 4, 0.9);
    addFlash('#ffffff', 0.5);
    addShake(26);
    G.victory = true;
  } else if (G.stage < BOSS_STAGE) {
    G.stageKills++;
  }
  petals(e.x, e.y - 40 * e.scale, 10, '#ff4d63', 240);
  sparks(e.x, e.y - 40 * e.scale, 8, '#ffd0d6', 300);
  ring(e.x, e.y, 6, 54, '#ff5f70', 2, 0.3);
  glyph(e.x, e.y - 70, ['名', '死', '记', '斩', '忆', '者'][Math.floor(Math.random() * 6)]);
  splat(e.x, e.y);
  SFX.kill();
  if (e.kind === 'oni') endGame(true);
  if (G.kills === 25 || G.kills === 50 || G.kills === 100) {
    G.streak = G.kills;
    G.banner = { title: G.kills === 100 ? '百 人 斩' : G.kills === 50 ? '五 十 人 斩' : '二 十 五 人 斩', sub: '', t: 0, dur: 1.6 };
    SFX.streak();
  }
}

function hurtPlayer(dmg = 1) {
  if (P.invuln > 0 || G.ult) return;
  P.hp -= dmg;
  P.holding = false; P.charged = false;
  P.invuln = 1.0;
  P.hurtT = 0.4;
  G.combo = 0;
  G.hitstop = 0.09;
  addShake(14);
  addFlash('#ff2b44', 0.28);
  sparks(P.x, P.y - 50, 16, '#ff4d63', 320);
  floatText('-1', P.x, P.y - 90, '#ff6070', 20);
  SFX.hurt();
  if (P.hp <= 0) { P.hp = 0; endGame(); }
}

function dash() {
  if (P.dashCd > 0 || P.dashT > 0) return;
  P.holding = false; P.charged = false;
  let perfect = null;
  for (const e of enemies) {
    if (e.dead || e.state !== 'wind') continue;
    if (e.st <= 0.24 * (P.parryWin || 1) && Math.hypot(e.x - P.x, e.y - P.y) < 150) { perfect = e; break; }
  }
  let dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  if (!dx && !dy) { dx = Math.cos(P.aim); dy = Math.sin(P.aim); }
  const d = Math.hypot(dx, dy) || 1;
  P.dashX = dx / d; P.dashY = dy / d;
  P.dashT = 0.22;
  P.dashCd = 0.75 * P.dashCdMul;
  P.invuln = Math.max(P.invuln, 0.28);
  P.face = P.dashX >= 0 ? 1 : -1;
  P.dashHits = new Set();
  slashFx(P.x, P.y, Math.atan2(P.dashY, P.dashX), 105, 1.3, '#bfe8ff', 0.2, 9);
  SFX.dash();
  if (perfect) perfectDodge();
}

function perfectDodge() {
  P.kenbikiT = 0.55;
  G.slowT = 0.5;
  G.punch = Math.max(G.punch, 0.8);
  addFlash('#dff6ff', 0.32);
  addShake(10);
  floatText('见 切', P.x, P.y - 118, '#dff6ff', 30);
  SFX.kenbiki();
  let hits = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y;
    if (Math.hypot(dx, dy) < 185) {
      hitEnemy(e, 2, Math.atan2(dy, dx), 100);
      hits++;
    }
  }
  slashFx(P.x, P.y, P.aim, 175, 2.4, '#dff6ff', 0.4, 14);
  ring(P.x, P.y, 10, 175, '#dff6ff', 2, 0.45);
  G.score += 200;
  if (hits) G.hitstop = 0.055;
}

function tryUlt() {
  if (G.meter < 100 || G.ult || G.cutin) return;
  G.meter = 0;
  G.cutin = { t: 0, dur: 1.4 };
  addFlash('#ff2b44', 0.2);
  addShake(6);
  SFX.cutin();
}

/* ---------------- 敌人 ---------------- */
const KINDS = {
  grunt: { hp: 1, speed: 88, r: 15, scale: 0.82, dmg: 1, body: '#161a28', eye: '#ff5a6a' },
  crawler: { hp: 1, speed: 145, r: 12, scale: 0.58, dmg: 1, body: '#121c24', eye: '#ff9aa4' },
  brute: { hp: 4, speed: 54, r: 22, scale: 1.02, dmg: 1, body: '#1b1524', eye: '#ffb45a' },
  shield: { hp: 4, speed: 46, r: 20, scale: 1.08, dmg: 1, body: '#1c1a26', eye: '#ffd36e' },
  archer: { hp: 1, speed: 64, r: 13, scale: 0.92, dmg: 1, body: '#151b24', eye: '#8fe3ff' },
  bomber: { hp: 1, speed: 118, r: 15, scale: 0.88, dmg: 2, body: '#1d1419', eye: '#ff8a5a' },
  shadow: { hp: 3, speed: 128, r: 13, scale: 0.8, dmg: 1, body: '#1a1018', eye: '#ff3b4e' },
  oni:    { hp: 240, speed: 62, r: 40, scale: 1.75, dmg: 2, body: '#120d16', eye: '#ff3b4e' }
};

function spawnEnemy(kind, fx, fy) {
  const k = KINDS[kind];
  const side = Math.floor(rnd(0, 4));
  let x = fx, y = fy;
  if (x == null) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    x = clamp(P.x + dir * rnd(520, 760), ARENA.x1, ARENA.x2);
    y = clamp(P.y + rnd(-180, 150), ARENA.y1, ARENA.y2);
  }
  const e = {
    kind, def: k, x, y, r: k.r, scale: k.scale * rnd(0.94, 1.06),
    hp: k.hp, maxHp: k.hp, speed: k.speed * rnd(0.9, 1.1), guard: kind === 'shield' ? 2 : 0,
    face: -1, state: 'chase', st: 0, cd: rnd(0.2, 0.9),
    kx: 0, ky: 0, stun: 0, hitFlash: 0, dead: false, deadT: 0,
    animT: rnd(0, 10), ph: rnd(0, TAU), bob: rnd(0, TAU)
  };
  enemies.push(e);
  ring(x, y, 4, 36, '#ff5f70', 2, 0.35);
  sparks(x, y - 20, 4, '#ff8a96', 120);
  return e;
}

function pickKind(t) {
  const r = Math.random();
  if (t > 22) return r < 0.12 ? 'shield' : r < 0.22 ? 'brute' : r < 0.52 ? 'crawler' : 'grunt';
  if (t > 12) return r < 0.10 ? 'shield' : r < 0.17 ? 'brute' : r < 0.42 ? 'crawler' : 'grunt';
  return r < 0.25 ? 'crawler' : 'grunt';
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0 || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) {
      projectiles.splice(i, 1);
      continue;
    }
    if (P.invuln <= 0 && Math.hypot(p.x - P.x, p.y - (P.y - 48)) < 24) {
      hurtPlayer(p.dmg);
      sparks(p.x, p.y, 8, '#ff8a96', 220);
      projectiles.splice(i, 1);
    }
  }
}

function updateArcher(e, dt, d, dx, dy) {
  e.face = dx >= 0 ? 1 : -1;
  if (e.state === 'wind') {
    e.st -= dt;
    e.aim = Math.atan2(P.y - e.y, P.x - e.x);
    if (e.st <= 0) {
      e.state = 'chase';
      e.cd = 1.9;
      fireArrow(e);
    }
    return;
  }
  e.cd = Math.max(0, e.cd - dt);
  const sp = e.speed;
  if (d < 200) { e.x -= dx / d * sp * dt; e.y -= dy / d * sp * dt; }
  else if (d > 380) { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
  if (e.cd <= 0 && d < 460) { e.state = 'wind'; e.st = 0.85; e.aim = Math.atan2(dy, dx); }
  e.x = clamp(e.x, ARENA.x1 - 30, ARENA.x2 + 30);
  e.y = clamp(e.y, ARENA.y1 - 20, ARENA.y2 + 20);
}

function fireArrow(e) {
  const a = Math.atan2(P.y - (e.y - 42), P.x - e.x);
  projectiles.push({ x: e.x, y: e.y - 42, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 1.8, dmg: 1 });
  SFX.bow();
}

function updateBomber(e, dt, d, dx, dy) {
  e.face = dx >= 0 ? 1 : -1;
  if (e.state === 'fuse') {
    e.st -= dt;
    if (e.st <= 0) explodeBomber(e);
    return;
  }
  const sp = e.speed;
  if (d > 74) {
    e.x += dx / d * sp * dt;
    e.y += dy / d * sp * dt;
  } else {
    e.state = 'fuse';
    e.st = 0.85;
    SFX.fuse();
  }
  e.x = clamp(e.x, ARENA.x1 - 30, ARENA.x2 + 30);
  e.y = clamp(e.y, ARENA.y1 - 20, ARENA.y2 + 20);
}

function explodeBomber(e) {
  const R = 140;
  ring(e.x, e.y, 10, R * 1.7, '#ff8a5a', 5, 0.5);
  ring(e.x, e.y, 4, R, '#ffffff', 2, 0.3);
  petals(e.x, e.y - 20, 16, '#ff8a5a', 380);
  sparks(e.x, e.y - 30, 28, '#ffd0a0', 540);
  addShake(15);
  addFlash('#ff8a5a', 0.25);
  if (Math.hypot(P.x - e.x, P.y - e.y) < R && P.invuln <= 0) hurtPlayer(2);
  for (const o of enemies) {
    if (o.dead || o === e || o.kind === 'oni') continue;
    if (Math.hypot(o.x - e.x, o.y - e.y) < R) hitEnemy(o, 2, Math.atan2(o.y - e.y, o.x - e.x), 140);
  }
  e.dead = true;
  e.deadT = 0;
  e.hitFlash = 0;
  if (ang != null) {
    e.kx = Math.cos(ang) * 620;
    e.ky = Math.sin(ang) * 360;
    e.vz = 300;
    e.z = 1;
  }
  SFX.explode();
}

function startOniAttack(e, phase) {
  const pool = phase === 1 ? ['slash'] : phase === 2 ? ['slash', 'charge', 'slash'] : ['slash', 'charge', 'slam', 'slash'];
  const atk = pool[Math.floor(Math.random() * pool.length)];
  e.atk = atk;
  e.hitDone = false;
  e.state = 'wind';
  if (atk === 'slash') { e.st = Math.max(0.55, 0.95 - phase * 0.1); e.breakTime = 0.7; }
  else if (atk === 'charge') {
    e.st = 0.7 - phase * 0.05; e.breakTime = 1.2;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.dashX = dx / d; e.dashY = dy / d;
  } else { e.st = 0.95; e.breakTime = 1.1; }
  e.aimX = P.x; e.aimY = P.y;
}

function oniStrike(e) {
  e.state = 'strike';
  e.st = e.atk === 'charge' ? 0.4 : 0.18;
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.atk === 'slash') {
    slashFx(e.x, e.y, e.face > 0 ? 0.25 : Math.PI - 0.25, 180, 1.2, '#ff3b4e', 0.32, 14);
    addShake(12);
    if (d < 200 && P.invuln <= 0) hurtPlayer(2);
    SFX.bossSlash();
  } else if (e.atk === 'slam') {
    ring(e.x, e.y, 20, 250, '#ff3b4e', 6, 0.6);
    ring(e.x, e.y, 10, 150, '#ffffff', 3, 0.4);
    addShake(22);
    addFlash('#ff3b4e', 0.22);
    if (d < 240 && P.invuln <= 0) hurtPlayer(2);
    SFX.explode();
  }
}

function updateOni(e, dt) {
  e.animT += dt;
  e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
  e.cd = Math.max(0, e.cd - dt);
  if (e.invuln > 0) e.invuln -= dt;

  const hpF = e.hp / e.maxHp;
  const phase = hpF > 0.66 ? 1 : hpF > 0.33 ? 2 : 3;
  if (phase !== e.phase) {
    e.phase = phase;
    e.state = 'roar';
    e.st = 1.1;
    e.invuln = 1.0;
    addShake(20);
    addFlash('#ff2b44', 0.3);
    ring(e.x, e.y, 30, 300, '#ff3b4e', 5, 0.8);
    floatText('第 ' + phase + ' 阶 · 鬼 武 者', e.x, e.y - 280, '#ff8a96', 24);
    if (phase === 2) {
      spawnEnemy('grunt', e.x - 170, e.y + 30);
      spawnEnemy('grunt', e.x + 150, e.y + 20);
    }
    if (phase === 3) {
      spawnEnemy('shadow', e.x - 150, e.y + 30);
      spawnEnemy('shadow', e.x + 140, e.y + 20);
      spawnEnemy('shadow', e.x + 20, e.y - 60);
    }
    SFX.roar();
  }

  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
  e.face = dx >= 0 ? 1 : -1;

  switch (e.state) {
    case 'enter':
      e.st -= dt;
      if (e.st <= 0) { e.state = 'chase'; e.cd = 0.6; }
      break;
    case 'chase':
      if (d > 160) {
        e.x += dx / d * e.speed * (e.slowT > 0 ? 0.45 : 1) * dt;
        e.y += dy / d * e.speed * 0.55 * dt;
      }
      if (e.cd <= 0 && !G.ult) startOniAttack(e, phase);
      break;
    case 'wind':
      e.st -= dt;
      if (e.st <= 0) oniStrike(e);
      break;
    case 'strike':
      if (e.atk === 'charge') {
        e.x = clamp(e.x + e.dashX * 760 * dt, ARENA.x1 - 20, ARENA.x2 + 20);
        e.y = clamp(e.y + e.dashY * 520 * dt, ARENA.y1, ARENA.y2);
        if (Math.random() < 0.7) sparks(e.x, e.y - 90, 2, '#ff5f70', 160, 0, TAU, 0);
        if (!e.hitDone && Math.hypot(P.x - e.x, P.y - e.y) < 82) {
          e.hitDone = true;
          if (P.invuln <= 0) hurtPlayer(2);
        }
      }
      e.st -= dt;
      if (e.st <= 0) {
        if ((e.breakTime || 0) >= 1) { e.state = 'break'; e.st = e.breakTime; }
        else { e.state = 'recover'; e.st = e.breakTime || 0.7; }
      }
      break;
    case 'recover':
      e.st -= dt;
      if (e.st <= 0) { e.state = 'chase'; e.cd = Math.max(0.45, 1.0 - phase * 0.12); }
      break;
    case 'break':
      e.st -= dt;
      if (e.st <= 0) { e.state = 'chase'; e.cd = 0.6; }
      break;
    case 'roar':
      e.st -= dt;
      if (e.st <= 0) { e.state = 'chase'; e.cd = 0.5; }
      break;
  }
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) {
      e.deadT += dt;
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      e.kx -= e.kx * Math.min(1, 4 * dt);
      e.ky -= e.ky * Math.min(1, 4 * dt);
      if (e.z > 0 || e.vz > 0) {
        e.z += e.vz * dt;
        e.vz -= 1200 * dt;
        if (e.z <= 0) { e.z = 0; e.vz = 0; }
      }
      continue;
    }
    if (e.burn > 0) {
      e.burn -= dt;
      e.burnTick = (e.burnTick || 0) - dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        e.hp -= 1;
        e.hitFlash = 0.4;
        if (P.bloodburn) P.hp = Math.min(P.maxHp, P.hp + 0.08);
        if (e.hp <= 0) { killEnemy(e, Math.random() * TAU); continue; }
      }
    }
    if (e.slowT > 0) e.slowT -= dt;
    e.animT += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
    e.cd = Math.max(0, e.cd - dt);

    // 击退
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    e.kx -= e.kx * Math.min(1, 6 * dt);
    e.ky -= e.ky * Math.min(1, 6 * dt);

    // 浮空
    if (e.z > 0 || e.vz > 0) {
      e.z += e.vz * dt;
      e.vz -= 1000 * dt;
      if (e.z <= 0) {
        e.z = 0; e.vz = 0;
        if (!e.dead) { e.state = 'chase'; e.cd = 0.5; }
        sparks(e.x, e.y - 6, 6, '#8a93a8', 120, -Math.PI / 2, 2.2, 120);
      }
      continue;
    }

    if (e.stun > 0) {
      e.stun -= dt;
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      e.kx -= e.kx * Math.min(1, 9 * dt);
      e.ky -= e.ky * Math.min(1, 9 * dt);
      continue;
    }
    const dx = P.x - e.x, dy = P.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (e.kind === 'oni') { updateOni(e, dt); continue; }
    if (e.kind === 'archer') { updateArcher(e, dt, d, dx, dy); continue; }
    if (e.kind === 'bomber') { updateBomber(e, dt, d, dx, dy); continue; }
    if (e.state === 'chase') {
      e.face = dx >= 0 ? 1 : -1;
      if (d > 42) {
        const sp = e.speed * (1 + Math.min(0.35, G.kills * 0.002));
        e.x += dx / d * sp * dt;
        e.y += dy / d * sp * dt;
      }
      if (d < 54 && e.cd <= 0 && !G.ult) { e.state = 'wind'; e.st = e.kind === 'brute' ? 0.7 : 0.5; }
    } else if (e.state === 'wind') {
      e.st -= dt;
      if (e.st <= 0) {
        e.state = 'strike'; e.st = 0.14;
        if (d < 74 && P.invuln <= 0) hurtPlayer();
      }
    } else if (e.state === 'strike') {
      e.st -= dt;
      if (e.st <= 0) { e.state = 'chase'; e.cd = 1.0; }
    }
  }

  // 分离
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.dead) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b.dead) continue;
      if (a.kind === 'oni' || b.kind === 'oni') continue;
      if ((a.z || 0) > 0 || (b.z || 0) > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r + 4;
      if (d < min && d > 0.01) {
        const push = (min - d) * 0.5;
        a.x -= dx / d * push; a.y -= dy / d * push;
        b.x += dx / d * push; b.y += dy / d * push;
      }
    }
  }

  // 边界
  for (const e of enemies) {
    if (e.dead) continue;
    e.x = clamp(e.x, ARENA.x1 - 40, ARENA.x2 + 40);
    e.y = clamp(e.y, ARENA.y1 - 30, ARENA.y2 + 20);
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].dead && enemies[i].deadT > 0.55) enemies.splice(i, 1);
  }
}

/* ---------------- 更新 ---------------- */
const BOSS_STAGE = 4;
const STAGES = [
  { title: '第 一 阵 · 足 轻', quota: 44, eliteAt: 18, pool: ['grunt', 'grunt', 'crawler', 'shield'],
    elite: ['shield', 'shield', 'archer', 'archer', 'archer', 'archer'], eliteAt2: 34, elite2: ['bomber', 'bomber', 'archer', 'archer', 'shield', 'grunt', 'grunt'] },
  { title: '第 二 阵 · 弓 火', quota: 60, eliteAt: 26, pool: ['grunt', 'crawler', 'archer', 'bomber', 'shield', 'archer'],
    elite: ['bomber', 'bomber', 'bomber', 'archer', 'archer', 'shield'], eliteAt2: 40, elite2: ['shield', 'shield', 'bomber', 'bomber', 'archer', 'archer', 'grunt', 'grunt'] },
  { title: '第 三 阵 · 黄 泉', quota: 60, eliteAt: 26, pool: ['crawler', 'archer', 'bomber', 'shield', 'shadow', 'bomber'],
    elite: ['shield', 'shield', 'bomber', 'bomber', 'archer', 'archer', 'archer'], eliteAt2: 46, elite2: ['shield', 'shield', 'shield', 'bomber', 'bomber', 'archer', 'archer', 'grunt'] },
  { title: '第 四 阵 · 鬼 武 者', boss: true }
];

const TALENTS = [
  { id: 't_wave', name: '剑 心', desc: '开局自带「剑气」', apply() { P.hasWave = true; } },
  { id: 't_burn', name: '业 火', desc: '开局自带「焚身」', apply() { P.hasBurn = true; } },
  { id: 't_frost', name: '霜 心', desc: '开局自带「霜刃」', apply() { P.hasFrost = true; } },
  { id: 't_chain', name: '雷 引', desc: '开局自带「连锁雷」', apply() { P.hasChain = true; } },
  { id: 't_dash', name: '疾 影', desc: '闪避冷却 -35%，见切窗口 +25%', apply() { P.dashCdMul = 0.65; P.parryWin = 1.25; } },
  { id: 't_blood', name: '血 契', desc: '攻击 +2，最大生命 -2', apply() { P.dmgBonus += 2; P.maxHp = Math.max(4, P.maxHp - 2); P.hp = P.maxHp; } }
];

const WEAPONS = [
  { id: 'mingce', name: '名 册', type: '长刃 · 均衡', desc: '四段连斩，范围适中',
    steps: 4, dur: 0.24, range: [112, 124, 136, 148], half: [1.2, 1.2, 1.95, 1.5],
    dmg: [1, 1, 2, 3], lunge: 16, heavyDur: 0.44, heavyRange: 172, heavyDmg: 4, heavyLaunch: 330, launchLast: 240 },
  { id: 'zhui', name: '朱 痕', type: '双刃 · 迅捷', desc: '六段快斩，范围较短',
    steps: 6, dur: 0.17, range: [92, 96, 100, 104, 108, 118], half: [1.05, 1.05, 1.05, 1.05, 1.6, 1.3],
    dmg: [1, 1, 1, 1, 1, 2], lunge: 22, heavyDur: 0.38, heavyRange: 150, heavyDmg: 3, heavyLaunch: 220, launchLast: 160 },
  { id: 'shangu', name: '山 骨', type: '重刃 · 破阵', desc: '三段重击，范围大、能击飞',
    steps: 3, dur: 0.34, range: [150, 170, 190], half: [1.4, 1.4, 1.9],
    dmg: [2, 2, 4], lunge: 12, heavyDur: 0.55, heavyRange: 215, heavyDmg: 7, heavyLaunch: 420, launchLast: 320 }
];
const WPN = () => WEAPONS.find(w => w.id === G.weapon) || WEAPONS[0];

const UPGRADES = [
  { id: 'wave', name: '剑 气', desc: '每段斩击飞出一道刀气，贯穿前方', apply() { P.hasWave = true; } },
  { id: 'burn', name: '焚 身', desc: '命中造成燃烧，死亡时爆炸', apply() { P.hasBurn = true; } },
  { id: 'chain', name: '连 锁 雷', desc: '命中时电弧弹到附近 2 人', apply() { P.hasChain = true; } },
  { id: 'frost', name: '霜 刃', desc: '命中减速 55%', apply() { P.hasFrost = true; } },
  { id: 'soul', name: '吸 魂', desc: '击杀回复生命', apply() { P.lifesteal += 0.4; } },
  { id: 'firestorm', name: '雷 火', badge: '组合', req: () => P.hasBurn && P.hasChain, desc: '电弧附带燃烧，点燃成片', apply() { P.firestorm = true; } },
  { id: 'iceblade', name: '冰 刃', badge: '组合', req: () => P.hasFrost && P.hasWave, desc: '刀气附带霜冻，成片减速', apply() { P.iceblade = true; } },
  { id: 'split', name: '裂 空', badge: '组合', req: () => P.hasWave, desc: '刀气一分为三', apply() { P.splitWave = true; } },
  { id: 'shatter', name: '碎 冰', badge: '组合', req: () => P.hasFrost, desc: '对减速目标伤害 +60%，击杀碎冰爆炸', apply() { P.shatter = true; } },
  { id: 'bloodburn', name: '血 燃', badge: '组合', req: () => P.hasBurn && P.lifesteal > 0, desc: '燃烧伤害转化为治疗', apply() { P.bloodburn = true; } }
];

function offerWeapon() {
  G.weaponPick = { opts: WEAPONS.slice() };
  G.paused = true;
}

function offerTalent() {
  const pool = TALENTS.slice();
  const opts = [];
  while (opts.length < 3 && pool.length) {
    opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  G.talent = { opts };
  G.paused = true;
}

function chooseCard(i) {
  if (G.weaponPick) {
    const w = G.weaponPick.opts[i];
    if (!w) return;
    G.weapon = w.id;
    G.weaponName = w.name;
    G.weaponPick = null;
    offerTalent();
    return;
  }
  if (G.talent) {
    const t = G.talent.opts[i];
    if (!t) return;
    t.apply();
    G.talentName = t.name;
    G.talent = null;
    G.paused = false;
    G.tut = 5.2;
    startStage(1, false);
    return;
  }
  if (G.upgrade) {
    const opt = G.upgrade.opts[i];
    if (!opt) return;
    const next = G.upgrade.next;
    opt.apply();
    G.taken.add(opt.id);
    G.upgrade = null;
    G.paused = false;
    startStage(next, next < BOSS_STAGE);
  }
}

function offerUpgrade(next) {
  const avail = UPGRADES.filter(u => !G.taken.has(u.id) && (!u.req || u.req()));
  const syn = avail.filter(u => u.badge);
  const base = avail.filter(u => !u.badge);
  const opts = [];
  if (syn.length) opts.push(syn.splice(Math.floor(Math.random() * syn.length), 1)[0]);
  const rest = base.concat(syn);
  while (opts.length < 3 && rest.length) {
    opts.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
  }
  G.upgrade = { opts, next };
  G.paused = true;
}

function startStage(n, keep) {
  G.stage = n;
  G.stageKills = 0;
  G.stageClearT = 0;
  G.eliteDone = false;
  G.elite2Done = false;
  G.spawnT = 0.5;
  G.formT = 7;
  projectiles.length = 0;
  if (!keep) enemies.length = 0;
  const st = STAGES[n - 1];
  if (!st) return;
  if (st.boss) {
    G.bloodMoon = true;
    P.hp = P.maxHp;
    const boss = spawnEnemy('oni', clamp(P.x + 380, ARENA.x1 + 120, ARENA.x2 - 120), PORTRAIT ? 760 : 520);
    boss.state = 'enter';
    boss.st = 1.2;
    boss.phase = 1;
    boss.cd = 0.8;
    G.banner = { title: '第 三 阵 · 鬼 武 者', sub: '斩 将', t: 0, dur: 2.4 };
    SFX.roar();
  } else {
    G.bloodMoon = false;
    P.hp = Math.min(P.maxHp, P.hp + 2);
    G.banner = { title: st.title, sub: `斩 ${st.quota} 人`, t: 0, dur: 2.2 };
  }
}

function updateStage(dt) {
  if (G.stage >= BOSS_STAGE) return;
  const st = STAGES[G.stage - 1];
  if (!st) return;
  if (G.stageKills < st.quota) {
    G.spawnT -= dt;
    const alive = enemies.filter(e => !e.dead).length;
    if (G.spawnT <= 0 && alive < (G.stage === 1 ? 20 : 24)) {
      G.spawnT = 0.55 - G.stage * 0.08;
      spawnEnemy(st.pool[Math.floor(Math.random() * st.pool.length)]);
      if (Math.random() < 0.3) spawnEnemy(st.pool[Math.floor(Math.random() * st.pool.length)]);
    }
    G.formT -= dt;
    if (G.formT <= 0 && alive < 22) {
      G.formT = 11 - G.stage;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const bx = clamp(P.x + dir * 520, ARENA.x1 + 60, ARENA.x2 - 60);
      for (let i = 0; i < 3; i++) spawnEnemy('shield', clamp(bx + i * 52, ARENA.x1, ARENA.x2), clamp(P.y - 26 + i * 14, ARENA.y1, ARENA.y2));
      for (let i = 0; i < 2; i++) spawnEnemy('archer', clamp(bx + 80 + i * 46, ARENA.x1, ARENA.x2), clamp(P.y - 90 - i * 16, ARENA.y1, ARENA.y2));
      G.banner = { title: '盾 阵 推 进', sub: '绕 后 破 阵', t: 0, dur: 1.2 };
    }
  } else {
    G.stageClearT += dt;
    if (G.stageClearT > 0.9 && !G.upgrade) {
      offerUpgrade(G.stage + 1);
    }
  }
  if (!G.elite2Done && st.elite2 && G.stageKills >= st.eliteAt2) {
    G.elite2Done = true;
    for (const k of st.elite2) spawnEnemy(k, clamp(P.x + rnd(-560, 560), ARENA.x1 + 60, ARENA.x2 - 60), clamp(P.y + rnd(-130, 130), ARENA.y1, ARENA.y2));
    G.banner = { title: '强 敌 来 袭', sub: '斩 杀 首 级', t: 0, dur: 1.6 };
    addFlash('#ff3b4e', 0.22);
    addShake(12);
    SFX.roar();
  }
  if (!G.eliteDone && st.elite && G.stageKills >= st.eliteAt) {
    G.eliteDone = true;
    for (const k of st.elite) spawnEnemy(k, clamp(P.x + rnd(-520, 520), ARENA.x1 + 60, ARENA.x2 - 60), clamp(P.y + rnd(-120, 120), ARENA.y1, ARENA.y2));
    G.banner = { title: '精 英 来 袭', sub: '斩 杀 首 级', t: 0, dur: 1.6 };
    addFlash('#ff3b4e', 0.22);
    addShake(10);
    SFX.roar();
  }
}

function update(dt) {
  if (G.mode === 'play' && G.paused) return;
  G.t += dt;
  if (G.mode === 'play' && !G.paused) G.tut = Math.max(0, (G.tut || 0) - dt);
  G.flash = Math.max(0, G.flash - dt * 4);
  G.shake = Math.max(0, G.shake - dt * 85);
  G.kickX -= G.kickX * Math.min(1, 12 * dt);
  G.kickY -= G.kickY * Math.min(1, 12 * dt);
  updateFX(dt);
  if (G.execT > 0) G.execT = Math.max(0, G.execT - dt);
  updateWaves(dt);
  updateWeather(dt);
  G.redMix = lerp(G.redMix, (G.bloodMoon && G.mode !== 'title') ? 1 : 0, 1 - Math.exp(-1.6 * dt));

  if (G.mode === 'title') return;
  if (G.mode === 'result') { G.endT += dt; return; }
  if (G.cutin) {
    G.cutin.t += dt;
    if (G.cutin.t >= G.cutin.dur) {
      G.cutin = null;
      G.ult = { t: 0, dur: 1.55, hit: false };
      G.timeScale = 0.05;
      addFlash('#ff2b44', 0.55);
      addShake(22);
      SFX.ult();
    }
    return;
  }
  if (G.ult) { updateUlt(dt); return; }

  G.runT += dt;
  CAM.x = lerp(CAM.x, clamp(P.x, W / 2, WORLD_W - W / 2), 1 - Math.exp(-5 * dt));
  CAM.y = PORTRAIT ? 860 : 360;
  G.hitstop = Math.max(0, G.hitstop - dt);
  G.slowT = Math.max(0, G.slowT - dt);
  G.punch = Math.max(0, G.punch - dt * 7);
  const frozen = G.hitstop > 0;
  const dtW = dt * (frozen ? 0.03 : (G.slowT > 0 ? 0.3 : 1));

  updateStage(dt);
  updateProjectiles(dt);
  updatePlayer(dt);
  updateEnemies(dtW);

  // 连击衰减
  if (G.combo > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 0;
  }

  if (G.banner) {
    G.banner.t += dt;
    if (G.banner.t > G.banner.dur) G.banner = null;
  }
}

function updatePlayer(dt) {
  P.animT += dt;
  P.invuln = Math.max(0, P.invuln - dt);
  P.attackT = Math.max(0, P.attackT - dt);
  if (P.attackT <= 0 && P.buffer) {
    const b = P.buffer;
    P.buffer = 0;
    attack(b === 2);
  }
  P.chainCd = Math.max(0, P.chainCd - dt);
  P.dashT = Math.max(0, P.dashT - dt);
  P.dashCd = Math.max(0, P.dashCd - dt);
  P.hurtT = Math.max(0, P.hurtT - dt);
  P.kenbikiT = Math.max(0, P.kenbikiT - dt);

  if (P.run) P.runPhase += dt * 10;
  if (P.holding) {
    P.holdT += dt;
    if (!P.charged && P.holdT >= 0.42 && P.attackT <= 0) {
      P.charged = true;
      attack(true);
    }
  }

  let dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  const len = Math.hypot(dx, dy);
  P.run = len > 0.05 ? 1 : 0;

  if (P.dashT > 0) {
    const sp = 1150;
    P.x += P.dashX * sp * dt;
    P.y += P.dashY * sp * dt;
    for (const e of enemies) {
      if (e.dead || P.dashHits.has(e)) continue;
      if (Math.hypot(e.x - P.x, e.y - P.y) < 60 + e.r) {
        P.dashHits.add(e);
        hitEnemy(e, 1, Math.atan2(P.dashY, P.dashX));
      }
    }
  } else if (!G.ult) {
    if (len > 0) {
      dx /= len; dy /= len;
      const sp = P.speed * P.speedMul * (P.attackT > 0 ? 0.8 : 1) * (P.holding && !P.charged ? 0.9 : 1);
      P.x += dx * sp * dt;
      P.y += dy * sp * dt;
      if (P.attackT <= 0 && P.hurtT <= 0) { P.aim = Math.atan2(dy, dx); P.face = dx >= 0 ? 1 : -1; }
    }
  }
  P.x = clamp(P.x, ARENA.x1, ARENA.x2);
}

function updateUlt(dt) {
  const u = G.ult;
  u.t += dt;
  if (!u.hit && u.t > 0.32) {
    u.hit = true;
    const list = enemies.filter(e => !e.dead);
    for (const e of list) {
      if (e.kind === 'oni') {
        const dmg = Math.min(e.hp - 1, Math.ceil(e.maxHp * 0.22));
        if (dmg > 0) {
          e.hp -= dmg;
          e.hitFlash = 1;
          floatText(String(dmg), e.x, e.y - 150, '#ffd36e', 28);
          ring(e.x, e.y - 60, 20, 120, '#ffd36e', 3, 0.4);
        }
      } else if (Math.hypot(e.x - P.x, e.y - P.y) < 700) {
        const ang = Math.atan2(e.y - P.y, e.x - P.x);
        e.hp -= 3;
        e.hitFlash = 1;
        e.kx += Math.cos(ang) * 420;
        e.ky += Math.sin(ang) * 260;
        e.stun = Math.max(e.stun || 0, 0.35);
        floatText('3', e.x + rnd(-8, 8), e.y - 70, '#ffe8eb', 16);
        if (e.hp <= 0) killEnemy(e, ang);
      }
    }
    if (list.length) {
      G.score += list.length * 80;
      G.combo += list.length * 2;
      G.maxCombo = Math.max(G.maxCombo, G.combo);
      addFlash('#ff2b44', 0.6);
    }
    for (let i = 0; i < 14; i++) {
      slashes.push({
        x: rnd(120, 1160), y: rnd(330, 650), ang: rnd(-1.2, 1.2),
        r: rnd(120, 260), half: 0.9, color: i % 3 === 0 ? '#ffd0d6' : '#ffffff',
        life: 0.5 + i * 0.02, max: 0.5 + i * 0.02, w: 5, full: true
      });
    }
    addShake(26);
    G.execT = 0.65;
    G.execX = P.x;
    G.execY = P.y - 90;
    addFlash('#ffffff', 0.4);
  }
  if (u.t > u.dur) {
    G.ult = null;
    G.timeScale = 1;
    addShake(8);
  }
}

function calcRank() {
  let rank = G.kills >= 110 ? 'SSS' : G.kills >= 85 ? 'SS' : G.kills >= 60 ? 'S' : G.kills >= 40 ? 'A' : G.kills >= 25 ? 'B' : G.kills >= 15 ? 'C' : 'D';
  if (G.victory && rank !== 'SSS') rank = rank === 'SS' ? 'SSS' : rank === 'S' ? 'SS' : rank === 'A' ? 'S' : rank === 'B' ? 'A' : rank === 'C' ? 'B' : 'C';
  return rank;
}

function endGame(victory) {
  if (G.mode !== 'play') return;
  G.mode = 'result';
  G.victory = !!victory;
  G.endT = 0;
  G.banner = null;
  G.ult = null;
  G.timeScale = 1;
  G.shake = 0;
  G.resultBuild = [...G.taken];
  G.rank = calcRank();
  if (G.score > G.best) {
    G.best = G.score;
    try { localStorage.setItem('tide_best', String(G.best)); } catch (e) {}
  }
}

function startGame() {
  audioInit();
  G.mode = 'play';
  G.paused = false;
  G.tut = 5.2;
  G.upgrade = null;
  G.cutin = null;
  G.taken = new Set();
  G.runT = 0; G.score = 0; G.kills = 0; G.combo = 0; G.comboT = 0; G.maxCombo = 0;
  G.stage = 1; G.stageKills = 0; G.stageClearT = 0; G.victory = false;
  G.meter = 0; G.hitstop = 0; G.shake = 0; G.flash = 0;
  G.bloodMoon = false; G.ult = null; G.banner = null; G.timeScale = 1;
  G.spawnT = 0.4; G.endT = 0; G.streak = 0;
  P.maxHp = 10;
  P.x = W / 2; P.y = PORTRAIT ? 800 : 580; CAM.x = W / 2; CAM.y = PORTRAIT ? 860 : 360; P.hp = P.maxHp; P.aim = Math.PI; P.face = 1;
  P.attackT = 0; P.dashT = 0; P.dashCd = 0; P.invuln = 1.0; P.hurtT = 0;
  P.dmgBonus = 0; P.speedMul = 1; P.rangeMul = 1; P.dashCdMul = 1; P.ultGainMul = 1;
  P.hasWave = false; P.hasChain = false; P.hasBurn = false; P.hasFrost = false; P.lifesteal = 0; P.chainCd = 0;
  P.firestorm = false; P.iceblade = false; P.splitWave = false; P.shatter = false; P.bloodburn = false;
  P.parryWin = 1; P.hasWave = false; P.hasBurn = false; P.hasFrost = false; P.hasChain = false;
  P.dmgBonus = 0; P.dashCdMul = 1;
  enemies.length = 0; projectiles.length = 0; parts.length = 0; slashes.length = 0; texts.length = 0;
  rings.length = 0; decals.length = 0;
  G.talent = null;
  G.weaponPick = null;
  G.weapon = 'mingce';
  G.weaponName = '名 册';
  offerWeapon();
}

/* ---------------- 天气 ---------------- */
function updateWeather(dt) {
  for (const r of rain) {
    r.y += 1000 * r.z * dt;
    r.x -= 240 * r.z * dt;
    if (r.y > H + 20) { r.y = -20; r.x = rnd(0, W + 200); }
    if (r.x < -30) r.x += W + 60;
  }
  for (const m of motes) {
    m.x += (m.vx + Math.sin(G.t * 0.6 + m.ph) * 6) * dt;
    m.y += m.vy * dt;
    if (m.y < 300) { m.y = rnd(640, 690); m.x = rnd(0, W); }
  }
}

function updateFX(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.vx -= p.vx * p.drag * dt;
    p.vy -= p.vy * p.drag * 0.4 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vr) p.rot += p.vr * dt;
  }
  for (let i = slashes.length - 1; i >= 0; i--) {
    slashes[i].life -= dt;
    if (slashes[i].life <= 0) slashes.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].life -= dt;
    if (rings[i].life <= 0) rings.splice(i, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= 0.93;
    if (t.life <= 0) texts.splice(i, 1);
  }
}

/* ---------------- 角色绘制 ---------------- */
function drawSu(x, y, s, face, t, pose) {
  g.save();
  g.translate(x, y);
  g.scale(face * s, s);

  const run = pose.run || 0;
  const atk = pose.atk || 0;
  const bob = Math.sin(t * 16) * 2.2 * run;
  const hipY = -70 + bob;
  const shY = -116 + bob;
  const headY = -138 + bob;
  const sway = Math.sin(t * 2.2) * 4 + run * Math.sin(t * 16) * 5;

  // 下摆
  g.fillStyle = '#14161f';
  g.beginPath();
  g.moveTo(-6, hipY - 12);
  g.quadraticCurveTo(-30, hipY + 18, -28 + sway, hipY + 64);
  g.quadraticCurveTo(-8, hipY + 40, 4, hipY + 6);
  g.closePath();
  g.fill();

  // 腿
  const swing = Math.sin(t * 16) * 20 * run;
  g.strokeStyle = '#0b0d14';
  g.lineWidth = 11;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-4, hipY);
  g.quadraticCurveTo(-8 + swing * 0.35, hipY + 34, -10 + swing, -2);
  g.stroke();
  g.beginPath();
  g.moveTo(4, hipY);
  g.quadraticCurveTo(10 - swing * 0.35, hipY + 32, 12 - swing, -2);
  g.stroke();

  // 躯干
  g.fillStyle = '#0c0e15';
  g.beginPath();
  g.moveTo(-12, shY + 4);
  g.quadraticCurveTo(0, shY - 3, 12, shY + 4);
  g.lineTo(10, hipY - 2);
  g.quadraticCurveTo(0, hipY + 6, -10, hipY - 2);
  g.closePath();
  g.fill();

  // 羽织（单肩滑落）
  g.fillStyle = '#474d5e';
  g.beginPath();
  g.moveTo(-13, shY + 2);
  g.quadraticCurveTo(-26, shY + 26, -24 + sway * 0.5, shY + 76);
  g.quadraticCurveTo(-12, shY + 56, -2, shY + 40);
  g.lineTo(6, shY + 10);
  g.closePath();
  g.fill();
  g.strokeStyle = '#ff4d63';
  g.globalAlpha = 0.25;
  g.lineWidth = 1.2;
  g.stroke();
  g.globalAlpha = 1;

  // 腰带
  g.strokeStyle = '#b02a3c';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(-9, hipY - 6);
  g.lineTo(9, hipY - 4);
  g.stroke();

  // 头
  g.fillStyle = '#e6d6c6';
  g.beginPath();
  g.ellipse(1, headY, 9.5, 11, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(-6, headY + 6);
  g.quadraticCurveTo(1, headY + 15, 7, headY + 5);
  g.lineTo(7, headY + 8);
  g.quadraticCurveTo(1, headY + 16, -6, headY + 8);
  g.closePath();
  g.fill();

  // 乱发
  g.fillStyle = '#0a0b12';
  g.beginPath();
  g.moveTo(-10, headY - 2);
  g.bezierCurveTo(-14, headY - 14, -4, headY - 20, 4, headY - 17);
  g.bezierCurveTo(12, headY - 14, 15, headY - 4, 12, headY + 3);
  g.lineTo(8, headY - 8);
  g.lineTo(4, headY + 2);
  g.lineTo(0, headY - 9);
  g.lineTo(-4, headY + 1);
  g.lineTo(-8, headY - 6);
  g.closePath();
  g.fill();
  // 侧后长发
  g.beginPath();
  g.moveTo(-8, headY - 6);
  g.quadraticCurveTo(-22, headY + 8, -18 + sway * 0.4, headY + 34);
  g.quadraticCurveTo(-10, headY + 16, -5, headY + 4);
  g.closePath();
  g.fill();

  // 一只蓝眼
  g.save();
  g.shadowColor = '#8fd8ff';
  g.shadowBlur = 10;
  g.fillStyle = '#8fd8ff';
  g.fillRect(3.0, headY - 2.2, 4.6, 2.0);
  g.restore();

  // 手臂 + 刀
  const armA = lerp(0.5, 2.3, atk);
  const hx = Math.sin(armA) * 26;
  const hy = shY + Math.cos(armA) * 26;
  g.strokeStyle = '#0b0d14';
  g.lineWidth = 6.5;
  g.beginPath();
  g.moveTo(4, shY + 12);
  g.quadraticCurveTo(8, shY + 20, hx, hy);
  g.stroke();

  let blade;
  if (atk <= 0.001) blade = -0.6;
  else if (atk < 0.22) blade = lerp(-0.6, -2.4, easeOut(atk / 0.22));
  else if (atk < 0.7) blade = lerp(-2.4, 1.0, easeOut((atk - 0.22) / 0.48));
  else blade = lerp(1.0, -0.6, (atk - 0.7) / 0.3);
  const bx = Math.sin(blade), by = Math.cos(blade);
  const len = 118;
  const tipX = hx + bx * len, tipY = hy + by * len;
  g.save();
  g.lineCap = 'round';
  g.shadowColor = '#ff6a78';
  g.shadowBlur = 8 + (pose.glow || 0) * 14;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(tipX, tipY); g.stroke();
  g.strokeStyle = '#ff9aa4';
  g.globalAlpha = 0.7;
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + bx * len * 0.5, hy + by * len * 0.5); g.stroke();
  g.globalAlpha = 1;
  // 刀身刻名（细密横刻）
  g.strokeStyle = 'rgba(30,20,30,0.55)';
  g.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    const k = i / 10;
    const px = hx + bx * len * k, py = hy + by * len * k;
    g.beginPath();
    g.moveTo(px - by * 2.2, py + bx * 2.2);
    g.lineTo(px + by * 2.2, py - bx * 2.2);
    g.stroke();
  }
  g.restore();

  // 轮廓光
  g.strokeStyle = '#a8e6ff';
  g.globalAlpha = 0.55;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-1, headY - 11);
  g.quadraticCurveTo(-15, shY - 6, -16, shY + 46);
  g.stroke();
  g.beginPath();
  g.moveTo(-10, shY + 10);
  g.quadraticCurveTo(-24, shY + 40, -26, shY + 76);
  g.stroke();
  g.globalAlpha = 0.35;
  g.strokeStyle = '#ff8a96';
  g.beginPath();
  g.moveTo(10, shY + 6);
  g.quadraticCurveTo(14, hipY - 10, 8, hipY + 2);
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
}

function drawOni(e) {
  // 立绘版
  let bossIdx = 0;
  if (e.state === 'wind' || e.state === 'strike') bossIdx = 1;
  else if (e.state === 'break' || e.state === 'roar') bossIdx = 2;
  const bart = BOSS_ART[bossIdx];
  if (bart.img.complete && bart.img.naturalWidth) {
    const bs = (272 / bart.img.naturalHeight) * depth(e.y);
    const img = bart.img;
    g.save();
    g.translate(e.x, e.y);
    g.scale(e.face * bs, bs);
    g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight * bart.foot);
    g.restore();
    if (e.hitFlash > 0) {
      g.save();
      g.globalAlpha = e.hitFlash * 0.35;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(e.x, e.y - 120 * bs, 50 * bs, 90 * bs, 0, 0, TAU); g.fill();
      g.restore();
    }
    if (e.state === 'break') {
      g.save();
      g.globalAlpha = 0.7 + Math.sin(G.t * 10) * 0.3;
      g.textAlign = 'center';
      g.font = `700 13px ${F_SANS}`;
      g.fillStyle = '#ffd36e';
      g.shadowColor = '#ffd36e';
      g.shadowBlur = 10;
      g.fillText('破 绽', e.x, e.y - 330);
      g.restore();
    }
    return;
  }

  // 矢量版（立绘加载失败时兜底）
  const s = e.scale * depth(e.y);
  g.save();
  g.translate(e.x, e.y);
  g.scale(e.face * s, s);
  const t = e.animT;
  const bob = Math.sin(t * 2.2) * 2;
  const wind = e.state === 'wind';
  const strike = e.state === 'strike';
  const broken = e.state === 'break' || e.state === 'roar';
  const crouch = broken ? 14 : 0;

  // 气场（画在身体后面）
  if (wind) {
    const k = 1 - e.st / (e.atk === 'slam' ? 0.95 : 0.8);
    g.globalAlpha = 0.10 + clamp(k, 0, 1) * 0.22;
    g.fillStyle = '#ff3b4e';
    g.beginPath(); g.ellipse(0, -80, 54, 78, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }
  if (broken) {
    g.globalAlpha = 0.30;
    g.fillStyle = '#ffd36e';
    g.beginPath(); g.ellipse(0, -80, 46, 64, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }


  // 腿
  g.strokeStyle = '#0a0810';
  g.lineWidth = 16;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(-14, -62 + crouch); g.lineTo(-18, 0); g.stroke();
  g.beginPath(); g.moveTo(14, -62 + crouch); g.lineTo(20, 0); g.stroke();

  // 身体
  g.fillStyle = '#120d16';
  g.beginPath();
  g.moveTo(-30, -128 + bob + crouch);
  g.quadraticCurveTo(0, -140 + bob + crouch, 30, -128 + bob + crouch);
  g.lineTo(24, -58 + crouch);
  g.quadraticCurveTo(0, -48 + crouch, -24, -58 + crouch);
  g.closePath();
  g.fill();

  // 肩甲
  g.fillStyle = '#241a28';
  g.beginPath(); g.ellipse(-30, -124 + bob, 15, 10, -0.2, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(30, -124 + bob, 15, 10, 0.2, 0, TAU); g.fill();
  g.strokeStyle = '#ff3b4e';
  g.globalAlpha = 0.35;
  g.lineWidth = 1.4;
  g.beginPath(); g.ellipse(30, -124 + bob, 15, 10, 0.2, 0, TAU); g.stroke();
  g.globalAlpha = 0.25;
  g.strokeStyle = '#ff8a96';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-28, -132 + bob);
  g.quadraticCurveTo(-38, -100, -30, -60 + crouch);
  g.stroke();
  g.globalAlpha = 1;

  // 腰带
  g.strokeStyle = '#5a1520';
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(-22, -66 + crouch); g.lineTo(22, -64 + crouch); g.stroke();

  // 头 / 面具
  g.fillStyle = '#e8dcd2';
  g.beginPath(); g.ellipse(0, -150 + bob + crouch, 13, 15, 0, 0, TAU); g.fill();
  g.fillStyle = '#d8ccc4';
  g.beginPath(); g.moveTo(-10, -160 + bob + crouch); g.lineTo(-22, -186 + bob); g.lineTo(-4, -168 + bob + crouch); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(10, -160 + bob + crouch); g.lineTo(22, -186 + bob); g.lineTo(4, -168 + bob + crouch); g.closePath(); g.fill();
  g.save();
  g.shadowColor = '#ff3b4e';
  g.shadowBlur = 12;
  g.fillStyle = '#ff3b4e';
  g.fillRect(-8, -152 + bob + crouch, 6, 3);
  g.fillRect(3, -152 + bob + crouch, 6, 3);
  g.restore();
  g.strokeStyle = 'rgba(120,20,30,0.6)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-4, -140 + bob + crouch);
  g.lineTo(0, -132 + bob + crouch);
  g.lineTo(4, -140 + bob + crouch);
  g.stroke();

  // 大太刀
  let blade = -0.7;
  if (wind) blade = -2.7;
  else if (strike) blade = 0.9;
  if (broken) blade = 0.2;
  const hx = 30, hy = -96 + bob + crouch;
  const bx = Math.sin(blade), by = Math.cos(blade);
  const len = 175;
  g.save();
  g.lineCap = 'round';
  g.shadowColor = '#ff3b4e';
  g.shadowBlur = 12;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + bx * len, hy + by * len); g.stroke();
  g.strokeStyle = 'rgba(255,60,80,0.5)';
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + bx * len * 0.6, hy + by * len * 0.6); g.stroke();
  g.restore();

  // 弓
  if (e.kind === 'archer') {
    g.strokeStyle = '#7a5844';
    g.lineWidth = 3;
    g.beginPath(); g.arc(20, -66, 24, -1.1, 1.1); g.stroke();
    g.strokeStyle = 'rgba(220,235,255,0.4)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(20 + 24 * Math.cos(-1.1), -66 + 24 * Math.sin(-1.1));
    g.lineTo(20 + 24 * Math.cos(1.1), -66 + 24 * Math.sin(1.1));
    g.stroke();
  }

  // 自爆僧的肚子
  if (e.kind === 'bomber') {
    const pulse = e.state === 'fuse' ? 0.55 + Math.sin(G.t * 30) * 0.4 : 0.3;
    g.fillStyle = '#3a1a1e';
    g.beginPath(); g.arc(0, -46, 24, 0, TAU); g.fill();
    g.globalAlpha = clamp(pulse + 0.3, 0, 1);
    g.fillStyle = '#ff5a3c';
    g.beginPath(); g.arc(0, -46, 9, 0, TAU); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = '#ffd36e';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -70); g.lineTo(4, -82); g.stroke();
    g.fillStyle = '#fff1b8';
    g.beginPath(); g.arc(4, -84, 2.5 + Math.random() * 1.5, 0, TAU); g.fill();
  }

  if (e.hitFlash > 0) {
    g.globalAlpha = e.hitFlash * 0.35;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, -80, 34, 70, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }
  g.restore();

  // 破绽提示
  if (e.state === 'break') {
    g.save();
    g.globalAlpha = 0.7 + Math.sin(G.t * 10) * 0.3;
    g.textAlign = 'center';
    g.font = `700 13px ${F_SANS}`;
    g.fillStyle = '#ffd36e';
    g.shadowColor = '#ffd36e';
    g.shadowBlur = 10;
    g.fillText('破 绽', e.x, e.y - 330);
    g.restore();
  }
}

function drawShade(e, t) {
  const s = e.scale * depth(e.y);
  g.save();
  g.translate(e.x, e.y - (e.z || 0));
  g.scale(e.face * s, s);
  if (e.dead) {
    const k = clamp(e.deadT / 0.55, 0, 1);
    g.globalAlpha = 1 - k;
    g.translate(0, k * 10);
  }
  const bob = Math.sin(t * 5 + e.bob) * 2;
  const wind = e.state === 'wind';
  const strike = e.state === 'strike';
  const step = Math.sin(t * 7 + e.bob) * 3;

  // 腿
  g.strokeStyle = e.def.body;
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-8, -26);
  g.lineTo(-10 + step, -1);
  g.stroke();
  g.beginPath();
  g.moveTo(8, -26);
  g.lineTo(10 - step, -1);
  g.stroke();

  // 斗篷
  g.beginPath();
  g.moveTo(0, -92 + bob);
  g.quadraticCurveTo(-20, -70 + bob, -21, -20);
  g.quadraticCurveTo(-12, -11, 0, -13);
  g.quadraticCurveTo(12, -11, 21, -20);
  g.quadraticCurveTo(20, -70 + bob, 0, -92 + bob);
  g.closePath();
  g.fillStyle = e.def.body;
  g.fill();
  g.strokeStyle = e.def.eye;
  g.globalAlpha = 0.22;
  g.lineWidth = 1.4;
  g.stroke();
  g.globalAlpha = 1;

  // 兜帽
  g.beginPath();
  g.moveTo(-15, -88 + bob);
  g.quadraticCurveTo(-14, -108 + bob, 0, -110 + bob);
  g.quadraticCurveTo(14, -108 + bob, 15, -88 + bob);
  g.quadraticCurveTo(8, -96 + bob, 0, -96 + bob);
  g.quadraticCurveTo(-8, -96 + bob, -15, -88 + bob);
  g.closePath();
  g.fillStyle = e.def.body;
  g.fill();
  g.strokeStyle = e.def.eye;
  g.globalAlpha = 0.28;
  g.lineWidth = 1.2;
  g.stroke();
  g.globalAlpha = 1;

  // 面部深渊
  g.fillStyle = 'rgba(0,0,0,0.92)';
  g.beginPath(); g.ellipse(0, -96 + bob, 9.5, 10.5, 0, 0, TAU); g.fill();

  // 红眼（无 shadowBlur，用两层小光斑代替）
  g.fillStyle = e.def.eye;
  g.globalAlpha = 0.20;
  g.beginPath(); g.arc(-4.3, -96 + bob, 6, 0, TAU); g.fill();
  g.beginPath(); g.arc(4.7, -96 + bob, 6, 0, TAU); g.fill();
  g.globalAlpha = 1;
  g.fillRect(-6, -97 + bob, 3.4, 2);
  g.fillRect(3, -97 + bob, 3.4, 2);

  // 手臂
  const armSwing = strike ? -1.1 : wind ? -0.55 : Math.sin(t * 5 + e.bob) * 0.12;
  g.strokeStyle = e.def.body;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(-12, -72 + bob);
  g.quadraticCurveTo(-25, -58 + bob, -22, -38 + bob + armSwing * 9);
  g.stroke();
  g.beginPath();
  g.moveTo(12, -72 + bob);
  g.quadraticCurveTo(25, -58 + bob, 22, -38 + bob + armSwing * 9);
  g.stroke();

  // 爪尖
  g.strokeStyle = e.def.eye;
  g.globalAlpha = 0.4;
  g.lineWidth = 1;
  const clawY = -38 + bob + armSwing * 9;
  for (const side of [-1, 1]) {
    const cxp = side * 22;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(cxp, clawY);
      g.lineTo(cxp + side * 4 + k * 2, clawY + 8);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  // 盾
  if (e.kind === 'shield' && e.guard > 0) {
    g.save();
    g.translate(21, -54);
    g.rotate(-0.08);
    g.fillStyle = '#262231';
    g.strokeStyle = '#ffd36e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-8, -30);
    g.quadraticCurveTo(8, -28, 8, -6);
    g.quadraticCurveTo(8, 22, 0, 30);
    g.quadraticCurveTo(-8, 22, -8, -6);
    g.quadraticCurveTo(-8, -28, -8, -30);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(255,211,110,0.45)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, -26); g.lineTo(0, 26); g.stroke();
    g.globalAlpha = 0.85;
    g.fillStyle = '#ff4d5e';
    g.beginPath();
    g.moveTo(0, -13); g.lineTo(5, -2); g.lineTo(0, 9); g.lineTo(-5, -2);
    g.closePath();
    g.fill();
    g.restore();
  }

  // 弓
  if (e.kind === 'archer') {
    g.strokeStyle = '#7a5844';
    g.lineWidth = 3;
    g.beginPath(); g.arc(20, -66, 24, -1.1, 1.1); g.stroke();
    g.strokeStyle = 'rgba(220,235,255,0.4)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(20 + 24 * Math.cos(-1.1), -66 + 24 * Math.sin(-1.1));
    g.lineTo(20 + 24 * Math.cos(1.1), -66 + 24 * Math.sin(1.1));
    g.stroke();
  }

  // 自爆僧的肚子
  if (e.kind === 'bomber') {
    const pulse = e.state === 'fuse' ? 0.55 + Math.sin(G.t * 30) * 0.4 : 0.3;
    g.fillStyle = '#3a1a1e';
    g.beginPath(); g.arc(0, -46, 24, 0, TAU); g.fill();
    g.globalAlpha = clamp(pulse + 0.3, 0, 1);
    g.fillStyle = '#ff5a3c';
    g.beginPath(); g.arc(0, -46, 9, 0, TAU); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = '#ffd36e';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -70); g.lineTo(4, -82); g.stroke();
    g.fillStyle = '#fff1b8';
    g.beginPath(); g.arc(4, -84, 2.5 + Math.random() * 1.5, 0, TAU); g.fill();
  }

  // 蓄力红光
  if (wind) {
    const k = 1 - e.st / (e.kind === 'brute' ? 0.7 : 0.5);
    g.globalAlpha = 0.12 + k * 0.25;
    g.fillStyle = '#ff3b4e';
    g.beginPath(); g.ellipse(0, -50, 42, 54, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }

  if (e.hitFlash > 0 && !e.dead) {
    g.globalAlpha = e.hitFlash * 0.5;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, -52, 24, 48, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }
  g.restore();

  // 血条
  if (!e.dead && e.hp < e.maxHp) {
    const w = 30;
    g.save();
    g.globalAlpha = 0.8;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(e.x - w / 2, e.y - 108 * s - (e.z || 0), w, 3);
    g.fillStyle = '#ff5f70';
    g.fillRect(e.x - w / 2, e.y - 108 * s - (e.z || 0), w * (e.hp / e.maxHp), 3);
    g.restore();
  }
}

/* ---------------- 渲染 ---------------- */
function render() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, W, H);

  // shake
  const sx = G.shake ? rnd(-G.shake, G.shake) : 0;
  const sy = G.shake ? rnd(-G.shake, G.shake) * 0.6 : 0;
  g.save();
  g.translate(sx, sy);

  const bossScene = (G.mode === 'play' && G.stage >= BOSS_STAGE);
  const duskScene = IMG.dusk.complete && IMG.dusk.naturalWidth && !bossScene;
  if (duskScene || (IMG.normal.complete && IMG.normal.naturalWidth)) {
    const BSCALE = 1.1;
    const bw = W * BSCALE, bh = H * BSCALE;
    const bx = (W - bw) / 2, by = H - bh;
    if (duskScene) {
      if (PORTRAIT) {
        const sc = Math.max(W / 1280, H / 720);
        const dw = 1280 * sc, dh = 720 * sc;
        g.drawImage(bgD, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        g.drawImage(bgD, bx, by, bw, bh);
      }
      g.drawImage(overlayDusk, 0, 0, W, H);
    } else {
      g.drawImage(bgN, bx, by, bw, bh);
      if (G.redMix > 0.001) {
        g.save();
        g.globalAlpha = clamp(G.redMix, 0, 1);
        g.drawImage(bgR, bx, by, bw, bh);
        g.restore();
      }
      g.drawImage(overlayCanvas, 0, 0, W, H);
    }
  } else {
    g.drawImage(bg, 0, 0);
  }

  // ---- 相机：世界坐标 ----
  g.save();
  g.translate(W / 2 - CAM.x, H / 2 - CAM.y);
  if (IS_TOUCH) {
    g.translate(P.x, P.y);
    g.scale(1.12, 1.12);
    g.translate(-P.x, -P.y);
  }
  if (G.punch > 0.001) {
    const pz = 1 + G.punch * 0.05;
    g.translate(P.x, P.y);
    g.scale(pz, pz);
    g.translate(-P.x, -P.y);
  }
  if (PORTRAIT) {
    g.drawImage(duskScene ? groundDusk : groundCanvas, 0, 420, WORLD_W, 900);
    g.fillStyle = duskScene ? '#1a120f' : '#0e1018';
    g.fillRect(0, 1310, WORLD_W, 400);
  }
  else g.drawImage(duskScene ? groundDusk : groundCanvas, 0, 330);
  drawProps();
  drawWaves();

  // 地面血迹
  for (const d of decals) {
    g.save();
    g.globalAlpha = d.a;
    g.translate(d.x, d.y);
    g.rotate(d.rot);
    g.fillStyle = '#5a0d18';
    g.beginPath();
    g.ellipse(0, 0, d.r, d.r * 0.4, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(d.r * 0.9, d.r * 0.2, d.r * 0.3, d.r * 0.14, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  // 实体
  const list = [];
  for (const e of enemies) list.push(e);
  if (G.mode !== 'title') list.push(P);
  list.sort((a, b) => a.y - b.y);

  for (const e of list) {
    // 影子
    const sc = e === P ? 0.9 * depth(e.y) : e.scale * depth(e.y);
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath();
    g.ellipse(e.x, e.y + 2, 24 * sc, 7 * sc, 0, 0, TAU);
    g.fill();
    g.restore();

    if (e === P) {
      g.drawImage(auraCanvas, P.x - 128, P.y - 180, 256, 256);
      g.strokeStyle = 'rgba(150,230,255,0.28)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(P.x, P.y + 2, 32, 9, 0, 0, TAU);
      g.stroke();
      const atk = P.attackT > 0 ? 1 - P.attackT / P.attackDur : 0;
      if (P.invuln > 0 && Math.floor(P.invuln * 18) % 2 === 0) g.globalAlpha = 0.45;
      const spriteDrawn = drawPlayerSprite();
      if (!spriteDrawn) drawSu(P.x, P.y, 0.9 * depth(P.y), P.face, P.animT, {
        run: P.run, atk: P.attackT > 0 ? easeOut(Math.min(1, atk * 1.6)) : 0,
        glow: P.attackT > 0 ? 1 : 0.2
      });
      g.globalAlpha = 1;
    } else if (e.kind === 'oni') {
      drawOni(e);
    } else if (!drawEnemySprite(e)) {
      drawShade(e, G.t);
    }

    if (e.kind === 'archer' && e.state === 'wind' && !e.dead) {
      g.save();
      g.globalAlpha = 0.12 + 0.24 * (1 - e.st / 0.85);
      g.strokeStyle = '#ff5f70';
      g.lineWidth = 1;
      g.setLineDash([7, 9]);
      g.beginPath();
      g.moveTo(e.x, e.y - 42);
      g.lineTo(e.x + Math.cos(e.aim) * 520, e.y - 42 + Math.sin(e.aim) * 520);
      g.stroke();
      g.restore();
    }
  }

  // 箭矢
  for (const p of projectiles) {
    g.save();
    g.strokeStyle = 'rgba(255,210,216,0.9)';
    g.lineWidth = 2.2;
    g.shadowColor = '#ff5f70';
    g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(p.x, p.y, 2.4, 0, TAU); g.fill();
    g.restore();
  }

  // 蓄力环
  if (P.holding) {
    const k = Math.min(1, P.holdT / 0.42);
    g.save();
    g.strokeStyle = k >= 1 ? '#ffffff' : 'rgba(150,220,255,0.85)';
    g.lineWidth = 3;
    g.shadowColor = k >= 1 ? '#ffffff' : '#8fd8ff';
    g.shadowBlur = 14;
    g.beginPath();
    g.ellipse(P.x, P.y + 2, 36, 13, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    g.stroke();
    if (k >= 1) {
      g.globalAlpha = 0.35 + Math.sin(G.t * 18) * 0.25;
      g.beginPath();
      g.ellipse(P.x, P.y + 2, 45, 17, 0, 0, TAU);
      g.stroke();
    }
    g.restore();
  }

  // 斩击特效
  for (const s of slashes) {
    const k = 1 - s.life / s.max;
    g.save();
    g.translate(s.x, s.y - 40);
    g.scale(1, 0.62);
    g.rotate(s.ang);
    g.globalAlpha = (1 - k) * 0.95;
    g.strokeStyle = s.color;
    g.lineWidth = s.w * (1 - k * 0.6);
    g.lineCap = 'round';
    g.shadowColor = s.color;
    g.shadowBlur = 18;
    g.beginPath();
    g.arc(0, 0, s.r * (0.6 + k * 0.45), -s.half, s.half);
    g.stroke();
    g.restore();
  }

  // 环
  for (const r of rings) {
    const k = 1 - r.life / r.max;
    g.save();
    g.globalAlpha = (1 - k) * 0.9;
    g.strokeStyle = r.color;
    g.lineWidth = r.w * (1 - k * 0.6);
    g.beginPath();
    g.ellipse(r.x, r.y - 40, lerp(r.r, r.r1, easeOut(k)), lerp(r.r, r.r1, easeOut(k)) * 0.42, 0, 0, TAU);
    g.stroke();
    g.restore();
  }

  // 粒子
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    g.globalAlpha = a;
    if (p.type === 'spark') {
      g.strokeStyle = p.color;
      g.lineWidth = p.size;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
      g.stroke();
    } else {
      g.fillStyle = p.color;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot || 0);
      g.beginPath();
      g.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  }
  g.restore();

  // 飘字
  for (const t of texts) {
    g.save();
    g.globalAlpha = clamp(t.life / t.max, 0, 1);
    g.font = `700 ${t.size}px ${F_SANS}`;
    g.textAlign = 'center';
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 4;
    g.fillStyle = t.color;
    g.fillText(t.t, t.x, t.y);
    g.restore();
  }

  drawExec();
  g.restore();
  drawWeather();

  // 无我/名册滤镜
  if (G.ult) {
    g.save();
    const u = G.ult;
    const a = Math.min(0.45, u.t * 2);
    const grd = g.createRadialGradient(640, 420, 60, 640, 420, 680);
    grd.addColorStop(0, 'rgba(80,0,10,0)');
    grd.addColorStop(1, `rgba(90,0,14,${a})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  g.restore();

  // 屏幕特效
  if (G.flash > 0.001) {
    g.save();
    g.globalAlpha = clamp(G.flash, 0, 1);
    g.fillStyle = G.flashColor;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  // 暗角
  g.drawImage(vignetteCanvas, 0, 0, W, H);
  if (G.mode === 'play' && P.hp <= 3) {
    const a = 0.10 + Math.sin(G.t * 4) * 0.05;
    g.fillStyle = `rgba(120,0,12,${a})`;
    g.fillRect(0, 0, W, H);
  }

  if (G.mode === 'title') { drawTitle(); return; }
  if (G.mode === 'play') drawHUD();
  if (IS_TOUCH && G.mode === 'play') drawTouchUI();
  if (G.cutin) drawCutin();
  if (G.fatal) {
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, H - 44, W, 44);
    g.fillStyle = '#ff6b7a';
    g.font = '12px monospace';
    g.textAlign = 'left';
    g.fillText('ERROR: ' + G.fatal, 16, H - 18);
    g.restore();
  }
  if (G.weaponPick) drawWeapons();
  else if (G.talent) drawTalent();
  else if (G.upgrade) drawUpgrade();
  else if (G.paused) drawPause();
  if (G.mode === 'result') drawResult();
}

function drawWeather() {
  g.save();
  g.lineCap = 'round';
  for (const r of rain) {
    g.globalAlpha = 0.03 + 0.13 * r.z;
    g.strokeStyle = '#9fb7d8';
    g.lineWidth = 0.6 + r.z * 0.8;
    g.beginPath();
    g.moveTo(r.x, r.y);
    g.lineTo(r.x + 4 * r.z, r.y + r.len * r.z);
    g.stroke();
  }
  for (const m of motes) {
    g.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(G.t * 2 + m.ph));
    g.fillStyle = '#ff9aa4';
    g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill();
  }
  g.restore();
}

/* ---------------- HUD ---------------- */
function drawExec() {
  if (G.execT <= 0) return;
  const k = 1 - G.execT / 0.6;
  const a = Math.min(1, G.execT * 6) * (1 - k * 0.8);
  g.save();
  g.globalAlpha = a;
  g.translate(G.execX, G.execY - 40 - k * 40);
  const sc = 1 + k * 0.35;
  g.scale(sc, sc);
  g.textAlign = 'center';
  g.font = `700 96px ${F_SERIF}`;
  g.fillStyle = '#ffffff';
  g.shadowColor = '#ff2b44';
  g.shadowBlur = 34;
  g.fillText('斩', 0, 0);
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,90,110,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const ang = i / 8 * TAU + k * 0.4;
    g.beginPath();
    g.moveTo(Math.cos(ang) * 60, Math.sin(ang) * 60);
    g.lineTo(Math.cos(ang) * (90 + k * 40), Math.sin(ang) * (90 + k * 40));
    g.stroke();
  }
  g.restore();
}

function drawTouchUI() {
  g.save();
  const jx = joy.active ? joy.ox : 150, jy = joy.active ? joy.oy : H - (PORTRAIT ? 240 : 150);
  const baseR = 82;
  g.globalAlpha = joy.active ? 0.9 : 0.32;
  g.fillStyle = 'rgba(10,14,24,0.55)';
  g.beginPath(); g.arc(jx, jy, baseR, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(160,200,255,0.45)';
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(jx, jy, baseR, 0, TAU); g.stroke();
  const kx = joy.active ? jx + joy.kx : jx, ky = joy.active ? jy + joy.ky : jy;
  g.fillStyle = joy.active ? 'rgba(220,240,255,0.7)' : 'rgba(220,240,255,0.3)';
  g.beginPath(); g.arc(kx, ky, 36, 0, TAU); g.fill();
  g.globalAlpha = 1;
  for (const b of TBTN) {
    if (b.id === 'pause') {
      g.fillStyle = 'rgba(8,10,16,0.45)';
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(230,238,250,0.7)';
      g.fillRect(b.x - 5, b.y - 8, 3.5, 16);
      g.fillRect(b.x + 1.5, b.y - 8, 3.5, 16);
      continue;
    }
    const pressed = b.touchId != null;
    const ready = b.id === 'ult' && G.meter >= 100 && !G.ult && !G.cutin;
    g.fillStyle = pressed ? 'rgba(255,90,110,0.35)' : 'rgba(10,14,24,0.45)';
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill();
    g.strokeStyle = ready ? '#ffd36e' : (pressed ? 'rgba(255,140,150,0.9)' : 'rgba(170,200,240,0.35)');
    g.lineWidth = ready ? 2.5 : 1.5;
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke();
    g.fillStyle = ready ? '#ffd36e' : 'rgba(230,240,255,0.85)';
    g.font = `700 ${b.id === 'atk' ? 34 : 19}px ${F_SERIF}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(b.label, b.x, b.y + 1);
    g.textBaseline = 'alphabetic';
  }
  g.restore();
}

function drawHUD() {
  // 关卡进度 / Boss 血条
  g.save();
  g.textAlign = 'center';
  if (G.stage < BOSS_STAGE) {
    const st = STAGES[G.stage - 1];
    text(st.title, W / 2, PORTRAIT ? 68 : 44, { size: 12, color: 'rgba(200,215,240,0.82)', align: 'center', spacing: 5 });
    const bw = 280, bx = W / 2 - bw / 2, by = PORTRAIT ? 90 : 56;
    g.fillStyle = 'rgba(6,8,14,0.72)';
    roundRect(bx, by, bw, 4, 2); g.fill();
    g.fillStyle = '#ff5f70';
    g.shadowColor = '#ff5f70'; g.shadowBlur = 8;
    roundRect(bx, by, bw * clamp(G.stageKills / st.quota, 0, 1), 4, 2); g.fill();
    g.shadowBlur = 0;
    text(`斩 ${G.stageKills} / ${st.quota}`, W / 2, PORTRAIT ? 114 : 80, { size: 10, color: 'rgba(170,190,220,0.6)', align: 'center', spacing: 3 });
  } else {
    const boss = enemies.find(e => e.kind === 'oni' && !e.dead);
    text('鬼 武 者', W / 2, 40, { size: 13, color: '#ff9aa4', align: 'center', spacing: 7, glow: 12 });
    const bw = 520, bx = W / 2 - bw / 2, by = 52;
    g.fillStyle = 'rgba(6,8,14,0.78)';
    roundRect(bx, by, bw, 7, 3); g.fill();
    const k = boss ? clamp(boss.hp / boss.maxHp, 0, 1) : 0;
    g.fillStyle = '#ff3b4e';
    g.shadowColor = '#ff3b4e'; g.shadowBlur = 12;
    roundRect(bx, by, bw * k, 7, 3); g.fill();
    g.shadowBlur = 0;
    for (let i = 1; i < 3; i++) {
      g.fillStyle = 'rgba(10,10,16,0.9)';
      g.fillRect(bx + bw * (i / 3) - 1, by - 2, 2, 11);
    }
    // 阶段点
    const ph = boss ? boss.phase : 1;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i < ph ? '#ff5f70' : 'rgba(255,255,255,0.15)';
      g.beginPath();
      g.arc(bx + 14 + i * 16, 74, 3, 0, TAU);
      g.fill();
    }
  }
  g.restore();

  // 分数
  g.save();
  g.textAlign = 'right';
  const sy = (IS_TOUCH ? 30 : 0) + (PORTRAIT ? 40 : 0);
  text('SCORE', W - 54, 46 + sy, { size: 10, color: 'rgba(160,180,215,0.55)', align: 'right', spacing: 4 });
  text(String(G.score).padStart(7, '0'), W - 54, 80 + sy, { size: 28, family: F_NUM, weight: 700, color: '#eef2fb', align: 'right' });
  text(`BEST ${String(G.best).padStart(7, '0')}`, W - 54, 102 + sy, { size: 9, color: 'rgba(160,180,215,0.35)', align: 'right', spacing: 2 });
  const tm = Math.floor(G.runT / 60), ts = Math.floor(G.runT % 60);
  text(`${tm}:${String(ts).padStart(2, '0')}`, W - 54, 124 + sy, { size: 12, family: F_NUM, color: 'rgba(200,215,240,0.55)', align: 'right', spacing: 2 });
  g.restore();

  // 连击 + 评级
  if (G.combo > 1) {
    const rate = ratingOf(G.combo);
    const col = RATE_COLOR[rate];
    const pulse = 1 + Math.min(0.25, G.combo / 900);
    g.save();
    g.textAlign = 'right';
    g.translate(W - 54, 168 + (IS_TOUCH ? 30 : 0));
    g.scale(pulse, pulse);
    text(String(G.combo), 0, 0, { size: 44, family: F_NUM, weight: 700, color: col, align: 'right', glow: 16 });
    text('H I T S', -4, 22, { size: 11, color: 'rgba(230,240,255,0.7)', align: 'right', spacing: 3 });
    g.restore();

    g.save();
    const s = 0.8 + Math.min(0.4, G.combo / 400);
    g.translate(W - 54, 258);
    g.scale(s, s);
    text(rate, 0, 0, { size: 62, family: F_SERIF, weight: 700, color: col, align: 'right', glow: 24 });
    g.restore();
  }

  // HP
  g.save();
  text('命', 52, PORTRAIT ? 76 : 60, { size: 22, family: F_SERIF, weight: 700, color: '#eef2fb', spacing: 2 });
  for (let i = 0; i < P.maxHp; i++) {
    const x = 52 + (i % 5) * 22, y = (PORTRAIT ? 94 : 78) + Math.floor(i / 5) * 12;
    g.fillStyle = i < P.hp ? '#ff4d63' : 'rgba(255,255,255,0.08)';
    if (i < P.hp) { g.shadowColor = '#ff4d63'; g.shadowBlur = 10; }
    g.fillRect(x, y, 16, 6);
    g.shadowBlur = 0;
  }
  text(String(P.hp), 168, PORTRAIT ? 108 : 92, { size: 12, color: 'rgba(200,215,240,0.5)' });
  // 兵刃
  if (G.weaponName) text('兵 刃 · ' + G.weaponName, 40, PORTRAIT ? 132 : 112, { size: 10, color: '#bfe8ff', spacing: 2 });
  // 天赋
  if (G.talentName) {
    text('天 赋 · ' + G.talentName, 40, PORTRAIT ? 148 : 128, { size: 10, color: '#ffd98a', spacing: 2 });
  }
  // 已获得特性
  let tx = 40, ty = (G.talentName ? 150 : 130) + (PORTRAIT ? 20 : 0);
  g.textAlign = 'left';
  for (const id of G.taken) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u) continue;
    const label = u.name.replace(/\s/g, '');
    g.font = `600 10px ${F_SANS}`;
    const tw = g.measureText(label).width + 14;
    g.fillStyle = u.badge ? 'rgba(255,190,80,0.16)' : 'rgba(255,255,255,0.06)';
    roundRect(tx, ty - 9, tw, 16, 8);
    g.fill();
    g.fillStyle = u.badge ? '#ffd98a' : 'rgba(200,215,240,0.8)';
    g.fillText(label, tx + 7, ty + 2);
    tx += tw + 6;
    if (tx > 320) { tx = 40; ty += 20; }
  }
  g.restore();

  // 名册槽
  const bw = 380, bx = W / 2 - bw / 2, by = PORTRAIT ? H - 46 : 668;
  g.save();
  g.fillStyle = 'rgba(8,10,16,0.7)';
  roundRect(bx - 2, by - 2, bw + 4, 10, 5); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(bx, by, bw, 6, 3); g.fill();
  const ready = G.meter >= 100;
  // 新手引导
  if (G.tut > 0 && !G.paused && !G.upgrade && !G.cutin) {
    const step = G.tut > 3.4 ? 0 : G.tut > 1.7 ? 1 : 2;
    const msgs = IS_TOUCH
      ? ['左侧拖动 · 移动', '点「斩」攻击 · 按住自动重斩', '被攻击瞬间点「闪」· 见切']
      : ['WASD 移动', 'J 攻击 · 按住蓄力', '被攻击瞬间按 K · 见切'];
    const a = Math.min(1, (5.2 - G.tut) * 5, G.tut * 2);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(6,8,14,0.72)';
    roundRect(W / 2 - 210, PORTRAIT ? H - 420 : 596, 420, 40, 20);
    g.fill();
    g.textAlign = 'center';
    g.font = `600 14px ${F_SANS}`;
    g.letterSpacing = '2px';
    g.fillStyle = '#ffe8eb';
    g.fillText(msgs[step], W / 2, (PORTRAIT ? H - 420 : 596) + 25);
    g.restore();
  }

  // 暂停按钮（键盘端）
  if (!IS_TOUCH) {
  g.save();
  g.fillStyle = 'rgba(8,10,16,0.55)';
  roundRect(W - 60, H - 64, 34, 34, 7);
  g.fill();
  g.fillStyle = 'rgba(230,238,250,0.85)';
  if (G.paused) {
    g.beginPath();
    g.moveTo(W - 48, H - 56);
    g.lineTo(W - 48, H - 38);
    g.lineTo(W - 34, H - 47);
    g.closePath();
    g.fill();
  } else {
    g.fillRect(W - 50, H - 56, 4, 18);
    g.fillRect(W - 42, H - 56, 4, 18);
  }
  g.restore();
  }

  g.fillStyle = ready ? '#ff5f70' : '#ff9aa4';
  if (ready) { g.shadowColor = '#ff5f70'; g.shadowBlur = 16; }
  roundRect(bx, by, bw * (G.meter / 100), 6, 3); g.fill();
  g.shadowBlur = 0;
  text('名 册', bx - 14, by + 7, { size: 10, color: 'rgba(220,180,185,0.7)', align: 'right', spacing: 2 });
  if (ready) {
    g.globalAlpha = 0.7 + Math.sin(G.t * 6) * 0.3;
    text('E  —  名 册 · 万 斩', W / 2, by - 18, { size: 13, color: '#ffd0d6', align: 'center', spacing: 4, glow: 14 });
    g.globalAlpha = 1;
  }
  g.restore();

  // 操作提示
  if (G.mode === 'play' && G.t < 12 && !G.ult) {
    g.save();
    g.globalAlpha = Math.min(0.42, (12 - G.t) * 0.1);
    text(IS_TOUCH ? '左侧拖动移动    右侧斩 / 闪 / 名册' : 'WASD 移动    J 斩（按住蓄力）    K 闪身 / 见切    E 名册',
      W / 2, PORTRAIT ? H - 14 : 706, { size: 10, color: '#dfe8ff', align: 'center', spacing: 2 });
    g.restore();
  }

  // 横幅
  if (G.banner) {
    const b = G.banner;
    const a = Math.min(1, b.t * 4, (b.dur - b.t) * 2.5);
    if (a > 0) {
      g.save();
      g.globalAlpha = clamp(a, 0, 1);
      g.textAlign = 'center';
      g.font = `700 ${PORTRAIT ? 32 : 44}px ${F_SERIF}`;
      g.letterSpacing = PORTRAIT ? '8px' : '12px';
      g.fillStyle = '#f0f3fa';
      g.shadowColor = 'rgba(255,70,90,0.8)';
      g.shadowBlur = 26;
      g.fillText(b.title, W / 2 + 6, PORTRAIT ? 330 : 210);
      if (b.sub) {
        g.font = `400 12px ${F_SANS}`;
        g.letterSpacing = '4px';
        g.fillStyle = 'rgba(210,220,245,0.7)';
        g.shadowBlur = 0;
        g.fillText(b.sub, W / 2, PORTRAIT ? 358 : 238);
      }
      g.restore();
    }
  }

  // 大招演出
  if (G.ult) {
    const u = G.ult;
    g.save();
    g.globalAlpha = Math.min(1, u.t * 5) * (1 - Math.max(0, (u.t - 1.2) / 0.35));
    g.textAlign = 'center';
    g.font = `700 96px ${F_SERIF}`;
    g.letterSpacing = '22px';
    g.fillStyle = '#ffffff';
    g.shadowColor = '#ff2b44';
    g.shadowBlur = 40;
    g.fillText('名 册', W / 2 + 11, 300);
    g.font = `400 14px ${F_SANS}`;
    g.letterSpacing = '8px';
    g.fillStyle = 'rgba(255,210,215,0.85)';
    g.shadowBlur = 0;
    g.fillText('万 斩 · 皆 有 名', W / 2, 336);
    g.restore();
  }
}

/* ---------------- 标题 / 结算 ---------------- */
function drawTitlePortrait() {
  g.save();
  g.fillStyle = 'rgba(6,6,10,0.55)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  text('斩 名 录', W / 2, 196, { size: 76, family: F_SERIF, weight: 700, color: '#f2f5fc', align: 'center', spacing: 14, glow: 30, glowColor: 'rgba(255,70,90,0.45)' });
  text('T H E   N A M E   B L A D E', W / 2, 240, { size: 10, color: 'rgba(170,190,220,0.7)', align: 'center', spacing: 5 });

  const card = IMG.card.complete && IMG.card.naturalWidth ? IMG.card : IMG.su;
  if (card.complete && card.naturalWidth) {
    const cw = 340, ch = 453, x = (W - cw) / 2, y = 286;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = 34;
    g.drawImage(card, x, y, cw, ch);
    g.restore();
    text('SU  /  19  /  被逐出师门', W / 2, y + ch + 30, { size: 9, color: 'rgba(200,212,238,0.55)', align: 'center', spacing: 3 });
  }

  text('三阵。', W / 2, 836, { size: 17, family: F_SERIF, color: 'rgba(225,232,248,0.9)', align: 'center', spacing: 2 });
  text('走到鬼武者面前，然后斩了他。', W / 2, 872, { size: 15, family: F_SERIF, color: 'rgba(225,232,248,0.72)', align: 'center', spacing: 2 });

  const rows = IS_TOUCH ? [
    ['左侧', '拖动移动'],
    ['斩', '攻击 · 按住自动重斩'],
    ['闪', '闪身 · 见切慢镜'],
    ['名册', '满槽清屏']
  ] : [
    ['WASD', '移动'],
    ['J', '斩 · 四段 / 按住蓄力'],
    ['K', '闪身 · 见切慢镜'],
    ['E', '名册 · 满槽清场']
  ];
  rows.forEach((r, i) => {
    const y = 950 + i * 44;
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(W / 2 - 150, y - 16, 58, 24, 4); g.fill();
    g.strokeStyle = 'rgba(255,120,135,0.25)'; g.lineWidth = 1;
    roundRect(W / 2 - 150, y - 16, 58, 24, 4); g.stroke();
    text(r[0], W / 2 - 121, y + 1, { size: 10, color: '#ffb8c0', align: 'center', spacing: 1 });
    text(r[1], W / 2 - 78, y + 1, { size: 13, color: 'rgba(210,222,245,0.78)' });
    g.restore();
  });

  if (G.best > 0) text('BEST  ' + String(G.best).padStart(7, '0'), W / 2, 1160, { size: 10, color: 'rgba(200,212,238,0.5)', align: 'center', spacing: 3 });
  text(IS_TOUCH ? '点 击 屏 幕 开 始' : '单 击  或  按 任 意 键  开 始', W / 2, 1214, { size: 13, color: '#ffe8eb', align: 'center', spacing: 6, glow: 12 });
  g.restore();
}

function drawTitle() {
  if (PORTRAIT) { drawTitlePortrait(); return; }
  const t = G.t;
  // 主角立绘卡
  const card = IMG.card.complete && IMG.card.naturalWidth ? IMG.card : IMG.su;
  if (card.complete && card.naturalWidth) {
    const cw = 392, ch = 523;
    const x = 808, y = 100;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.65)';
    g.shadowBlur = 30;
    g.drawImage(card, x, y, cw, ch);
    g.restore();
    text('SU  /  19  /  被逐出师门', x + cw, y + ch + 30, { size: 10, color: 'rgba(200,212,238,0.55)', align: 'right', spacing: 3 });
  }

  // 左侧暗角
  const grad = g.createLinearGradient(0, 0, 820, 0);
  grad.addColorStop(0, 'rgba(4,5,10,0.94)');
  grad.addColorStop(0.6, 'rgba(4,5,10,0.6)');
  grad.addColorStop(1, 'rgba(4,5,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 900, H);

  g.fillStyle = '#ff4d63';
  g.shadowColor = '#ff4d63'; g.shadowBlur = 16;
  g.fillRect(120, 176, 2, 52);
  g.shadowBlur = 0;

  text('T H E   N A M E   B L A D E', 148, 194, { size: 11, color: 'rgba(170,190,220,0.7)', spacing: 6 });
  text('斩名录', 144, 300, { size: 100, family: F_SERIF, weight: 700, color: '#f2f5fc', spacing: 12, glow: 30, glowColor: 'rgba(255,70,90,0.45)' });
  text('溯 · 十 九 · 被 逐 出 师 门 的 剑 客', 150, 370, { size: 13, color: 'rgba(200,215,240,0.8)', spacing: 3 });

  text('三阵。', 150, 420, { size: 18, family: F_SERIF, color: 'rgba(225,232,248,0.85)', spacing: 3 });
  text('走到鬼武者面前，然后斩了他。', 150, 450, { size: 18, family: F_SERIF, color: 'rgba(225,232,248,0.85)', spacing: 3 });

  const rows = IS_TOUCH ? [
    ['左侧', '拖动移动'],
    ['斩', '攻击 · 按住自动重斩'],
    ['闪', '闪身 · 见切慢镜'],
    ['名册', '满槽清屏']
  ] : [
    ['WASD', '移动'],
    ['J', '斩 · 四段 / 按住蓄力'],
    ['K', '闪身 · 见切慢镜'],
    ['E', '名册 · 满槽清场']
  ];
  rows.forEach((r, i) => {
    const y = 520 + i * 32;
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(150, y - 16, 58, 22, 4); g.fill();
    g.strokeStyle = 'rgba(255,120,135,0.25)'; g.lineWidth = 1;
    roundRect(150, y - 16, 58, 22, 4); g.stroke();
    text(r[0], 179, y, { size: 10, color: '#ffb8c0', align: 'center', spacing: 1 });
    text(r[1], 224, y, { size: 13, color: 'rgba(210,222,245,0.78)' });
    g.restore();
  });

  if (IS_TOUCH) text('iPhone：分享 → 添加到主屏幕，可全屏', 150, 706, { size: 10, color: 'rgba(200,212,238,0.45)', spacing: 2 });
  if (G.best > 0) text('BEST  ' + String(G.best).padStart(7, '0'), 150, 640, { size: 10, color: 'rgba(200,212,238,0.5)', spacing: 3 });
  const pulse = 0.72 + Math.sin(t * 3.2) * 0.28;
  g.save();
  g.globalAlpha = pulse;
  text(IS_TOUCH ? '点 击 屏 幕 开 始' : '单 击  或  按 任 意 键  开 始', 150, 680, { size: 13, color: '#ffe8eb', spacing: 6, glow: 12 });
  g.restore();
}

function drawCutin() {
  const c = G.cutin;
  if (!c) return;
  const k = clamp(c.t / c.dur, 0, 1);
  const e = easeOut(Math.min(1, k * 2.2));
  const a = Math.min(1, k * 5) * (1 - Math.max(0, (k - 0.9) / 0.1));
  const bandH = 470;
  const by = (H - bandH) / 2;
  g.save();
  g.globalAlpha = a * 0.62;
  g.fillStyle = '#050307';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = a;

  // 图像只占一条横向长带
  g.save();
  g.beginPath();
  g.rect(0, by, W, bandH);
  g.clip();
  const iw = W * (1.02 + 0.02 * (1 - e));
  const ih = iw * (720 / 1280);
  const ix = (1 - e) * 90;
  const iy = by - (ih - bandH) * 0.52;
  g.drawImage(IMG.cutin, ix, iy, iw, ih);
  g.restore();

  // 上下红线与黑边
  g.fillStyle = 'rgba(255,59,78,0.85)';
  g.fillRect(0, by - 2, W, 2);
  g.fillRect(0, by + bandH, W, 2);
  g.fillStyle = 'rgba(4,2,5,0.82)';
  g.fillRect(0, 0, W, by);
  g.fillRect(0, by + bandH, W, H - by - bandH);

  // 左侧压暗 + 文案
  const grad = g.createLinearGradient(0, 0, 620, 0);
  grad.addColorStop(0, 'rgba(6,3,6,0.95)');
  grad.addColorStop(0.55, 'rgba(6,3,6,0.6)');
  grad.addColorStop(1, 'rgba(6,3,6,0)');
  g.fillStyle = grad;
  g.fillRect(0, by, 620, bandH);

  g.textAlign = 'left';
  g.font = `700 56px ${F_SERIF}`;
  g.letterSpacing = '8px';
  g.fillStyle = '#f7f3ef';
  g.shadowColor = '#ff3b4e';
  g.shadowBlur = 22;
  g.fillText('溯', 84, by + bandH * 0.52);
  g.font = `700 17px ${F_SANS}`;
  g.letterSpacing = '8px';
  g.fillStyle = '#ff8a96';
  g.shadowBlur = 10;
  g.fillText('名 册 · 万 斩', 88, by + bandH * 0.52 + 44);
  g.font = `400 10px ${F_SANS}`;
  g.letterSpacing = '4px';
  g.fillStyle = 'rgba(240,235,240,0.55)';
  g.shadowBlur = 0;
  g.fillText('T H E   N A M E   B L A D E', 88, by + bandH * 0.52 + 70);
  g.restore();
}

function cardRects() {
  if (PORTRAIT) {
    const cw = 470, ch = 150, x = (W - cw) / 2;
    return [0, 1, 2].map(i => ({ x, y: 300 + i * 170, w: cw, h: ch }));
  }
  const cw = 300, ch = 260, gap = 32, x0 = (W - (cw * 3 + gap * 2)) / 2;
  return [0, 1, 2].map(i => ({ x: x0 + i * (cw + gap), y: 260, w: cw, h: ch }));
}

function drawCards(title, sub, cards) {
  g.save();
  g.fillStyle = 'rgba(4,5,10,0.86)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.font = `700 ${PORTRAIT ? 30 : 34}px ${F_SERIF}`;
  g.letterSpacing = '10px';
  g.fillStyle = '#f2f5fc';
  g.shadowColor = 'rgba(120,180,255,0.6)';
  g.shadowBlur = 20;
  g.fillText(title, W / 2 + 5, PORTRAIT ? 130 : 150);
  g.shadowBlur = 0;
  g.font = `400 11px ${F_SANS}`;
  g.letterSpacing = '5px';
  g.fillStyle = 'rgba(200,212,238,0.55)';
  g.fillText(sub, W / 2, PORTRAIT ? 162 : 182);

  const rects = cardRects();
  cards.forEach((c, i) => {
    const r = rects[i];
    const isSyn = !!c.badge;
    g.save();
    g.fillStyle = 'rgba(18,20,32,0.94)';
    roundRect(r.x, r.y, r.w, r.h, 8); g.fill();
    g.strokeStyle = isSyn ? 'rgba(255,200,90,0.9)' : (i === 0 ? 'rgba(255,90,105,0.8)' : 'rgba(150,180,230,0.25)');
    g.lineWidth = isSyn ? 2 : (i === 0 ? 2 : 1);
    roundRect(r.x, r.y, r.w, r.h, 8); g.stroke();

    if (PORTRAIT) {
      g.textAlign = 'left';
      if (isSyn) {
        g.font = `700 10px ${F_SANS}`;
        g.letterSpacing = '3px';
        g.fillStyle = '#ffc25a';
        g.fillText('组 合', r.x + 28, r.y + 30);
      }
      g.font = `700 24px ${F_SERIF}`;
      g.letterSpacing = '4px';
      g.fillStyle = isSyn ? '#ffd98a' : '#f0f3fa';
      g.fillText(c.name, r.x + 28, r.y + 70);
      if (c.type) {
        g.font = `600 11px ${F_SANS}`;
        g.letterSpacing = '2px';
        g.fillStyle = 'rgba(160,220,255,0.85)';
        g.fillText(c.type, r.x + 28, r.y + 96);
      }
      g.font = `400 13px ${F_SANS}`;
      g.letterSpacing = '1px';
      g.fillStyle = 'rgba(200,215,240,0.75)';
      g.fillText(c.desc, r.x + 28, r.y + 124);
      g.textAlign = 'right';
      g.font = `700 18px ${F_NUM}`;
      g.fillStyle = 'rgba(255,140,150,0.9)';
      g.fillText('[' + (i + 1) + ']', r.x + r.w - 26, r.y + 74);
    } else {
      g.textAlign = 'center';
      if (isSyn) {
        g.font = `700 11px ${F_SANS}`;
        g.letterSpacing = '4px';
        g.fillStyle = '#ffc25a';
        g.fillText('组 合', r.x + r.w / 2, r.y + 46);
      }
      g.font = `700 26px ${F_SERIF}`;
      g.letterSpacing = '6px';
      g.fillStyle = isSyn ? '#ffd98a' : '#f0f3fa';
      g.fillText(c.name, r.x + r.w / 2, r.y + 86);
      if (c.type) {
        g.font = `600 11px ${F_SANS}`;
        g.letterSpacing = '3px';
        g.fillStyle = 'rgba(160,220,255,0.85)';
        g.fillText(c.type, r.x + r.w / 2, r.y + 116);
      }
      g.font = `400 14px ${F_SANS}`;
      g.letterSpacing = '2px';
      g.fillStyle = 'rgba(200,215,240,0.75)';
      g.fillText(c.desc, r.x + r.w / 2, r.y + 152);
      g.font = `700 12px ${F_NUM}`;
      g.letterSpacing = '2px';
      g.fillStyle = 'rgba(255,140,150,0.9)';
      g.fillText('[' + (i + 1) + ']', r.x + r.w / 2, r.y + 208);
    }
    g.restore();
  });
  g.restore();
}

function pauseRowRect(i) {
  return { x: W / 2 - 170, y: H / 2 + 18 + i * 56, w: 340, h: 44 };
}
function pauseAction(i) {
  if (i === 0) G.paused = false;
  else if (i === 1) { G.paused = false; startGame(); }
  else if (i === 2) { muted = !muted; if (MASTER) MASTER.gain.value = muted ? 0 : 0.5; }
  else if (i === 3) {
    G.paused = false; G.mode = 'title'; G.ult = null; G.cutin = null; G.tut = 0;
    enemies.length = 0; projectiles.length = 0; waves.length = 0;
  }
}
function drawWeapons() {
  drawCards('选 武 器', '选一把开局兵刃   ·   按 1 / 2 / 3', G.weaponPick.opts);
}

function drawUpgrade() {
  drawCards('斩 获', '选 一 个 强 化   ·   按 1 / 2 / 3', G.upgrade.opts);
}

function drawTalent() {
  drawCards('择 天 赋', '选 一 个 开 局 天 赋   ·   按 1 / 2 / 3', G.talent.opts);
}

function drawPause() {
  g.save();
  g.fillStyle = 'rgba(4,5,10,0.76)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.font = `700 40px ${F_SERIF}`;
  g.letterSpacing = '14px';
  g.fillStyle = '#f0f3fa';
  g.shadowColor = 'rgba(120,180,255,0.7)';
  g.shadowBlur = 22;
  g.fillText('暂 停', W / 2 + 7, H / 2 - 46);
  g.shadowBlur = 0;
  const labels = ['继 续', '重 新 开 始', muted ? '音 效 ： 关' : '音 效 ： 开', '返 回 标 题'];
  for (let i = 0; i < labels.length; i++) {
    const r = pauseRowRect(i);
    g.fillStyle = i === 0 ? 'rgba(255,90,110,0.16)' : 'rgba(255,255,255,0.05)';
    roundRect(r.x, r.y, r.w, r.h, 8); g.fill();
    g.strokeStyle = i === 0 ? 'rgba(255,110,130,0.7)' : 'rgba(160,190,230,0.22)';
    g.lineWidth = 1;
    roundRect(r.x, r.y, r.w, r.h, 8); g.stroke();
    g.font = `600 15px ${F_SANS}`;
    g.letterSpacing = '6px';
    g.fillStyle = i === 0 ? '#ffe8eb' : 'rgba(220,230,250,0.82)';
    g.fillText(labels[i], W / 2, r.y + 29);
  }
  g.font = `400 10px ${F_SANS}`;
  g.letterSpacing = '4px';
  g.fillStyle = 'rgba(200,212,238,0.45)';
  g.fillText('ESC 继续   ·   M 静音', W / 2, H / 2 + 268);
  g.restore();
}

function shareRect() {
  return { x: W / 2 - 130, y: 646, w: 260, h: 38 };
}

function roundRectOn(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildShareCanvas() {
  const cw = 1080, ch = 1440;
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  const SERIF = '"Songti SC", "Noto Serif SC", serif';
  const SANS = '"PingFang SC", "Hiragino Sans GB", sans-serif';

  const bg = x.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, '#0d0a12');
  bg.addColorStop(0.5, '#1c1220');
  bg.addColorStop(1, '#08060a');
  x.fillStyle = bg;
  x.fillRect(0, 0, cw, ch);
  x.strokeStyle = 'rgba(255,59,78,0.5)';
  x.lineWidth = 8;
  x.beginPath(); x.moveTo(-80, 800); x.lineTo(cw + 80, 440); x.stroke();

  if (IMG.cutin.complete && IMG.cutin.naturalWidth) {
    const bandY = 250, bandH = 610;
    const k = Math.max(cw / IMG.cutin.naturalWidth, bandH / IMG.cutin.naturalHeight);
    const dw = IMG.cutin.naturalWidth * k, dh = IMG.cutin.naturalHeight * k;
    x.save();
    x.beginPath(); x.rect(0, bandY, cw, bandH); x.clip();
    x.drawImage(IMG.cutin, (cw - dw) / 2, bandY + (bandH - dh) / 2 - 40, dw, dh);
    x.restore();
    const f = x.createLinearGradient(0, bandY + bandH - 190, 0, bandY + bandH);
    f.addColorStop(0, 'rgba(8,6,10,0)');
    f.addColorStop(1, 'rgba(8,6,10,0.94)');
    x.fillStyle = f;
    x.fillRect(0, bandY + bandH - 190, cw, 190);
  }

  x.textAlign = 'left';
  x.font = `700 96px ${SERIF}`;
  x.fillStyle = '#f7f3ef';
  x.shadowColor = '#ff3b4e';
  x.shadowBlur = 30;
  x.fillText('斩 名 录', 72, 178);
  x.shadowBlur = 0;
  x.font = `400 20px ${SANS}`;
  x.fillStyle = 'rgba(255,180,190,0.75)';
  x.fillText('T H E   N A M E   B L A D E', 78, 216);

  const rank = G.rank || calcRank();
  x.textAlign = 'right';
  x.font = `700 150px ${SERIF}`;
  x.fillStyle = RATE_COLOR[rank] || '#fff';
  x.shadowColor = RATE_COLOR[rank] || '#fff';
  x.shadowBlur = 40;
  x.fillText(rank, cw - 72, 200);
  x.shadowBlur = 0;

  const mm = Math.floor(G.runT / 60), ss = Math.floor(G.runT % 60);
  const stats = [['斩 敌', G.kills], ['最高连击', G.maxCombo], ['用 时', `${mm}:${String(ss).padStart(2, '0')}`], ['总 分', G.score]];
  stats.forEach((st, i) => {
    const y = 952 + i * 54;
    x.textAlign = 'left';
    x.font = `400 24px ${SANS}`;
    x.fillStyle = 'rgba(200,210,235,0.6)';
    x.fillText(st[0], 90, y);
    x.textAlign = 'right';
    x.font = `700 42px ${SANS}`;
    x.fillStyle = '#f2f5fc';
    x.fillText(String(st[1]), cw - 90, y);
  });

  const build = G.resultBuild || [];
  if (build.length) {
    let tx = 90, ty = 1200;
    for (const id of build) {
      const u = UPGRADES.find(v => v.id === id);
      if (!u) continue;
      const label = u.name.replace(/\s/g, '');
      x.font = `600 22px ${SANS}`;
      const tw = x.measureText(label).width + 34;
      x.fillStyle = u.badge ? 'rgba(255,190,80,0.18)' : 'rgba(255,255,255,0.08)';
      roundRectOn(x, tx, ty - 28, tw, 42, 21);
      x.fill();
      x.fillStyle = u.badge ? '#ffd98a' : 'rgba(220,230,250,0.85)';
      x.fillText(label, tx + 17, ty);
      tx += tw + 12;
      if (tx > cw - 280) { tx = 90; ty += 58; }
    }
  }

  x.textAlign = 'center';
  x.font = `400 20px ${SANS}`;
  x.fillStyle = 'rgba(200,210,235,0.4)';
  x.fillText('三 阵 斩 将   ·   溯', cw / 2, 1362);

  return c;
}

function saveShareCard() {
  const c = buildShareCanvas();
  try {
    c.toBlob(async (b) => {
    const file = new File([b], 'tide-share.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '斩名录' }); return; } catch (e) {}
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'tide-share.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, 'image/png');
  } catch (e) {
    G.shareErr = '当前环境无法保存图片（请用网页版打开）';
    setTimeout(() => { G.shareErr = null; }, 2500);
  }
}

function drawResult() {
  const a = clamp(G.endT * 1.5, 0, 1);
  g.save();
  g.globalAlpha = a * 0.92;
  g.fillStyle = '#05040a';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = a;
  if (PORTRAIT) g.translate(0, (H - 720) / 2);
  g.textAlign = 'center';

  const win = G.victory;
  g.font = `700 46px ${F_SERIF}`;
  g.letterSpacing = '14px';
  g.fillStyle = '#f0eef5';
  g.shadowColor = 'rgba(255,60,80,0.8)';
  g.shadowBlur = 26;
  g.fillText(win ? '斩 尽' : '力 竭', W / 2 + 7, 176);

  g.shadowBlur = 0;
  g.font = `400 11px ${F_SANS}`;
  g.letterSpacing = '6px';
  g.fillStyle = 'rgba(200,210,235,0.55)';
  g.fillText(win ? 'VICTORY' : 'YOU FELL', W / 2, 206);

  // 评级
  const rank = G.rank || calcRank();
  g.font = `700 132px ${F_SERIF}`;
  g.letterSpacing = '10px';
  g.fillStyle = RATE_COLOR[rank];
  g.shadowColor = RATE_COLOR[rank];
  g.shadowBlur = 40;
  g.fillText(rank, W / 2, 360);
  g.shadowBlur = 0;

  g.font = `400 12px ${F_SANS}`;
  g.letterSpacing = '5px';
  g.fillStyle = 'rgba(200,210,235,0.55)';
  g.fillText('R A N K', W / 2, 392);

  // 数据
  const mm = Math.floor(G.runT / 60), ss = Math.floor(G.runT % 60);
  const stats = [
    ['用 时', `${mm}:${String(ss).padStart(2, '0')}`],
    ['斩 敌', G.kills],
    ['最高连击', G.maxCombo],
    ['总分', G.score]
  ];
  stats.forEach((s, i) => {
    const y = 456 + i * 40;
    g.font = `400 12px ${F_SANS}`;
    g.letterSpacing = '4px';
    g.fillStyle = 'rgba(190,205,230,0.55)';
    g.fillText(s[0], W / 2 - 140, y);
    g.textAlign = 'right';
    g.font = `700 26px ${F_NUM}`;
    g.letterSpacing = '2px';
    g.fillStyle = '#eef2fb';
    g.fillText(String(s[1]), W / 2 + 140, y);
    g.textAlign = 'center';
  });

  // 分享卡按钮
  const sr = shareRect();
  g.globalAlpha = a;
  g.fillStyle = 'rgba(255,90,110,0.16)';
  roundRect(sr.x, sr.y, sr.w, sr.h, 20); g.fill();
  g.strokeStyle = 'rgba(255,120,140,0.7)';
  g.lineWidth = 1.5;
  roundRect(sr.x, sr.y, sr.w, sr.h, 20); g.stroke();
  g.font = `600 13px ${F_SANS}`;
  g.letterSpacing = '4px';
  g.fillStyle = '#ffe8eb';
  g.fillText('保 存 分 享 图', W / 2, sr.y + 26);

  const pulse = 0.8 + Math.sin(G.endT * 3) * 0.2;
  g.globalAlpha = a * pulse;
  g.font = `400 11px ${F_SANS}`;
  g.letterSpacing = '5px';
  g.fillStyle = 'rgba(232,242,255,0.7)';
  g.fillText('R 再来一次   ·   S 保存', W / 2, 706);
  g.restore();
}

/* ---------------- 主循环 ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  try {
    update(dt);
    render();
  } catch (err) {
    console.error(err);
    G.fatal = String(err && err.message || err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const rotBtn = document.getElementById('rot-btn');
if (rotBtn) {
  rotBtn.addEventListener('click', async () => {
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch (e) {}
    try {
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (e) {}
  });
}

const qs = new URLSearchParams(location.search);
if (qs.get('skip') === '1') setTimeout(() => startGame(), 80);

BOOTED = true;
window.__tide = { G, P, enemies, projectiles, startGame, spawnEnemy, startStage, attack, dash, tryUlt, hurtPlayer, killEnemy, hitEnemy, endGame, joy, buildShareCanvas };
})();
