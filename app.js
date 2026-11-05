const viewer = document.getElementById('viewer');
const carName = document.getElementById('car-name');
const carList = document.getElementById('car-list');
const listPanel = document.getElementById('list-panel');
const loadFill = document.getElementById('load-fill');
const colorBar = document.getElementById('color-bar');
const introBtn = document.getElementById('btn-intro');
const goBtn = document.getElementById('btn-go');
const hornBtn = document.getElementById('btn-horn');

// 아이가 고를 수 있는 색 (버튼 순서대로)
const PALETTE = [
  { id: 'red',    name: '빨강', rgb: [0.80, 0.05, 0.05] },
  { id: 'orange', name: '주황', rgb: [0.95, 0.40, 0.05] },
  { id: 'yellow', name: '노랑', rgb: [0.95, 0.80, 0.10] },
  { id: 'green',  name: '초록', rgb: [0.10, 0.55, 0.20] },
  { id: 'blue',   name: '파랑', rgb: [0.10, 0.30, 0.85] },
  { id: 'sky',    name: '하늘', rgb: [0.45, 0.75, 0.95] },
  { id: 'purple', name: '보라', rgb: [0.45, 0.15, 0.70] },
  { id: 'pink',   name: '분홍', rgb: [0.95, 0.50, 0.70] },
  { id: 'brown',  name: '갈색', rgb: [0.32, 0.17, 0.08] },
  { id: 'white',  name: '하양', rgb: [0.92, 0.92, 0.92] },
  { id: 'silver', name: '은색', rgb: [0.55, 0.57, 0.60] },
  { id: 'black',  name: '검정', rgb: [0.04, 0.04, 0.05] },
];

let cars = [];
let index = 0;
let paintMaterials = [];   // 지금 보이는 차의 도장(페인트) 재질들
let originalColors = [];   // 각 재질의 원래 색 (원래 색으로 되돌리기용)

const savedIndex = Number(localStorage.getItem('carIndex') || 0);

async function init() {
  const res = await fetch('models.json');
  cars = (await res.json()).cars;
  index = savedIndex < cars.length ? savedIndex : 0;
  buildList();
  buildColorBar();
  show(index);
}

function show(i, speak = false) {
  stopAllSound();
  index = (i + cars.length) % cars.length;
  const car = cars[index];
  if (speak) speakIntro();
  carName.textContent = `${car.emoji} ${car.name}`;
  paintMaterials = [];
  colorBar.classList.toggle('hidden', !(car.paint && car.paint.length));
  viewer.src = car.file;
  localStorage.setItem('carIndex', String(index));
  for (const [j, btn] of [...carList.children].entries()) {
    btn.firstChild.classList.toggle('current', j === index);
  }
}

function buildList() {
  carList.innerHTML = '';
  cars.forEach((car, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.innerHTML = `<span class="emoji">${car.emoji}</span>${car.name}`;
    btn.addEventListener('click', () => {
      show(i, true);
      listPanel.classList.add('hidden');
    });
    li.appendChild(btn);
    carList.appendChild(li);
  });
}

// ---- 색 바꾸기 -------------------------------------------------------------

function buildColorBar() {
  colorBar.innerHTML = '';
  const reset = document.createElement('button');
  reset.className = 'swatch reset';
  reset.textContent = '원래 색';
  reset.dataset.color = '';
  reset.addEventListener('click', () => applyColor(''));
  colorBar.appendChild(reset);
  for (const c of PALETTE) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.color = c.id;
    b.setAttribute('aria-label', c.name);
    b.style.background = `rgb(${c.rgb.map((v) => Math.round(Math.sqrt(v) * 255)).join(',')})`;
    b.addEventListener('click', () => applyColor(c.id));
    colorBar.appendChild(b);
  }
}

