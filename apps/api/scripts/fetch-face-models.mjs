// Downloads the face-api model weights needed by the AI face engine into
// apps/api/models/. Run once after `npm install`:  npm run fetch-models
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.FACE_MODELS_DIR
  ? path.resolve(apiDir, process.env.FACE_MODELS_DIR)
  : path.join(apiDir, "models");
fs.mkdirSync(outDir, { recursive: true });

const CDN = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
const models = [
  "ssd_mobilenetv1",
  "face_landmark_68",
  "face_recognition",
];

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`  ✓ ${path.basename(dest)} (${(buf.length / 1024).toFixed(0)} KB)`);
}

for (const model of models) {
  const manifestName = `${model}_model-weights_manifest.json`;
  const manifestUrl = `${CDN}/${manifestName}`;
  console.log(`Fetching ${model} …`);
  const manifest = await getJson(manifestUrl);
  fs.writeFileSync(path.join(outDir, manifestName), JSON.stringify(manifest));
  console.log(`  ✓ ${manifestName}`);

  // Each weights group lists the shard files it depends on.
  const shards = new Set();
  for (const group of manifest) {
    for (const p of group.paths || []) shards.add(p);
  }
  for (const shard of shards) {
    await download(`${CDN}/${shard}`, path.join(outDir, shard));
  }
}

console.log(`\nDone. Models in: ${outDir}`);
console.log("Face verification will activate automatically on the next API start.");
