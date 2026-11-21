/**
 * test_part35_qr_pairing.mjs — Part 35: QR-Code Phone Pairing & Session Management
 *
 * Tests the server-side PairingSessionManager logic, network discovery,
 * and security properties of the pairing token system.
 *
 * Run with: node python/tests/test_part35_qr_pairing.mjs
 *
 * All tests use raw Node.js built-ins only (no external test framework).
 */

import crypto from 'crypto';
import os from 'os';
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath, URL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ─── Minimal inline session manager (mirrors vite.config.js logic for testing) ─

const TOKEN_EXPIRY_MS    = 5 * 60 * 1000;
const MAX_INVALID_ATTEMPTS = 3;

const SESSION_STATUS = {
  PENDING:   'pending',
  ACTIVE:    'active',
  EXPIRED:   'expired',
  CANCELLED: 'cancelled',
  LOCKED:    'locked',
};

class PairingSessionManager {
  constructor() { this._sessions = new Map(); }

  createSession(localIp, port = 5173) {
    const sessionId = crypto.randomUUID();
    const token     = crypto.randomBytes(32).toString('hex');
    const now       = Date.now();
    const expiresAt = now + TOKEN_EXPIRY_MS;
    const qrUrl     = `http://${localIp}:${port}/controller?session=${sessionId}&token=${token}`;
    this._sessions.set(sessionId, {
      id: sessionId, _token: token, createdAt: now, expiresAt,
      status: SESSION_STATUS.PENDING, invalidAttempts: 0,
      connectedAt: null, _qrUrl: qrUrl, localIp, port,
    });
    return { sessionId, expiresAt, qrUrl, localIp, port };
  }

  createSessionWithExpiry(localIp, port, expiryMs) {
    const result = this.createSession(localIp, port);
    const s = this._sessions.get(result.sessionId);
    s.expiresAt = Date.now() + expiryMs;
    this._sessions.set(result.sessionId, s);
    return { ...result, expiresAt: s.expiresAt };
  }

  _getToken(sessionId) {
    const s = this._sessions.get(sessionId);
    return s ? s._token : null;
  }

  validateToken(sessionId, token) {
    const s = this._sessions.get(sessionId);
    if (!s) return { valid: false, error: 'Session not found' };
    if (s.status === SESSION_STATUS.LOCKED)    return { valid: false, error: 'Session locked' };
    if (s.status === SESSION_STATUS.CANCELLED) return { valid: false, error: 'Session cancelled' };
    if (s.status === SESSION_STATUS.EXPIRED || Date.now() > s.expiresAt) {
      s.status = SESSION_STATUS.EXPIRED;
      return { valid: false, error: 'Session expired' };
    }
    const exp = Buffer.from(s._token, 'utf8');
    const got = Buffer.from(typeof token === 'string' ? token : '', 'utf8');
    let match = false;
    if (exp.length === got.length) {
      try { match = crypto.timingSafeEqual(exp, got); } catch (_) { match = false; }
    }
    if (!match) {
      s.invalidAttempts++;
      if (s.invalidAttempts >= MAX_INVALID_ATTEMPTS) s.status = SESSION_STATUS.LOCKED;
      this._sessions.set(sessionId, s);
      return { valid: false, error: `Invalid token`, locked: s.status === SESSION_STATUS.LOCKED, attemptsUsed: s.invalidAttempts };
    }
    return { valid: true, session: this._sanitize(s) };
  }

  activateSession(sessionId) {
    const s = this._sessions.get(sessionId);
    if (!s || s.status !== SESSION_STATUS.PENDING) return false;
    s.status = SESSION_STATUS.ACTIVE; s.connectedAt = Date.now();
    this._sessions.set(sessionId, s); return true;
  }

  cancelSession(sessionId) {
    const s = this._sessions.get(sessionId);
    if (!s) return false;
    s.status = SESSION_STATUS.CANCELLED;
    this._sessions.set(sessionId, s); return true;
  }

  getSession(sessionId) {
    const s = this._sessions.get(sessionId);
    if (!s) return null;
    if (s.status === SESSION_STATUS.PENDING && Date.now() > s.expiresAt) {
      s.status = SESSION_STATUS.EXPIRED; this._sessions.set(sessionId, s);
    }
    return this._sanitize(s);
  }

