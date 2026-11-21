import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const manifestPath = path.join(ROOT, 'python/reports/car_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Check nodes
console.log('Total nodes:', manifest.nodes?.length);
if (manifest.nodes) {
  for (let i = 0; i < Math.min(10, manifest.nodes.length); i++) {
    const node = manifest.nodes[i];
    console.log(`Node ${i}: name=${node.name}, translation=${JSON.stringify(node.translation)}, rotation=${JSON.stringify(node.rotation)}, matrix=${JSON.stringify(node.matrix)}`);
  }
}
