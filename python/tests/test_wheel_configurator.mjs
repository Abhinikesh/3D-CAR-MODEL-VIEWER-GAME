/**
 * test_wheel_configurator.mjs
 * Automated Unit Test Suite for Part 11 — Wheel and Rim Configurator.
 * Validates wheel assemblies, mesh isolation, finish presets, multi-material rim arrays,
 * independent wheel targeting, brake calipers, and non-mutating override behavior.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

import {
  RIM_FINISH_PRESETS,
  CALIPER_PRESETS,
  RIM_STYLES,
  RIM_STYLE_LIMITATION_NOTE,
  WHEEL_TARGET_MODES,
  WHEEL_POSITIONS,
} from '../../src/materials/wheelPresets.js';

import {
  RIM_MESH_MAP,
  CALIPER_MESH_MAP,
  ALL_RIM_MESH_NAMES,
  ALL_CALIPER_MESH_NAMES,
  PROTECTED_DISC_MESH_NAMES,
  PROTECTED_TIRE_NODE_NAMES,
  createRimFaceMaterial,
  createRimInnerSpokeMaterial,
  createBrakeCaliperMaterial,
} from '../../src/materials/wheelMaterialFactory.js';

import { WheelCustomizationEngine } from '../../src/materials/wheelCustomizationEngine.js';
import { useWheelStore } from '../../src/store/wheelStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

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

// Load manifest
const manifestPath = resolve(ROOT, 'python/reports/car_manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const allManifestNames = new Set();
if (manifest.meshes) manifest.meshes.forEach((m) => m.name && allManifestNames.add(m.name));
if (manifest.nodes) manifest.nodes.forEach((n) => n.name && allManifestNames.add(n.name));

console.log('\n◎ Part 11 — Wheel & Rim Configurator Unit Tests\n');

// 1. All four wheel assemblies resolve in manifest
test('All four wheel assemblies (FL, FR, RL, RR) exist in car_manifest.json', () => {
  const assemblies = ['Wheel_Assembly_FL', 'Wheel_Assembly_FR', 'Wheel_Assembly_RL', 'Wheel_Assembly_RR'];
  for (const a of assemblies) {
    assert(allManifestNames.has(a), `Missing wheel assembly node: "${a}"`);
  }
});

// 2. Rim meshes identified independently from tires
test('Rim meshes are identified independently from tires', () => {
  assert(ALL_RIM_MESH_NAMES.length === 4, 'Should have 4 rim meshes');
  for (const rim of ALL_RIM_MESH_NAMES) {
    assert(allManifestNames.has(rim), `Rim mesh not in manifest: ${rim}`);
    assert(!PROTECTED_TIRE_NODE_NAMES.includes(rim), `Rim "${rim}" must not be in tire list`);
  }
  for (const tire of PROTECTED_TIRE_NODE_NAMES) {
    assert(allManifestNames.has(tire), `Tire node not in manifest: ${tire}`);
    assert(!ALL_RIM_MESH_NAMES.includes(tire), `Tire "${tire}" must not be in rim list`);
  }
});

// 3. Brake discs and calipers independently mapped
test('Brake discs and calipers are independently mapped', () => {
  assert(ALL_CALIPER_MESH_NAMES.length === 4, 'Should have 4 caliper meshes');
  assert(PROTECTED_DISC_MESH_NAMES.length === 4, 'Should have 4 brake disc meshes');
  for (const cal of ALL_CALIPER_MESH_NAMES) {
    assert(allManifestNames.has(cal), `Caliper node not in manifest: ${cal}`);
    assert(!PROTECTED_DISC_MESH_NAMES.includes(cal), `Caliper "${cal}" must not be in disc list`);
  }
  for (const disc of PROTECTED_DISC_MESH_NAMES) {
    assert(allManifestNames.has(disc), `Disc node not in manifest: ${disc}`);
    assert(!ALL_CALIPER_MESH_NAMES.includes(disc), `Disc "${disc}" must not be in caliper list`);
  }
});

// 4. Every rim finish preset produces valid MeshPhysicalMaterial
test('Every rim finish preset produces valid MeshPhysicalMaterial with PBR parameters', () => {
  const expectedPresets = [
    'gloss_black', 'satin_black', 'silver_metallic', 'chrome',
    'gunmetal', 'titanium_grey', 'bronze', 'gold', 'custom', 'factory',
  ];
  for (const pid of expectedPresets) {
    const preset = RIM_FINISH_PRESETS[pid];
    assert(preset, `Preset "${pid}" must exist in RIM_FINISH_PRESETS`);
    const mat = createRimFaceMaterial({ preset: pid });
    assert(mat instanceof THREE.MeshPhysicalMaterial, `${pid} must create MeshPhysicalMaterial`);
    assert(typeof mat.metalness === 'number', `${pid} must define numeric metalness`);
    assert(typeof mat.roughness === 'number', `${pid} must define numeric roughness`);
    assert(mat.color instanceof THREE.Color, `${pid} must have valid THREE.Color`);
    mat.dispose();
  }
});

// 5. Custom rim colors work and generate coordinated inner spoke tones
test('Custom rim color derives coordinated inner spoke tone', () => {
  const customHex = '#FF3300';
  const faceMat = createRimFaceMaterial({ customColor: customHex });
  const innerMat = createRimInnerSpokeMaterial({ customColor: customHex });
  assertEqual(faceMat.color.getHexString().toUpperCase(), 'FF3300');
  assert(innerMat instanceof THREE.MeshStandardMaterial);
  // Inner tone should be darker than outer face
  const faceHsl = {};
  const innerHsl = {};
  faceMat.color.getHSL(faceHsl);
  innerMat.color.getHSL(innerHsl);
  assert(innerHsl.l <= faceHsl.l, 'Inner spoke cavity must be darker than polished outer face');
  faceMat.dispose();
  innerMat.dispose();
});

// 6. Brake caliper presets produce valid materials
test('Every brake caliper preset produces valid MeshPhysicalMaterial', () => {
  const expectedCal = ['factory', 'racing_red', 'performance_yellow', 'electric_blue', 'stealth_black', 'custom'];
  for (const cid of expectedCal) {
    const preset = CALIPER_PRESETS[cid];
    assert(preset, `Caliper preset "${cid}" must exist`);
    const mat = createBrakeCaliperMaterial({ preset: cid });
    assert(mat instanceof THREE.MeshPhysicalMaterial, `${cid} must create MeshPhysicalMaterial`);
    mat.dispose();
  }
});

// 7. Wheel store initial state & actions
test('wheelStore initializes with factory defaults and executes target actions', () => {
  const store = useWheelStore.getState();
  assertEqual(store.targetMode, WHEEL_TARGET_MODES.ALL);
  assert(store.isFactoryWheels === true);

  // Set rim finish for all
  useWheelStore.getState().setRimFinish('bronze', 'all');
  const s1 = useWheelStore.getState();
  assert(s1.isFactoryWheels === false);
  assertEqual(s1.rimFinishes.fl.preset, 'bronze');
  assertEqual(s1.rimFinishes.rr.preset, 'bronze');

  // Set front only
  useWheelStore.getState().setRimFinish('gold', 'front');
  const s2 = useWheelStore.getState();
  assertEqual(s2.rimFinishes.fl.preset, 'gold');
  assertEqual(s2.rimFinishes.fr.preset, 'gold');
  assertEqual(s2.rimFinishes.rl.preset, 'bronze');

  // Set individual wheel
  useWheelStore.getState().setRimFinish('chrome', 'rl');
  const s3 = useWheelStore.getState();
  assertEqual(s3.rimFinishes.rl.preset, 'chrome');
  assertEqual(s3.rimFinishes.rr.preset, 'bronze');

  // Reset
  useWheelStore.getState().resetWheelsToFactory();
  const s4 = useWheelStore.getState();
  assert(s4.isFactoryWheels === true);
  assertEqual(s4.rimFinishes.fl.preset, 'factory');
  assertEqual(s4.rimFinishes.rr.preset, 'factory');
});

// 8. WheelCustomizationEngine handles multi-material arrays without mutating originals
test('WheelCustomizationEngine handles multi-material arrays and preserves originals', () => {
  const engine = new WheelCustomizationEngine();
  const mockScene = new THREE.Group();

  // Create mock rim meshes with Array(2) materials
  const mockOrigMat0 = new THREE.MeshBasicMaterial({ name: 'OrigRim2' });
  const mockOrigMat1 = new THREE.MeshBasicMaterial({ name: 'OrigRim1' });

  for (const [pos, rimName] of Object.entries(RIM_MESH_MAP)) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [mockOrigMat0, mockOrigMat1]);
    mesh.name = rimName;
    mockScene.add(mesh);
  }

  // Create mock calipers
  const mockOrigCal = new THREE.MeshBasicMaterial({ name: 'OrigBrake' });
  for (const [pos, calName] of Object.entries(CALIPER_MESH_MAP)) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mockOrigCal);
    mesh.name = calName;
    mockScene.add(mesh);
  }

  // Initialize
  engine.initializeFromScene(mockScene);
  assert(Object.keys(engine.rimMeshes).length === 4, 'Engine must index all 4 rims');
  assert(Object.keys(engine.caliperMeshes).length === 4, 'Engine must index all 4 calipers');

  // Apply bronze finish
  engine.applyRimFinishes({
    fl: { preset: 'bronze' },
    fr: { preset: 'bronze' },
    rl: { preset: 'bronze' },
    rr: { preset: 'bronze' },
  });

  const flMesh = engine.rimMeshes.fl;
  assert(Array.isArray(flMesh.material), 'Rim material must remain an Array');
  assert(flMesh.material[0] !== mockOrigMat0, 'Slot 0 must be replaced with custom face material');
  assert(flMesh.material[1] !== mockOrigMat1, 'Slot 1 must be replaced with custom inner material');
  assert(flMesh.material[0].name.includes('RimFace_bronze'));

  // Apply caliper finish
  engine.applyCaliperFinish('performance_yellow');
  const flCal = engine.caliperMeshes.fl;
  assert(flCal.material !== mockOrigCal);
  assert(flCal.material.name.includes('Caliper_performance_yellow'));

  // Restore factory
  engine.restoreFactoryWheels();
  assertEqual(flMesh.material[0], mockOrigMat0, 'Slot 0 must restore original material');
  assertEqual(flMesh.material[1], mockOrigMat1, 'Slot 1 must restore original material');
  assertEqual(flCal.material, mockOrigCal, 'Caliper must restore original material');

  engine.dispose();
});

// 9. No namespace collisions: rims/calipers vs paint vs secondary
test('Zero namespace collisions: wheels vs paint vs secondary', () => {
  const ALL_PAINTABLE = [
    'BodyRearPanelsColor1', 'BodyPillars', 'BodyHood', 'BodyDoorRColor1',
    'BodyDoorRMirrorColor1', 'BodyDoorLColor1', 'BodyDoorLMirrorColor1',
    'BodyRoofPanel', 'BodyPanelsColor2', 'BodyHoodTopgrill', 'BodyDoorRColor2',
    'BodyDoorRHandle02', 'BodyDoorRMirrorColor2', 'BodyDoorLColor2',
    'BodyDoorLHandle02', 'BodyDoorLMirrorColor2',
  ];

  for (const name of [...ALL_RIM_MESH_NAMES, ...ALL_CALIPER_MESH_NAMES]) {
    assert(!ALL_PAINTABLE.includes(name), `Wheel mesh "${name}" collided with paint meshes!`);
    assert(!PROTECTED_DISC_MESH_NAMES.includes(name), `Wheel mesh "${name}" collided with discs!`);
    assert(!PROTECTED_TIRE_NODE_NAMES.includes(name), `Wheel mesh "${name}" collided with tires!`);
  }
});

// 10. Single rim geometry reported accurately
test('Rim style declaration confirms OEM 5-Spoke and reports single-geometry limitation', () => {
  assert(RIM_STYLES.oem_5spoke, 'OEM 5-spoke style must be declared');
  assert(Object.keys(RIM_STYLES).length === 1, 'Exactly one genuine rim style present in asset');
  assert(typeof RIM_STYLE_LIMITATION_NOTE === 'string' && RIM_STYLE_LIMITATION_NOTE.length > 20);
});

// 11. CarSceneGraph calls useWheelCustomization
test('CarSceneGraph.jsx imports and calls useWheelCustomization', () => {
  const sgSrc = readFileSync(resolve(ROOT, 'src/components/canvas/CarSceneGraph.jsx'), 'utf-8');
  assert(sgSrc.includes('useWheelCustomization'), 'CarSceneGraph must import useWheelCustomization');
  assert(sgSrc.includes('useWheelCustomization(scene)'), 'CarSceneGraph must call useWheelCustomization(scene)');
});

// 12. WheelToolbar component is mounted in App.jsx
test('WheelToolbar is mounted in App.jsx', () => {
  const appSrc = readFileSync(resolve(ROOT, 'src/App.jsx'), 'utf-8');
  assert(appSrc.includes('<WheelToolbar'), 'App.jsx must mount <WheelToolbar />');
  assert(appSrc.includes('Wheel & Rim Configurator'), 'App.jsx must list Part 11 in milestones');
});

console.log(`\n${'─'.repeat(52)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(52)}\n`);

if (failed > 0) process.exit(1);
