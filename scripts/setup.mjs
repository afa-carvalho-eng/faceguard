// Cross-platform first-run setup: create local env files from the examples.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const copies = [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/web/.env.example", "apps/web/.env.local"],
];

for (const [from, to] of copies) {
  const src = path.join(root, from);
  const dst = path.join(root, to);
  if (fs.existsSync(dst)) {
    console.log(`✓ ${to} already exists — leaving it as is`);
  } else if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`✓ created ${to}`);
  }
}
console.log("\nSetup done. Default search provider is 'mock' (no API key needed).");
console.log("Next: web → http://localhost:3000  |  api → http://localhost:4000\n");
