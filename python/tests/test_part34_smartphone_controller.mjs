/**
 * test_part34_smartphone_controller.mjs
 * Part 34 — Smartphone Controller Architecture & Unified Input Arbitration
 *
 * Verifies:
 * - Normalized input structure across keyboard, smartphone, and future gamepad
 * - Input validation & bounds clamping (throttle [0,1], brake [0,1], steer [-1,1])
 * - Malformed / invalid input rejection (NaN, infinity, non-objects, non-boolean flags)
 * - Single-active-controller ownership model
 * - Source arbitration: mobile controller ownership locks out keyboard continuous inputs
 * - Separation of continuous inputs from one-time discrete actions (camera, reset, pause)
 * - Safe disconnect handling & immediate neutral input restoration
 * - Prevention of multiple phones taking control simultaneously (single-device lock)
 * - Heartbeat watchdog timeout detection (> 2000ms idle neutralizes controller)
 * - Mode exit & session cleanup behavior
 * - Backward compatibility: default keyboard operation preserved 100%
 *
 * Run with:  node python/tests/test_part34_smartphone_controller.mjs
 */

import {
  INPUT_SOURCE,
  CONTROLLER_STATUS,
  CONTROLLER_ACTION,
} from '../../src/services/controller/controllerTypes.js';
import { validateControllerInput } from '../../src/services/controller/inputValidator.js';
import { useVehicleInputStore, VEHICLE_GEAR } from '../../src/scenes/driving/vehicleInputStore.js';
import { useControllerSessionStore } from '../../src/services/controller/controllerSessionStore.js';

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    pass++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
    failures.push({ name, error: err.message });
    fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? 'Assertion failed');
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertClose(a, b, msg, tol = 1e-5) {
  if (Math.abs(a - b) > tol) throw new Error(msg ?? `Expected ~${b}, got ${a}`);
}

console.log('\n━━━ Part 34: Smartphone Controller Architecture & Arbitration ━━━\n');

// ── T01: Input Source Constants ──────────────────────────────────────────────
test('T01: INPUT_SOURCE defines KEYBOARD, SMARTPHONE, and GAMEPAD', () => {
  assertEq(INPUT_SOURCE.KEYBOARD, 'keyboard', 'KEYBOARD source');
  assertEq(INPUT_SOURCE.SMARTPHONE, 'smartphone', 'SMARTPHONE source');
  assertEq(INPUT_SOURCE.GAMEPAD, 'gamepad', 'GAMEPAD source');
});

// ── T02: Controller Status Constants ─────────────────────────────────────────
test('T02: CONTROLLER_STATUS defines DISCONNECTED, READY, PAIRING, CONNECTED', () => {
  assertEq(CONTROLLER_STATUS.DISCONNECTED, 'disconnected', 'DISCONNECTED');
  assertEq(CONTROLLER_STATUS.READY, 'ready', 'READY');
  assertEq(CONTROLLER_STATUS.CONNECTED, 'connected', 'CONNECTED');
});

// ── T03: Input Validator — Valid Continuous Controls ─────────────────────────
test('T03: Input validator accepts valid continuous controls within range', () => {
  const result = validateControllerInput({
    throttle: 0.75,
    brake: 0.25,
    steering: -0.6,
    reverse: false,
    handbrake: false,
  });
  assert(result.valid === true, 'Payload should be valid');
  assertClose(result.data.throttle, 0.75, 'Throttle');
  assertClose(result.data.brake, 0.25, 'Brake');
  assertClose(result.data.steer, -0.6, 'Steering');
  assertEq(result.data.reverse, false, 'Reverse');
  assertEq(result.data.handbrake, false, 'Handbrake');
});

// ── T04: Input Validator — Range Clamping ─────────────────────────────────────
test('T04: Input validator clamps throttle/brake to [0,1] and steer to [-1,1]', () => {
  const result = validateControllerInput({
    throttle: 99.5,
    brake: -10,
    steering: 5.5,
  });
  assert(result.valid === true, 'Clamped payload is valid');
  assertEq(result.data.throttle, 1.0, 'Throttle clamped to 1.0');
  assertEq(result.data.brake, 0.0, 'Brake clamped to 0.0');
  assertEq(result.data.steer, 1.0, 'Steering clamped to 1.0');
});

// ── T05: Input Validator — Rejection of Malformed Payloads ───────────────────
test('T05: Input validator rejects non-object, null, or NaN inputs', () => {
  assert(validateControllerInput(null).valid === false, 'null rejected');
  assert(validateControllerInput('string').valid === false, 'string rejected');
  assert(validateControllerInput(123).valid === false, 'number rejected');
  assert(validateControllerInput({ throttle: NaN }).valid === false, 'NaN throttle rejected');
  assert(validateControllerInput({ brake: Infinity }).valid === false, 'Infinity brake rejected');
  assert(validateControllerInput({ steering: 'fast' }).valid === false, 'string steer rejected');
});

