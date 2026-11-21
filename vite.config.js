import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';

// ─── Network Discovery ──────────────────────────────────────────────────────

/**
 * Returns candidate LAN IPv4 addresses the phone can reach, ranked by preference:
 *  1. Wi-Fi (en0, wlan0, Wi-Fi, Wireless) — most likely what the phone is on
 *  2. Any other non-internal IPv4
 *  3. Loopback fallback (not reachable by phone — QR will warn)
 *
 * Returns an array so the UI can let the user pick if multiple interfaces exist.
 */
function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const wifi = [];
  const other = [];

  const wifiNames = /^(en0|wlan|wi-fi|wireless|airport)/i;

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (wifiNames.test(name)) {
        wifi.push({ ip: addr.address, iface: name, preferred: true });
      } else {
        other.push({ ip: addr.address, iface: name, preferred: false });
      }
    }
  }

  const all = [...wifi, ...other];
  return all.length > 0 ? all : [{ ip: '127.0.0.1', iface: 'lo', preferred: false, loopback: true }];
}

function getBestLocalIp() {
  const addrs = getLocalNetworkAddresses();
  return addrs[0].ip;
}

// ─── Pairing Session Manager (inline — Vite plugins are CJS/ESM mixed) ──────

import crypto from 'crypto';

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
  constructor() {
    this._sessions = new Map();
  }

  createSession(localIp, port = 5173) {
    this._pruneOld();
    const sessionId = crypto.randomUUID();
    const token     = crypto.randomBytes(32).toString('hex');
    const now       = Date.now();
    const expiresAt = now + TOKEN_EXPIRY_MS;
    const qrUrl     = `http://${localIp}:${port}/controller?session=${sessionId}&token=${token}`;

    this._sessions.set(sessionId, {
      id: sessionId, _token: token, createdAt: now, expiresAt,
      status: SESSION_STATUS.PENDING, invalidAttempts: 0,
      connectedAt: null, disconnectedAt: null,
      _qrUrl: qrUrl, localIp, port,
    });

    return { sessionId, expiresAt, qrUrl, localIp, port };
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
      return { valid: false, error: `Invalid token (${s.invalidAttempts}/${MAX_INVALID_ATTEMPTS})`, locked: s.status === SESSION_STATUS.LOCKED };
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
    s.status = SESSION_STATUS.CANCELLED; s.disconnectedAt = Date.now();
    this._sessions.set(sessionId, s); return true;
  }

  disconnectSession(sessionId) {
    const s = this._sessions.get(sessionId);
    if (!s) return false;
    if (s.status === SESSION_STATUS.ACTIVE) {
      s.status = SESSION_STATUS.CANCELLED; s.disconnectedAt = Date.now();
      this._sessions.set(sessionId, s);
    }
    return true;
  }

  getSession(sessionId) {
    const s = this._sessions.get(sessionId);
    if (!s) return null;
    if (s.status === SESSION_STATUS.PENDING && Date.now() > s.expiresAt) {
      s.status = SESSION_STATUS.EXPIRED; this._sessions.set(sessionId, s);
    }
    return this._sanitize(s);
  }

  _pruneOld() {
    const now = Date.now();
    for (const [id, s] of this._sessions.entries()) {
      if (s.status === SESSION_STATUS.PENDING && now > s.expiresAt) s.status = SESSION_STATUS.EXPIRED;
      if ([SESSION_STATUS.EXPIRED, SESSION_STATUS.CANCELLED, SESSION_STATUS.LOCKED].includes(s.status)
          && now - s.createdAt > 10 * 60 * 1000) {
        this._sessions.delete(id);
      }
    }
  }

  _sanitize({ _token, _qrUrl, ...safe }) { return safe; } // eslint-disable-line no-unused-vars
}

const sessionManager = new PairingSessionManager();

// ─── Controller Mobile Page HTML (Part 36 — Full Driving Controller) ──────────

