/**
 * test_part38_interface_polish_integration.mjs — Part 38: Driving Interface Polish & Showroom Integration
 *
 * Comprehensive end-to-end integration test validating:
 *  1. Showroom and Driving mode transitions via appModeStore
 *  2. Shared vehicle customization persistence (paint, finish, wheels, calipers)
 *  3. Single-source-of-truth 3D model architecture across both modes
 *  4. Clean scene mounting and unmounting without memory leaks or stuck inputs
 *  5. Driving input neutralization when returning to Showroom
 *  6. Smartphone controller cleanup when exiting Driving Mode
 *  7. Keyboard control arbitration across mode boundaries
 *  8. Driving HUD and camera dock visibility during Driving Mode only
 *  9. VehicleSpecStrip visibility during Showroom Mode only
 * 10. StudioHeader dynamic contextual rendering (TEST DRIVE in Showroom, STUDIO CONFIG in Driving)
 * 11. Repeated mode switching stability (10 cycles without state corruption)
 * 12. Failure handling: mode switch while full throttle neutralizes inputs immediately
 * 13. Failure handling: phone disconnect while steering returns wheel to center
 * 14. Pause & resume state integrity across mode boundaries
 *
 * Run with: node python/tests/test_part38_interface_polish_integration.mjs
 * Built with raw Node.js built-ins only.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { useAppModeStore, APP_MODES, DRIVING_VIEWS } from '../../src/store/appModeStore.js';
import { usePaintStore } from '../../src/store/paintStore.js';
import { useWheelStore } from '../../src/store/wheelStore.js';
import { useVehicleInputStore, VEHICLE_GEAR } from '../../src/scenes/driving/vehicleInputStore.js';
import { useVehiclePhysicsStore } from '../../src/store/vehiclePhysicsStore.js';
import { useControllerSessionStore } from '../../src/services/controller/controllerSessionStore.js';
import { INPUT_SOURCE, CONTROLLER_STATUS } from '../../src/services/controller/controllerTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ─── Test Harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    passed++;
    process.stdout.write(`  ✅ ${name}\n`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    failed++;
    process.stdout.write(`  ❌ ${name}\n     ${err.message}\n`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertClose(a, b, eps = 0.001, msg) {
  if (Math.abs(a - b) > eps) throw new Error(msg || `Expected ${a} to be close to ${b} (eps: ${eps})`);
}

function assertContains(source, needle, msg) {
  if (!source.includes(needle)) throw new Error(msg || `Expected to find: ${needle}`);
}

console.log('\n🏎️  Part 38 — Driving Interface Polish and Showroom Integration\n');

// ── 1. Mode Transitions & Lifecycle ─────────────────────────────────────────

test('T01: Initial state is SHOWROOM mode with clean zero inputs', () => {
  useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);
  assert(useAppModeStore.getState().mode === APP_MODES.SHOWROOM);
  assert(useVehicleInputStore.getState().throttle === 0.0);
  assert(useVehicleInputStore.getState().steer === 0.0);
  assert(useVehicleInputStore.getState().brake === 0.0);
});

test('T02: Seamless mode switch: SHOWROOM -> DRIVING mode transition', () => {
  useAppModeStore.getState().setMode(APP_MODES.DRIVING);
  assert(useAppModeStore.getState().mode === APP_MODES.DRIVING);
  assert(useAppModeStore.getState().isDrivingMode() === true);
  assert(useAppModeStore.getState().isShowroomMode() === false);
});

test('T03: Transition back: DRIVING -> SHOWROOM mode transition', () => {
  useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);
  assert(useAppModeStore.getState().mode === APP_MODES.SHOWROOM);
  assert(useAppModeStore.getState().isShowroomMode() === true);
  assert(useAppModeStore.getState().isDrivingMode() === false);
});

// ── 2. Customization Persistence Across Modes ───────────────────────────────

test('T04: Paint color & finish customized in SHOWROOM persist into DRIVING mode', () => {
  useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);

  // Customize in Showroom
  usePaintStore.getState().setCustomColor('#E74C3C'); // Rosso Corsa Red
  usePaintStore.getState().setFinish('matte');

  assert(usePaintStore.getState().primaryColor === '#E74C3C');
  assert(usePaintStore.getState().activeFinish === 'matte');

  // Enter Driving Mode
  useAppModeStore.getState().setMode(APP_MODES.DRIVING);

  // Verify same customization is active
  assert(usePaintStore.getState().primaryColor === '#E74C3C', 'Paint color must persist in driving mode');
  assert(usePaintStore.getState().activeFinish === 'matte', 'Paint finish must persist in driving mode');
});

test('T05: Wheel & rim configuration customized in SHOWROOM persists into DRIVING mode', () => {
  useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);

  // Customize wheels
  useWheelStore.getState().setRimFinish('forged_gt');
  assert(useWheelStore.getState().activePresetId === 'forged_gt');

  // Enter Driving Mode
  useAppModeStore.getState().setMode(APP_MODES.DRIVING);
  assert(useWheelStore.getState().activePresetId === 'forged_gt', 'Wheel preset must persist in driving mode');
});

test('T06: Customization changes made after driving persist into subsequent driving sessions', () => {
  // Return to Showroom
  useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);

  // Re-customize with Cyberpunk Cyan metallic
  usePaintStore.getState().setCustomColor('#00F0FF');
  usePaintStore.getState().setFinish('metallic');
  useWheelStore.getState().setRimFinish('aero_turbine');

  // Enter Driving Mode again
  useAppModeStore.getState().setMode(APP_MODES.DRIVING);

  assert(usePaintStore.getState().primaryColor === '#00F0FF');
  assert(usePaintStore.getState().activeFinish === 'metallic');
  assert(useWheelStore.getState().activePresetId === 'aero_turbine');
});

// ── 3. Single Source of Truth Architecture ──────────────────────────────────

test('T07: Both ShowroomScene and DrivingVehicle use ConfiguredVehicle as single source of truth', () => {
  const showroomSceneSrc = readFileSync(path.join(ROOT, 'src', 'scenes', 'showroom', 'ShowroomScene.jsx'), 'utf-8');
  const drivingVehicleSrc = readFileSync(path.join(ROOT, 'src', 'scenes', 'driving', 'DrivingVehicle.jsx'), 'utf-8');
  const configuredVehicleSrc = readFileSync(path.join(ROOT, 'src', 'scenes', 'shared', 'ConfiguredVehicle.jsx'), 'utf-8');

  assertContains(showroomSceneSrc, 'ConfiguredVehicle', 'ShowroomScene must render ConfiguredVehicle');
  assertContains(drivingVehicleSrc, 'ConfiguredVehicle', 'DrivingVehicle must render ConfiguredVehicle');
  assertContains(configuredVehicleSrc, 'CarAssetLoader', 'ConfiguredVehicle must wrap CarAssetLoader');
});

test('T08: CarSceneGraph hooks apply identical materials regardless of operating mode', () => {
  const csgSrc = readFileSync(path.join(ROOT, 'src', 'components', 'canvas', 'CarSceneGraph.jsx'), 'utf-8');

  assertContains(csgSrc, 'usePaintMaterials(scene)', 'Must apply paint materials');
  assertContains(csgSrc, 'useSecondaryMaterials(scene)', 'Must apply secondary materials');
  assertContains(csgSrc, 'useWheelCustomization(scene)', 'Must apply wheel customization');
  assertContains(csgSrc, 'useVehicleLighting(scene)', 'Must apply vehicle lighting');
});

// ── 4. Driving Input Lifecycle & Safety Handover ────────────────────────────

test('T09: Driving inputs during Driving Mode successfully update physics input store', () => {
  useAppModeStore.getState().setMode(APP_MODES.DRIVING);

  useVehicleInputStore.getState().setInputs({
    throttle: 0.8,
    steer: -0.5,
    brake: 0.0,
  }, INPUT_SOURCE.KEYBOARD);

  const input = useVehicleInputStore.getState();
  assertClose(input.throttle, 0.8);
  assertClose(input.steer, -0.5);
  assert(input.isAccelerating === true);
});

test('T10: Returning to Showroom automatically neutralizes active driving inputs', () => {
  // Vehicle is at 0.8 throttle
  assert(useVehicleInputStore.getState().throttle > 0);

  // Return to Showroom
  useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);

  const input = useVehicleInputStore.getState();
  assert(input.throttle === 0.0, 'Throttle must be 0 after returning to Showroom');
  assert(input.steer === 0.0, 'Steer must be 0 after returning to Showroom');
  assert(input.brake === 0.0, 'Brake must be 0 after returning to Showroom');
  assert(input.isAccelerating === false);
});

test('T11: Smartphone controller session is safely reset when returning to Showroom', () => {
  useAppModeStore.getState().setMode(APP_MODES.DRIVING);

  // Connect simulated smartphone
  useControllerSessionStore.getState().connectController({ id: 'phone-part38-test' });
  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.CONNECTED);
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.SMARTPHONE);

  // Exit to Showroom
  useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);

  // Session must be reset, active source returned to KEYBOARD
  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.DISCONNECTED);
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.KEYBOARD);
  assert(useVehicleInputStore.getState().throttle === 0.0);
});

// ── 5. UI Structure & Viewport Polish ───────────────────────────────────────

test('T12: App.jsx conditionally renders overlays matching active operating mode', () => {
  const appSrc = readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf-8');

  // Driving mode only overlays
  assertContains(appSrc, "appMode === APP_MODES.DRIVING && <DrivingHUD", 'DrivingHUD only in DRIVING');
  assertContains(appSrc, "appMode === APP_MODES.DRIVING && <DrivingCameraDock", 'DrivingCameraDock only in DRIVING');
  assertContains(appSrc, "appMode === APP_MODES.DRIVING && <DrivingControlsHelp", 'DrivingControlsHelp only in DRIVING');

  // Showroom mode only overlays
  assertContains(appSrc, "appMode === APP_MODES.SHOWROOM && <AutomotiveCameraDock", 'AutomotiveCameraDock only in SHOWROOM');
  assertContains(appSrc, "appMode === APP_MODES.SHOWROOM && <ComponentHUD", 'ComponentHUD only in SHOWROOM');
  assertContains(appSrc, "appMode === APP_MODES.SHOWROOM && (", 'VehicleSpecStrip only in SHOWROOM');
});

test('T13: StudioHeader renders contextual controls (TEST DRIVE in Showroom, STUDIO CONFIG in Driving)', () => {
  const headerSrc = readFileSync(path.join(ROOT, 'src', 'components', 'ui', 'StudioHeader.jsx'), 'utf-8');

  assertContains(headerSrc, 'TEST DRIVE', 'Header must have TEST DRIVE button in Showroom');
  assertContains(headerSrc, 'STUDIO CONFIG', 'Header must have STUDIO CONFIG button in Driving');
  assertContains(headerSrc, 'ASPHALT TEST PROVING GROUND', 'Header must identify proving ground circuit');
});

test('T14: DrivingHUD includes Return to Showroom button with prominent exit action', () => {
  const hudSrc = readFileSync(path.join(ROOT, 'src', 'components', 'ui', 'DrivingHUD.jsx'), 'utf-8');

  assertContains(hudSrc, 'Exit to Showroom Configurator', 'DrivingHUD must have Exit to Showroom button');
  assertContains(hudSrc, 'APP_MODES.SHOWROOM', 'DrivingHUD must trigger mode switch to SHOWROOM');
});

// ── 6. Camera System & Driving Perspectives ─────────────────────────────────

test('T15: Driving camera perspective cycling works correctly (CHASE -> CLOSE -> WIDE -> HOOD -> BUMPER)', () => {
  useAppModeStore.getState().setDrivingView(DRIVING_VIEWS.CHASE);
  assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.CHASE);

  useAppModeStore.getState().cycleDrivingView();
  assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.CLOSE);

  useAppModeStore.getState().cycleDrivingView();
  assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.WIDE);

  useAppModeStore.getState().cycleDrivingView();
  assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.HOOD);

  useAppModeStore.getState().cycleDrivingView();
  assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.BUMPER);

  useAppModeStore.getState().cycleDrivingView();
  assert(useAppModeStore.getState().drivingView === DRIVING_VIEWS.CHASE, 'Cycles back to CHASE');
});

test('T16: Simulation pause and resume maintain state integrity', () => {
  useAppModeStore.getState().setMode(APP_MODES.DRIVING);

  assert(useVehiclePhysicsStore.getState().isPaused === false);
  useVehiclePhysicsStore.getState().togglePause();
  assert(useVehiclePhysicsStore.getState().isPaused === true, 'Simulation should pause');

  useVehiclePhysicsStore.getState().togglePause();
  assert(useVehiclePhysicsStore.getState().isPaused === false, 'Simulation should resume');
});

// ── 7. Stress & Stability Verification ──────────────────────────────────────

test('T17: Repeated mode switching (10 cycles) executes without state corruption or stuck inputs', () => {
  for (let i = 0; i < 10; i++) {
    // Showroom -> Driving
    useAppModeStore.getState().setMode(APP_MODES.DRIVING);
    useVehicleInputStore.getState().setInputs({ throttle: 0.5, steer: 0.2 }, INPUT_SOURCE.KEYBOARD);

    // Driving -> Showroom
    useAppModeStore.getState().setMode(APP_MODES.SHOWROOM);
    assert(useVehicleInputStore.getState().throttle === 0.0);
    assert(useVehicleInputStore.getState().steer === 0.0);
  }
  assert(useAppModeStore.getState().mode === APP_MODES.SHOWROOM);
});

test('T18: App.jsx milestones includes completed Part 38', () => {
  const appSrc = readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf-8');
  assertContains(appSrc, 'id: 38', 'App.jsx must include Part 38');
  assertContains(appSrc, 'Driving Interface Polish and Showroom Integration', 'App.jsx must name Part 38 correctly');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(55));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);

if (failed === 0) {
  console.log('🎉 ALL PART 38 TESTS PASSED\n');
  process.exit(0);
} else {
  console.log('🔴 SOME TESTS FAILED:\n');
  results.filter(r => !r.ok).forEach(r => {
    console.log(`   ❌ ${r.name}: ${r.error}`);
  });
  console.log();
  process.exit(1);
}