// ── T06: Input Validator — Discrete Action Validation ────────────────────────
test('T06: Input validator handles discrete actions (camera, reset, pause)', () => {
  const cam = validateControllerInput({ action: 'camera' });
  assert(cam.valid === true && cam.data.action === 'camera', 'camera action valid');

  const rst = validateControllerInput({ action: 'reset' });
  assert(rst.valid === true && rst.data.action === 'reset', 'reset action valid');

  const inv = validateControllerInput({ action: 'invalid_action_xyz' });
  assert(inv.valid === false, 'unrecognized action rejected');
});

// ── T07: Default State — Keyboard has Active Ownership ───────────────────────
test('T07: vehicleInputStore initializes with KEYBOARD as active source', () => {
  useVehicleInputStore.getState().resetInputs();
  const state = useVehicleInputStore.getState();
  assertEq(state.activeSource, INPUT_SOURCE.KEYBOARD, 'Default activeSource must be KEYBOARD');
  assertEq(state.throttle, 0.0, 'Initial throttle 0');
  assertEq(state.brake, 0.0, 'Initial brake 0');
  assertEq(state.steer, 0.0, 'Initial steer 0');
});

// ── T08: Keyboard Driving Works Normally When Active ─────────────────────────
test('T08: Keyboard sets continuous inputs when KEYBOARD is activeSource', () => {
  useVehicleInputStore.getState().setActiveSource(INPUT_SOURCE.KEYBOARD);
  useVehicleInputStore.getState().setInputs({ throttle: 0.85, steer: -0.5 }, INPUT_SOURCE.KEYBOARD);

  const state = useVehicleInputStore.getState();
  assertClose(state.throttle, 0.85, 'Keyboard throttle applied');
  assertClose(state.steer, -0.5, 'Keyboard steer applied');
  assert(state.isAccelerating === true, 'isAccelerating flag set');
});

// ── T09: Smartphone Ownership Handover & Neutral Input Reset ─────────────────
test('T09: Switching activeSource to SMARTPHONE resets previous inputs cleanly', () => {
  // Ensure keyboard was driving
  useVehicleInputStore.getState().setActiveSource(INPUT_SOURCE.KEYBOARD);
  useVehicleInputStore.getState().setInputs({ throttle: 1.0, steer: 0.75 }, INPUT_SOURCE.KEYBOARD);

  // Switch to Smartphone
  useVehicleInputStore.getState().setActiveSource(INPUT_SOURCE.SMARTPHONE, 'phone-session-001');

  const state = useVehicleInputStore.getState();
  assertEq(state.activeSource, INPUT_SOURCE.SMARTPHONE, 'activeSource changed to SMARTPHONE');
  assertEq(state.activeDeviceId, 'phone-session-001', 'activeDeviceId set');
  assertEq(state.throttle, 0.0, 'Throttle automatically neutralized on handover');
  assertEq(state.steer, 0.0, 'Steering automatically neutralized on handover');
  assertEq(state.brake, 0.0, 'Brake neutralized on handover');
});

// ── T10: Input Arbitration — Keyboard Blocked While Smartphone Active ────────
test('T10: Keyboard continuous inputs are rejected when SMARTPHONE is active', () => {
  useVehicleInputStore.getState().setActiveSource(INPUT_SOURCE.SMARTPHONE, 'phone-session-001');

  // Attempt to inject keyboard throttle & steer
  useVehicleInputStore.getState().setInputs({ throttle: 1.0, steer: 1.0 }, INPUT_SOURCE.KEYBOARD);

  const state = useVehicleInputStore.getState();
  assertEq(state.throttle, 0.0, 'Keyboard throttle must be rejected while phone is active');
  assertEq(state.steer, 0.0, 'Keyboard steer must be rejected while phone is active');
});

// ── T11: Smartphone Drives Continuous Inputs When Active ─────────────────────
test('T11: Smartphone successfully sets inputs when SMARTPHONE is active', () => {
  useVehicleInputStore.getState().setActiveSource(INPUT_SOURCE.SMARTPHONE, 'phone-session-001');

  useVehicleInputStore.getState().setInputs(
    { throttle: 0.9, steer: -0.4, handbrake: false },
    INPUT_SOURCE.SMARTPHONE
  );

  const state = useVehicleInputStore.getState();
  assertClose(state.throttle, 0.9, 'Mobile throttle applied');
  assertClose(state.steer, -0.4, 'Mobile steer applied');
});

// ── T12: Disconnect Handling & Keyboard Restoration ──────────────────────────
test('T12: Disconnecting controller zeroes inputs and returns control to KEYBOARD', () => {
  useVehicleInputStore.getState().setActiveSource(INPUT_SOURCE.SMARTPHONE, 'phone-session-001');
  useVehicleInputStore.getState().setInputs({ throttle: 0.8, steer: 0.5 }, INPUT_SOURCE.SMARTPHONE);

  // Disconnect controller
  useVehicleInputStore.getState().neutralizeController(INPUT_SOURCE.SMARTPHONE);

  const state = useVehicleInputStore.getState();
  assertEq(state.activeSource, INPUT_SOURCE.KEYBOARD, 'Active source returned to KEYBOARD');
  assertEq(state.activeDeviceId, null, 'activeDeviceId cleared');
  assertEq(state.throttle, 0.0, 'Throttle zeroed');
  assertEq(state.steer, 0.0, 'Steer zeroed');

  // Keyboard can drive again immediately
  useVehicleInputStore.getState().setInputs({ throttle: 0.5 }, INPUT_SOURCE.KEYBOARD);
  assertClose(useVehicleInputStore.getState().throttle, 0.5, 'Keyboard active again');
});

