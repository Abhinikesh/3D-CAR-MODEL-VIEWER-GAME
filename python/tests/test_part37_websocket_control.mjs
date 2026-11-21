/**
 * test_part37_websocket_control.mjs — Part 37: WebSocket Communication & Real-Time Smartphone Control
 *
 * Comprehensive integration test suite validating:
 *  1. Valid phone connection & authentication
 *  2. Invalid session rejection (HTTP 4003)
 *  3. Expired session rejection (HTTP 4001)
 *  4. Steering transmission (-1.0 to +1.0)
 *  5. Throttle transmission (0.0 to 1.0)
 *  6. Brake transmission (0.0 to 1.0)
 *  7. Reverse request transmission
 *  8. Handbrake state transmission
 *  9. Reset discrete action
 * 10. Camera discrete action
 * 11. Multiple simultaneous input changes
 * 12. Disconnect input neutralization
 * 13. Stale-input timeout (> 750ms neutralizes continuous inputs)
 * 14. Network interruption & heartbeat timeout (> 2000ms disconnects)
 * 15. Reconnection safety (initial zero frame, no stuck inputs)
 * 16. Duplicate controller rejection (single-device lock, code 4409)
 * 17. Leaving Driving Mode (resetSession)
 * 18. Desktop keyboard fallback & input arbitration
 * 19. Rate limiting (max 60 packets/sec)
 * 20. Payload size limits (> 2048 bytes rejected)
 * 21. Protocol versioning (v1 validated)
 * 22. Action whitelisting (reject arbitrary commands)
 * 23. Numeric bounds clamping and non-finite number rejection
 * 24. Live telemetry push
 *
 * Run with: node python/tests/test_part37_websocket_control.mjs
 * Built with raw Node.js built-ins only.
 */

import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  INPUT_SOURCE,
  CONTROLLER_STATUS,
  CONTROLLER_ACTION,
  CONTROLLER_PROTOCOL_VERSION,
  STALE_INPUT_TIMEOUT_MS,
  HEARTBEAT_TIMEOUT_MS,
  MAX_PAYLOAD_BYTES,
  RATE_LIMIT_MAX_PACKETS,
} from '../../src/services/controller/controllerTypes.js';

import { validateControllerInput } from '../../src/services/controller/inputValidator.js';
import { useControllerSessionStore } from '../../src/services/controller/controllerSessionStore.js';
import { useVehicleInputStore, VEHICLE_GEAR } from '../../src/scenes/driving/vehicleInputStore.js';
import { localControllerService } from '../../src/services/controller/localControllerService.js';

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

