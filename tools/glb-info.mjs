// Prints a summary of a GLB: nodes, meshes, skins, images, animations (name + duration).
import { readFileSync } from 'node:fs';
for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binOffset = 20 + jsonLen + 8;
  const accMax = (i) => { const a = gltf.accessors[i]; return a.max ? a.max[0] : NaN; };
  console.log(`== ${file} (${(buf.length/1e6).toFixed(2)} MB)`);
  console.log(`nodes=${gltf.nodes?.length} meshes=${gltf.meshes?.length} skins=${gltf.skins?.map(s=>s.joints.length).join(',')} joints  materials=${gltf.materials?.length} images=${gltf.images?.length} textures=${gltf.textures?.length}`);
  console.log('images:', (gltf.images||[]).map(im => `${im.name||'?'} ${im.mimeType} ${(gltf.bufferViews[im.bufferView].byteLength/1e3).toFixed(0)}KB`).join(' | '));
  console.log('top nodes:', (gltf.scenes[0].nodes).map(i => gltf.nodes[i].name).join(', '));
  for (const an of gltf.animations || []) {
    const dur = Math.max(...an.samplers.map(s => accMax(s.input)));
    const targets = new Set(an.channels.map(c => c.target.node));
    console.log(`  anim "${an.name}"  ${dur.toFixed(2)}s  channels=${an.channels.length} nodes=${targets.size}`);
  }
}