// 모델이 다 불러와지면: 도장 재질 찾기 → 원래 색 기억 → 저장된 색(있으면) 입히기
viewer.addEventListener('load', () => {
  const car = cars[index];
  const names = car.paint || [];
  paintMaterials = viewer.model.materials.filter((m) => names.includes(m.name));
  originalColors = paintMaterials.map((m) => {
    const base = car.color ? [...car.color, 1] : [...m.pbrMetallicRoughness.baseColorFactor];
    return base;
  });
  applyColor(localStorage.getItem(`color:${car.id}`) || '', false);
});

function applyColor(colorId, save = true) {
  const car = cars[index];
  const c = PALETTE.find((p) => p.id === colorId);
  paintMaterials.forEach((m, i) => {
    const rgb = c ? c.rgb : originalColors[i];
    m.pbrMetallicRoughness.setBaseColorFactor([rgb[0], rgb[1], rgb[2], originalColors[i][3] ?? 1]);
  });
  for (const b of colorBar.children) b.classList.toggle('current', b.dataset.color === (c ? c.id : ''));
  if (save) {
    if (c) localStorage.setItem(`color:${car.id}`, c.id);
    else localStorage.removeItem(`color:${car.id}`);
  }
}

// ---- 소리 (세이펜처럼: 설명 / 출발 / 빵빵) ------------------------------------
// 목소리: sounds/<id>-intro.*, sounds/<id>-go.* (record.html에서 직접 녹음해 저장한 파일. webm → m4a → mp3 순으로 찾음)
// 파일이 하나도 없으면 브라우저 음성합성(speechSynthesis)이 models.json의 lines를 대신 읽어줌.
// 엔진 소리와 경적은 Web Audio로 그 자리에서 합성. 차마다 engine 설정(models.json)으로 음이 달라짐.

const SOUND_EXTS = ['webm', 'm4a', 'mp3'];
let audioCtx = null;
let voice = null;          // 지금 재생 중인 <audio>
let engineStop = null;     // 엔진 소리 끄는 함수

function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function stopAllSound() {
  if (voice) { voice.pause(); voice = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (engineStop) { engineStop(); engineStop = null; }
  for (const b of [introBtn, goBtn, hornBtn]) b.classList.remove('playing');
}

function playVoice(kind, btn) {
  const car = cars[index];
  return new Promise((resolve) => {
    const done = () => { btn.classList.remove('playing'); resolve(); };
    btn.classList.add('playing');
    const fallback = () => {
      const text = (car.lines && car.lines[kind]) || car.name;
      if (!window.speechSynthesis) return done();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = 0.95; u.pitch = 1.1;
      u.onend = done; u.onerror = done;
      speechSynthesis.speak(u);
    };
    const tryExt = (i) => {
      if (i >= SOUND_EXTS.length) return fallback();
      const a = new Audio(`sounds/${car.id}-${kind}.${SOUND_EXTS[i]}`);
      voice = a;
      a.addEventListener('ended', done);
      a.addEventListener('error', () => { if (voice === a) tryExt(i + 1); });
      a.play().catch(() => { if (voice === a) tryExt(i + 1); });
    };
    tryExt(0);
  });
}

// 엔진 소리: 톱니파 두 개 + 낮은 웅웅거림. rpm을 올렸다 내리면 "부아앙" 느낌
function startEngine(cfg) {
  const c = ctx();
  const base = (cfg && cfg.hz) || 55;        // 기본음 (큰 엔진일수록 낮게)
  const rough = (cfg && cfg.rough) || 0.5;   // 거친 정도
  const master = c.createGain(); master.gain.value = 0; master.connect(c.destination);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.connect(master);
  const oscs = [c.createOscillator(), c.createOscillator(), c.createOscillator()];
  oscs[0].type = 'sawtooth'; oscs[1].type = 'square'; oscs[2].type = 'triangle';
  oscs.forEach((o, i) => { const g = c.createGain(); g.gain.value = [0.5, 0.25 * rough, 0.6][i]; o.connect(g); g.connect(lp); });
  const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 18;
  const lfoGain = c.createGain(); lfoGain.gain.value = base * 0.08; lfo.connect(lfoGain);
  for (const o of oscs) lfoGain.connect(o.frequency);
  const t = c.currentTime;
  const setRpm = (mult, at) => {
    oscs[0].frequency.setTargetAtTime(base * mult, at, 0.15);
    oscs[1].frequency.setTargetAtTime(base * mult * 1.5, at, 0.15);
    oscs[2].frequency.setTargetAtTime(base * mult * 0.5, at, 0.15);
    lp.frequency.setTargetAtTime(400 + 900 * mult, at, 0.15);
  };
  setRpm(1, t);
  master.gain.setTargetAtTime(0.35, t, 0.1);
  for (const o of [...oscs, lfo]) o.start(t);
  // 시동 → 부릉부릉 → 부아앙 → 천천히
  setRpm(1.3, t + 0.6); setRpm(1.0, t + 1.1); setRpm(1.4, t + 1.5); setRpm(1.0, t + 2.0);
  setRpm(2.6, t + 3.0); setRpm(3.2, t + 4.2); setRpm(1.2, t + 5.5);
  return () => {
    const now = c.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0, now, 0.25);
    for (const o of [...oscs, lfo]) { try { o.stop(now + 1.2); } catch (e) {} }
  };
}