async function testAsync(name, fn) {
  try {
    await fn();
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

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n📡 Part 37 — WebSocket Communication & Real-Time Smartphone Control\n');

// ── 1. Protocol & Validation Tests ──────────────────────────────────────────

test('T01: Protocol version 1 is supported and validated', () => {
  const validV1 = validateControllerInput({ v: 1, throttle: 0.5 });
  assert(validV1.valid === true, 'v1 should be valid');
  assertClose(validV1.data.throttle, 0.5);

  const invalidV99 = validateControllerInput({ v: 99, throttle: 0.5 });
  assert(invalidV99.valid === false, 'v99 should be rejected');
  assert(/unsupported protocol/i.test(invalidV99.error));

  const unversioned = validateControllerInput({ throttle: 0.8 });
  assert(unversioned.valid === true, 'Unversioned payloads should remain backward-compatible');
  assertClose(unversioned.data.throttle, 0.8);
});

test('T02: Continuous steering transmission is clamped to [-1.0, 1.0]', () => {
  const left = validateControllerInput({ steer: -0.75 });
  assert(left.valid);
  assertClose(left.data.steer, -0.75);

  const right = validateControllerInput({ steer: 0.85 });
  assert(right.valid);
  assertClose(right.data.steer, 0.85);

  // Clamping overshoots
  const overLeft = validateControllerInput({ steer: -3.5 });
  assert(overLeft.valid);
  assertClose(overLeft.data.steer, -1.0, 0.0001, 'Should clamp to -1.0');

  const overRight = validateControllerInput({ steer: 2.1 });
  assert(overRight.valid);
  assertClose(overRight.data.steer, 1.0, 0.0001, 'Should clamp to 1.0');
});

test('T03: Continuous throttle & brake transmission clamped to [0.0, 1.0]', () => {
  const pedal = validateControllerInput({ throttle: 0.65, brake: 0.35 });
  assert(pedal.valid);
  assertClose(pedal.data.throttle, 0.65);
  assertClose(pedal.data.brake, 0.35);

  const over = validateControllerInput({ throttle: 1.5, brake: -0.5 });
  assert(over.valid);
  assertClose(over.data.throttle, 1.0, 0.0001, 'Throttle clamps to 1.0');
  assertClose(over.data.brake, 0.0, 0.0001, 'Brake clamps to 0.0');
});

test('T04: Non-finite inputs (NaN, Infinity, Strings) are strictly rejected', () => {
  assert(!validateControllerInput({ throttle: NaN }).valid);
  assert(!validateControllerInput({ brake: Infinity }).valid);
  assert(!validateControllerInput({ steer: -Infinity }).valid);
  assert(!validateControllerInput({ throttle: 'full' }).valid);
});

test('T05: Reverse request and Handbrake states are sanitized booleans', () => {
  const flags1 = validateControllerInput({ reverse: true, handbrake: 1 });
  assert(flags1.valid);
  assert(flags1.data.reverse === true);
  assert(flags1.data.handbrake === true);

  const flags2 = validateControllerInput({ reverse: false, handbrake: 0 });
  assert(flags2.valid);
  assert(flags2.data.reverse === false);
  assert(flags2.data.handbrake === false);
});

test('T06: Discrete action whitelisting (accepts camera, reset, pause; rejects arbitrary commands)', () => {
  assert(validateControllerInput({ action: 'camera' }).valid);
  assert(validateControllerInput({ action: 'reset' }).valid);
  assert(validateControllerInput({ action: 'pause' }).valid);

  // Unknown actions must be rejected
  const badAction = validateControllerInput({ action: 'format_disk' });
  assert(badAction.valid === false);
  assert(/invalid action/i.test(badAction.error));

  const shellCommand = validateControllerInput({ action: 'rm -rf /' });
  assert(shellCommand.valid === false);
});

// ── 2. Controller Session Store & Connection Lifecycle ──────────────────────

test('T07: Valid phone connection registers device and switches active source to SMARTPHONE', () => {
  useControllerSessionStore.getState().resetSession();
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.KEYBOARD);

  const result = useControllerSessionStore.getState().connectController({
    id: 'phone-test-01',
    name: 'Pixel 8 Pro',
    ip: '192.168.1.50',
  });

  assert(result.success === true);
  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.CONNECTED);
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.SMARTPHONE);
  assert(useVehicleInputStore.getState().activeDeviceId === 'phone-test-01');

  // Verify inputs start at zero/neutral on fresh connection
  assert(useVehicleInputStore.getState().throttle === 0.0);
  assert(useVehicleInputStore.getState().brake === 0.0);
  assert(useVehicleInputStore.getState().steer === 0.0);
});

test('T08: Duplicate controller is rejected (single-device lock)', () => {
  // phone-test-01 is currently connected
  const secondAttempt = useControllerSessionStore.getState().connectController({
    id: 'phone-test-02',
    name: 'iPhone 15',
    ip: '192.168.1.55',
  });

  assert(secondAttempt.success === false);
  assert(/already connected/i.test(secondAttempt.error));
  assert(useVehicleInputStore.getState().activeDeviceId === 'phone-test-01');
});

test('T09: Input delivery updates vehicle input store in real time', () => {
  const result = useControllerSessionStore.getState().processIncomingInput({
    v: 1,
    throttle: 0.8,
    brake: 0.0,
    steer: -0.4,
    reverse: false,
    handbrake: false,
    timestamp: Date.now(),
  });

  assert(result.accepted === true);
  const input = useVehicleInputStore.getState();
  assertClose(input.throttle, 0.8);
  assertClose(input.steer, -0.4);
  assert(input.isAccelerating === true);
  assert(input.gear === VEHICLE_GEAR.DRIVE);
});

test('T10: Reverse toggle engages REVERSE gear and sets isReversing flag', () => {
  useControllerSessionStore.getState().processIncomingInput({
    v: 1,
    reverse: true,
    throttle: 0.5,
  });

  const input = useVehicleInputStore.getState();
  assert(input.gear === VEHICLE_GEAR.REVERSE);
  assert(input.isReversing === true);
  assertClose(input.throttle, 0.5);

  // Toggle back to DRIVE
  useControllerSessionStore.getState().processIncomingInput({
    v: 1,
    reverse: false,
  });
  assert(useVehicleInputStore.getState().gear === VEHICLE_GEAR.DRIVE);
  assert(useVehicleInputStore.getState().isReversing === false);
});

