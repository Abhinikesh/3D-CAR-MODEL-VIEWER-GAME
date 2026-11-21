/**
 * test_secondary_materials.mjs
 * Unit tests for Part 10 secondary material systems.
 * Node.js ESM — no browser environment required.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓  ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${description}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
}

// ─── Load manifest ────────────────────────────────────────────────────────────

const manifestPath = resolve(ROOT, 'python/reports/car_manifest.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch {
  console.error('ERROR: car_manifest.json not found — run python/inspect_model.py first');
  process.exit(1);
}

// Build a set of all mesh / node names from the manifest
const allManifestNames = new Set();
// Flat mesh list
if (manifest.meshes) {
  for (const mesh of manifest.meshes) {
    if (mesh.name) allManifestNames.add(mesh.name);
  }
}
// Flat node list (may include anonymous nodes like node_84)
if (manifest.nodes) {
  for (const node of manifest.nodes) {
    if (node.name) allManifestNames.add(node.name);
  }
}
// Also check inside hierarchy if present
if (manifest.hierarchy && manifest.hierarchy.nodes) {
  for (const node of manifest.hierarchy.nodes) {
    if (node.name) allManifestNames.add(node.name);
  }
}
// scene_graph nodes
if (manifest.scene_graph) {
  const traverse = (n) => {
    if (n.name) allManifestNames.add(n.name);
    if (n.children) n.children.forEach(traverse);
  };
  if (Array.isArray(manifest.scene_graph)) manifest.scene_graph.forEach(traverse);
  else traverse(manifest.scene_graph);
}

// ─── Load registry source (parse statically) ─────────────────────────────────

const regPath = resolve(ROOT, 'src/materials/secondaryMaterialRegistry.js');
const regSrc = readFileSync(regPath, 'utf-8');

function extractArray(src, varName) {
  const re = new RegExp(`export const ${varName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const m = src.match(re);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())  // strip inline comments first
    .join('\n')
    .split(',')
    .map((s) => s.trim().replace(/^['"`]|['"`]$/g, '').trim())
    .filter((s) => s.length > 0 && !s.startsWith('//') && !s.startsWith('*'));
}

const GLASS_MESH_NAMES = extractArray(regSrc, 'GLASS_MESH_NAMES');
const CHROME_MIRROR_MESH_NAMES = extractArray(regSrc, 'CHROME_MIRROR_MESH_NAMES');
const CHROME_HARDWARE_MESH_NAMES = extractArray(regSrc, 'CHROME_HARDWARE_MESH_NAMES');
const CHROME_RIM_MESH_NAMES = extractArray(regSrc, 'CHROME_RIM_MESH_NAMES');
const TIRE_NODE_NAMES = extractArray(regSrc, 'TIRE_NODE_NAMES');
const RUBBER_GASKET_MESH_NAMES = extractArray(regSrc, 'RUBBER_GASKET_MESH_NAMES');
const EXTERIOR_PLASTIC_MESH_NAMES = extractArray(regSrc, 'EXTERIOR_PLASTIC_MESH_NAMES');
const INTERIOR_PLASTIC_MESH_NAMES = extractArray(regSrc, 'INTERIOR_PLASTIC_MESH_NAMES');
const HEADLIGHT_MESH_NAMES = extractArray(regSrc, 'HEADLIGHT_MESH_NAMES');
const BRAKELIGHT_MESH_NAMES = extractArray(regSrc, 'BRAKELIGHT_MESH_NAMES');
const SIGNALLIGHT_MESH_NAMES = extractArray(regSrc, 'SIGNALLIGHT_MESH_NAMES');

const ALL_PAINTABLE = [
  'BodyRearPanelsColor1', 'BodyPillars', 'BodyHood', 'BodyDoorRColor1',
  'BodyDoorRMirrorColor1', 'BodyDoorLColor1', 'BodyDoorLMirrorColor1',
  'BodyRoofPanel', 'BodyPanelsColor2', 'BodyHoodTopgrill', 'BodyDoorRColor2',
  'BodyDoorRHandle02', 'BodyDoorRMirrorColor2', 'BodyDoorLColor2',
  'BodyDoorLHandle02', 'BodyDoorLMirrorColor2',
];

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n◎ Part 10 — Secondary Material System Unit Tests\n');

// 1. Glass mesh names in manifest
test('Glass mesh names exist in car_manifest.json', () => {
  for (const name of GLASS_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing glass mesh: "${name}"`);
  }
  assert(GLASS_MESH_NAMES.length === 5, `Expected 5 glass meshes, got ${GLASS_MESH_NAMES.length}`);
});

// 2. Chrome hardware in manifest
test('Chrome hardware mesh names exist in car_manifest.json', () => {
  for (const name of CHROME_HARDWARE_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing chrome hardware: "${name}"`);
  }
});

// 3. Chrome rim mesh names in manifest
test('Chrome rim mesh names exist in car_manifest.json', () => {
  for (const name of CHROME_RIM_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing rim mesh: "${name}"`);
  }
  assert(CHROME_RIM_MESH_NAMES.length === 4, `Expected 4 rim meshes, got ${CHROME_RIM_MESH_NAMES.length}`);
});

// 4. Tire node names present
test('Tire node names (node_84/89/94/99) exist in car_manifest.json', () => {
  for (const name of TIRE_NODE_NAMES) {
    assert(allManifestNames.has(name), `Missing tire node: "${name}"`);
  }
  assert(TIRE_NODE_NAMES.length === 4, `Expected 4 tire nodes, got ${TIRE_NODE_NAMES.length}`);
});

// 5. Rubber gaskets in manifest
test('Rubber gasket mesh names exist in car_manifest.json', () => {
  for (const name of RUBBER_GASKET_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing gasket: "${name}"`);
  }
});

// 6. Plastic mesh names in manifest
test('Exterior plastic mesh names exist in car_manifest.json', () => {
  for (const name of EXTERIOR_PLASTIC_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing exterior plastic: "${name}"`);
  }
});

test('Interior plastic mesh names exist in car_manifest.json', () => {
  for (const name of INTERIOR_PLASTIC_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing interior plastic: "${name}"`);
  }
});

// 7. Emissive mesh names in manifest
test('Headlight mesh names exist in car_manifest.json', () => {
  for (const name of HEADLIGHT_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing headlight: "${name}"`);
  }
});

test('Brakelight mesh names exist in car_manifest.json', () => {
  for (const name of BRAKELIGHT_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing brakelight: "${name}"`);
  }
});

test('Signallight mesh names exist in car_manifest.json', () => {
  for (const name of SIGNALLIGHT_MESH_NAMES) {
    assert(allManifestNames.has(name), `Missing signallight: "${name}"`);
  }
});

// 8. No overlap: paintable vs secondary
test('No overlap between paintable meshes (Part 9) and secondary meshes', () => {
  const allSecondary = new Set([
    ...GLASS_MESH_NAMES,
    ...CHROME_MIRROR_MESH_NAMES,
    ...CHROME_HARDWARE_MESH_NAMES,
    ...CHROME_RIM_MESH_NAMES,
    ...TIRE_NODE_NAMES,
    ...RUBBER_GASKET_MESH_NAMES,
    ...EXTERIOR_PLASTIC_MESH_NAMES,
    ...INTERIOR_PLASTIC_MESH_NAMES,
    ...HEADLIGHT_MESH_NAMES,
    ...BRAKELIGHT_MESH_NAMES,
    ...SIGNALLIGHT_MESH_NAMES,
  ]);
  for (const name of ALL_PAINTABLE) {
    assert(!allSecondary.has(name), `Paint mesh "${name}" found in secondary registry — namespace collision!`);
  }
});

// 9. Glass not in chrome list
test('Glass meshes not duplicated in chrome lists', () => {
  const chromeAll = new Set([...CHROME_MIRROR_MESH_NAMES, ...CHROME_HARDWARE_MESH_NAMES, ...CHROME_RIM_MESH_NAMES]);
  for (const name of GLASS_MESH_NAMES) {
    assert(!chromeAll.has(name), `"${name}" appears in both glass and chrome lists`);
  }
});

// 10. Chrome not in rubber list
test('Chrome meshes not duplicated in rubber/tire lists', () => {
  const rubberAll = new Set([...TIRE_NODE_NAMES, ...RUBBER_GASKET_MESH_NAMES]);
  for (const name of [...CHROME_MIRROR_MESH_NAMES, ...CHROME_RIM_MESH_NAMES]) {
    assert(!rubberAll.has(name), `"${name}" appears in both chrome and rubber lists`);
  }
});

// 11. Zustand store initial state (parse source statically)
test('secondaryMaterialStore declares correct initial state keys', () => {
  const storeSrc = readFileSync(resolve(ROOT, 'src/store/secondaryMaterialStore.js'), 'utf-8');
  const requiredKeys = [
    'glassProfile', 'chromeProfile', 'rubberProfile', 'plasticProfile',
    'headlightsOn', 'taillightsOn', 'indicatorsOn', 'brakeLightsOn', 'isFactorySecondary',
    'setGlassProfile', 'setChromeProfile', 'setRubberProfile', 'setPlasticProfile',
    'setHeadlights', 'setTaillights', 'setIndicators', 'setBrakeLights', 'resetAllSecondary',
  ];
  for (const key of requiredKeys) {
    assert(storeSrc.includes(key), `Store missing key: "${key}"`);
  }
});

// 12. Glass material factory produces transmission material (source check)
test('glassMaterials.js defines transmission > 0 for factory profile', () => {
  const glassSrc = readFileSync(resolve(ROOT, 'src/materials/glassMaterials.js'), 'utf-8');
  assert(glassSrc.includes('transmission:'), 'Glass factory must set transmission');
  assert(glassSrc.includes('MeshPhysicalMaterial'), 'Glass must use MeshPhysicalMaterial');
  // Factory transmission is 0.92
  assert(glassSrc.includes('0.92'), 'Factory glass transmission should be 0.92');
});

// 13. createHeadlightMaterial ON has emissiveIntensity > 0 (source check)
test('emissiveMaterials.js: headlight ON preset has emissiveIntensity = 10', () => {
  const emSrc = readFileSync(resolve(ROOT, 'src/materials/emissiveMaterials.js'), 'utf-8');
  assert(emSrc.includes('emissiveIntensity: 10'), 'Headlight ON must have emissiveIntensity: 10');
});

// 14. createHeadlightMaterial OFF has emissiveIntensity = 0
test('emissiveMaterials.js: headlight OFF preset has emissiveIntensity = 0', () => {
  const emSrc = readFileSync(resolve(ROOT, 'src/materials/emissiveMaterials.js'), 'utf-8');
  // OFF preset
  assert(emSrc.includes('emissiveIntensity: 0'), 'Headlight OFF must have emissiveIntensity: 0');
});

// 15. SecondaryMaterialEngine has multi-material array handling
test('secondaryMaterialEngine.js handles Array.isArray(mesh.material) for rims and tires', () => {
  const engSrc = readFileSync(resolve(ROOT, 'src/materials/secondaryMaterialEngine.js'), 'utf-8');
  assert(engSrc.includes('Array.isArray(mesh.material)'), 'Engine must check Array.isArray(mesh.material)');
  assert(engSrc.includes('newMats[0] = '), 'Engine must replace index 0 of multi-material array');
  assert(engSrc.includes('newMats[1] = '), 'Engine must replace index 1 of multi-material array');
});

// 16. Engine restore uses originalMaterials Map
test('secondaryMaterialEngine.js preserves and restores originals via Map', () => {
  const engSrc = readFileSync(resolve(ROOT, 'src/materials/secondaryMaterialEngine.js'), 'utf-8');
  assert(engSrc.includes('this.originalMaterials = new Map()'), 'Engine must initialize originalMaterials Map');
  assert(engSrc.includes('this.originalMaterials.set(node.uuid'), 'Engine must cache originals by uuid');
  assert(engSrc.includes('this.originalMaterials.get(mesh.uuid)'), 'Engine must restore originals by uuid');
});

// 17. Carbon fiber CARBON_AVAILABLE = false
test('carbonMaterials.js declares CARBON_AVAILABLE = false', () => {
  const carbonSrc = readFileSync(resolve(ROOT, 'src/materials/carbonMaterials.js'), 'utf-8');
  assert(carbonSrc.includes('CARBON_AVAILABLE = false'), 'Carbon must declare CARBON_AVAILABLE = false');
});

// 18. SecondaryMaterialToolbar exports named export
test('SecondaryMaterialToolbar.jsx exports named SecondaryMaterialToolbar', () => {
  const tbSrc = readFileSync(resolve(ROOT, 'src/components/ui/SecondaryMaterialToolbar.jsx'), 'utf-8');
  assert(tbSrc.includes('export function SecondaryMaterialToolbar'), 'Must export named SecondaryMaterialToolbar');
});

// 19. CarSceneGraph imports and calls useSecondaryMaterials
test('CarSceneGraph.jsx imports and calls useSecondaryMaterials', () => {
  const sgSrc = readFileSync(resolve(ROOT, 'src/components/canvas/CarSceneGraph.jsx'), 'utf-8');
  assert(sgSrc.includes('useSecondaryMaterials'), 'CarSceneGraph must import useSecondaryMaterials');
  assert(sgSrc.includes('useSecondaryMaterials(scene)'), 'CarSceneGraph must call useSecondaryMaterials(scene)');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(52)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(52)}\n`);

if (failed > 0) process.exit(1);