  _sanitize({ _token, _qrUrl, ...safe }) { return safe; }
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

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertMatch(value, pattern, msg) {
  if (!pattern.test(value)) throw new Error(msg || `Expected ${value} to match ${pattern}`);
}

// ─── Network Discovery helpers (mirrors vite.config.js) ──────────────────────

function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const wifi = [], other = [];
  const wifiNames = /^(en0|wlan|wi-fi|wireless|airport)/i;
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (wifiNames.test(name)) wifi.push({ ip: addr.address, iface: name, preferred: true });
      else other.push({ ip: addr.address, iface: name, preferred: false });
    }
  }
  const all = [...wifi, ...other];
  return all.length > 0 ? all : [{ ip: '127.0.0.1', iface: 'lo', preferred: false, loopback: true }];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n📋 Part 35 — QR-Code Phone Pairing & Session Management\n');

// T01: LAN IP discovery returns non-loopback IPv4
test('T01: LAN IP discovery returns at least one candidate address', () => {
  const addrs = getLocalNetworkAddresses();
  assert(Array.isArray(addrs) && addrs.length > 0, 'Expected at least one address');
  assert(addrs[0].ip, 'Expected ip field');
  assert(addrs[0].iface, 'Expected iface field');
});

// T02: Loopback addresses excluded from non-fallback results
test('T02: Loopback 127.0.0.1 excluded when real interfaces exist', () => {
  const realInterfaces = Object.values(os.networkInterfaces()).flat()
    .filter(a => a.family === 'IPv4' && !a.internal);
  if (realInterfaces.length === 0) {
    // No real interfaces on this machine — fallback to loopback is acceptable
    return;
  }
  const addrs = getLocalNetworkAddresses();
  const nonLoopback = addrs.filter(a => a.ip !== '127.0.0.1');
  assert(nonLoopback.length > 0, 'Expected at least one non-loopback IPv4 when real interfaces exist');
});

// T03: Session creation generates unique IDs
test('T03: Session creation generates unique session IDs', () => {
  const mgr = new PairingSessionManager();
  const s1  = mgr.createSession('192.168.1.1');
  const s2  = mgr.createSession('192.168.1.1');
  assert(s1.sessionId !== s2.sessionId, 'Session IDs must be unique');
  assert(typeof s1.sessionId === 'string' && s1.sessionId.length > 0, 'Session ID must be a non-empty string');
});

// T04: Token is 64-char hex (256-bit entropy)
test('T04: Pairing token is 64-char hex (256-bit entropy)', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const tok = mgr._getToken(s.sessionId);
  assert(typeof tok === 'string', 'Token must be a string');
  assert(tok.length === 64, `Token must be 64 chars, got ${tok.length}`);
  assertMatch(tok, /^[0-9a-f]{64}$/, 'Token must be lowercase hex');
});

// T05: Two sessions never share the same token
test('T05: Two sessions always have distinct tokens', () => {
  const mgr = new PairingSessionManager();
  const s1  = mgr.createSession('192.168.1.1');
  const s2  = mgr.createSession('192.168.1.1');
  const t1  = mgr._getToken(s1.sessionId);
  const t2  = mgr._getToken(s2.sessionId);
  assert(t1 !== t2, 'Each session must have a unique token');
});

// T06: Session includes expiry timestamp (5 min from creation)
test('T06: Session expiresAt is ~5 minutes from creation', () => {
  const before = Date.now();
  const mgr    = new PairingSessionManager();
  const s      = mgr.createSession('192.168.1.1');
  const after  = Date.now();
  const expectedMin = before + TOKEN_EXPIRY_MS - 100;
  const expectedMax = after  + TOKEN_EXPIRY_MS + 100;
  assert(s.expiresAt >= expectedMin && s.expiresAt <= expectedMax,
    `expiresAt ${s.expiresAt} not within expected 5-min window`);
});

// T07: Valid token validates successfully
test('T07: Correct token validates successfully', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const tok = mgr._getToken(s.sessionId);
  const r   = mgr.validateToken(s.sessionId, tok);
  assert(r.valid === true, `Expected valid:true, got: ${JSON.stringify(r)}`);
  assert(r.session, 'Expected session object in result');
  assert(!r.session._token, 'Sanitized session must not contain _token');
});

// T08: Invalid/wrong token is rejected
test('T08: Wrong token is rejected', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const r   = mgr.validateToken(s.sessionId, 'a'.repeat(64)); // wrong 64-char hex
  assert(r.valid === false, 'Expected valid:false for wrong token');
  assert(r.error, 'Expected error message');
});