function buildControllerPageHTML() {
  // NOTE: This HTML is served as a standalone page from Vite middleware.
  // No React, no bundler. Pure HTML + CSS + JS for maximum mobile performance.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
  <meta name="mobile-web-app-capable" content="yes"/>
  <meta name="theme-color" content="#0a0c14"/>
  <title>Car Controller</title>
  <style>
    /* ── Reset & tokens ──────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #07090d;
      --surface: #111827;
      --surface2: #1a2235;
      --accent: #00f0ff;
      --accent-dim: rgba(0,240,255,.18);
      --green: #10b981;
      --red: #ef4444;
      --amber: #f59e0b;
      --text: #e2e8f0;
      --muted: rgba(255,255,255,.45);
      --border: rgba(255,255,255,.1);
      --shadow: 0 8px 32px rgba(0,0,0,.55);
    }

    html, body {
      width: 100%; height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      overflow: hidden;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* ── Connecting / Error Screens ───────────────────────────────────── */
    #connectScreen {
      position: fixed; inset: 0; z-index: 100;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 20px; padding: 32px;
      background: var(--bg);
    }
    .cs-logo {
      width: 64px; height: 64px;
      background: rgba(0,240,255,.1);
      border: 1px solid rgba(0,240,255,.3);
      border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
    }
    .cs-title { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
    .cs-sub { font-size: 13px; color: var(--muted); text-align: center; line-height: 1.5; }
    .cs-status {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 20px;
      background: var(--surface);
      border-radius: 12px; border: 1px solid var(--border);
      font-size: 13px; font-weight: 600;
    }
    .cs-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
      background: var(--muted);
    }
    .cs-dot.connecting { background: var(--amber); animation: pulse 1.2s infinite; }
    .cs-dot.connected  { background: var(--green); }
    .cs-dot.error      { background: var(--red); }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    .cs-btn {
      padding: 13px 28px;
      background: var(--accent-dim);
      border: 1px solid rgba(0,240,255,.4);
      border-radius: 12px;
      color: var(--accent);
      font-size: 15px; font-weight: 700;
      cursor: pointer; display: none;
    }

    /* ── Controller Layout (hidden until connected) ───────────────────── */
    #controller {
      position: fixed; inset: 0;
      display: none;
      flex-direction: column;
      background: var(--bg);
    }
    #controller.show { display: flex; }

    /* ── Status Bar (top) ─────────────────────────────────────────────── */
    #statusBar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px;
      background: rgba(0,0,0,.55);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      /* safe area for notched phones */
      padding-top: max(8px, env(safe-area-inset-top));
    }
    .sb-left { display: flex; align-items: center; gap: 8px; }
    .sb-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
    .sb-dot.lost { background: var(--red); animation: pulse 1.2s infinite; }
    .sb-label { font-size: 11px; font-weight: 700; color: var(--text); letter-spacing: .05em; text-transform: uppercase; }
    .sb-latency { font-size: 11px; color: var(--muted); font-family: monospace; }
    .sb-right { display: flex; align-items: center; gap: 10px; }
    .sb-speed {
      font-size: 13px; font-weight: 700; color: var(--accent);
      font-family: monospace; min-width: 48px; text-align: right;
    }
    #disconnectBtn {
      padding: 5px 10px;
      background: rgba(239,68,68,.12);
      border: 1px solid rgba(239,68,68,.3);
      border-radius: 8px;
      color: var(--red);
      font-size: 11px; font-weight: 700;
      cursor: pointer; letter-spacing: .04em;
    }

    /* ── Main Driving Area ────────────────────────────────────────────── */
    #drivingArea {
      flex: 1;
      display: grid;
      /* Portrait:  steer top (60%), pedals bottom (40%) */
      /* Landscape: steer left (55%), pedals right (45%) */
      grid-template-areas: "steer steer" "utils pedals";
      grid-template-rows: 1fr auto;
      grid-template-columns: 1fr auto;
      gap: 0;
      min-height: 0;
    }

    /* ── Steering Zone ────────────────────────────────────────────────── */
    #steerZone {
      grid-area: steer;
      position: relative;
      display: flex; align-items: center; justify-content: center;
      touch-action: none;
      cursor: grab;
      background: rgba(0,0,0,.2);
      border-bottom: 1px solid var(--border);
      min-height: 160px;
      overflow: hidden;
    }
    #steerZone:active { cursor: grabbing; }

    /* Track bar */
    .steer-track {
      position: absolute;
      bottom: 24px; left: 10%; right: 10%;
      height: 6px;
      background: rgba(255,255,255,.08);
      border-radius: 3px;
    }
    .steer-fill {
      position: absolute;
      top: 0; height: 100%;
      border-radius: 3px;
      background: var(--accent);
      transition: none;
    }
    /* Thumb */
    #steerThumb {
      position: absolute;
      bottom: 14px;
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--accent);
      border: 3px solid #fff;
      box-shadow: 0 0 16px var(--accent), var(--shadow);
      transform: translateX(-50%);
      transition: left .05s linear;
      pointer-events: none;
    }

    /* Direction labels */
    .steer-label {
      position: absolute; bottom: 56px;
      font-size: 11px; font-weight: 700; color: var(--muted);
      text-transform: uppercase; letter-spacing: .07em;
    }
    .steer-label.left  { left: 12%; }
    .steer-label.right { right: 12%; }
    .steer-label.center { left: 50%; transform: translateX(-50%); }

    /* Steer value display */
    #steerVal {
      position: absolute; top: 16px;
      font-size: 32px; font-weight: 900;
      font-family: monospace;
      color: rgba(255,255,255,.12);
      letter-spacing: -.03em;
      pointer-events: none;
      transition: color .15s;
    }
    #steerVal.active { color: var(--accent); }

    /* Steer direction arrows */
    .steer-arrow {
      position: absolute; top: 50%;
      font-size: 28px; opacity: .15;
      transform: translateY(-50%);
      pointer-events: none;
      transition: opacity .1s;
    }
    .steer-arrow.left  { left: 8%; }
    .steer-arrow.right { right: 8%; }
    .steer-arrow.left.lit  { opacity: .9; color: var(--accent); }
    .steer-arrow.right.lit { opacity: .9; color: var(--accent); }

    /* ── Utility Controls ─────────────────────────────────────────────── */
    #utilBar {
      grid-area: utils;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 10px 12px;
      border-top: 1px solid var(--border);
      background: rgba(0,0,0,.3);
    }
    .util-row { display: flex; gap: 8px; align-items: center; }
    .util-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px;
      width: 60px; height: 60px;
      border-radius: 14px;
      background: rgba(255,255,255,.05);
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .04em;
      cursor: pointer;
      touch-action: manipulation;
      transition: background .12s, border-color .12s, color .12s;
      -webkit-tap-highlight-color: transparent;
    }
    .util-btn .icon { font-size: 20px; line-height: 1; }
    .util-btn:active, .util-btn.pressed {
      background: rgba(0,240,255,.15);
      border-color: rgba(0,240,255,.5);
      color: var(--accent);
    }
    .util-btn.danger:active, .util-btn.danger.pressed {
      background: rgba(239,68,68,.2);
      border-color: rgba(239,68,68,.5);
      color: var(--red);
    }
    .util-btn.toggle-on {
      background: rgba(0,240,255,.18);
      border-color: rgba(0,240,255,.55);
      color: var(--accent);
    }
    .util-btn.toggle-on.danger-toggle {
      background: rgba(239,68,68,.2);
      border-color: rgba(239,68,68,.5);
      color: var(--red);
    }

    /* ── Pedals (Throttle + Brake) ────────────────────────────────────── */
    #pedalZone {
      grid-area: pedals;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border-top: 1px solid var(--border);
      border-left: 1px solid var(--border);
      background: rgba(0,0,0,.3);
      min-width: 120px;
      max-width: 160px;
    }

    .pedal {
      flex: 1;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 6px;
      border-radius: 16px;
      border: 2px solid;
      font-size: 12px; font-weight: 800;
      text-transform: uppercase; letter-spacing: .07em;
      cursor: pointer;
      touch-action: none;
      position: relative;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
      transition: transform .05s;
    }
    .pedal:active { transform: scale(.97); }
    .pedal .pedal-icon { font-size: 28px; line-height: 1; }
    .pedal .pedal-label { font-size: 11px; }

    /* Fill level bar inside pedal */
    .pedal-fill {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 0%;
      transition: height .04s linear;
      pointer-events: none;
    }

    #throttleBtn {
      background: rgba(16,185,129,.08);
      border-color: rgba(16,185,129,.35);
      color: var(--green);
    }
    #throttleBtn .pedal-fill { background: rgba(16,185,129,.22); }
    #throttleBtn.pressed {
      background: rgba(16,185,129,.18);
      border-color: var(--green);
      box-shadow: 0 0 24px rgba(16,185,129,.35);
    }

    #brakeBtn {
      background: rgba(239,68,68,.08);
      border-color: rgba(239,68,68,.35);
      color: var(--red);
    }
    #brakeBtn .pedal-fill { background: rgba(239,68,68,.22); }
    #brakeBtn.pressed {
      background: rgba(239,68,68,.18);
      border-color: var(--red);
      box-shadow: 0 0 24px rgba(239,68,68,.3);
    }

    /* ── Reverse indicator strip ──────────────────────────────────────── */
    #reverseStrip {
      position: absolute; top: 8px; right: 8px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px; font-weight: 800;
      letter-spacing: .08em;
      background: rgba(245,158,11,.18);
      border: 1px solid rgba(245,158,11,.4);
      color: var(--amber);
      display: none;
    }
    #reverseStrip.show { display: block; }

    /* ── Landscape layout adjustments ────────────────────────────────── */
    @media (orientation: landscape) {
      #drivingArea {
        grid-template-areas: "steer pedals" "utils pedals";
        grid-template-rows: 1fr auto;
        grid-template-columns: 1fr 140px;
      }
      #steerZone {
        border-bottom: 1px solid var(--border);
        border-right: none;
        min-height: 0;
      }
      #utilBar {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
        padding: 8px 12px;
        border-top: 1px solid var(--border);
        border-right: none;
      }
      #pedalZone {
        grid-row: 1 / 3;
        flex-direction: column;
        max-width: 140px;
        min-height: 0;
        border-top: none;
      }
    }

    /* ── Accessibility ────────────────────────────────────────────────── */
    [aria-label] { /* touch targets always visible */ }
    .sr-only {
      position: absolute; width: 1px; height: 1px;
      overflow: hidden; clip: rect(0,0,0,0);
    }
  </style>