// ── T13: Controller Session Store — Pairing Lifecycle ────────────────────────
test('T13: controllerSessionStore handles pairing and connection state', () => {
  useControllerSessionStore.getState().resetSession();
  assertEq(useControllerSessionStore.getState().status, CONTROLLER_STATUS.DISCONNECTED, 'Initial DISCONNECTED');

  const res = useControllerSessionStore.getState().connectController({
    id: 'test-phone-abc',
    name: 'iPhone 15 Pro',
    ip: '192.168.1.50',
  });

  assert(res.success === true, 'Connection succeeds');
  const session = useControllerSessionStore.getState();
  assertEq(session.status, CONTROLLER_STATUS.CONNECTED, 'Status CONNECTED');
  assertEq(session.connectedDevice.id, 'test-phone-abc', 'Device ID matched');
  assertEq(useVehicleInputStore.getState().activeSource, INPUT_SOURCE.SMARTPHONE, 'InputStore arbitration synced');
});

// ── T14: Single-Device Lock (Prevent Multiple Controllers) ───────────────────
test('T14: Single-controller lock rejects a second phone taking control', () => {
  useControllerSessionStore.getState().resetSession();
  useControllerSessionStore.getState().connectController({
    id: 'first-phone',
    name: 'Primary Phone',
  });

  // Attempt second phone connection
  const secondAttempt = useControllerSessionStore.getState().connectController({
    id: 'second-phone-hijack',
    name: 'Secondary Phone',
  });

  assert(secondAttempt.success === false, 'Second controller must be rejected');
  assertEq(useControllerSessionStore.getState().connectedDevice.id, 'first-phone', 'Primary phone retained');
});

// ── T15: Ingestion Pipeline with Input Validation ────────────────────────────
test('T15: processIncomingInput validates, updates store, and tracks stats', () => {
  useControllerSessionStore.getState().connectController({ id: 'active-phone' });

  // Valid packet
  const res1 = useControllerSessionStore.getState().processIncomingInput({
    throttle: 0.65,
    steering: 0.3,
    timestamp: Date.now() - 5,
  });
  assert(res1.accepted === true, 'Valid packet accepted');
  assertClose(useVehicleInputStore.getState().throttle, 0.65, 'Throttle passed to input store');

  // Malformed packet
  const res2 = useControllerSessionStore.getState().processIncomingInput({
    throttle: 'not-a-number',
  });
  assert(res2.accepted === false, 'Malformed packet rejected');
  assert(useControllerSessionStore.getState().stats.packetsRejected > 0, 'Rejected count incremented');
});

// ── T16: Heartbeat Watchdog Timeout ──────────────────────────────────────────
test('T16: Heartbeat watchdog detects stale mobile connection (> 2000ms) and disconnects', () => {
  useControllerSessionStore.getState().connectController({ id: 'active-phone' });
  useVehicleInputStore.getState().setInputs({ throttle: 1.0 }, INPUT_SOURCE.SMARTPHONE);

  // Artificially simulate stale lastSeen (2500ms ago)
  useControllerSessionStore.setState((s) => ({
    connectedDevice: { ...s.connectedDevice, lastSeen: Date.now() - 2500 },
  }));

  const timedOut = useControllerSessionStore.getState().checkHeartbeatTimeout();
  assert(timedOut === true, 'Watchdog should trigger timeout');
  assertEq(useControllerSessionStore.getState().status, CONTROLLER_STATUS.READY, 'Status reverted');
  assertEq(useVehicleInputStore.getState().activeSource, INPUT_SOURCE.KEYBOARD, 'Source reverted to KEYBOARD');
  assertEq(useVehicleInputStore.getState().throttle, 0.0, 'Throttle zeroed for safety');
});

// ── T17: Mode Exit & Session Reset ───────────────────────────────────────────
test('T17: resetSession cleans up all controller state on mode exit', () => {
  useControllerSessionStore.getState().connectController({ id: 'phone-to-clear' });
  useControllerSessionStore.getState().openPanel();

  useControllerSessionStore.getState().resetSession();
  const session = useControllerSessionStore.getState();
  assertEq(session.status, CONTROLLER_STATUS.DISCONNECTED, 'Status DISCONNECTED');
  assertEq(session.connectedDevice, null, 'connectedDevice null');
  assertEq(session.isPanelOpen, false, 'Panel closed');
  assertEq(useVehicleInputStore.getState().activeSource, INPUT_SOURCE.KEYBOARD, 'Input store restored');
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
console.log(`━━━ Results: ${pass} passed, ${fail} failed ━━━`);

if (failures.length) {
  console.log('\nFailed tests:');
  failures.forEach(({ name, error }) => {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error}`);
  });
}

console.log('');
process.exit(fail > 0 ? 1 : 0);
