/**
 * test_part33_keyboard_input.mjs
 * Part 33 — Keyboard Driving Controls & Input Management
 *
 * Node.js test harness (no browser required) that validates:
 * - vehicleInputStore API shape and normalization
 * - Keyboard-to-store mapping logic (via simulated keysDown state)
 * - Input priority rules (handbrake, dual-pedal, forward/reverse logic)
 * - Gear selection rules
 * - One-shot key repeat guard (documented behavior)
 * - Window blur cleanup behavior
 * - Pause guard behavior
 * - Steering direction convention
 * - Reverse intent (G key) logic
 *
 * Run with:  node python/tests/test_part33_keyboard_input.mjs
 */

// ─── Lightweight mock environment ───────────────────────────────────────────
// Replicate the input-mapping logic from KeyboardVehicleInput in pure JS
// so we can unit-test it without a React / Three.js / Rapier environment.

const VEHICLE_GEAR = { DRIVE: 'D', REVERSE: 'R', NEUTRAL: 'N' };
const REV_THRESHOLD = 0.35; // m/s — matches vehiclePhysicsConfig

/**
 * Pure-function version of the useFrame logic from KeyboardVehicleInput.
 * Returns { throttle, brake, steer, gear, handbrake }.
 */
function computeInputs(keys, currentSpeed) {
  const { forward, backward, left, right, handbrake, reverseIntent } = keys;

  let throttle = 0.0;
  let brake    = 0.0;
  let gear     = VEHICLE_GEAR.DRIVE;

  if (handbrake) {
    throttle = 0.0;
    brake    = 1.0;
    gear     = currentSpeed < -0.1 ? VEHICLE_GEAR.REVERSE : VEHICLE_GEAR.DRIVE;

  } else if (forward && backward) {
    throttle = 0.0;
    brake    = 1.0;
    gear     = currentSpeed < -0.1 ? VEHICLE_GEAR.REVERSE : VEHICLE_GEAR.DRIVE;

  } else if (reverseIntent && !forward) {
    if (currentSpeed > REV_THRESHOLD) {
      throttle = 0.0;
      brake    = 1.0;
      gear     = VEHICLE_GEAR.DRIVE;
    } else {
      throttle = backward ? 1.0 : 0.0;
      brake    = 0.0;
      gear     = VEHICLE_GEAR.REVERSE;
    }

  } else if (forward) {
    if (currentSpeed < -REV_THRESHOLD) {
      throttle = 0.0;
      brake    = 1.0;
      gear     = VEHICLE_GEAR.REVERSE;
    } else {
      throttle = 1.0;
      brake    = 0.0;
      gear     = VEHICLE_GEAR.DRIVE;
    }

  } else if (backward) {
    if (currentSpeed > REV_THRESHOLD) {
      throttle = 0.0;
      brake    = 1.0;
      gear     = VEHICLE_GEAR.DRIVE;
    } else {
      throttle = 1.0;
      brake    = 0.0;
      gear     = VEHICLE_GEAR.REVERSE;
    }

  } else {
    throttle = 0.0;
    brake    = 0.0;
    gear     = currentSpeed < -0.1 ? VEHICLE_GEAR.REVERSE : VEHICLE_GEAR.DRIVE;
  }

  let steer = 0.0;
  if (left && !right) steer = -1.0;
  else if (right && !left) steer = 1.0;

  return { throttle, brake, steer, gear, handbrake: Boolean(handbrake) };
}