// 경적: 두 음을 같이 (차마다 음높이 조금 다르게)
function honk(cfg) {
  const c = ctx();
  const f = (cfg && cfg.horn) || 420;
  const t = c.currentTime;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(c.destination);
  const master = c.createGain(); master.gain.value = 0; master.connect(lp);
  const oscs = [f, f * 1.26].map((hz) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; const g = c.createGain(); g.gain.value = 0.25; o.connect(g); g.connect(master); return o; });
  const beep = (at, len) => { master.gain.setTargetAtTime(0.5, at, 0.02); master.gain.setTargetAtTime(0, at + len, 0.05); };
  beep(t, 0.22); beep(t + 0.35, 0.45);   // 빵, 빠앙
  for (const o of oscs) { o.start(t); o.stop(t + 1.2); }
  hornBtn.classList.add('playing');
  setTimeout(() => hornBtn.classList.remove('playing'), 900);
}

async function speakIntro() {
  stopAllSound();
  await playVoice('intro', introBtn);
}

async function goGo() {
  stopAllSound();
  const car = cars[index];
  engineStop = startEngine(car.engine);
  viewer.autoRotate = true;
  rotateBtn.classList.add('on');
  await new Promise((r) => setTimeout(r, 500));
  await playVoice('go', goBtn);
  await new Promise((r) => setTimeout(r, 2500));
  if (engineStop) { engineStop(); engineStop = null; }
}

introBtn.addEventListener('click', speakIntro);
goBtn.addEventListener('click', goGo);
hornBtn.addEventListener('click', () => honk(cars[index].engine));

// ---- 버튼들 ---------------------------------------------------------------

document.getElementById('btn-prev').addEventListener('click', () => show(index - 1, true));
document.getElementById('btn-next').addEventListener('click', () => show(index + 1, true));

document.getElementById('btn-reset').addEventListener('click', () => {
  viewer.cameraOrbit = 'auto auto auto';
  viewer.fieldOfView = 'auto';
  viewer.cameraTarget = 'auto auto auto';
});

const rotateBtn = document.getElementById('btn-rotate');
rotateBtn.addEventListener('click', () => {
  viewer.autoRotate = !viewer.autoRotate;
  rotateBtn.classList.toggle('on', viewer.autoRotate);
});

document.getElementById('btn-list').addEventListener('click', () => listPanel.classList.remove('hidden'));
document.getElementById('btn-close').addEventListener('click', () => listPanel.classList.add('hidden'));

viewer.addEventListener('progress', (e) => {
  const p = Math.round(e.detail.totalProgress * 100);
  loadFill.style.width = p + '%';
  loadFill.parentElement.style.opacity = p >= 100 ? '0' : '1';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
