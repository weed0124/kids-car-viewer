const viewer = document.getElementById('viewer');
const carName = document.getElementById('car-name');
const carList = document.getElementById('car-list');
const listPanel = document.getElementById('list-panel');
const loadFill = document.getElementById('load-fill');
const colorBar = document.getElementById('color-bar');
const introBtn = document.getElementById('btn-intro');

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
const originalOf = new WeakMap(); // 재질 → 처음 봤을 때의 원래 색 (원래 색으로 되돌리기용)

const savedIndex = Number(localStorage.getItem('carIndex') || 0);

async function init() {
  const res = await fetch('models.json');
  cars = (await res.json()).cars;
  index = savedIndex < cars.length ? savedIndex : 0;
  buildList();
  buildColorBar();
  show(index);
  findRecordings();
}

function show(i, speak = false) {
  stopAllSound();
  index = (i + cars.length) % cars.length;
  const car = cars[index];
  if (speak) speakIntro();
  carName.textContent = `${car.emoji} ${car.name}`;
  colorBar.classList.toggle('hidden', !(car.paint && car.paint.length));
  // 같은 파일을 다시 넣으면 model-viewer가 다시 불러오지 않으므로(load 이벤트 없음) 그대로 둔다
  if (viewer.src !== car.file) viewer.src = car.file;
  else markColor(localStorage.getItem(`color:${car.id}`) || '');
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

// 모델이 다 불러와지면 저장된 색(있으면) 입히기.
// 빠르게 넘기다 이전 차의 load가 늦게 도착하면 무시한다.
viewer.addEventListener('load', () => {
  loadFill.parentElement.style.opacity = '0';
  const car = cars[index];
  if (!car || viewer.src !== car.file) return;
  applyColor(localStorage.getItem(`color:${car.id}`) || '', false);
});

// 지금 화면에 있는 모델에서 이 차의 도장 재질을 매번 새로 찾는다
function currentPaintMaterials(car) {
  const names = car.paint || [];
  if (!names.length || !viewer.model || viewer.src !== car.file) return [];
  return viewer.model.materials.filter((m) => names.includes(m.name));
}

function originalColor(m, car) {
  if (car.color) return [...car.color, 1];
  if (!originalOf.has(m)) originalOf.set(m, [...m.pbrMetallicRoughness.baseColorFactor]);
  return originalOf.get(m);
}

function markColor(colorId) {
  for (const b of colorBar.children) b.classList.toggle('current', b.dataset.color === colorId);
}

function applyColor(colorId, save = true) {
  const car = cars[index];
  if (!car) return;
  const c = PALETTE.find((p) => p.id === colorId);
  for (const m of currentPaintMaterials(car)) {
    const orig = originalColor(m, car);
    const rgb = c ? c.rgb : orig;
    m.pbrMetallicRoughness.setBaseColorFactor([rgb[0], rgb[1], rgb[2], orig[3] ?? 1]);
  }
  markColor(c ? c.id : '');
  if (save) {
    if (c) localStorage.setItem(`color:${car.id}`, c.id);
    else localStorage.removeItem(`color:${car.id}`);
  }
}

// ---- 소리 (세이펜처럼: 설명해줘) ----------------------------------------------
// 목소리: sounds/<id>-intro.* (record.html에서 직접 녹음해 저장한 파일. webm → m4a → mp3 순으로 찾음)
// 파일이 하나도 없으면 브라우저 음성합성(speechSynthesis)이 models.json의 lines를 대신 읽어줌.

const SOUND_EXTS = ['webm', 'm4a', 'mp3'];
const recordings = {};     // 차 id → 녹음 파일 주소 (시작할 때 한 번만 확인)
let voice = null;          // 지금 재생 중인 <audio>
let utter = null;          // 지금 읽는 문장 (iOS에서 참조가 사라지면 onend가 안 오는 문제 방지)
let playToken = 0;         // 빠르게 누를 때 이전 재생의 끝 처리가 새 재생을 건드리지 않게
let speechUnlocked = false;
let lastCancel = 0;        // 마지막으로 읽기를 멈춘 시각

// 녹음 파일이 있는 차만 미리 찾아 둔다. 버튼을 누른 뒤에 찾으면 터치와의 연결이 끊겨 iOS에서 소리가 막힘.
async function findRecordings() {
  const audio = document.createElement('audio');
  const exts = SOUND_EXTS.filter((ext) => {
    const type = { webm: 'audio/webm', m4a: 'audio/mp4', mp3: 'audio/mpeg' }[ext];
    return audio.canPlayType(type) !== '';
  });
  await Promise.all(cars.map(async (car) => {
    for (const ext of exts) {
      const url = `sounds/${car.id}-intro.${ext}`;
      try {
        const res = await fetch(url);
        if (res.ok) { recordings[car.id] = url; return; }
      } catch (_) { /* 오프라인 등 */ }
    }
  }));
}

// iOS Safari는 첫 음성합성을 터치 순간에 호출해야 이후에도 소리가 난다. 첫 터치 때 빈 문장으로 열어 둠.
function unlockSpeech() {
  if (speechUnlocked || !window.speechSynthesis) return;
  speechUnlocked = true;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}
document.addEventListener('touchend', unlockSpeech, { capture: true, passive: true });
document.addEventListener('click', unlockSpeech, { capture: true });

function koreanVoice() {
  const list = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return list.find((v) => v.lang === 'ko-KR') || list.find((v) => v.lang && v.lang.startsWith('ko'));
}

function stopAllSound() {
  playToken++;
  if (voice) { voice.pause(); voice = null; }
  if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) {
    speechSynthesis.cancel();
    lastCancel = Date.now();
  }
  introBtn.classList.remove('playing');
}

function speakText(text, done) {
  if (!window.speechSynthesis) return done();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = 0.95; u.pitch = 1.1;
  const v = koreanVoice();
  if (v) u.voice = v;
  u.onend = done; u.onerror = done;
  utter = u;
  speechSynthesis.speak(u);
}

// 버튼을 누른 그 순간(같은 호출 안에서) 바로 재생을 시작한다
function playIntro() {
  const car = cars[index];
  if (!car) return;
  const token = playToken;
  const done = () => { if (token === playToken) introBtn.classList.remove('playing'); };
  introBtn.classList.add('playing');
  const text = (car.lines && car.lines.intro) || car.name;

  const url = recordings[car.id];
  if (url) {
    const a = new Audio(url);
    voice = a;
    a.addEventListener('ended', done);
    a.play().catch(() => { if (token === playToken) speakText(text, done); });
    return;
  }

  // iOS는 cancel() 직후 바로 speak()하면 말이 씹히는 경우가 있어, 읽던 중이었다면 아주 잠깐 쉬고 읽음
  const wait = 150 - (Date.now() - lastCancel);
  if (wait > 0) setTimeout(() => { if (token === playToken) speakText(text, done); }, wait);
  else speakText(text, done);
}

function speakIntro() {
  stopAllSound();
  playIntro();
}

introBtn.addEventListener('click', speakIntro);

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