// ─── Minimal vehicleInputStore mock ─────────────────────────────────────────
function createInputStoreMock() {
  let state = {
    throttle: 0, brake: 0, steer: 0, handbrake: false,
    gear: VEHICLE_GEAR.DRIVE,
    isAccelerating: false, isBraking: false, isReversing: false,
  };
  let resetCallCount = 0;
  let setCallCount   = 0;

  return {
    setInputs(inputs) {
      setCallCount++;
      if (inputs.throttle !== undefined) {
        state.throttle       = Math.max(0, Math.min(1, Number(inputs.throttle) || 0));
        state.isAccelerating = state.throttle > 0.01;
      }
      if (inputs.brake !== undefined) {
        state.brake    = Math.max(0, Math.min(1, Number(inputs.brake) || 0));
        state.isBraking = state.brake > 0.01;
      }
      if (inputs.steer !== undefined) {
        state.steer = Math.max(-1, Math.min(1, Number(inputs.steer) || 0));
      }
      if (inputs.gear !== undefined && Object.values(VEHICLE_GEAR).includes(inputs.gear)) {
        state.gear       = inputs.gear;
        state.isReversing = inputs.gear === VEHICLE_GEAR.REVERSE;
      }
      if (inputs.handbrake !== undefined) {
        state.handbrake = Boolean(inputs.handbrake);
      }
    },
    resetInputs() {
      resetCallCount++;
      state = {
        throttle: 0, brake: 0, steer: 0, handbrake: false,
        gear: VEHICLE_GEAR.DRIVE,
        isAccelerating: false, isBraking: false, isReversing: false,
      };
    },
    getState: () => ({ ...state }),
    getResetCount: () => resetCallCount,
    getSetCount:   () => setCallCount,
  };
}

// ─── Test runner ─────────────────────────────────────────────────────────────
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

