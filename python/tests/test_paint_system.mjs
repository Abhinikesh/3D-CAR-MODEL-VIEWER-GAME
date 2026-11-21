/**
 * Automated Unit Test Suite for Automotive Paint Material System (Part 9)
 * Tests paint presets, finish types, material factory, safe override engine, and Zustand store.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  PAINT_COLOR_PRESETS,
  PAINT_FINISH_TYPES,
} from '../../src/materials/paintPresets.js';
import {
  createAutomotivePaintMaterial,
  PaintOverrideEngine,
  PRIMARY_PAINT_MESH_NAMES,
  SECONDARY_PAINT_MESH_NAMES,
  ALL_PAINTABLE_MESH_NAMES,
} from '../../src/materials/paintMaterialFactory.js';
import { usePaintStore } from '../../src/store/paintStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running Automotive Paint Material System Unit Tests (Part 9)...\n');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (error) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${error.message}`);
    process.exitCode = 1;
  }
}

// 1. Verify 12 Curated Presets + Factory
it('Defines all required automotive paint color presets (including 12 presets + factory)', () => {
  const expectedPresetIds = [
    'factory_original',
    'carmine_red',
    'racing_red',
    'midnight_black',
    'pearl_white',
    'silver_metallic',
    'graphite_grey',
    'deep_blue',
    'british_racing_green',
    'champagne_gold',
    'matte_grey',
    'electric_blue',
    'custom',
  ];

  for (const id of expectedPresetIds) {
    const found = PAINT_COLOR_PRESETS.find((p) => p.id === id);
    assert.ok(found, `Missing required paint preset: ${id}`);
    assert.ok(found.primaryColor.startsWith('#'), `${id} primaryColor must be a hex string`);
    assert.ok(found.secondaryColor.startsWith('#'), `${id} secondaryColor must be a hex string`);
    assert.ok(PAINT_FINISH_TYPES[found.finish], `${id} references invalid finish: ${found.finish}`);
  }
});

// 2. Verify 6 Finish Categories and PBR Ranges
it('Defines all 6 finish categories with physically plausible PBR parameters', () => {
  const requiredFinishes = ['solid', 'metallic', 'pearl', 'matte', 'satin', 'gloss'];
  for (const fid of requiredFinishes) {
    const f = PAINT_FINISH_TYPES[fid];
    assert.ok(f, `Missing finish: ${fid}`);
    assert.ok(f.metalness >= 0.0 && f.metalness <= 1.0, `${fid} metalness out of range`);
    assert.ok(f.roughness >= 0.0 && f.roughness <= 1.0, `${fid} roughness out of range`);
    assert.ok(f.clearcoat >= 0.0 && f.clearcoat <= 1.0, `${fid} clearcoat out of range`);
    assert.ok(f.clearcoatRoughness >= 0.0 && f.clearcoatRoughness <= 1.0, `${fid} clearcoatRoughness out of range`);
    assert.ok(f.ior >= 1.0 && f.ior <= 2.5, `${fid} ior out of range`);
  }

  // Verify contrast between Matte and Gloss
  const matte = PAINT_FINISH_TYPES.matte;
  const gloss = PAINT_FINISH_TYPES.gloss;
  assert.ok(matte.roughness > 0.6, 'Matte roughness must be high to suppress sharp reflections');
  assert.strictEqual(matte.clearcoat, 0.0, 'Matte clearcoat must be 0');
  assert.ok(gloss.roughness < 0.15, 'Gloss roughness must be low for mirror reflections');
  assert.strictEqual(gloss.clearcoat, 1.0, 'Gloss clearcoat must be 1.0');

  // Verify Pearl has iridescence
  const pearl = PAINT_FINISH_TYPES.pearl;
  assert.ok(pearl.iridescence > 0.2, 'Pearl must feature subtle iridescence');
});

// 3. Verify Paintable Mesh Mapping against actual car_manifest.json
it('Identifies exactly 16 paintable meshes (7 primary + 9 secondary) present in car.glb', () => {
  assert.strictEqual(PRIMARY_PAINT_MESH_NAMES.length, 7, 'Expected 7 primary paint meshes');
  assert.strictEqual(SECONDARY_PAINT_MESH_NAMES.length, 9, 'Expected 9 secondary paint meshes');
  assert.strictEqual(ALL_PAINTABLE_MESH_NAMES.length, 16, 'Expected 16 total paintable meshes');

  const manifestPath = path.resolve(__dirname, '../reports/car_manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'car_manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const manifestMeshNames = new Set(manifest.meshes.map((m) => m.name));

  for (const name of ALL_PAINTABLE_MESH_NAMES) {
    assert.ok(manifestMeshNames.has(name), `Paintable mesh "${name}" not found in car.glb`);
  }

  // Ensure non-paint meshes are NOT in paintable list
  const nonPaintMeshes = [
    'Glass_Windshield',
    'WheelFrontLBrakeDisc',
    'Mesh_Rim_FL',
    'Mesh_Caliper_FL',
    'InteriorSeatsColor1',
    'Engine',
  ];
  for (const nonPaint of nonPaintMeshes) {
    assert.ok(!ALL_PAINTABLE_MESH_NAMES.includes(nonPaint), `Non-paint mesh "${nonPaint}" mistakenly marked as paintable`);
  }
});

// 4. Verify createAutomotivePaintMaterial Factory
it('Creates high-grade Three.js MeshPhysicalMaterial with accurate physical properties', () => {
  const mat = createAutomotivePaintMaterial({
    color: '#0B2545',
    finish: 'metallic',
  });

  assert.ok(mat.isMeshPhysicalMaterial, 'Material must be an instance of MeshPhysicalMaterial');
  assert.strictEqual(mat.color.getHexString().toUpperCase(), '0B2545');
  assert.strictEqual(mat.metalness, PAINT_FINISH_TYPES.metallic.metalness);
  assert.strictEqual(mat.roughness, PAINT_FINISH_TYPES.metallic.roughness);
  assert.strictEqual(mat.clearcoat, 1.0);
  assert.ok(mat.sheen > 0, 'Metallic finish must have subtle sheen highlights');
});

// 5. Verify PaintOverrideEngine Safe Non-Mutating Override & Reset
it('PaintOverrideEngine preserves original materials and restores them cleanly on reset', () => {
  const engine = new PaintOverrideEngine();

  // Create mock scene graph
  const rootGroup = new THREE.Group();
  const originalMat1 = new THREE.MeshStandardMaterial({ name: 'Orig_Paint1', color: 0xaa0000 });
  const originalMat2 = new THREE.MeshStandardMaterial({ name: 'Orig_Paint2', color: 0x111111 });
  const glassMat = new THREE.MeshPhysicalMaterial({ name: 'Orig_Glass', transmission: 0.95 });

  const primaryMesh = new THREE.Mesh(new THREE.BoxGeometry(), originalMat1);
  primaryMesh.name = 'BodyHood';
  rootGroup.add(primaryMesh);

  const secondaryMesh = new THREE.Mesh(new THREE.BoxGeometry(), originalMat2);
  secondaryMesh.name = 'BodyRoofPanel';
  rootGroup.add(secondaryMesh);

  const nonPaintMesh = new THREE.Mesh(new THREE.BoxGeometry(), glassMat);
  nonPaintMesh.name = 'Glass_Windshield';
  rootGroup.add(nonPaintMesh);

  // Initialize engine
  engine.initializeFromScene(rootGroup);
  assert.strictEqual(engine.targetMeshes.length, 2, 'Should index only the 2 paintable meshes');

  // Apply custom paint
  engine.applyPaint({
    primaryColor: '#0066FF',
    secondaryColor: '#001133',
    finish: 'gloss',
    isFactory: false,
  });

  // Verify meshes received custom materials
  assert.notStrictEqual(primaryMesh.material, originalMat1, 'Primary mesh should have new material');
  assert.strictEqual(primaryMesh.material.color.getHexString().toUpperCase(), '0066FF');
  assert.notStrictEqual(secondaryMesh.material, originalMat2, 'Secondary mesh should have new material');
  assert.strictEqual(nonPaintMesh.material, glassMat, 'Non-paint mesh material must remain untouched');

  // Verify original materials were NOT mutated
  assert.strictEqual(originalMat1.color.getHexString().toUpperCase(), 'AA0000', 'Original material 1 was mutated!');
  assert.strictEqual(originalMat2.color.getHexString().toUpperCase(), '111111', 'Original material 2 was mutated!');

  // Test Factory Reset
  engine.restoreFactoryMaterials();
  assert.strictEqual(primaryMesh.material, originalMat1, 'Primary mesh material not restored on reset');
  assert.strictEqual(secondaryMesh.material, originalMat2, 'Secondary mesh material not restored on reset');
  assert.strictEqual(engine.activeCustomMaterials.size, 0, 'Active custom materials should be cleared');

  engine.dispose();
});

// 6. Verify Zustand paintStore Actions and Serializable State
it('paintStore manages state transitions and provides serializable state', () => {
  const store = usePaintStore.getState();

  // Initial factory state
  assert.strictEqual(store.activePresetId, 'factory_original');
  assert.strictEqual(store.isFactory, true);

  // Apply preset
  usePaintStore.getState().applyPreset('deep_blue');
  let state = usePaintStore.getState();
  assert.strictEqual(state.activePresetId, 'deep_blue');
  assert.strictEqual(state.primaryColor, '#0B2545');
  assert.strictEqual(state.isFactory, false);

  // Switch finish
  usePaintStore.getState().setFinish('matte');
  state = usePaintStore.getState();
  assert.strictEqual(state.activeFinish, 'matte');
  assert.strictEqual(state.materialParameters.roughness, PAINT_FINISH_TYPES.matte.roughness);
  assert.strictEqual(state.materialParameters.clearcoat, 0.0);

  // Custom color
  usePaintStore.getState().setCustomColor('#FF5500');
  state = usePaintStore.getState();
  assert.strictEqual(state.activePresetId, 'custom');
  assert.strictEqual(state.primaryColor, '#FF5500');

  // Reset to factory
  usePaintStore.getState().resetToFactory();
  state = usePaintStore.getState();
  assert.strictEqual(state.activePresetId, 'factory_original');
  assert.strictEqual(state.isFactory, true);
});

console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed.\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
