# 자동차 구경 🚗 — 아이용 3D 자동차 뷰어 (PWA)

차를 360도로 빙글빙글 돌리고, 아무 부위나(스페어타이어까지!) 확대해서 볼 수 있는 웹앱.
차 색깔도 마음대로 바꿀 수 있습니다. 안드로이드 홈 화면에 설치하면 일반 앱처럼 전체화면으로 실행되고,
한 번 본 차는 오프라인에서도 보입니다.

## 들어있는 차 (11대)

실제 텍스처가 입혀진 고품질 모델만 남겼습니다(대부분 Ddiaz Design 제작). 전부 뒤에 보조바퀴가 달린 차고, 글래디에이터만 짐칸 아래입니다.

| 차 | 출처 (Sketchfab) | 색 바꾸기 |
|---|---|---|
| 지프 랭글러 4문 루비콘 (2013) | Ddiaz Design, CC BY-NC-SA | ✅ |
| 지프 랭글러 루비콘 392 (2023) | Ddiaz Design, CC BY-NC-SA | ✅ |
| 지프 랭글러 2문 (2007) | Ddiaz Design, CC BY-NC-SA | ✅ |
| 지프 글래디에이터 (2020) | Ddiaz Design, CC BY-NC-SA | ✅ |
| 벤츠 G63 (2025) | Ddiaz Design, CC BY-NC-SA | ✅ |
| 벤츠 G63 (2020) | Ddiaz Design, CC BY-NC-SA | ✅ |
| 랜드로버 디펜더 110 픽업 | Ddiaz Design, CC BY | ✅ |
| 랜드로버 디펜더 90 (1997) | — | ✅ |
| 포드 브롱코 2문 (2021) | Ddiaz Design, CC BY-NC-SA | ✅ |
| 허머 H3 | David_Holiday, CC BY | ✅ |
| 닛산 패트롤 슈퍼 사파리 | Lambo_SC04, CC BY | ✅ |

뺀 모델(단색 평면 모델이거나 사진 스캔이라 질감이 아쉬운 것)의 원본과 변환 설정은 `~/Downloads/kids-car-model/`과
`tools/build-models.mjs`에 그대로 있어서, 필요하면 다시 빌드해 넣을 수 있습니다.

조명은 `hdr/studio_small_09.hdr`(Poly Haven, CC0) 스튜디오 환경맵을 써서 도장 반사가 실제처럼 보이게 했습니다.
`index.html`의 `environment-image`를 `hdr/sky.hdr`로 바꾸면 야외 느낌이 됩니다.

## 로컬에서 실행

```bash
cd kids-car-viewer
python3 -m http.server 8787
# 브라우저에서 http://localhost:8787
```

## 차 추가하는 법 (핵심!)