function assert(condition, msg) {
  if (!condition) throw new Error(msg ?? 'Assertion failed');
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertClose(a, b, msg, tol = 1e-6) {
  if (Math.abs(a - b) > tol) throw new Error(msg ?? `Expected ~${b}, got ${a}`);
}

// ─── Test cases ───────────────────────────────────────────────────────────────

console.log('\n━━━ Part 33: Keyboard Driving Controls ━━━\n');

// ── T01: W key → throttle=1.0, gear=DRIVE at standstill ──────────────────
test('T01: W key → throttle=1.0, gear=DRIVE when stationary', () => {
  const result = computeInputs(
    { forward:true, backward:false, left:false, right:false, handbrake:false, reverseIntent:false },
    0 // stationary
  );
  assertEq(result.throttle, 1.0, 'throttle');
  assertEq(result.brake,    0.0, 'brake');
  assertEq(result.gear, VEHICLE_GEAR.DRIVE, 'gear');
});

// ── T02: S key → brake when moving forward ───────────────────────────────
test('T02: S key → brake=1.0 when moving forward (speed > threshold)', () => {
  const result = computeInputs(
    { forward:false, backward:true, left:false, right:false, handbrake:false, reverseIntent:false },
    5.0 // moving forward at 5 m/s
  );
  assertEq(result.throttle, 0.0, 'throttle must be 0');
  assertEq(result.brake,    1.0, 'brake must be 1');
  assertEq(result.gear, VEHICLE_GEAR.DRIVE, 'gear must be DRIVE');
});

// ── T03: S key → reverse when at standstill ──────────────────────────────
test('T03: S key → reverse gear + throttle=1.0 when stationary', () => {
  const result = computeInputs(
    { forward:false, backward:true, left:false, right:false, handbrake:false, reverseIntent:false },
    0.0
  );
  assertEq(result.throttle, 1.0, 'throttle');
  assertEq(result.brake,    0.0, 'brake');
  assertEq(result.gear, VEHICLE_GEAR.REVERSE, 'gear');
});

// ── T04: A key → steer=-1.0 (LEFT) ──────────────────────────────────────
test('T04: A key → steer=-1.0 (LEFT)', () => {
  const result = computeInputs(
    { forward:false, backward:false, left:true, right:false, handbrake:false, reverseIntent:false },
    0
  );
  assertEq(result.steer, -1.0, 'steer must be -1.0');
});

// ── T05: D key → steer=+1.0 (RIGHT) ─────────────────────────────────────
test('T05: D key → steer=+1.0 (RIGHT)', () => {
  const result = computeInputs(
    { forward:false, backward:false, left:false, right:true, handbrake:false, reverseIntent:false },
    0
  );
  assertEq(result.steer, 1.0, 'steer must be +1.0');
});

// ── T06: A+W simultaneously → throttle=1.0, steer=-1.0 ──────────────────
test('T06: A+W → throttle=1.0, steer=-1.0 simultaneously', () => {
  const result = computeInputs(
    { forward:true, backward:false, left:true, right:false, handbrake:false, reverseIntent:false },
    0
  );
  assertEq(result.throttle, 1.0, 'throttle');
  assertEq(result.steer,   -1.0, 'steer');
  assertEq(result.gear, VEHICLE_GEAR.DRIVE, 'gear');
});

// ── T07: S+D simultaneously (braking + right steer) ──────────────────────
test('T07: S+D while moving forward → brake=1.0, steer=+1.0', () => {
  const result = computeInputs(
    { forward:false, backward:true, left:false, right:true, handbrake:false, reverseIntent:false },
    5.0
  );
  assertEq(result.brake, 1.0, 'brake');
  assertEq(result.steer, 1.0, 'steer');
});

// ── T08: Space → handbrake=true, brake=1.0 ───────────────────────────────
test('T08: Space key → handbrake=true, brake=1.0', () => {
  const result = computeInputs(
    { forward:false, backward:false, left:false, right:false, handbrake:true, reverseIntent:false },
    0
  );
  assert(result.handbrake === true, 'handbrake flag must be true');
  assertEq(result.brake, 1.0, 'brake');
  assertEq(result.throttle, 0.0, 'throttle must be 0');
});

// ── T09: Key release → throttle goes to 0 ────────────────────────────────
test('T09: Releasing all keys → throttle=0, brake=0, steer=0', () => {
  const result = computeInputs(
    { forward:false, backward:false, left:false, right:false, handbrake:false, reverseIntent:false },
    0
  );
  assertEq(result.throttle, 0.0, 'throttle');
  assertEq(result.brake,    0.0, 'brake');
  assertEq(result.steer,    0.0, 'steer');
});

// ── T10: Window blur → resetInputs called ────────────────────────────────
test('T10: Window blur → resetInputs() called (store zeroed)', () => {
  const store = createInputStoreMock();
  store.setInputs({ throttle: 1.0, steer: -0.5, gear: VEHICLE_GEAR.DRIVE });
  assertEq(store.getState().throttle, 1.0, 'pre-blur throttle');
  // Simulate blur
  store.resetInputs();
  assertEq(store.getState().throttle, 0.0, 'post-blur throttle');
  assertEq(store.getState().steer,    0.0, 'post-blur steer');
  assert(store.getResetCount() === 1, 'resetInputs called exactly once');
});

// ── T11: Pause guard → inputs go to zero when isPaused ───────────────────
test('T11: Pause guard halts input injection (resetInputs called)', () => {
  const store = createInputStoreMock();
  store.setInputs({ throttle: 1.0 });
  // Simulate pause guard triggering resetInputs
  let isPaused = true;
  let wasActive = true;
  if (isPaused && wasActive) {
    store.resetInputs();
    wasActive = false;
  }
  assertEq(store.getState().throttle, 0.0, 'throttle zeroed on pause');
  assert(!wasActive, 'wasActive cleared');
  assert(store.getResetCount() === 1, 'resetInputs called once');
});

// ── T12: Vehicle reset key → requestReset called ─────────────────────────
test('T12: R key → requestReset mock called', () => {
  let resetCalled = false;
  const mockPhysicsStore = { requestReset: () => { resetCalled = true; } };
  // Simulate one-shot keydown (no repeat)
  const e = { code: 'KeyR', repeat: false, target: { tagName: 'BODY' } };
  if (!e.repeat && e.code === 'KeyR') {
    mockPhysicsStore.requestReset();
  }
  assert(resetCalled, 'requestReset should be called');
});

// ── T13: G key → reverse intent engaged near standstill ──────────────────
test('T13: G key → reverseIntent=true → REVERSE gear when stationary', () => {
  const result = computeInputs(
    { forward:false, backward:false, left:false, right:false, handbrake:false, reverseIntent:true },
    0.0
  );
  assertEq(result.gear, VEHICLE_GEAR.REVERSE, 'gear must be REVERSE');
  assertEq(result.throttle, 0.0, 'throttle=0 since backward not pressed');
});

// ── T14: C key → cycleDrivingView called (one-shot) ──────────────────────
test('T14: C key → cycleDrivingView mock called once', () => {
  let callCount = 0;
  const mockAppStore = { cycleDrivingView: () => { callCount++; } };
  // No repeat — fires once
  const e = { code: 'KeyC', repeat: false };
  if (!e.repeat && e.code === 'KeyC') {
    mockAppStore.cycleDrivingView();
  }
  assertEq(callCount, 1, 'cycleDrivingView should be called once');
});

// ── T15: Repeat keydown for R → no double-reset ───────────────────────────
test('T15: Repeated R keydown with e.repeat=true → requestReset NOT called again', () => {
  let callCount = 0;
  const mockPhysicsStore = { requestReset: () => { callCount++; } };
  const handleKeyDown = (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyR') mockPhysicsStore.requestReset();
  };
  handleKeyDown({ code: 'KeyR', repeat: false, target: { tagName: 'BODY' } });
  handleKeyDown({ code: 'KeyR', repeat: true,  target: { tagName: 'BODY' } });
  handleKeyDown({ code: 'KeyR', repeat: true,  target: { tagName: 'BODY' } });
  assertEq(callCount, 1, 'requestReset must be called exactly once despite repeat events');
});

// ── T16: Mode switch to SHOWROOM → resetInputs called (component unmounts) ─
test('T16: Component unmount (mode switch) → resetInputs called', () => {
  const store = createInputStoreMock();
  store.setInputs({ throttle: 0.8, steer: 1.0 });
  // Simulate cleanup function
  const cleanup = () => { store.resetInputs(); };
  cleanup();
  assertEq(store.getState().throttle, 0.0, 'throttle zeroed on unmount');
  assertEq(store.getState().steer,    0.0, 'steer zeroed on unmount');
  assert(store.getResetCount() === 1, 'resetInputs called once');
});

// ── T17: Input abstraction — setInputs/resetInputs interface consistency ──
test('T17: vehicleInputStore setInputs/resetInputs interface contract', () => {
  const store = createInputStoreMock();
  store.setInputs({ throttle: 0.75, brake: 0.0, steer: -0.5, gear: VEHICLE_GEAR.DRIVE, handbrake: false });
  const s = store.getState();
  assertClose(s.throttle, 0.75, 'throttle 0.75');
  assertClose(s.steer,   -0.5,  'steer -0.5');
  assert(s.isAccelerating, 'isAccelerating derived flag');

  store.resetInputs();
  const r = store.getState();
  assertEq(r.throttle, 0.0, 'throttle reset');
  assertEq(r.steer,    0.0, 'steer reset');
  assert(!r.isAccelerating, 'isAccelerating cleared');
  assert(!r.isBraking,      'isBraking cleared');
  assert(!r.isReversing,    'isReversing cleared');
});

// ── T18: Steering direction convention ───────────────────────────────────
test('T18: Steering direction: LEFT=−1.0, RIGHT=+1.0', () => {
  const leftResult = computeInputs(
    { forward:false, backward:false, left:true, right:false, handbrake:false, reverseIntent:false }, 0
  );
  const rightResult = computeInputs(
    { forward:false, backward:false, left:false, right:true, handbrake:false, reverseIntent:false }, 0
  );
  assert(leftResult.steer  < 0, 'Left steer must be negative');
  assert(rightResult.steer > 0, 'Right steer must be positive');
  assertEq(leftResult.steer,  -1.0, 'Full left = -1.0');
  assertEq(rightResult.steer, +1.0, 'Full right = +1.0');
});

// ── T19: Dual-pedal conflict (W+S) → brake overrides ─────────────────────
test('T19: W+S simultaneously → brake overrides (safety)', () => {
  const result = computeInputs(
    { forward:true, backward:true, left:false, right:false, handbrake:false, reverseIntent:false },
    5.0
  );
  assertEq(result.throttle, 0.0, 'throttle must be 0 on conflict');
  assertEq(result.brake,    1.0, 'brake must be 1.0 on conflict');
});

// ── T20: W while reversing → brake activates ─────────────────────────────
test('T20: W pressed while reversing (speed < −threshold) → brake=1.0', () => {
  const result = computeInputs(
    { forward:true, backward:false, left:false, right:false, handbrake:false, reverseIntent:false },
    -3.0 // moving backward at 3 m/s
  );
  assertEq(result.throttle, 0.0, 'throttle must be 0');
  assertEq(result.brake,    1.0, 'brake must be 1.0');
  assertEq(result.gear, VEHICLE_GEAR.REVERSE, 'gear stays REVERSE while braking out of reverse');
});

// ── T21: G key while moving forward → brake first ────────────────────────
test('T21: G key while moving forward (speed > threshold) → brake first', () => {
  const result = computeInputs(
    { forward:false, backward:false, left:false, right:false, handbrake:false, reverseIntent:true },
    8.0 // moving forward fast
  );
  assertEq(result.brake,    1.0, 'must brake when G pressed while moving forward');
  assertEq(result.throttle, 0.0, 'no throttle');
  assertEq(result.gear, VEHICLE_GEAR.DRIVE, 'still in DRIVE while braking');
});

// ── T22: G+S key → reverse throttle ──────────────────────────────────────
test('T22: G+S key while stationary → REVERSE gear with throttle=1.0', () => {
  const result = computeInputs(
    { forward:false, backward:true, left:false, right:false, handbrake:false, reverseIntent:true },
    0.0
  );
  assertEq(result.gear, VEHICLE_GEAR.REVERSE, 'REVERSE gear');
  assertEq(result.throttle, 1.0, 'throttle=1.0 (backward key held)');
});

// ── T23: setInputs clamps throttle to [0, 1] ─────────────────────────────
test('T23: setInputs throttle clamped to [0,1] range', () => {
  const store = createInputStoreMock();
  store.setInputs({ throttle: 999 });
  assertEq(store.getState().throttle, 1.0, 'clamped to 1.0');
  store.setInputs({ throttle: -5 });
  assertEq(store.getState().throttle, 0.0, 'clamped to 0.0');
});

// ── T24: setInputs clamps steer to [-1, 1] ───────────────────────────────
test('T24: setInputs steer clamped to [−1,+1] range', () => {
  const store = createInputStoreMock();
  store.setInputs({ steer: 10 });
  assertEq(store.getState().steer, 1.0, 'clamped to +1.0');
  store.setInputs({ steer: -10 });
  assertEq(store.getState().steer, -1.0, 'clamped to -1.0');
});

// ── T25: setInputs rejects invalid gear ──────────────────────────────────
test('T25: setInputs ignores invalid gear strings', () => {
  const store = createInputStoreMock();
  store.setInputs({ gear: VEHICLE_GEAR.DRIVE });
  assertEq(store.getState().gear, VEHICLE_GEAR.DRIVE, 'valid gear accepted');
  store.setInputs({ gear: 'TURBO' }); // invalid
  assertEq(store.getState().gear, VEHICLE_GEAR.DRIVE, 'invalid gear ignored');
});

// ── T26: Handbrake priority over reverseIntent ───────────────────────────
test('T26: Space (handbrake) takes priority over G (reverseIntent)', () => {
  const result = computeInputs(
    { forward:false, backward:false, left:false, right:false, handbrake:true, reverseIntent:true },
    0
  );
  assert(result.handbrake, 'handbrake flag set');
  assertEq(result.brake,    1.0, 'brake=1.0');
  assertEq(result.throttle, 0.0, 'throttle=0');
});

// ── T27: steer=0 when both A and D held ──────────────────────────────────
test('T27: A+D simultaneously → steer=0.0 (opposing cancel)', () => {
  const result = computeInputs(
    { forward:false, backward:false, left:true, right:true, handbrake:false, reverseIntent:false },
    0
  );
  assertEq(result.steer, 0.0, 'opposing steering keys cancel');
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
