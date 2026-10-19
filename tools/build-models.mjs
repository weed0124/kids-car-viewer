// 모델 변환 스크립트 — Sketchfab에서 받은 glb/gltf를 앱용 glb로 만든다.
//   cd tools && npm install
//   SRC=~/Downloads/kids-car-model OUT=../models node build-models.mjs fj40 hummer ...
// SRC 안의 파일 이름은 아래 CFG의 in: 경로 참고. paint: 색 바꾸기 대상 재질 이름(models.json의 paint와 같게).
// 텍스처가 입혀진 도장 재질은 밝기만 남긴 흑백 텍스처로 바꾸고 평균색을 baseColorFactor로 옮긴다(색 곱하기용).
// renormal: 정점이 안 합쳐져 단순화가 안 되는 모델용(법선 버리고 합친 뒤 다시 계산). 'keep'은 법선 유지.
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, weld, simplify, resample, prune, textureCompress, quantize, instance, sparse, normals } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';

const S = process.env.SRC || process.env.S || '.';
const OUT = process.env.OUT || '../models';
const CFG = {
  // existing cars (re-built from original zips so paint stays a separate material)
  wrangler:   { in: `${S}/wrangler/scene.gltf`,  paint: ['WRANG'] },
  defender:   { in: `${S}/defender/scene.gltf`,  paint: ['BodyColour_Mat1', 'Roof_Color'] },
  gclass:     { in: `${S}/gclass/scene.gltf`,    paint: [/Paint_Material1$/], target: 220000, error: 0.01 },
  jimny:      { in: `${S}/jimny/scene.gltf`,     paint: ['Carro_Pintura'], target: 220000, error: 0.01, renormal: true },
  bronco:     { in: `${S}/bronco/scene.gltf`,    paint: ['BRChassis_XZSG1'] },
  santafe:    { in: `${S}/santafe/scene.gltf`,   paint: ['santafek_body'], target: 220000, error: 0.01 },
  sorento:    { in: `${S}/sorento/scene.gltf`,   paint: ['template_carpaint.014'], target: 220000, error: 0.01, renormal: true },
  // new cars
  fj40:       { in: `${S}/fj40.glb`,        paint: ['FJ_BODYPAINT2'] },
  hummer:     { in: `${S}/hummer.glb`,      paint: ['mat_body'] },
  defender110:{ in: `${S}/defender110.glb`, paint: [/body_1$/, /body_2$/], target: 220000, error: 0.01, renormal: 'keep' },
  wrangler4d: { in: `${S}/wrangler4d.glb`,  paint: ['CarPaaint'] },
  pajero:     { in: `${S}/pajero.glb`,      paint: ['carpaint'], target: 220000, error: 0.01, rotate: [-90, 0, 0] },
  rav4:       { in: `${S}/rav4.glb`,        paint: ['carpaint'], target: 220000, error: 0.01, rotate: [-90, 0, 0] },
  galloper:   { in: `${S}/galloper.glb`,    paint: [], target: 250000, scan: true, error: 0.01, renormal: true },
  korando:    { in: `${S}/korando.glb`,     paint: [], target: 250000, scan: true, error: 0.01, renormal: true },
};

// smooth (area-weighted) vertex normals, keeping the index buffer intact
function smoothNormals(doc) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'); const idx = prim.getIndices(); if (!pos || !idx) continue;
    const n = pos.getCount(); const P = new Float32Array(n * 3); const tmp = [0, 0, 0];
    for (let i = 0; i < n; i++) { pos.getElement(i, tmp); P[i*3] = tmp[0]; P[i*3+1] = tmp[1]; P[i*3+2] = tmp[2]; }
    const N = new Float32Array(n * 3); const I = idx.getArray();
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t+1], c = I[t+2];
      const ux = P[b*3]-P[a*3], uy = P[b*3+1]-P[a*3+1], uz = P[b*3+2]-P[a*3+2];
      const vx = P[c*3]-P[a*3], vy = P[c*3+1]-P[a*3+1], vz = P[c*3+2]-P[a*3+2];
      const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
      for (const k of [a, b, c]) { N[k*3] += nx; N[k*3+1] += ny; N[k*3+2] += nz; }
    }
    for (let i = 0; i < n; i++) { const l = Math.hypot(N[i*3], N[i*3+1], N[i*3+2]) || 1; N[i*3] /= l; N[i*3+1] /= l; N[i*3+2] /= l; }
    const old = prim.getAttribute('NORMAL'); if (old) prim.setAttribute('NORMAL', null);
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(doc.getRoot().listBuffers()[0]));
  }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;

const matches = (name, pats) => pats.some(p => typeof p === 'string' ? name === p : p.test(name));
const triCount = (doc) => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); t += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; } return Math.round(t); };