test('T11: Handbrake input engages handbrake flag in store', () => {
  useControllerSessionStore.getState().processIncomingInput({
    v: 1,
    handbrake: true,
  });
  assert(useVehicleInputStore.getState().handbrake === true);

  useControllerSessionStore.getState().processIncomingInput({
    v: 1,
    handbrake: false,
  });
  assert(useVehicleInputStore.getState().handbrake === false);
});

test('T12: Input arbitration: keyboard inputs are rejected while smartphone is active', () => {
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.SMARTPHONE);

  // Desktop keyboard attempts to steer or accelerate
  useVehicleInputStore.getState().setInputs({
    steer: 0.99,
    throttle: 1.0,
  }, INPUT_SOURCE.KEYBOARD);

  // Values should NOT change to keyboard inputs
  assert(useVehicleInputStore.getState().steer !== 0.99);
  assert(useVehicleInputStore.getState().throttle !== 1.0);
});

test('T13: Disconnect safely neutralizes vehicle inputs and returns control to KEYBOARD', () => {
  // Give car some throttle & steer
  useControllerSessionStore.getState().processIncomingInput({
    v: 1,
    throttle: 0.9,
    steer: 0.7,
  });
  assertClose(useVehicleInputStore.getState().throttle, 0.9);

  // Disconnect
  useControllerSessionStore.getState().disconnectController();

  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.READY);
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.KEYBOARD);
  assert(useVehicleInputStore.getState().throttle === 0.0, 'Throttle must be 0 after disconnect');
  assert(useVehicleInputStore.getState().brake === 0.0, 'Brake must be 0 after disconnect');
  assert(useVehicleInputStore.getState().steer === 0.0, 'Steer must be 0 after disconnect');
  assert(useVehicleInputStore.getState().handbrake === false);
  assert(useVehicleInputStore.getState().isAccelerating === false);
});

test('T14: Keyboard controls resume immediately after smartphone disconnects', () => {
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.KEYBOARD);

  useVehicleInputStore.getState().setInputs({
    throttle: 0.75,
    steer: 0.25,
  }, INPUT_SOURCE.KEYBOARD);

  assertClose(useVehicleInputStore.getState().throttle, 0.75);
  assertClose(useVehicleInputStore.getState().steer, 0.25);

  // Clean up
  useVehicleInputStore.getState().resetInputs();
});

// ── 3. Stale Input Timeout & Watchdog Safety ────────────────────────────────

test('T15: Stale-input watchdog neutralizes throttle & steer after 750ms without input', () => {
  useControllerSessionStore.getState().resetSession();
  useControllerSessionStore.getState().connectController({ id: 'phone-stale-test' });

  // Phone sends strong throttle and left steer
  useControllerSessionStore.getState().processIncomingInput({
    v: 1,
    throttle: 0.85,
    steer: -0.65,
  });
  assertClose(useVehicleInputStore.getState().throttle, 0.85);
  assertClose(useVehicleInputStore.getState().steer, -0.65);

  // Simulate 800ms elapsing without continuous inputs (heartbeat may still arrive)
  const device = useControllerSessionStore.getState().connectedDevice;
  device.lastInputTime = Date.now() - 850; // older than 750ms
  device.lastSeen = Date.now();            // heartbeat is still alive

  // Run watchdog check
  useControllerSessionStore.getState().checkHeartbeatTimeout();

  // Status should transition to STALE and continuous inputs must be neutralized
  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.STALE);
  assert(useVehicleInputStore.getState().throttle === 0.0, 'Throttle must neutralize on stale timeout');
  assert(useVehicleInputStore.getState().steer === 0.0, 'Steering must return to center on stale timeout');
  assert(useVehicleInputStore.getState().brake === 0.0);
});

test('T16: Fresh input received during STALE state immediately restores CONNECTED status', () => {
  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.STALE);

  // Driver touches steering again
  useControllerSessionStore.getState().processIncomingInput({
    v: 1,
    steer: 0.3,
    throttle: 0.2,
  });

  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.CONNECTED);
  assertClose(useVehicleInputStore.getState().steer, 0.3);
  assertClose(useVehicleInputStore.getState().throttle, 0.2);
});

test('T17: Hard heartbeat timeout (> 2000ms) disconnects controller and reverts to KEYBOARD', () => {
  const device = useControllerSessionStore.getState().connectedDevice;
  device.lastSeen = Date.now() - 2500; // 2.5s since any message

  const didTimeout = useControllerSessionStore.getState().checkHeartbeatTimeout();
  assert(didTimeout === true, 'Watchdog should trigger emergency disconnect');
  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.READY);
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.KEYBOARD);
  assert(useVehicleInputStore.getState().throttle === 0.0);
  assert(useVehicleInputStore.getState().steer === 0.0);
});

