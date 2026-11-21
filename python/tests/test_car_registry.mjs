/**
 * Unit Test Suite for Car Asset Registry & Store
 * Verifies semantic component mappings, pivot definitions, hinge axes, and node coverage.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SEMANTIC_COMPONENTS } from '../../src/utils/carAssetRegistry.js';
import { useCarAssetStore } from '../../src/store/carAssetStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running Car Asset Registry & Store Unit Tests...\n');

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

// 1. Verify SEMANTIC_COMPONENTS definition
it('Registry defines exactly 17 canonical semantic components', () => {
  const componentKeys = Object.keys(SEMANTIC_COMPONENTS);
  assert.strictEqual(componentKeys.length, 17, `Expected 17 components, got ${componentKeys.length}`);
});

// 2. Verify all components have required properties and non-empty node arrays
it('All components have id, name, category, and non-empty node lists', () => {
  for (const [key, comp] of Object.entries(SEMANTIC_COMPONENTS)) {
    assert.ok(comp.id, `${key} missing 'id'`);
    assert.ok(comp.name, `${key} missing 'name'`);
    assert.ok(comp.category, `${key} missing 'category'`);
    assert.ok(Array.isArray(comp.nodes), `${key} 'nodes' must be an array`);
    assert.ok(comp.nodes.length > 0, `${key} 'nodes' array must not be empty`);
  }
});

// 3. Verify Closure Pivots and Hinge Configuration (DOOR_FL, DOOR_FR, BONNET, BOOT)
it('Door Front-Left has valid pivot, hinge axis, and rotation limits', () => {
  const door = SEMANTIC_COMPONENTS.DOOR_FL;
  assert.strictEqual(door.pivotNode, 'Pivot_Door_FL');
  assert.strictEqual(door.isHinged, true);
  assert.deepStrictEqual(door.hingeAxis, [0, 1, 0]);
  assert.ok(door.maxAngle > 0, 'maxAngle should be positive for FL door');
});

it('Door Front-Right has valid pivot, hinge axis, and rotation limits', () => {
  const door = SEMANTIC_COMPONENTS.DOOR_FR;
  assert.strictEqual(door.pivotNode, 'Pivot_Door_FR');
  assert.strictEqual(door.isHinged, true);
  assert.deepStrictEqual(door.hingeAxis, [0, 1, 0]);
  assert.ok(door.maxAngle < 0, 'maxAngle should be negative for FR door');
});

it('Bonnet has valid pivot, hinge axis, and rotation limits', () => {
  const bonnet = SEMANTIC_COMPONENTS.BONNET;
  assert.strictEqual(bonnet.pivotNode, 'Pivot_Bonnet');
  assert.strictEqual(bonnet.isHinged, true);
  assert.deepStrictEqual(bonnet.hingeAxis, [1, 0, 0]);
  assert.ok(bonnet.maxAngle < 0, 'maxAngle should be negative for bonnet open pitch');
});

it('Boot has valid pivot, hinge axis, and rotation limits', () => {
  const boot = SEMANTIC_COMPONENTS.BOOT;
  assert.strictEqual(boot.pivotNode, 'Pivot_Boot');
  assert.strictEqual(boot.isHinged, true);
  assert.deepStrictEqual(boot.hingeAxis, [1, 0, 0]);
  assert.ok(boot.maxAngle > 0, 'maxAngle should be positive for boot open pitch');
});

// 4. Verify 4 Wheel Assemblies
it('All 4 wheel assemblies are defined with correct steerable flags and pivots', () => {
  const fl = SEMANTIC_COMPONENTS.WHEEL_FL;
  const fr = SEMANTIC_COMPONENTS.WHEEL_FR;
  const rl = SEMANTIC_COMPONENTS.WHEEL_RL;
  const rr = SEMANTIC_COMPONENTS.WHEEL_RR;

  assert.strictEqual(fl.pivotNode, 'Wheel_Assembly_FL');
  assert.strictEqual(fl.steerable, true);

  assert.strictEqual(fr.pivotNode, 'Wheel_Assembly_FR');
  assert.strictEqual(fr.steerable, true);

  assert.strictEqual(rl.pivotNode, 'Wheel_Assembly_RL');
  assert.strictEqual(rl.steerable, false);

  assert.strictEqual(rr.pivotNode, 'Wheel_Assembly_RR');
  assert.strictEqual(rr.steerable, false);
});

// 5. Cross-reference all registry node names against actual GLB manifest
it('All referenced registry nodes exist in actual car_manifest.json', () => {
  const manifestPath = path.resolve(__dirname, '../reports/car_manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'car_manifest.json must exist');
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const manifestNodeNames = new Set(manifest.nodes.map((n) => n.name));

  const missingNodes = [];
  for (const [key, comp] of Object.entries(SEMANTIC_COMPONENTS)) {
    if (comp.pivotNode && !manifestNodeNames.has(comp.pivotNode)) {
      missingNodes.push(`${key}.pivotNode -> ${comp.pivotNode}`);
    }
    for (const nodeName of comp.nodes) {
      if (!manifestNodeNames.has(nodeName)) {
        missingNodes.push(`${key}.nodes -> ${nodeName}`);
      }
    }
  }

  assert.strictEqual(
    missingNodes.length,
    0,
    `Found ${missingNodes.length} node references not present in car.glb:\n${missingNodes.join('\n')}`
  );
});

// 6. Verify Zustand carAssetStore initial state and action contracts
it('carAssetStore initializes with correct defaults and reacts to actions', () => {
  const state = useCarAssetStore.getState();
  assert.strictEqual(state.modelUrl, '/models/car.glb');
  assert.strictEqual(state.isLoading, true);
  assert.strictEqual(state.isLoaded, false);

  // Test setLoaded action
  useCarAssetStore.getState().setLoaded({
    metrics: {
      nodeCount: 101,
      meshCount: 97,
      primitiveCount: 109,
      uniqueMaterialsCount: 29,
      uniqueTexturesCount: 0,
      vertexCount: 162766,
      triangleCount: 213347,
      dimensions: { x: 2.47, y: 1.74, z: 4.56, length: 4.56, width: 2.47, height: 1.74 },
      bounds: { min: { x: -1.235, y: 0.0, z: -2.28 }, max: { x: 1.235, y: 1.74, z: 2.28 }, center: { x: 0, y: 0.87, z: 0 } },
      radius: 2.74,
    },
    semanticRegistry: {
      resolvedCount: 17,
      totalCount: 17,
      unresolved: [],
    },
  });

  const updatedState = useCarAssetStore.getState();
  assert.strictEqual(updatedState.isLoaded, true);
  assert.strictEqual(updatedState.isLoading, false);
  assert.strictEqual(updatedState.semanticRegistry.resolvedCount, 17);
  assert.strictEqual(updatedState.semanticRegistry.totalCount, 17);
  assert.strictEqual(updatedState.metrics.groundContact, 'Y = 0.000m');
});

console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed.\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
