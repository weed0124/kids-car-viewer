const viewer = document.getElementById('viewer');
const carName = document.getElementById('car-name');
const carList = document.getElementById('car-list');
const listPanel = document.getElementById('list-panel');
const loadFill = document.getElementById('load-fill');
const colorBar = document.getElementById('color-bar');

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

function show(i) {
  index = (i + cars.length) % cars.length;
  const car = cars[index];
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
      show(i);
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

// ---- 버튼들 ---------------------------------------------------------------

document.getElementById('btn-prev').addEventListener('click', () => show(index - 1));
document.getElementById('btn-next').addEventListener('click', () => show(index + 1));

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
