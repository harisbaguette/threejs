// Isolate the official MetaPerson reference hairstyle in head-local coordinates.
// Source: avatarsdk/metaperson-loader-threejs, public/models/sample_avatar.glb.
// Requires local Vite on 5175, Google Chrome, and network for the pinned source.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const revision = 'ba6eb2505ea3e4d05874bdf7c31a4e45003653d4';
const response = await fetch(`https://raw.githubusercontent.com/avatarsdk/metaperson-loader-threejs/${revision}/public/models/sample_avatar.glb`);
if (!response.ok) throw new Error(`Reference download failed: ${response.status}`);
const source = Buffer.from(await response.arrayBuffer()).toString('base64');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5175/');
  const encoded = await page.evaluate(async source => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const buffer = Uint8Array.from(atob(source), c => c.charCodeAt(0)).buffer;
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    gltf.scene.updateMatrixWorld(true);
    const head = gltf.scene.getObjectByName('Head'), hair = gltf.scene.getObjectByName('haircut');
    if (!head || !hair?.isMesh) throw new Error('Expected head and haircut in the official reference.');
    const geometry = hair.geometry.clone();
    geometry.applyMatrix4(hair.matrixWorld).applyMatrix4(head.matrixWorld.clone().invert());
    geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight');
    geometry.morphAttributes = {};
    const material = hair.material.clone();
    material.transparent = true; material.alphaTest = .3; material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geometry, material); mesh.name = 'SofiaHair';
    const result = await new GLTFExporter().parseAsync(mesh, { binary: true });
    const bytes = new Uint8Array(result); let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(text);
  }, source);
  const file = Buffer.from(encoded, 'base64');
  await writeFile('public/assets/TravelerHair.glb', file);
  console.log(`Prepared hair: ${file.length} bytes`);
} finally { await browser.close(); }