</head>
<body>

<!-- ═══ Connecting Screen ════════════════════════════════════════════════════ -->
<div id="connectScreen" role="status" aria-live="polite">
  <div class="cs-logo" aria-hidden="true">🚗</div>
  <div class="cs-title">Car Controller</div>
  <div class="cs-sub" id="csSub">Connecting to your computer…</div>
  <div class="cs-status">
    <div class="cs-dot connecting" id="csDot" aria-hidden="true"></div>
    <span id="csSt">Authenticating session…</span>
  </div>
  <button class="cs-btn" id="retryBtn" onclick="location.reload()">Reconnect</button>
</div>

<!-- ═══ Driving Controller UI ════════════════════════════════════════════════ -->
<div id="controller" role="main" aria-label="Vehicle Driving Controller">

  <!-- Status bar -->
  <div id="statusBar" role="status" aria-live="polite" aria-atomic="true">
    <div class="sb-left">
      <div class="sb-dot" id="sbDot" aria-hidden="true"></div>
      <span class="sb-label">Connected</span>
      <span class="sb-latency" id="sbLatency" aria-label="Network latency">—</span>
    </div>
    <div class="sb-right">
      <span class="sb-speed" id="sbSpeed" aria-label="Vehicle speed">—</span>
      <button id="disconnectBtn" aria-label="Disconnect controller">DISCONNECT</button>
    </div>
  </div>

  <!-- Main driving area -->
  <div id="drivingArea">

    <!-- ── Steering Zone ─────────────────────────────────────────────── -->
    <div id="steerZone"
         role="slider"
         aria-label="Steering control. Drag left or right to steer"
         aria-valuemin="-100"
         aria-valuemax="100"
         aria-valuenow="0"
         tabindex="0">

      <div id="steerVal" aria-hidden="true">0.00</div>

      <span class="steer-arrow left" id="arrowLeft" aria-hidden="true">◀</span>
      <span class="steer-arrow right" id="arrowRight" aria-hidden="true">▶</span>

      <span class="steer-label left"  aria-hidden="true">LEFT</span>
      <span class="steer-label center" aria-hidden="true">STEER</span>
      <span class="steer-label right" aria-hidden="true">RIGHT</span>

      <div class="steer-track" aria-hidden="true">
        <div class="steer-fill" id="steerFill"></div>
      </div>
      <div id="steerThumb" aria-hidden="true"></div>

      <div id="reverseStrip" aria-label="Reverse mode active">REV</div>
    </div>

    <!-- ── Utility Controls ──────────────────────────────────────────── -->
    <div id="utilBar" aria-label="Vehicle action controls">
      <div class="util-row">
        <button class="util-btn" id="btnHandbrake"
                aria-label="Handbrake (toggle)"
                aria-pressed="false"
                data-action="handbrake">
          <span class="icon" aria-hidden="true">🅿</span>
          <span>HBRK</span>
        </button>
        <button class="util-btn danger-toggle" id="btnReverse"
                aria-label="Reverse (toggle)"
                aria-pressed="false"
                data-action="reverse">
          <span class="icon" aria-hidden="true">🔄</span>
          <span>REV</span>
        </button>
      </div>
      <div class="util-row">
        <button class="util-btn" id="btnCamera"
                aria-label="Switch camera view"
                data-action="camera">
          <span class="icon" aria-hidden="true">📷</span>
          <span>CAM</span>
        </button>
        <button class="util-btn danger" id="btnReset"
                aria-label="Reset vehicle position"
                data-action="reset">
          <span class="icon" aria-hidden="true">↺</span>
          <span>RESET</span>
        </button>
      </div>
    </div>

    <!-- ── Pedals ────────────────────────────────────────────────────── -->
    <div id="pedalZone" aria-label="Throttle and brake pedals">
      <button class="pedal" id="throttleBtn"
              aria-label="Throttle — hold to accelerate"
              aria-pressed="false">
        <div class="pedal-fill" id="throttleFill" aria-hidden="true"></div>
        <span class="pedal-icon" aria-hidden="true">▲</span>
        <span class="pedal-label">GAS</span>
      </button>
      <button class="pedal" id="brakeBtn"
              aria-label="Brake — hold to brake or reverse"
              aria-pressed="false">
        <div class="pedal-fill" id="brakeFill" aria-hidden="true"></div>
        <span class="pedal-icon" aria-hidden="true">▼</span>
        <span class="pedal-label">BRAKE</span>
      </button>
    </div>

  </div><!-- /drivingArea -->
