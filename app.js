const viewer = document.getElementById('viewer');
const carName = document.getElementById('car-name');
const carList = document.getElementById('car-list');
const listPanel = document.getElementById('list-panel');
const loadFill = document.getElementById('load-fill');

let cars = [];
let index = 0;

const savedIndex = Number(localStorage.getItem('carIndex') || 0);

async function init() {
  const res = await fetch('models.json');
  cars = (await res.json()).cars;
  index = savedIndex < cars.length ? savedIndex : 0;
  buildList();
  show(index);
}

function show(i) {
  index = (i + cars.length) % cars.length;
  const car = cars[index];
  carName.textContent = `${car.emoji} ${car.name}`;
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
