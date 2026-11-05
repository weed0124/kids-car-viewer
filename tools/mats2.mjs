import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const root = doc.getRoot(); const scene = root.listScenes()[0];
  const sb = getBounds(scene); const size = sb.max.map((v, i) => v - sb.min[i]);
  const stats = new Map();
  const visit = (node) => { const m = node.getWorldMatrix(); const mesh = node.getMesh();
    if (mesh) for (const prim of mesh.listPrimitives()) { const mat = prim.getMaterial(); if (!mat) continue;
      const pos = prim.getAttribute('POSITION'); const idx = prim.getIndices(); const n = idx ? idx.getCount() : pos.getCount();
      const s = stats.get(mat) || { tris: 0, min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] }; s.tris += n / 3;
      const a = pos.getArray(); const cnt = pos.getCount(); const step = Math.max(1, Math.floor(cnt / 20000));
      for (let i = 0; i < cnt; i += step) { const x = a[i*3], y = a[i*3+1], z = a[i*3+2];
        const w = [m[0]*x + m[4]*y + m[8]*z + m[12], m[1]*x + m[5]*y + m[9]*z + m[13], m[2]*x + m[6]*y + m[10]*z + m[14]];
        for (let k = 0; k < 3; k++) { if (w[k] < s.min[k]) s.min[k] = w[k]; if (w[k] > s.max[k]) s.max[k] = w[k]; } }
      stats.set(mat, s); }
    for (const c of node.listChildren()) visit(c); };
  for (const n of scene.listChildren()) visit(n);
  console.log(`=== ${f} materials=${root.listMaterials().length} size=${size.map(v=>v.toFixed(2))}`);
  for (const [m, s] of [...stats.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 14)) {
    const ext = s.max.map((v, i) => ((v - s.min[i]) / size[i] * 100).toFixed(0)).join('/'); const top = ((s.max[1] - sb.min[1]) / size[1] * 100).toFixed(0);
    console.log(`  ${String(Math.round(s.tris)).padStart(7)} | ${m.getName().slice(0,44).padEnd(44)} | ext%=${ext.padEnd(11)} top%=${top.padStart(3)} | col=${m.getBaseColorFactor().map(v=>v.toFixed(2)).join(',')} tex=${m.getBaseColorTexture()?'Y':'n'} met=${m.getMetallicFactor().toFixed(1)} rgh=${m.getRoughnessFactor().toFixed(1)} ${m.getAlphaMode()}`);
  }
}