1. **모델 구하기** — [Sketchfab](https://sketchfab.com) 에서 검색 + 왼쪽 필터에서 **Downloadable** 체크.
   무료 계정으로 로그인하면 다운로드 가능. 포맷은 **glTF** 선택(다운로드하면 zip).
   - 검색어 예시: `jeep wrangler`, `land rover defender`, `mercedes g class`, `suzuki jimny`,
     `ford bronco`, `hyundai santa fe`, `kia sorento`, `hyundai palisade`, `fire truck`, `school bus`
   - 라이선스가 **CC Attribution(CC-BY)** 인 것이 대부분 — 개인/가족용으로 자유롭게 사용 가능.
     `models.json`의 `note`에 제작자 이름을 적어두면 출처 표기까지 깔끔함.
2. **GLB로 변환** — zip 안이 `.gltf`+텍스처 여러 파일이면 한 파일(.glb)로 합치는 게 편함:
   ```bash
   npx @gltf-transform/cli optimize scene.gltf wrangler.glb --texture-compress webp
   ```
   (처음부터 `.glb` 한 파일이면 그대로 사용. `optimize`는 용량도 크게 줄여줌 — 휴대폰에 유리)
3. **파일 넣기** — `models/wrangler.glb` 로 복사.
4. **목록 등록** — `models.json`에 추가:
   ```json
   { "id": "wrangler", "name": "지프 랭글러", "emoji": "🛞", "file": "models/wrangler.glb",
     "paint": ["WRANG"], "note": "출처: Sketchfab @작성자" }
   ```
   - `paint`: 색을 바꿀 "차체 도장" 재질(material) 이름 목록. 비워두면(`[]`) 그 차는 색 바꾸기 버튼이 안 뜸.
     재질 이름은 `npx @gltf-transform/cli inspect 파일.glb` 의 MATERIALS 표에서 확인.
     보통 `carpaint`, `body`, `paint` 같은 이름이고, 헷갈리면 브라우저 콘솔에서
     `viewer.model.materials.map(m => m.name)` 로 이름을 보고 하나씩 칠해보면 됨.
   - `color`: (선택) 기본 색을 `[r, g, b]` (0~1)로 덮어쓰기. 텍스처가 입혀진 차체는 원래 색을 자동으로 못 읽을 때가 있어서 씀.
   - 주의: `optimize`의 기본값(`--palette`)은 재질들을 하나로 합쳐버려서 색 바꾸기가 안 됨. `--palette false` 를 붙일 것.
5. 새로고침 끝. (오프라인 캐시가 남아있으면 `sw.js`의 `CACHE` 버전을 하나 올리면 확실히 갱신)

## 색 바꾸기는 어떻게 동작하나

차마다 `paint`에 적힌 재질의 `baseColorFactor`만 바꿉니다(유리·타이어·내장은 그대로).
고른 색은 차별로 `localStorage`에 저장돼서 다음에 켜도 유지되고, **원래 색** 버튼으로 되돌릴 수 있습니다.
차체에 텍스처가 입혀진 모델(허머 H3)은 변환할 때 텍스처를 밝기만 남긴 흑백으로 바꿔두어서
어떤 색을 곱해도 무늬가 살아 있습니다.

## 안드로이드(아이 폰/태블릿)에 설치

PWA 설치에는 **https 주소**가 필요합니다. 제일 쉬운 방법은 GitHub Pages(무료):

```bash
cd kids-car-viewer
git init && git add -A && git commit -m "자동차 구경 앱"
gh repo create kids-car-viewer --public --source . --push
gh api repos/{owner}/kids-car-viewer/pages -X POST -f 'source[branch]=main' -f 'source[path]=/'
# 잠시 후 https://<계정>.github.io/kids-car-viewer/ 에서 접속 가능
```

안드로이드 Chrome으로 그 주소 접속 → 메뉴(⋮) → **"홈 화면에 추가"** → 앱 아이콘 생성.
실행하면 전체화면 앱으로 뜨고, 한 번 본 차는 비행기 모드에서도 보입니다.

- 모델 파일이 아이 사진·이름 같은 게 아니라 공개 3D 모델이라 public 레포여도 무방.
- 집 안에서만 쓸 거면 Mac에서 `python3 -m http.server`로 띄우고 같은 와이파이에서
  `http://<맥IP>:8787` 접속도 가능하지만, 이 경우 오프라인 캐시(https 필요)는 동작 안 함.

## 구조

```
index.html / style.css / app.js   # 앱 (바닐라 JS)
vendor/model-viewer.min.js        # 구글 <model-viewer> (로컬 번들 — 오프라인 대비)
models.json                       # 차 목록 (여기에 추가)
models/*.glb                      # 3D 모델 파일
manifest.webmanifest / sw.js      # PWA 설치 + 오프라인 캐시
icons/                            # 앱 아이콘
```

## 모델 변환 스크립트 (tools/)

`tools/build-models.mjs`가 지금 들어있는 11대를 만든 스크립트입니다. 새 차를 넣을 때 `CFG`에 한 줄 추가하고:

```bash
cd tools && npm install
SRC=~/Downloads/kids-car-model OUT=../models node build-models.mjs 차이름
```

하면 정점 합치기 → 단순화(기본 25만 삼각형) → 텍스처 webp 2048 → 양자화까지 한 번에 되고,
`paint`에 적은 재질은 색 바꾸기가 되도록 손질됩니다. 원본 파일은 `~/Downloads/kids-car-model/`에 있습니다.
