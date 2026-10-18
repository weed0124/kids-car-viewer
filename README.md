# 자동차 구경 🚗 — 아이용 3D 자동차 뷰어 (PWA)

차를 360도로 빙글빙글 돌리고, 아무 부위나(스페어타이어까지!) 확대해서 볼 수 있는 웹앱.
안드로이드 홈 화면에 설치하면 일반 앱처럼 전체화면으로 실행되고, 한 번 본 차는 오프라인에서도 보입니다.

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
   { "id": "wrangler", "name": "지프 랭글러", "emoji": "🛞", "file": "models/wrangler.glb", "note": "출처: Sketchfab @작성자" }
   ```
5. 새로고침 끝. (오프라인 캐시가 남아있으면 `sw.js`의 `CACHE` 버전을 `v2`로 올리면 확실히 갱신)

> 지금 들어있는 두 대(장난감 스포츠카, 우유 트럭)는 Khronos glTF 공식 샘플로,
> 앱 동작 확인용 자리표시자입니다. 진짜 차로 교체/추가하세요.

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
