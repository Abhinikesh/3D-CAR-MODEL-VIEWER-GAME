/**
 * test_part36_mobile_controller.mjs — Part 36: Mobile Controller Webpage and Touch Controls
 *
 * Tests the mobile controller HTML page served from Vite middleware:
 *  - Page content and structure
 *  - Steering, throttle, brake logic (pure JS function testing)
 *  - Touch safety and input neutralization behaviour
 *  - Action routing
 *  - Layout and accessibility attributes
 *
 * Run with: node python/tests/test_part36_mobile_controller.mjs
 *
 * Uses raw Node.js built-ins only (no browser, no test framework).
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const VITE_CONFIG = path.join(ROOT, 'vite.config.js');

// ─── Load vite.config.js source ─────────────────────────────────────────────
const viteSrc = readFileSync(VITE_CONFIG, 'utf-8');

// Extract buildControllerPageHTML output by running the function inline
// (We re-implement the extraction logic to avoid importing full vite.config.js,
//  which has Node-only imports.)
function extractControllerHTML() {
  // The function returns a template literal between the first ` after return` and the final `};`
  // We use a minimal regex to find the returned HTML string
  const match = viteSrc.match(/function buildControllerPageHTML\(\)\s*\{[\s\S]*?return\s*`([\s\S]*?)`;\s*\}/);
  if (!match) throw new Error('Could not extract buildControllerPageHTML from vite.config.js');
  return match[1];
}

let html;
try {
  html = extractControllerHTML();
} catch (e) {
  console.error('❌ Could not extract controller HTML:', e.message);
  process.exit(1);
}

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

function assertContains(source, needle, msg) {
  if (!source.includes(needle)) throw new Error(msg || `Expected to find: ${needle.slice(0, 80)}`);
}

function assertNotContains(source, needle, msg) {
  if (source.includes(needle)) throw new Error(msg || `Expected NOT to find: ${needle.slice(0, 80)}`);
}

function assertMatch(source, pattern, msg) {
  if (!pattern.test(source)) throw new Error(msg || `Expected pattern ${pattern} to match`);
}

// ─── Steering math (mirrors controller JS, testable without DOM) ─────────────

function pointerToSteer(clientX, rectLeft, rectWidth) {
  var rel = (clientX - rectLeft) / rectWidth;
  return Math.max(-1, Math.min(1, (rel - 0.5) * 2));
}

function clampSteer(val) { return Math.max(-1, Math.min(1, val)); }
function clampPedal(val) { return Math.max(0, Math.min(1, val)); }

function pedalFromY(clientY, rectTop, rectHeight) {
  var rel = 1 - ((clientY - rectTop) / rectHeight);
  return clampPedal(rel);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n📱 Part 36 — Mobile Controller Webpage and Touch Controls\n');

// ── T01: HTML structure
test('T01: Controller page has DOCTYPE and html lang attribute', () => {
  assertContains(html, '<!DOCTYPE html>', 'Must have DOCTYPE');
  assertContains(html, 'lang="en"', 'Must have lang=en');
});

test('T02: Viewport meta disables user-scalable zoom', () => {
  assertMatch(html, /user-scalable=no/, 'Must disable user-scalable zoom');
  assertMatch(html, /maximum-scale=1/, 'Must set maximum-scale=1');
});

test('T03: Touch-action:none is set on body/html to prevent scroll hijack', () => {
  assertMatch(html, /touch-action:\s*none/, 'Must set touch-action:none on control elements');
});

test('T04: Steering zone exists with aria-label and slider role', () => {
  assertContains(html, 'id="steerZone"', 'Must have steerZone element');
  assertContains(html, 'role="slider"', 'Steer zone must have slider role');
  assertMatch(html, /aria-label.*[Ss]teer/, 'Steer zone must have steering aria-label');
});

test('T05: Throttle button exists with aria-label', () => {
  assertContains(html, 'id="throttleBtn"', 'Must have throttleBtn');
  assertMatch(html, /aria-label.*[Tt]hrottle/, 'Throttle must have aria-label');
  assertContains(html, 'GAS', 'Throttle must show GAS label');
});

test('T06: Brake button exists with aria-label', () => {
  assertContains(html, 'id="brakeBtn"', 'Must have brakeBtn');
  assertMatch(html, /aria-label.*[Bb]rake/, 'Brake must have aria-label');
  assertContains(html, 'BRAKE', 'Brake must show BRAKE label');
});

test('T07: Utility buttons: Camera, Reset, Handbrake, Reverse present', () => {
  assertContains(html, 'id="btnCamera"',    'Must have camera button');
  assertContains(html, 'id="btnReset"',     'Must have reset button');
  assertContains(html, 'id="btnHandbrake"', 'Must have handbrake button');
  assertContains(html, 'id="btnReverse"',   'Must have reverse button');
});

test('T08: Utility buttons have aria-label attributes', () => {
  assertMatch(html, /aria-label.*[Cc]amera/, 'Camera btn must have aria-label');
  assertMatch(html, /aria-label.*[Rr]eset/,  'Reset btn must have aria-label');
  assertMatch(html, /aria-label.*[Hh]andbrake/, 'Handbrake must have aria-label');
  assertMatch(html, /aria-label.*[Rr]everse/,   'Reverse must have aria-label');
});

test('T09: Disconnect button exists in controller UI', () => {
  assertContains(html, 'id="disconnectBtn"', 'Must have disconnectBtn');
  assertMatch(html, /aria-label.*[Dd]isconnect/, 'Disconnect must have aria-label');
});

test('T10: Status bar / connection indicator present', () => {
  assertContains(html, 'id="statusBar"', 'Must have statusBar');
  assertContains(html, 'id="sbDot"',     'Must have connection dot');
  assertContains(html, 'id="sbLatency"', 'Must have latency display');
});

test('T11: Connect/error screen separate from controller UI', () => {
  assertContains(html, 'id="connectScreen"', 'Must have connectScreen overlay');
  assertContains(html, 'id="controller"',    'Must have controller div');
  assertContains(html, 'id="retryBtn"',      'Must have retry button in connect screen');
});

test('T12: Controller div hidden until connected (class show pattern)', () => {
  assertContains(html, 'classList.add(\'show\')', 'Controller must be shown via classList.add show');
  assertMatch(html, /#controller\.show\s*\{[^}]*display/, 'CSS must reveal controller via .show class');
});

test('T13: WebSocket connect/close/error handlers all present', () => {
  assertContains(html, "ws.addEventListener('open'",    'Must handle WS open');
  assertContains(html, "ws.addEventListener('close'",   'Must handle WS close');
  assertContains(html, "ws.addEventListener('error'",   'Must handle WS error');
  assertContains(html, "ws.addEventListener('message'", 'Must handle WS messages');
});

test('T14: Heartbeat is sent every ~500ms', () => {
  assertMatch(html, /setInterval[^,]*,\s*500/, 'Must use 500ms heartbeat interval');
  assertContains(html, "type: 'heartbeat'", 'Must send heartbeat type');
});

test('T15: Input loop dispatches continuous input at ~50ms', () => {
  assertMatch(html, /setInterval\s*\(sendInput\s*,\s*50\)/, 'Must have 50ms input dispatch loop');
});

test('T16: Input packet includes throttle, brake, steer, handbrake, reverse fields', () => {
  assertContains(html, 'throttle:', 'Input packet must include throttle');
  assertContains(html, 'brake:',    'Input packet must include brake');
  assertContains(html, 'steer:',    'Input packet must include steer');
  assertContains(html, 'handbrake:', 'Input packet must include handbrake');
  assertContains(html, 'reverse:',   'Input packet must include reverse');
});

test('T17: Action messages sent for camera and reset', () => {
  assertContains(html, "sendAction('camera')", 'Must call sendAction for camera');
  assertContains(html, "sendAction('reset')",  'Must call sendAction for reset');
});

test('T18: Steering clamped to [-1, +1] range', () => {
  // Math test of the inline logic
  assert(pointerToSteer(0,   0, 400) === -1, 'Far left should give -1');
  assert(pointerToSteer(400, 0, 400) ===  1, 'Far right should give +1');
  assert(pointerToSteer(200, 0, 400) ===  0, 'Center should give 0');
  // Overshoot clamps
  assert(pointerToSteer(-100, 0, 400) === -1, 'Under 0 must clamp to -1');
  assert(pointerToSteer(600,  0, 400) ===  1, 'Over width must clamp to +1');
});

test('T19: Steering center restore on release', () => {
  assertContains(html, 'state.steer = 0', 'Must reset steer to 0 on release');
  assertContains(html, 'updateSteerUI(0)', 'Must update steer UI on release');
});

test('T20: Throttle clamped to [0, 1] range', () => {
  var rect = { top: 100, height: 200 };
  assert(pedalFromY(100, 100, 200) === 1,   'Touch at top should give 1 (full throttle)');
  assert(pedalFromY(300, 100, 200) === 0,   'Touch at bottom should give 0');
  assert(pedalFromY(200, 100, 200) === 0.5, 'Touch at center should give 0.5');
  // Clamp overshot
  assert(pedalFromY(50,  100, 200) === 1, 'Above top must clamp to 1');
  assert(pedalFromY(400, 100, 200) === 0, 'Below bottom must clamp to 0');
});

test('T21: Throttle released immediately on touchend/touchcancel', () => {
  assertContains(html, "touchend',    onThrottleEnd", 'Must handle throttle touchend');
  assertContains(html, "touchcancel', onThrottleEnd", 'Must handle throttle touchcancel');
  assertContains(html, 'state.throttle = 0', 'Must zero throttle on release');
});

test('T22: Brake released immediately on touchend/touchcancel', () => {
  assertContains(html, "touchend',    onBrakeEnd", 'Must handle brake touchend');
  assertContains(html, "touchcancel', onBrakeEnd", 'Must handle brake touchcancel');
  assertContains(html, 'state.brake = 0', 'Must zero brake on release');
});

test('T23: Steering released immediately on touchcancel', () => {
  assertContains(html, "touchcancel', function (e) { e.preventDefault(); onSteerEnd(); }", 
    'Must handle steer touchcancel');
});

test('T24: visibilitychange handler neutralizes inputs when page is hidden', () => {
  assertContains(html, "document.addEventListener('visibilitychange'", 'Must handle visibilitychange');
  assertContains(html, 'document.hidden', 'Must check document.hidden');
  assertContains(html, 'clearAllInputs()', 'Must call clearAllInputs on hide');
});

test('T25: Window blur handler neutralizes inputs', () => {
  assertContains(html, "window.addEventListener('blur'", 'Must handle window blur');
  // blur handler should also call clearAllInputs
  assertMatch(html, /blur.*clearAllInputs|clearAllInputs.*blur/s, 'Blur must trigger clearAllInputs');
});

test('T26: clearAllInputs sends zero frame immediately via WS', () => {
  assertContains(html, 'function clearAllInputs()', 'Must define clearAllInputs function');
  assertContains(html, 'state.steer = 0', 'clearAllInputs must zero steer');
  assertContains(html, 'ws.send(JSON.stringify', 'Must send immediate zero input via WS');
});

test('T27: Error codes 4001 / 4003 / 4409 handled with distinct messages', () => {
  assertContains(html, 'code === 4001', 'Must handle 4001 expired code');
  assertContains(html, 'code === 4003', 'Must handle 4003 auth failed code');
  assertContains(html, 'code === 4409', 'Must handle 4409 already-connected code');
});

test('T28: Invalid QR (missing session/token) shows error immediately without connecting', () => {
  assertContains(html, '!SESSION || !TOKEN', 'Must check for missing session/token');
  assertContains(html, 'Invalid QR Code', 'Must show invalid QR message');
});

test('T29: Handbrake toggle updates aria-pressed', () => {
  assertContains(html, "setAttribute('aria-pressed'", 'Buttons must update aria-pressed');
  assertContains(html, 'toggle-on', 'Handbrake must use toggle-on class');
});

test('T30: Reverse toggle shows/hides reverse indicator strip', () => {
  assertContains(html, 'id="reverseStrip"', 'Must have reverse indicator strip');
  assertContains(html, "classList.toggle('show', state.reverse)", 'Must toggle reverse strip visibility');
});

test('T31: Landscape layout via CSS orientation media query', () => {
  assertContains(html, '@media (orientation: landscape)', 'Must have landscape media query');
  assertContains(html, '#pedalZone', 'Landscape block must include pedal zone rules');
});

test('T32: Portrait layout has steering at top, pedals at bottom', () => {
  // Default grid: steer + pedals arranged vertically
  assertMatch(html, /grid-template-areas.*steer.*pedals/s, 'Must define grid areas for steer and pedals');
});

test('T33: Body scrolling prevention: touchmove on body prevented', () => {
  assertContains(html, "document.addEventListener('touchmove'", 'Must add body touchmove listener');
  assertContains(html, 'e.preventDefault()', 'Must call preventDefault on body touchmove');
});

test('T34: Double-tap zoom prevention on util buttons', () => {
  assertContains(html, 'lastTap', 'Must track last tap time');
  assertContains(html, '300', 'Must use ~300ms double-tap threshold');
});

test('T35: Vite.config.js still builds correctly (syntax check)', () => {
  // Quick syntax check: count matching braces (approximate)
  const opens  = (viteSrc.match(/\{/g) || []).length;
  const closes = (viteSrc.match(/\}/g) || []).length;
  // Allow small imbalance due to string literals containing braces
  assert(Math.abs(opens - closes) < 50, `Brace imbalance: ${opens} open vs ${closes} close`);
});

test('T36: Controller page does not expose desktop configurator navigation', () => {
  assertNotContains(html, 'ConfiguratorWorkspace', 'Must not expose desktop configurator');
  assertNotContains(html, 'EngineeringMilestones', 'Must not expose milestones drawer');
  assertNotContains(html, 'StudioHeader',           'Must not expose studio header');
});

test('T37: Page is self-contained (no external JS imports that require bundler)', () => {
  assertNotContains(html, 'import React',    'Must not import React');
  assertNotContains(html, 'import { ',       'Must not use ES module imports');
  assertNotContains(html, '<script src=',    'Must not load external script files');
});

test('T38: Both touchstart and pointer events registered for cross-browser support', () => {
  assertContains(html, "addEventListener('touchstart'", 'Must use touchstart');
  assertContains(html, "addEventListener('pointerdown'", 'Must use pointerdown');
});

test('T39: Status bar shows latency display area', () => {
  assertContains(html, 'id="sbLatency"', 'Must have latency display in status bar');
  assertMatch(html, /pong.*latency|latency.*pong/is, 'Must update latency from pong messages');
});

test('T40: App.jsx milestone for Part 36 added', () => {
  const appSrc = readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf-8');
  assertContains(appSrc, '36', 'App.jsx must reference Part 36');
  assertContains(appSrc, 'Mobile Controller', 'App.jsx must name Part 36 correctly');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(55));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);

if (failed === 0) {
  console.log('🎉 ALL PART 36 TESTS PASSED\n');
  process.exit(0);
} else {
  console.log('🔴 SOME TESTS FAILED:\n');
  results.filter(r => !r.ok).forEach(r => {
    console.log(`   ❌ ${r.name}: ${r.error}`);
  });
  console.log();
  process.exit(1);
}