// T09: Expired token is rejected
test('T09: Expired session token is rejected', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSessionWithExpiry('192.168.1.1', 5173, -1000); // already expired
  const tok = mgr._getToken(s.sessionId);
  const r   = mgr.validateToken(s.sessionId, tok);
  assert(r.valid === false, 'Expected valid:false for expired session');
  assert(/expired/i.test(r.error), `Expected 'expired' in error, got: ${r.error}`);
});

// T10: Session invalidated after cancellation
test('T10: Cancelled session cannot authenticate', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const tok = mgr._getToken(s.sessionId);
  mgr.cancelSession(s.sessionId);
  const r   = mgr.validateToken(s.sessionId, tok);
  assert(r.valid === false, 'Expected valid:false after cancellation');
  assert(/cancelled/i.test(r.error), `Expected 'cancelled' in error, got: ${r.error}`);
});

// T11: Max invalid attempts (3) locks session
test('T11: Session locks after 3 invalid token attempts', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const bad = 'b'.repeat(64);

  const r1 = mgr.validateToken(s.sessionId, bad);
  assert(!r1.valid && !r1.locked, `Attempt 1: should not be locked yet, got ${JSON.stringify(r1)}`);

  const r2 = mgr.validateToken(s.sessionId, bad);
  assert(!r2.valid && !r2.locked, `Attempt 2: should not be locked yet`);

  const r3 = mgr.validateToken(s.sessionId, bad);
  assert(!r3.valid && r3.locked === true, `Attempt 3: session should be locked, got ${JSON.stringify(r3)}`);

  // Further attempts must also be rejected
  const tok = mgr._getToken(s.sessionId);
  const r4 = mgr.validateToken(s.sessionId, tok);
  assert(!r4.valid && /locked/i.test(r4.error), `Attempt 4: even correct token rejected on locked session`);
});

// T12: New session creation after expiry
test('T12: Can create new session after previous expires', () => {
  const mgr = new PairingSessionManager();
  const s1  = mgr.createSessionWithExpiry('192.168.1.1', 5173, -1000);
  const s2  = mgr.createSession('192.168.1.1');
  assert(s1.sessionId !== s2.sessionId, 'New session must have different ID');
  const tok2 = mgr._getToken(s2.sessionId);
  const r    = mgr.validateToken(s2.sessionId, tok2);
  assert(r.valid, 'New session should validate successfully');
});

// T13: QR URL contains IP:port, session ID and token
test('T13: QR URL contains host, port, sessionId, and token', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.42', 5173);
  assertMatch(s.qrUrl, /192\.168\.1\.42/, 'QR URL must contain LAN IP');
  assertMatch(s.qrUrl, /:5173/, 'QR URL must contain port 5173');
  assertMatch(s.qrUrl, /[?&]session=/, 'QR URL must contain session= param');
  assertMatch(s.qrUrl, /[?&]token=/, 'QR URL must contain token= param');
});

// T14: QR URL uses non-loopback IP when real network available
test('T14: QR URL uses non-loopback IP when real interfaces exist', () => {
  const realInterfaces = Object.values(os.networkInterfaces()).flat()
    .filter(a => a.family === 'IPv4' && !a.internal);
  if (realInterfaces.length === 0) return; // acceptable on isolated CI

  const addrs = getLocalNetworkAddresses();
  const best  = addrs[0].ip;
  assert(best !== '127.0.0.1' || addrs[0].loopback, 'Best IP should not be loopback when real interfaces exist');
});

// T15: Session cleanup on expiry
test('T15: Expired sessions are detected and status updated', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSessionWithExpiry('192.168.1.1', 5173, -1000);
  const info = mgr.getSession(s.sessionId);
  assert(info !== null, 'Session should still exist');
  assert(info.status === SESSION_STATUS.EXPIRED, `Expected EXPIRED, got ${info.status}`);
});

// T16: Cancelled session cannot be used to authenticate WebSocket (via validateToken)
test('T16: Cancelled session cannot authenticate (simulates WS rejection)', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const tok = mgr._getToken(s.sessionId);
  mgr.cancelSession(s.sessionId);
  const r = mgr.validateToken(s.sessionId, tok);
  assert(r.valid === false, 'Cancelled session must reject WS auth');
});

