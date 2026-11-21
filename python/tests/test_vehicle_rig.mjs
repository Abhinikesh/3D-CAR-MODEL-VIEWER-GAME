import fs from 'fs';
import assert from 'assert';
import * as THREE from 'three';
import {
  CLOSURE_RIG_CONFIG,
  CLOSURE_IDS,
  easeInOutCubic,
  isAnimatableClosure,
  getClosureConfig,
} from '../../src/utils/vehicleRigRegistry.js';
import { useVehicleRigStore } from '../../src/store/vehicleRigStore.js';
import { FOCUS_TARGETS } from '../../src/store/cameraStore.js';

console.log('\n◎ Part 14 — Automotive Closures Rigging & Animation Unit Tests\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗  FAIL: ${name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

// 1. Pivot Resolution in Actual Manifest
runTest('All 4 pivot nodes exist in car_manifest.json and map to distinct components', () => {
  const manifest = JSON.parse(fs.readFileSync('python/reports/car_manifest.json'));
  const nodeNames = new Set(manifest.nodes.map((n) => n.name));

  assert.strictEqual(CLOSURE_IDS.length, 4, 'Must have exactly 4 movable closures');

  for (const id of CLOSURE_IDS) {
    const config = CLOSURE_RIG_CONFIG[id];
    assert.ok(config, `Config must exist for ${id}`);
    assert.ok(
      nodeNames.has(config.pivotNodeName),
      `Pivot node '${config.pivotNodeName}' must exist in car_manifest.json`
    );
  }
});

// 2. Physical Kinematic Axis & Safe Angle Verification
runTest('Kinematic axes, directions, and safe opening angles match physical vehicle structure', () => {
  // Driver Door: Local Z-axis, negative outward swing
  const fl = CLOSURE_RIG_CONFIG.door_fl;
  assert.strictEqual(fl.axis, 'z');
  assert.strictEqual(fl.openAngleDeg, -60);
  assert.ok(fl.openAngleRad < 0);

  // Passenger Door: Local Z-axis, positive outward swing
  const fr = CLOSURE_RIG_CONFIG.door_fr;
  assert.strictEqual(fr.axis, 'z');
  assert.strictEqual(fr.openAngleDeg, 60);
  assert.ok(fr.openAngleRad > 0);

  // Bonnet: Local X-axis, positive clamshell lift
  const bonnet = CLOSURE_RIG_CONFIG.bonnet;
  assert.strictEqual(bonnet.axis, 'x');
  assert.strictEqual(bonnet.openAngleDeg, 42);
  assert.ok(bonnet.openAngleRad > 0);

  // Boot: Local X-axis, negative liftback lift
  const boot = CLOSURE_RIG_CONFIG.boot;
  assert.strictEqual(boot.axis, 'x');
  assert.strictEqual(boot.openAngleDeg, -48);
  assert.ok(boot.openAngleRad < 0);
});

// 3. Easing Function Mathematics
runTest('easeInOutCubic produces valid non-linear boundary constraints S(0)=0, S(1)=1', () => {
  assert.strictEqual(easeInOutCubic(0), 0);
  assert.strictEqual(easeInOutCubic(1), 1);
  assert.strictEqual(easeInOutCubic(0.5), 0.5);

  // S-curve acceleration & deceleration check:
  // Slope at t=0.1 should be smaller than linear (0.1)
  assert.ok(easeInOutCubic(0.1) < 0.1, 'Must ease in smoothly at beginning');
  // Slope at t=0.9 should be larger than linear (0.9)
  assert.ok(easeInOutCubic(0.9) > 0.9, 'Must ease out smoothly near end');
});

// 4. Initial Rig Store State
runTest('vehicleRigStore initializes with all 4 closures in closed state and progress 0.0', () => {
  const state = useVehicleRigStore.getState();
  assert.strictEqual(state.isAnyAnimating, false);
  assert.strictEqual(state.animationSpeed, 1.0);

  for (const id of CLOSURE_IDS) {
    const c = state.closures[id];
    assert.ok(c, `Closure ${id} must exist in state`);
    assert.strictEqual(c.currentProgress, 0);
    assert.strictEqual(c.targetProgress, 0);
    assert.strictEqual(c.state, 'closed');
  }
});

// 5. Individual Open, Close, and Reversal Actions
runTest('Individual closure opening and closing transitions state correctly', () => {
  const store = useVehicleRigStore.getState();

  // Open driver door
  store.openClosure('door_fl');
  let current = useVehicleRigStore.getState().closures.door_fl;
  assert.strictEqual(current.targetProgress, 1.0);
  assert.strictEqual(current.state, 'opening');
  assert.strictEqual(useVehicleRigStore.getState().isAnyAnimating, true);

  // Mid-flight reversal (closing while opening)
  store.closeClosure('door_fl');
  current = useVehicleRigStore.getState().closures.door_fl;
  assert.strictEqual(current.targetProgress, 0.0);
  assert.strictEqual(current.state, 'closing');

  // Toggle closure action
  store.toggleClosure('door_fl'); // was target 0, so should now target 1
  current = useVehicleRigStore.getState().closures.door_fl;
  assert.strictEqual(current.targetProgress, 1.0);
});

// 6. Coordinated Open All and Close All
runTest('openAll and closeAll actions drive all 4 closures in synchronized harmony', () => {
  const store = useVehicleRigStore.getState();

  store.openAll();
  let state = useVehicleRigStore.getState();
  assert.strictEqual(state.isAnyAnimating, true);
  for (const id of CLOSURE_IDS) {
    assert.strictEqual(state.closures[id].targetProgress, 1.0);
  }

  store.closeAll();
  state = useVehicleRigStore.getState();
  assert.strictEqual(state.isAnyAnimating, true);
  for (const id of CLOSURE_IDS) {
    assert.strictEqual(state.closures[id].targetProgress, 0.0);
  }
});

// 7. Reset All Instant Snap
runTest('resetAll instantly snaps all closures to progress 0.0 and closed state', () => {
  const store = useVehicleRigStore.getState();

  // Set simulated progress
  store.updateProgress('door_fl', 0.75);
  store.updateProgress('bonnet', 0.5);

  store.resetAll();
  const state = useVehicleRigStore.getState();
  assert.strictEqual(state.isAnyAnimating, false);
  for (const id of CLOSURE_IDS) {
    assert.strictEqual(state.closures[id].currentProgress, 0.0);
    assert.strictEqual(state.closures[id].targetProgress, 0.0);
    assert.strictEqual(state.closures[id].state, 'closed');
  }
});

// 8. Transform Preservation Simulation Across Repeated Open/Close Cycles
runTest('Repeated open/close cycles preserve original node transforms with zero drift', () => {
  // Simulate Object3D pivot in Three.js
  const pivot = new THREE.Object3D();
  pivot.rotation.set(0.1, 0.2, 0.3); // non-zero base orientation
  const baseRot = { x: pivot.rotation.x, y: pivot.rotation.y, z: pivot.rotation.z };

  const config = CLOSURE_RIG_CONFIG.door_fl;

  // Run 100 complete open-close cycles
  for (let cycle = 0; cycle < 100; cycle++) {
    // Open
    for (let p = 0; p <= 1.0; p += 0.1) {
      pivot.rotation[config.axis] = baseRot[config.axis] + easeInOutCubic(p) * config.openAngleRad;
    }
    // Close
    for (let p = 1.0; p >= 0; p -= 0.1) {
      pivot.rotation[config.axis] = baseRot[config.axis] + easeInOutCubic(p) * config.openAngleRad;
    }
  }

  // Final closed position must equal initial rotation within epsilon
  const errX = Math.abs(pivot.rotation.x - baseRot.x);
  const errY = Math.abs(pivot.rotation.y - baseRot.y);
  const errZ = Math.abs(pivot.rotation.z - baseRot.z);

  assert.ok(errX < 1e-6, `Rotation X drift: ${errX}`);
  assert.ok(errY < 1e-6, `Rotation Y drift: ${errY}`);
  assert.ok(errZ < 1e-6, `Rotation Z drift: ${errZ}`);
});

// 9. Camera Focus Target Compatibility
runTest('All closures define valid camera focus targets registered in FOCUS_TARGETS', () => {
  for (const id of CLOSURE_IDS) {
    const config = CLOSURE_RIG_CONFIG[id];
    assert.ok(
      FOCUS_TARGETS[config.cameraFocusTarget],
      `Camera target '${config.cameraFocusTarget}' must exist in FOCUS_TARGETS`
    );
  }
});

// 10. Animation Speed Clamping
runTest('setAnimationSpeed clamps within safe range [0.2, 3.0]', () => {
  const store = useVehicleRigStore.getState();

  store.setAnimationSpeed(0.05); // too low
  assert.strictEqual(useVehicleRigStore.getState().animationSpeed, 0.2);

  store.setAnimationSpeed(5.0); // too high
  assert.strictEqual(useVehicleRigStore.getState().animationSpeed, 3.0);

  store.setAnimationSpeed(1.25);
  assert.strictEqual(useVehicleRigStore.getState().animationSpeed, 1.25);

  store.setAnimationSpeed(1.0); // reset default
});

// 11. VehicleRigToolbar Export & Integration
runTest('VehicleRigToolbar component is exported and mounted in App.jsx', () => {
  const toolbarContent = fs.readFileSync('src/components/ui/VehicleRigToolbar.jsx', 'utf-8');
  assert.ok(toolbarContent.includes('export function VehicleRigToolbar'), 'Must export VehicleRigToolbar');
  assert.ok(toolbarContent.includes('CLOSURES RIG'), 'Must display closures rig header');
  assert.ok(toolbarContent.includes('OPEN ALL'), 'Must provide OPEN ALL action');
  assert.ok(toolbarContent.includes('CLOSE ALL'), 'Must provide CLOSE ALL action');
  assert.ok(toolbarContent.includes('RESET'), 'Must provide RESET action');

  const appContent = fs.readFileSync('src/App.jsx', 'utf-8');
  assert.ok(appContent.includes('import { VehicleRigToolbar }'), 'App.jsx must import VehicleRigToolbar');
  assert.ok(appContent.includes('<VehicleRigToolbar />'), 'App.jsx must mount <VehicleRigToolbar />');
  assert.ok(/currentPart\s*=\s*(1[4-9]|20)/.test(appContent), 'App.jsx currentPart must be >= 14');
});

// 12. ComponentHUD Integration for Closures
runTest('ComponentHUD integrates Kinematic Closure Mechanism controls', () => {
  const hudContent = fs.readFileSync('src/components/ui/ComponentHUD.jsx', 'utf-8');
  assert.ok(hudContent.includes('useVehicleRigStore'), 'ComponentHUD must import useVehicleRigStore');
  assert.ok(hudContent.includes('isAnimatableClosure'), 'ComponentHUD must check isAnimatableClosure');
  assert.ok(hudContent.includes('KINEMATIC MECHANISM'), 'ComponentHUD must render kinematic mechanism badge');
  assert.ok(hudContent.includes('toggleClosure'), 'ComponentHUD must bind toggleClosure');
});

console.log(`\n────────────────────────────────────────────────────`);
console.log(`  Results: ${passedTests} passed, ${totalTests - passedTests} failed`);
console.log(`────────────────────────────────────────────────────\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