for (const name of process.argv.slice(2)) {
  const cfg = CFG[name]; if (!cfg) { console.error('unknown', name); continue; }
  const t0 = Date.now();
  const doc = await io.read(cfg.in);
  const root = doc.getRoot();
  doc.setLogger({ debug(){}, info(){}, warn(){}, error: console.error });

  // 1. drop fully transparent (alpha 0) materials' primitives, and empty meshes
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const m = prim.getMaterial();
    if (m && m.getAlphaMode() === 'BLEND' && m.getBaseColorFactor()[3] === 0 && !m.getBaseColorTexture()) { mesh.removePrimitive(prim); prim.dispose(); }
  }
  // 2. scan models: drop normal / metallic-roughness textures (size), keep base color
  if (cfg.scan) for (const m of root.listMaterials()) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null); m.setMetallicFactor(0); m.setRoughnessFactor(0.85); }

  // 3. paint materials: make them tintable
  const paintNames = [];
  for (const m of root.listMaterials()) {
    if (!matches(m.getName(), cfg.paint)) continue;
    paintNames.push(m.getName());
    const tex = m.getBaseColorTexture();
    if (tex) {
      // turn the texture into a luminance map whose mean is 1.0, and move the mean colour into baseColorFactor
      const img = sharp(Buffer.from(tex.getImage()));
      const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i+1], b = data[i+2]; if (data[i+3] > 10 && Math.max(r, g, b) > 60) { sr += r; sg += g; sb += b; n++; } }
      const mean = [sr / n / 255, sg / n / 255, sb / n / 255];
      const meanLum = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2];
      const out = Buffer.alloc(data.length);
      for (let i = 0; i < data.length; i += 4) {
        const lum = (0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2]) / 255;
        const v = Math.min(255, Math.round(lum / meanLum * 255 * 0.9));
        out[i] = out[i+1] = out[i+2] = v; out[i+3] = data[i+3];
      }
      const png = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
      tex.setImage(png).setMimeType('image/png');
      const f = m.getBaseColorFactor();
      m.setBaseColorFactor([mean[0] / 0.9 * f[0], mean[1] / 0.9 * f[1], mean[2] / 0.9 * f[2], f[3]]);
      console.log(`  paint '${m.getName()}' textured -> mean colour ${mean.map(v => v.toFixed(2))}`);
    } else {
      console.log(`  paint '${m.getName()}' colour ${m.getBaseColorFactor().map(v => v.toFixed(2))}`);
    }
  }

  // 4. optional re-orientation (some uploads are Z-up / sideways)
  if (cfg.rotate) {
    const scene = root.listScenes()[0];
    const toQ = (x, y, z) => { const c = a => Math.cos(a * Math.PI / 360), s = a => Math.sin(a * Math.PI / 360);
      const cx = c(x), sx = s(x), cy = c(y), sy = s(y), cz = c(z), sz = s(z);
      return [sx*cy*cz - cx*sy*sz, cx*sy*cz + sx*cy*sz, cx*cy*sz - sx*sy*cz, cx*cy*cz + sx*sy*sz]; };
    const wrap = doc.createNode('reorient').setRotation(toQ(...cfg.rotate));
    for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); }
    scene.addChild(wrap);
  }
  // 5. unwelded / flat-shaded meshes: drop normals so vertices can merge, recompute smooth normals afterwards
  if (cfg.renormal) for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const drop = cfg.renormal === 'keep' ? ['TANGENT', 'COLOR_0'] : ['NORMAL', 'TANGENT', 'COLOR_0'];
    const mat = p.getMaterial();
    const textured = mat && (mat.getBaseColorTexture() || mat.getNormalTexture() || mat.getMetallicRoughnessTexture() || mat.getEmissiveTexture() || mat.getOcclusionTexture());
    if (!textured) drop.push('TEXCOORD_0', 'TEXCOORD_1');
    for (const sem of drop) { const a = p.getAttribute(sem); if (a) { p.setAttribute(sem, null); } }
  }
  const before = triCount(doc);
  await doc.transform(
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
    instance({ min: 5 }),
    flatten(),
    join({ keepNamed: false }),
    ...(cfg.renormal ? [quantize({ quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10 })] : []),
    weld(),
  );
  { let v = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) v += p.getAttribute('POSITION').getCount(); console.log(`  after weld: ${v} vertices, ${triCount(doc)} tris`); }
  const target = cfg.target || 250000;
  const ratio = Math.min(1, target / before);
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: cfg.error || 0.001 }));
  if (cfg.renormal && cfg.renormal !== 'keep') smoothNormals(doc);
  await doc.transform(
    resample(),
    prune({ keepSolidTextures: false }),
    sparse(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [cfg.texSize || 2048, cfg.texSize || 2048] }),
    quantize(),

  );
  const after = triCount(doc);
  const outFile = `${OUT}/${name}.glb`;
  await io.write(outFile, doc);
  const mb = (fs.statSync(outFile).size / 1e6).toFixed(1);
  const kept = root.listMaterials().filter(m => paintNames.includes(m.getName())).map(m => m.getName());
  console.log(`${name}: ${before} -> ${after} tris, ${mb} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s, paint=${JSON.stringify(kept)}`);
}