</div><!-- /controller -->

<script>
(function () {
  'use strict';

  // ── URL Params ──────────────────────────────────────────────────────────
  var params    = new URLSearchParams(location.search);
  var SESSION   = params.get('session') || '';
  var TOKEN     = params.get('token')   || '';
  var HOST      = location.host;
  var WS_URL    = 'ws://' + HOST + '/controller-ws?session=' + encodeURIComponent(SESSION) + '&token=' + encodeURIComponent(TOKEN);

  // ── DOM refs ────────────────────────────────────────────────────────────
  var connectScreen = document.getElementById('connectScreen');
  var controller    = document.getElementById('controller');
  var csDot         = document.getElementById('csDot');
  var csSt          = document.getElementById('csSt');
  var csSub         = document.getElementById('csSub');
  var retryBtn      = document.getElementById('retryBtn');
  var sbDot         = document.getElementById('sbDot');
  var sbLatency     = document.getElementById('sbLatency');
  var sbSpeed       = document.getElementById('sbSpeed');
  var steerZone     = document.getElementById('steerZone');
  var steerThumb    = document.getElementById('steerThumb');
  var steerFill     = document.getElementById('steerFill');
  var steerVal      = document.getElementById('steerVal');
  var arrowLeft     = document.getElementById('arrowLeft');
  var arrowRight    = document.getElementById('arrowRight');
  var reverseStrip  = document.getElementById('reverseStrip');
  var throttleBtn   = document.getElementById('throttleBtn');
  var throttleFill  = document.getElementById('throttleFill');
  var brakeBtn      = document.getElementById('brakeBtn');
  var brakeFill     = document.getElementById('brakeFill');
  var btnHandbrake  = document.getElementById('btnHandbrake');
  var btnReverse    = document.getElementById('btnReverse');
  var btnCamera     = document.getElementById('btnCamera');
  var btnReset      = document.getElementById('btnReset');
  var disconnectBtn = document.getElementById('disconnectBtn');

  // ── Vehicle State ───────────────────────────────────────────────────────
  var state = {
    steer:     0,       // -1 to +1
    throttle:  0,       // 0 to 1
    brake:     0,       // 0 to 1
    handbrake: false,
    reverse:   false,
  };

  // ── WebSocket ───────────────────────────────────────────────────────────
  var ws = null;
  var heartbeatTimer = null;
  var pingStart = 0;
  var connected = false;
  var inputTimer = null;   // 50ms dispatch interval
  var userDisconnected = false;
  var lastPongTime = Date.now();

  function setConnectStatus(cls, msg, sub) {
    csDot.className = 'cs-dot ' + cls;
    csSt.textContent = msg;
    if (sub) csSub.textContent = sub;
  }

  function showController() {
    connectScreen.style.display = 'none';
    controller.classList.add('show');
    connected = true;
    lastPongTime = Date.now();
    startInputLoop();
    // Lock orientation to landscape if possible
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function(){});
    }
  }

  function showError(msg, sub) {
    controller.classList.remove('show');
    connectScreen.style.display = '';
    setConnectStatus('error', msg, sub);
    retryBtn.style.display = 'block';
    connected = false;
    stopInputLoop();
    clearAllInputs();
    clearInterval(heartbeatTimer);
  }

  function connect() {
    if (!SESSION || !TOKEN) {
      showError('Invalid QR Code', 'Missing session or token. Rescan the QR code.');
      return;
    }
    userDisconnected = false;
    setConnectStatus('connecting', 'Connecting to car…', 'Please wait…');

    ws = new WebSocket(WS_URL);

    ws.addEventListener('open', function () {
      showController();
      // Send immediate zero frame to ensure vehicle starts in neutral
      sendInput();
      // Heartbeat: 500ms
      function sendHB() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        pingStart = Date.now();
        ws.send(JSON.stringify({ v: 1, type: 'heartbeat', timestamp: pingStart }));
      }
      sendHB();
      heartbeatTimer = setInterval(sendHB, 500);
    });

    ws.addEventListener('message', function (evt) {
      try {
        var msg = JSON.parse(evt.data);
        if (msg.type === 'pong' && pingStart) {
          lastPongTime = Date.now();
          sbDot.className = 'sb-dot';
          var rtt = Date.now() - pingStart;
          sbLatency.textContent = rtt + 'ms';
        }
        // Desktop pushes live simulation speed telemetry back to phone
        if (msg.type === 'telemetry' && typeof msg.speedKmh === 'number') {
          sbSpeed.textContent = Math.round(msg.speedKmh) + ' km/h';
        }
      } catch (_) {}
    });

    ws.addEventListener('close', function (evt) {
      clearInterval(heartbeatTimer);
      var code = evt.code;
      if (code === 4001) showError('Session Expired', 'Rescan the QR code on the computer.');
      else if (code === 4003) showError('Auth Failed', 'Invalid token. Rescan the QR code.');
      else if (code === 4409) showError('Already Connected', 'Another device is active. Disconnect it first.');
      else if (userDisconnected) showError('Disconnected', 'You disconnected from the car.');
      else {
        showError('Connection Interrupted', 'Attempting automatic reconnection…');
        setTimeout(function () { if (!connected && !userDisconnected) connect(); }, 1500);
      }
    });

    ws.addEventListener('error', function () {
      showError('Connection Error', 'Could not reach computer. Check Wi-Fi and try again.');
    });
  }

  // Periodic health check: flag interrupted connection if pong is delayed > 2.5s
  var healthTimer = setInterval(function () {
    if (connected && Date.now() - lastPongTime > 2500) {
      sbDot.className = 'sb-dot lost';
      sbLatency.textContent = 'Interrupted';
    }
  }, 1000);

  // ── Input Dispatch Loop ─────────────────────────────────────────────────
  function sendInput() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      v:         1,
      type:      'input',
      throttle:  round2(state.throttle),
      brake:     round2(state.brake),
      steer:     round2(state.steer),
      handbrake: state.handbrake,
      reverse:   state.reverse,
      timestamp: Date.now(),
    }));
  }

  function startInputLoop() {
    if (inputTimer) return;
    inputTimer = setInterval(sendInput, 50); // 20 Hz continuous input
  }

  function stopInputLoop() {
    if (inputTimer) { clearInterval(inputTimer); inputTimer = null; }
  }

  function sendAction(action) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ v: 1, type: 'input', action: action, timestamp: Date.now() }));
  }

  function clearAllInputs() {
    state.steer = 0; state.throttle = 0; state.brake = 0;
    // Do NOT clear handbrake/reverse toggles — they are intentional state
    updateSteerUI(0);
    updateThrottleUI(0);
    updateBrakeUI(0);
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Send zero frame immediately
      ws.send(JSON.stringify({ v: 1, type: 'input', throttle: 0, brake: 0, steer: 0,
        handbrake: state.handbrake, reverse: state.reverse, timestamp: Date.now() }));
    }
  }

  function round2(v) { return Math.round(v * 100) / 100; }

  // ── Steering Logic ──────────────────────────────────────────────────────
  var steerActive = false;
  var steerStartX = 0;
  var steerStartVal = 0;
  var steerZoneWidth = 0;
  var STEER_DEADZONE = 0.03;

  function getSteerZoneRect() {
    return steerZone.getBoundingClientRect();
  }

  function pointerToSteer(clientX) {
    var rect = getSteerZoneRect();
    // Map x position across zone to -1..+1 (allow overshot to clamp)
    var rel = (clientX - rect.left) / rect.width;
    return Math.max(-1, Math.min(1, (rel - 0.5) * 2));
  }

  function updateSteerUI(val) {
    var pct = ((val + 1) / 2) * 100;
    steerThumb.style.left = pct + '%';

    // Fill: from center outward
    if (val >= 0) {
      steerFill.style.left  = '50%';
      steerFill.style.width = (val * 50) + '%';
    } else {
      var w = (-val * 50);
      steerFill.style.left  = (50 - w) + '%';
      steerFill.style.width = w + '%';
    }

    steerVal.textContent = (val >= 0 ? '+' : '') + val.toFixed(2);
    steerVal.classList.toggle('active', Math.abs(val) > STEER_DEADZONE);
    arrowLeft.classList.toggle('lit',  val < -STEER_DEADZONE);
    arrowRight.classList.toggle('lit', val >  STEER_DEADZONE);

    steerZone.setAttribute('aria-valuenow', Math.round(val * 100));
  }

  function onSteerStart(clientX) {
    steerActive = true;
    steerStartX  = clientX;
    steerStartVal = state.steer;
    steerZoneWidth = getSteerZoneRect().width;
    steerThumb.style.transition = 'none';
  }

  function onSteerMove(clientX) {
    if (!steerActive) return;
    var delta = (clientX - steerStartX) / steerZoneWidth * 2;
    var raw   = steerStartVal + delta;
    state.steer = Math.max(-1, Math.min(1, raw));
    updateSteerUI(state.steer);
  }

  function onSteerEnd() {
    if (!steerActive) return;
    steerActive = false;
    state.steer = 0;
    updateSteerUI(0);
    steerThumb.style.transition = 'left .12s ease';
  }

  // Touch events on steer zone
  steerZone.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    onSteerStart(t.clientX);
  }, { passive: false });

  steerZone.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    onSteerMove(t.clientX);
  }, { passive: false });

  steerZone.addEventListener('touchend',    function (e) { e.preventDefault(); onSteerEnd(); }, { passive: false });
  steerZone.addEventListener('touchcancel', function (e) { e.preventDefault(); onSteerEnd(); }, { passive: false });

  // Pointer fallback for desktop testing
  steerZone.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') { onSteerStart(e.clientX); steerZone.setPointerCapture(e.pointerId); }
  });
  steerZone.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse' && steerActive) { onSteerMove(e.clientX); }
  });
  steerZone.addEventListener('pointerup',     function () { if (steerActive) onSteerEnd(); });
  steerZone.addEventListener('pointercancel', function () { if (steerActive) onSteerEnd(); });

  // Keyboard steering (desktop testing)
  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (e.key === 'ArrowLeft')  { state.steer = -1; updateSteerUI(-1); }
    if (e.key === 'ArrowRight') { state.steer =  1; updateSteerUI( 1); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { state.steer = 0; updateSteerUI(0); }
  });

  // ── Throttle Logic ──────────────────────────────────────────────────────
  var throttleActive = false;
  var throttleStartY = 0;

  function updateThrottleUI(val) {
    throttleFill.style.height = (val * 100) + '%';
    throttleBtn.setAttribute('aria-pressed', val > 0 ? 'true' : 'false');
    throttleBtn.classList.toggle('pressed', val > 0);
  }

  function onThrottleStart(e) {
    e.preventDefault();
    throttleActive = true;
    var rect = throttleBtn.getBoundingClientRect();
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    throttleStartY = clientY;
    state.throttle = 1; // full throttle on press for now (hold = full)
    updateThrottleUI(state.throttle);
  }

  function onThrottleMove(e) {
    e.preventDefault();
    if (!throttleActive) return;
    var rect = throttleBtn.getBoundingClientRect();
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // Map: top of button = full throttle, bottom = zero (inverted Y)
    var rel = 1 - ((clientY - rect.top) / rect.height);
    state.throttle = Math.max(0, Math.min(1, rel));
    updateThrottleUI(state.throttle);
  }

  function onThrottleEnd(e) {
    if (e) e.preventDefault();
    if (!throttleActive) return;
    throttleActive = false;
    state.throttle = 0;
    updateThrottleUI(0);
  }

  throttleBtn.addEventListener('touchstart',  onThrottleStart, { passive: false });
  throttleBtn.addEventListener('touchmove',   onThrottleMove,  { passive: false });
  throttleBtn.addEventListener('touchend',    onThrottleEnd,   { passive: false });
  throttleBtn.addEventListener('touchcancel', onThrottleEnd,   { passive: false });
  throttleBtn.addEventListener('pointerdown', function(e) { if (e.pointerType !== 'touch') onThrottleStart(e); });
  throttleBtn.addEventListener('pointermove', function(e) { if (e.pointerType !== 'touch' && throttleActive) onThrottleMove(e); });
  throttleBtn.addEventListener('pointerup',     function(e) { if (e.pointerType !== 'touch') onThrottleEnd(e); });
  throttleBtn.addEventListener('pointercancel', function(e) { if (e.pointerType !== 'touch') onThrottleEnd(e); });

  // ── Brake Logic ─────────────────────────────────────────────────────────
  var brakeActive = false;

  function updateBrakeUI(val) {
    brakeFill.style.height = (val * 100) + '%';
    brakeBtn.setAttribute('aria-pressed', val > 0 ? 'true' : 'false');
    brakeBtn.classList.toggle('pressed', val > 0);
  }

  function onBrakeStart(e) {
    e.preventDefault();
    brakeActive = true;
    state.brake = 1;
    updateBrakeUI(state.brake);
  }

  function onBrakeMove(e) {
    e.preventDefault();
    if (!brakeActive) return;
    var rect = brakeBtn.getBoundingClientRect();
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var rel = 1 - ((clientY - rect.top) / rect.height);
    state.brake = Math.max(0, Math.min(1, rel));
    updateBrakeUI(state.brake);
  }

  function onBrakeEnd(e) {
    if (e) e.preventDefault();
    if (!brakeActive) return;
    brakeActive = false;
    state.brake = 0;
    updateBrakeUI(0);
  }

  brakeBtn.addEventListener('touchstart',  onBrakeStart, { passive: false });
  brakeBtn.addEventListener('touchmove',   onBrakeMove,  { passive: false });
  brakeBtn.addEventListener('touchend',    onBrakeEnd,   { passive: false });
  brakeBtn.addEventListener('touchcancel', onBrakeEnd,   { passive: false });
  brakeBtn.addEventListener('pointerdown', function(e) { if (e.pointerType !== 'touch') onBrakeStart(e); });
  brakeBtn.addEventListener('pointermove', function(e) { if (e.pointerType !== 'touch' && brakeActive) onBrakeMove(e); });
  brakeBtn.addEventListener('pointerup',     function(e) { if (e.pointerType !== 'touch') onBrakeEnd(e); });
  brakeBtn.addEventListener('pointercancel', function(e) { if (e.pointerType !== 'touch') onBrakeEnd(e); });

  // ── Utility Buttons ─────────────────────────────────────────────────────

  // Handbrake (toggle)
  btnHandbrake.addEventListener('click', function () {
    state.handbrake = !state.handbrake;
    btnHandbrake.setAttribute('aria-pressed', state.handbrake ? 'true' : 'false');
    btnHandbrake.classList.toggle('toggle-on', state.handbrake);
    sendInput(); // immediate update
  });

  // Reverse (toggle)
  btnReverse.addEventListener('click', function () {
    state.reverse = !state.reverse;
    btnReverse.setAttribute('aria-pressed', state.reverse ? 'true' : 'false');
    btnReverse.classList.toggle('toggle-on', state.reverse);
    btnReverse.classList.toggle('danger-toggle', state.reverse);
    reverseStrip.classList.toggle('show', state.reverse);
    sendInput();
  });

  // Camera (one-shot action)
  btnCamera.addEventListener('click', function () {
    sendAction('camera');
    flashBtn(btnCamera);
  });

  // Reset (one-shot action)
  btnReset.addEventListener('click', function () {
    sendAction('reset');
    flashBtn(btnReset);
  });

  // Disconnect
  disconnectBtn.addEventListener('click', function () {
    userDisconnected = true;
    clearAllInputs();
    if (ws) { ws.close(1000, 'User disconnected'); }
    showError('Disconnected', 'You disconnected from the car.');
  });

  function flashBtn(btn) {
    btn.classList.add('pressed');
    setTimeout(function () { btn.classList.remove('pressed'); }, 180);
  }

  // ── Safety: Tab visibility / screen lock ───────────────────────────────
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      // Page hidden — immediately neutralize all continuous inputs
      clearAllInputs();
    }
  });

  // Also handle page blur (iOS Safari)
  window.addEventListener('blur', function () {
    clearAllInputs();
  });

  // Prevent accidental browser pull-to-refresh and over-scroll
  document.addEventListener('touchmove', function (e) {
    // Only prevent default on the steer zone, throttle, and brake areas
    // (they set passive:false themselves above); here we prevent body scrolling
    if (e.target === document.body || e.target === controller || e.target === document.documentElement) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent double-tap zoom on util buttons
  var lastTap = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTap < 300) e.preventDefault();
    lastTap = now;
  }, { passive: false });

  // ── Init ────────────────────────────────────────────────────────────────
  updateSteerUI(0);
  updateThrottleUI(0);
  updateBrakeUI(0);
  steerThumb.style.transition = 'left .12s ease';

  connect();

})();
</script>
</body>
</html>`;
}

// ─── Vite Plugin ─────────────────────────────────────────────────────────────

/**
 * Local Controller Plugin — Part 35
 *
 * Extends the Part 34 plugin with:
 *  - Enhanced network discovery (Wi-Fi preferred)
 *  - POST /api/controller/create-session   → create pairing session, return QR URL
 *  - GET  /api/controller/session/:id      → get session status (no token)
 *  - DELETE /api/controller/session/:id    → cancel session
 *  - GET  /api/controller/network          → all LAN candidate addresses
 *  - GET  /controller*                     → serve mobile controller HTML page
 *  - WebSocket /controller-ws              → authenticate phone + relay inputs
 */
function localControllerPlugin() {
  let viteWs      = null;   // Vite HMR WebSocket channel (set in configureServer)
  let controllerWss = null; // Raw ws.WebSocketServer for phone ↔ server
  /** sessionId → WebSocket (the currently-paired phone socket) */
  const activeSockets = new Map();

  return {
    name: 'local-controller-service',

    configureServer(server) {
      viteWs = server.ws;

      // ── WebSocket server on /controller-ws ─────────────────────────────────
      server.httpServer.once('listening', () => {
        controllerWss = new WebSocketServer({ noServer: true });

        server.httpServer.on('upgrade', (req, socket, head) => {
          try {
            const pathname = new URL(req.url, 'http://localhost').pathname;
            if (pathname === '/controller-ws') {
              controllerWss.handleUpgrade(req, socket, head, (ws) => {
                controllerWss.emit('connection', ws, req);
              });
            }
          } catch (_) {}
        });

        controllerWss.on('connection', (socket, req) => {
          // Parse token + sessionId from query string
          const reqUrl = new URL(req.url, `http://${req.headers.host}`);
          const sessionId = reqUrl.searchParams.get('session') || '';
          const token     = reqUrl.searchParams.get('token')   || '';

          // Validate token against session manager
          const { valid, session, error, locked } = sessionManager.validateToken(sessionId, token);

          if (!valid) {
            const code = locked ? 4003 : (error === 'Session expired' ? 4001 : 4003);
            socket.close(code, error || 'Auth failed');
            return;
          }

          // Single-device lock: reject if another phone is already connected on this session
          if (activeSockets.has(sessionId)) {
            socket.close(4409, 'Another device is already connected');
            return;
          }

          // Activate session
          sessionManager.activateSession(sessionId);
          activeSockets.set(sessionId, socket);

          // Rate limit & payload size tracking per socket — Part 37
          let packetCount = 0;
          let rateWindowStart = Date.now();
          const MAX_PAYLOAD_BYTES = 2048;
          const MAX_PACKETS_PER_SEC = 60;

          // Notify frontend (Vite HMR channel) → React hook picks this up
          const deviceInfo = {
            id:   sessionId,
            name: req.headers['user-agent'] ? 'Mobile Browser' : 'Smartphone Controller',
            ip:   req.socket.remoteAddress || 'local-network',
          };
          viteWs.send('controller:paired', { sessionId, deviceInfo });

          socket.on('message', (raw) => {
            // Security: Frame size limit
            if (raw.length > MAX_PAYLOAD_BYTES) {
              socket.close(1009, 'Message too big');
              return;
            }

            // Security: Rate limiting (drop excess if client floods > 60 msgs/sec)
            const now = Date.now();
            if (now - rateWindowStart > 1000) {
              rateWindowStart = now;
              packetCount = 0;
            }
            packetCount++;
            if (packetCount > MAX_PACKETS_PER_SEC) {
              return; // drop message to prevent event loop / simulation starvation
            }

            let msg;
            try { msg = JSON.parse(raw.toString()); } catch (_) { return; }

            // Protocol version check (if present, must match 1)
            if (msg.v !== undefined && msg.v !== 1) {
              return;
            }

            if (msg.type === 'heartbeat') {
              // Echo pong for latency measurement
              socket.send(JSON.stringify({ v: 1, type: 'pong', timestamp: msg.timestamp, serverTime: Date.now() }));
              // Also relay heartbeat to frontend so it can update lastSeen
              viteWs.send('controller:heartbeat', { sessionId, timestamp: msg.timestamp });
              return;
            }

            if (msg.type === 'input') {
              // Sanitize numerical bounds
              const throttle = msg.throttle !== undefined ? Math.max(0, Math.min(1, Number(msg.throttle) || 0)) : undefined;
              const brake    = msg.brake !== undefined ? Math.max(0, Math.min(1, Number(msg.brake) || 0)) : undefined;
              const steer    = msg.steer !== undefined ? Math.max(-1, Math.min(1, Number(msg.steer) || 0)) : undefined;
              const reverse  = msg.reverse !== undefined ? Boolean(msg.reverse) : undefined;
              const handbrake = msg.handbrake !== undefined ? Boolean(msg.handbrake) : undefined;

              // Action validation whitelist
              let action = undefined;
              if (typeof msg.action === 'string') {
                const act = msg.action.trim().toLowerCase();
                if (['camera', 'reset', 'pause'].includes(act)) {
                  action = act;
                }
              }

              // Relay normalized input to React app via HMR channel
              viteWs.send('controller:input', {
                v: 1,
                throttle,
                brake,
                steer,
                handbrake,
                reverse,
                action,
                timestamp: msg.timestamp || Date.now(),
              });
            }
          });

          socket.on('close', () => {
            activeSockets.delete(sessionId);
            sessionManager.disconnectSession(sessionId);
            viteWs.send('controller:disconnected', { sessionId });
          });

          socket.on('error', () => {
            activeSockets.delete(sessionId);
            sessionManager.disconnectSession(sessionId);
            viteWs.send('controller:disconnected', { sessionId });
          });
        });

        // Part 37: Desktop → Phone live telemetry stream
        server.ws.on('controller:telemetry', (data) => {
          if (!data || typeof data !== 'object') return;
          const msgStr = JSON.stringify({
            v: 1,
            type: 'telemetry',
            speedKmh: Math.round(Number(data.speedKmh) || 0),
            gear: data.gear || 'D',
          });
          for (const sock of activeSockets.values()) {
            if (sock.readyState === 1) { // 1 = WebSocket.OPEN
              sock.send(msgStr);
            }
          }
        });
      });

      // ── HTTP middleware ───────────────────────────────────────────────────

      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // GET /api/controller/status (Part 34 compat)
        if (req.method === 'GET' && url === '/api/controller/status') {
          const addrs   = getLocalNetworkAddresses();
          const localIp = addrs[0].ip;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.end(JSON.stringify({
            status: 'ready', localIp, port: 5173,
            controllerUrl: `http://${localIp}:5173/controller`,
            serverTime: Date.now(),
          }));
        }

        // GET /api/controller/network — all candidate LAN addresses
        if (req.method === 'GET' && url === '/api/controller/network') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.end(JSON.stringify({ addresses: getLocalNetworkAddresses() }));
        }

        // OPTIONS preflight for /api/controller/*
        if (req.method === 'OPTIONS' && url.startsWith('/api/controller/')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.writeHead(204); return res.end();
        }

        // POST /api/controller/create-session
        if (req.method === 'POST' && url === '/api/controller/create-session') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            const addrs   = getLocalNetworkAddresses();
            const localIp = addrs[0].ip;
            const result  = sessionManager.createSession(localIp, 5173);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(result));
          });
          return;
        }

        // GET /api/controller/session/:id
        const sessionGetMatch = url.match(/^\/api\/controller\/session\/([^?#/]+)$/);
        if (req.method === 'GET' && sessionGetMatch) {
          const sid = decodeURIComponent(sessionGetMatch[1]);
          const s   = sessionManager.getSession(sid);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          if (!s) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Session not found' })); }
          return res.end(JSON.stringify(s));
        }

        // DELETE /api/controller/session/:id
        const sessionDelMatch = url.match(/^\/api\/controller\/session\/([^?#/]+)$/);
        if (req.method === 'DELETE' && sessionDelMatch) {
          const sid = decodeURIComponent(sessionDelMatch[1]);
          // Also close any active WS for that session
          const sock = activeSockets.get(sid);
          if (sock) { sock.close(1000, 'Session cancelled'); activeSockets.delete(sid); }
          const ok = sessionManager.cancelSession(sid);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.end(JSON.stringify({ cancelled: ok }));
        }

        // GET /controller* → serve mobile controller HTML page
        if (req.method === 'GET' && url.startsWith('/controller')) {
          const html = buildControllerPageHTML();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          return res.end(html);
        }

        next();
      });
    },
  };
}

// ─── Vite Config ──────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), localControllerPlugin()],
  server: {
    port: 5173,
    host: true,   // Listen on 0.0.0.0 for local Wi-Fi access
    open: false,
  },
  build: {
    target: 'esnext',
  },
});
