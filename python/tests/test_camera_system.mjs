import {
  useCameraStore,
  CAMERA_PRESETS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from '../../src/store/cameraStore.js';

console.log('[Test] Running Camera & Navigation System Automated Verification...');

// 1. Verify all 10 presets exist
const expectedPresets = [
  'front',
  'rear',
  'left',
  'right',
  'top',
  'bottom',
  'front-left',
  'front-right',
  'rear-left',
  'rear-right',
];

for (const key of expectedPresets) {
  if (!CAMERA_PRESETS[key]) {
    throw new Error(`Missing preset: ${key}`);
  }
}
console.log('✓ PASS: All 10 presets defined and registered.');

// 2. Coordinate convention tests
if (CAMERA_PRESETS['front'].position[2] <= 0) throw new Error('Front preset must be at +Z');
if (CAMERA_PRESETS['rear'].position[2] >= 0) throw new Error('Rear preset must be at -Z');
if (CAMERA_PRESETS['left'].position[0] <= 0) throw new Error('Left preset must be at +X (driver side)');
if (CAMERA_PRESETS['right'].position[0] >= 0) throw new Error('Right preset must be at -X (passenger side)');
if (CAMERA_PRESETS['top'].position[1] <= 0) throw new Error('Top preset must be at +Y (roof plan view)');
if (CAMERA_PRESETS['bottom'].position[1] >= 0) throw new Error('Bottom preset must be at -Y (undercarriage view)');
console.log('✓ PASS: Canonical automotive coordinate conventions verified:');
console.log('    Front (+Z), Rear (-Z), Left (+X), Right (-X), Top (+Y), Bottom (-Y)');

// 3. Target verification: all presets target vehicle centroid [0, 0.75, 0]
for (const key of expectedPresets) {
  const p = CAMERA_PRESETS[key];
  if (
    Math.abs(p.target[0]) > 0.001 ||
    Math.abs(p.target[1] - 0.75) > 0.001 ||
    Math.abs(p.target[2]) > 0.001
  ) {
    throw new Error(`Preset ${key} target is not [0, 0.75, 0]: ${JSON.stringify(p.target)}`);
  }
}
console.log('✓ PASS: All presets strictly target vehicle centroid [0, 0.75, 0].');

// 4. Underside floor penetration flag
if (!CAMERA_PRESETS['bottom'].allowUnderside) {
  throw new Error('Bottom preset must flag allowUnderside: true');
}
if (CAMERA_PRESETS['front'].allowUnderside) {
  throw new Error('Front preset must not flag allowUnderside: true');
}
console.log('✓ PASS: Chassis underside floor relaxation constraint verified.');

// 5. Zustand state machine tests
const store = useCameraStore.getState();

// Preset selection
store.setPreset('front');
let state = useCameraStore.getState();
if (state.activePreset !== 'front' || !state.isTransitioning || state.desiredPosition[2] < 6.0) {
  throw new Error('setPreset failed');
}

// Transition settlement
store.finishTransition();
state = useCameraStore.getState();
if (state.isTransitioning) throw new Error('finishTransition failed');

// Projection mode toggle
store.setProjectionMode('orthographic');
state = useCameraStore.getState();
if (state.projectionMode !== 'orthographic') throw new Error('setProjectionMode orthographic failed');

store.setProjectionMode('perspective');
state = useCameraStore.getState();
if (state.projectionMode !== 'perspective') throw new Error('setProjectionMode perspective failed');

// Reset view
store.resetView();
state = useCameraStore.getState();
if (state.activePreset !== 'front-left' || state.projectionMode !== 'perspective') {
  throw new Error('resetView failed');
}

// Fit to vehicle
store.setBounds({ size: { x: 2.47, y: 1.74, z: 4.56 }, center: { x: 0, y: 0.75, z: 0 } });
store.fitToVehicle();
state = useCameraStore.getState();
if (!state.isTransitioning || !state.desiredPosition) {
  throw new Error('fitToVehicle failed');
}

// Custom view on user interaction
store.setCustomView();
state = useCameraStore.getState();
if (state.activePreset !== 'custom') {
  throw new Error('setCustomView failed');
}

console.log('✓ PASS: Zustand camera state actions verified successfully.');

// ─── Part 12 Advanced Automotive Camera & Cinematic Verification ───
console.log('\n[Test Part 12] Advanced Automotive Viewpoints & Cinematic Mode Verification...');

// 6. Verify all 6 Advanced Automotive Viewpoints
const advancedViewpoints = [
  'elevated-front',
  'elevated-rear',
  'wheel-detail',
  'front-detail',
  'rear-detail',
  'interior-view',
];

for (const key of advancedViewpoints) {
  const p = CAMERA_PRESETS[key];
  if (!p) throw new Error(`Missing advanced viewpoint: ${key}`);
  if (!p.position || p.position.length !== 3) throw new Error(`${key} invalid position`);
  if (!p.target || p.target.length !== 3) throw new Error(`${key} invalid target`);
}
console.log('✓ PASS: All 6 advanced automotive viewpoints defined (Elevated, Details & Cockpit).');

// 7. Verify Component Focus Definitions
import { FOCUS_TARGETS } from '../../src/store/cameraStore.js';
const expectedFocus = ['vehicle', 'front', 'rear', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr', 'cabin'];
for (const f of expectedFocus) {
  if (!FOCUS_TARGETS[f]) throw new Error(`Missing focus target definition: ${f}`);
}
console.log('✓ PASS: All 8 component focus targets mapped.');

// 8. Verify focusOn action
store.focusOn('wheel_fl');
state = useCameraStore.getState();
if (!state.isTransitioning || state.activePreset !== 'focus-wheel_fl') {
  throw new Error('focusOn action failed');
}
store.finishTransition();

// 9. Verify Turntable Mode state machine
store.toggleTurntable(true);
state = useCameraStore.getState();
if (!state.isTurntableActive) throw new Error('toggleTurntable(true) failed');

store.setTurntableSpeed(2.5);
state = useCameraStore.getState();
if (state.turntableSpeed !== 2.5) throw new Error('setTurntableSpeed failed');

store.stopTurntable();
state = useCameraStore.getState();
if (state.isTurntableActive) throw new Error('stopTurntable failed');

// Selecting a preset should automatically halt turntable
store.toggleTurntable(true);
store.setPreset('front-left');
state = useCameraStore.getState();
if (state.isTurntableActive) throw new Error('Preset selection must pause turntable');
store.finishTransition();

console.log('✓ PASS: Turntable controls and auto-pause on interaction verified.');

// 10. Verify configurable transition smoothing factor
store.setTransitionSmoothing(8.5);
state = useCameraStore.getState();
if (state.transitionSmoothing !== 8.5) throw new Error('setTransitionSmoothing failed');
store.setTransitionSmoothing(7.5); // restore default

console.log('✓ PASS: Configurable transition smoothing factor verified.');
console.log('✓ All Part 6 & Part 12 Camera, Navigation & Cinematic tests passed!\n');