// T17: activateSession marks session ACTIVE and sets connectedAt
test('T17: activateSession transitions PENDING → ACTIVE with timestamp', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const ok  = mgr.activateSession(s.sessionId);
  assert(ok, 'activateSession should return true for PENDING session');
  const info = mgr.getSession(s.sessionId);
  assert(info.status === SESSION_STATUS.ACTIVE, `Expected ACTIVE, got ${info.status}`);
  assert(info.connectedAt !== null, 'connectedAt must be set');
});

// T18: Sanitized session never contains _token or _qrUrl
test('T18: getSession() never exposes _token or _qrUrl', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const info = mgr.getSession(s.sessionId);
  assert(!('_token' in info), 'Sanitized session must not expose _token');
  assert(!('_qrUrl' in info), 'Sanitized session must not expose _qrUrl');
});

// T19: validateToken() result never contains raw token
test('T19: validateToken() result does not leak token in session object', () => {
  const mgr = new PairingSessionManager();
  const s   = mgr.createSession('192.168.1.1');
  const tok = mgr._getToken(s.sessionId);
  const r   = mgr.validateToken(s.sessionId, tok);
  assert(r.valid, 'Should be valid');
  if (r.session) {
    assert(!('_token' in r.session), 'Result session must not contain _token');
  }
});

// T20: vite.config.js exists and exports localControllerPlugin reference
test('T20: vite.config.js exists and references controller plugin', () => {
  const cfgPath = path.join(ROOT, 'vite.config.js');
  assert(existsSync(cfgPath), 'vite.config.js must exist');
  const src = readFileSync(cfgPath, 'utf-8');
  assert(/localControllerPlugin/.test(src), 'vite.config.js must define localControllerPlugin');
  assert(/create-session/.test(src), 'vite.config.js must have create-session endpoint');
  assert(/controller-ws/.test(src), 'vite.config.js must reference /controller-ws WebSocket path');
  assert(/pairingSessionManager|PairingSessionManager|sessionManager/.test(src), 'vite.config.js must use session manager');
});

// T21: SmartphoneConnectionPanel references QR code and session states
test('T21: SmartphoneConnectionPanel.jsx references QR code and PANEL_STATE', () => {
  const panelPath = path.join(ROOT, 'src', 'components', 'ui', 'SmartphoneConnectionPanel.jsx');
  assert(existsSync(panelPath), 'SmartphoneConnectionPanel.jsx must exist');
  const src = readFileSync(panelPath, 'utf-8');
  assert(/qrcode|QRCode/.test(src), 'Panel must reference qrcode library');
  assert(/PANEL_STATE/.test(src), 'Panel must define PANEL_STATE');
  assert(/create-session/.test(src), 'Panel must call create-session API');
  assert(/expiresAt|countdown|Countdown/.test(src), 'Panel must implement expiry countdown');
});

// T22: useControllerWebSocket hook exists
test('T22: useControllerWebSocket.js hook exists', () => {
  const p = path.join(ROOT, 'src', 'services', 'controller', 'useControllerWebSocket.js');
  assert(existsSync(p), 'useControllerWebSocket.js must exist');
  const src = readFileSync(p, 'utf-8');
  assert(/import.meta.hot/.test(src) || /import\.meta\.hot/.test(src), 'Hook must use import.meta.hot');
  assert(/controller:paired/.test(src), 'Hook must handle controller:paired event');
  assert(/controller:input/.test(src), 'Hook must handle controller:input event');
  assert(/controller:disconnected/.test(src), 'Hook must handle controller:disconnected event');
});

// T23: Controller page template produces valid HTML with WebSocket logic
test('T23: controllerPageTemplate.js produces HTML with WebSocket connection code', () => {
  const p = path.join(ROOT, 'src', 'services', 'controller', 'controllerPageTemplate.js');
  assert(existsSync(p), 'controllerPageTemplate.js must exist');
  const src = readFileSync(p, 'utf-8');
  assert(/WebSocket/.test(src), 'Template must include WebSocket connection code');
  assert(/controller-ws/.test(src), 'Template must connect to /controller-ws path');
  assert(/heartbeat/.test(src), 'Template must send heartbeat messages');
  assert(/token/.test(src), 'Template must use token in URL');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n─'.repeat(55));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);

if (failed === 0) {
  console.log('🎉 ALL PART 35 TESTS PASSED\n');
  process.exit(0);
} else {
  console.log('🔴 SOME TESTS FAILED:\n');
  results.filter(r => !r.ok).forEach(r => {
    console.log(`   ❌ ${r.name}: ${r.error}`);
  });
  console.log();
  process.exit(1);
}