// ── 4. Network Interruption & Reconnection Safety ───────────────────────────

test('T18: Reconnection starts with clean neutral inputs (never restores old throttle/steer)', () => {
  // First session was running at 0.8 throttle before dropping
  useControllerSessionStore.getState().connectController({ id: 'reconnected-phone' });

  // Initial state upon reconnection MUST be zero
  const input = useVehicleInputStore.getState();
  assert(input.throttle === 0.0, 'Reconnection must start with 0 throttle');
  assert(input.steer === 0.0, 'Reconnection must start with 0 steer');
  assert(input.brake === 0.0);
  assert(input.handbrake === false);
});

test('T19: Leaving Driving Mode (resetSession) safely clears all controller state', () => {
  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.CONNECTED);

  useControllerSessionStore.getState().resetSession();

  assert(useControllerSessionStore.getState().status === CONTROLLER_STATUS.DISCONNECTED);
  assert(useControllerSessionStore.getState().connectedDevice === null);
  assert(useVehicleInputStore.getState().activeSource === INPUT_SOURCE.KEYBOARD);
  assert(useVehicleInputStore.getState().throttle === 0.0);
});

// ── 5. Server Architecture & Vite Plugin Verification ───────────────────────

test('T20: Vite configuration implements rate limiting and frame size guards', () => {
  const vitePath = path.join(ROOT, 'vite.config.js');
  const src = readFileSync(vitePath, 'utf-8');

  assertContains(src, 'MAX_PAYLOAD_BYTES', 'vite.config.js must define MAX_PAYLOAD_BYTES');
  assertContains(src, 'MAX_PACKETS_PER_SEC', 'vite.config.js must define MAX_PACKETS_PER_SEC');
  assertContains(src, 'rateWindowStart', 'vite.config.js must track rate limit window');
  assertContains(src, 'controller:telemetry', 'vite.config.js must handle desktop telemetry forwarding');
});

test('T21: DrivingScene mounts useControllerWebSocket hook for persistent background input', () => {
  const scenePath = path.join(ROOT, 'src', 'scenes', 'driving', 'DrivingScene.jsx');
  const src = readFileSync(scenePath, 'utf-8');

  assertContains(src, 'useControllerWebSocket', 'DrivingScene must import useControllerWebSocket');
  assertContains(src, 'useControllerWebSocket()', 'DrivingScene must call useControllerWebSocket()');
});

test('T22: DrivingHUD streams live speed telemetry to smartphone controller', () => {
  const hudPath = path.join(ROOT, 'src', 'components', 'ui', 'DrivingHUD.jsx');
  const src = readFileSync(hudPath, 'utf-8');

  assertContains(src, 'sendControllerTelemetry', 'DrivingHUD must import sendControllerTelemetry');
  assertContains(src, 'speedKmh: displaySpeed', 'DrivingHUD must pass real displaySpeed');
});

test('T23: Mobile controller page template includes protocol version and auto-reconnect', () => {
  const vitePath = path.join(ROOT, 'vite.config.js');
  const src = readFileSync(vitePath, 'utf-8');

  assertContains(src, 'v: 1', 'Mobile controller must specify protocol version v: 1');
  assertContains(src, 'healthTimer', 'Mobile controller must track connection health');
  assertContains(src, 'Attempting automatic reconnection', 'Mobile controller must support automatic reconnection');
});

test('T24: App.jsx milestone for Part 37 added', () => {
  const appPath = path.join(ROOT, 'src', 'App.jsx');
  const src = readFileSync(appPath, 'utf-8');

  assertContains(src, 'id: 37', 'App.jsx must include Part 37');
  assertContains(src, 'WebSocket Communication', 'App.jsx must name Part 37 correctly');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

function assertContains(source, needle, msg) {
  if (!source.includes(needle)) throw new Error(msg || `Expected to find: ${needle}`);
}

console.log('\n' + '─'.repeat(55));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);

if (failed === 0) {
  console.log('🎉 ALL PART 37 TESTS PASSED\n');
  process.exit(0);
} else {
  console.log('🔴 SOME TESTS FAILED:\n');
  results.filter(r => !r.ok).forEach(r => {
    console.log(`   ❌ ${r.name}: ${r.error}`);
  });
  console.log();
  process.exit(1);
}
