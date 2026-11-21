import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const manifestPath = path.join(ROOT, 'python/reports/car_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('Manifest asset info:', manifest.asset_info);
console.log('Manifest metrics:', manifest.metrics);
console.log('Manifest pivots:', manifest.pivots);
