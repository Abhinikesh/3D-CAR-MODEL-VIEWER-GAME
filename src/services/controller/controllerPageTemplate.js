/**
 * Controller Mobile Page — Part 35
 *
 * Minimal HTML page served to the smartphone browser when it opens the QR URL.
 * Generated as a template string so the Vite plugin can inject it via middleware.
 *
 * The phone:
 *  1. Reads token + sessionId from the URL query string.
 *  2. Opens a WebSocket to ws://<same-host>:5173/controller-ws?session=<id>&token=<t>
 *  3. Displays connection status.
 *  4. Sends heartbeats every 500 ms.
 *  5. Part 36 will add touch-based driving controls on top of this scaffold.
 *
 * This page is STATIC HTML+JS — no React, no bundler — deliberately minimal so it
 * loads instantly on any mobile browser over local Wi-Fi.
 */

export function buildControllerPageHTML() {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <title>Car Controller</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0c14;
      --surface: #111827;
      --accent: #00f0ff;
      --green: #10b981;
      --red: #ef4444;
      --amber: #f59e0b;
      --text: #e2e8f0;
      --muted: rgba(255,255,255,0.45);
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      gap: 24px;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .logo {
      width: 56px;
      height: 56px;
      background: rgba(0,240,255,0.1);
      border: 1px solid rgba(0,240,255,0.25);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
      text-align: center;
    }
    .subtitle {
      font-size: 13px;
      color: var(--muted);
      text-align: center;
      line-height: 1.5;
    }
    .status-card {
      width: 100%;
      max-width: 360px;
      background: var(--surface);
      border-radius: 16px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .status-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--muted);
    }
    .dot.connecting { background: var(--amber); animation: pulse 1.2s infinite; }
    .dot.connected  { background: var(--green); }
    .dot.error      { background: var(--red); }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
    .status-text { font-weight: 600; }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 11px;
    }
    .detail-col { display: flex; flex-direction: column; gap: 2px; }
    .detail-label { color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .detail-value { font-weight: 600; font-family: monospace; word-break: break-all; color: var(--accent); }
    .info-note {
      font-size: 11px;
      color: var(--muted);
      text-align: center;
      padding: 10px 14px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.06);
      line-height: 1.5;
    }
    .latency-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--muted);
    }
    .latency-value { color: var(--green); font-weight: 600; font-family: monospace; }
    button.retry-btn {
      width: 100%;
      padding: 12px;
      background: rgba(0,240,255,0.1);
      border: 1px solid rgba(0,240,255,0.3);
      border-radius: 10px;
      color: var(--accent);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button.retry-btn:active { background: rgba(0,240,255,0.2); }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="logo">🚗</div>
  <div>
    <div class="title">Car Controller</div>
    <div class="subtitle" id="subtitle">Connecting to your computer…</div>
  </div>

  <div class="status-card">
    <div class="status-row">
      <div class="dot connecting" id="dot"></div>
      <span class="status-text" id="statusText">Authenticating session…</span>
    </div>
    <div class="detail-grid" id="detailGrid">
      <div class="detail-col">
        <span class="detail-label">Session</span>
        <span class="detail-value" id="sessionDisplay">—</span>
      </div>
      <div class="detail-col">
        <span class="detail-label">Host</span>
        <span class="detail-value" id="hostDisplay">—</span>
      </div>
    </div>
    <div class="latency-bar" id="latencyRow" style="display:none">
      <span>Round-trip latency</span>
      <span class="latency-value" id="latencyVal">—</span>
    </div>
  </div>

  <div class="info-note" id="infoNote">
    Keep this page open while driving. Touch controls will appear in Part 36.
  </div>

  <button class="retry-btn hidden" id="retryBtn" onclick="location.reload()">
    Reconnect
  </button>

  <script>
    (function () {
      const params    = new URLSearchParams(location.search);
      const sessionId = params.get('session') || '';
      const token     = params.get('token')   || '';
      const host      = location.host;        // e.g. 192.168.1.42:5173
      const wsUrl     = 'ws://' + host + '/controller-ws?session=' + encodeURIComponent(sessionId) + '&token=' + encodeURIComponent(token);

      const dot          = document.getElementById('dot');
      const statusText   = document.getElementById('statusText');
      const subtitle     = document.getElementById('subtitle');
      const sessionDisp  = document.getElementById('sessionDisplay');
      const hostDisp     = document.getElementById('hostDisplay');
      const latencyRow   = document.getElementById('latencyRow');
      const latencyVal   = document.getElementById('latencyVal');
      const infoNote     = document.getElementById('infoNote');
      const retryBtn     = document.getElementById('retryBtn');

      sessionDisp.textContent = sessionId ? sessionId.slice(0, 8) + '…' : '—';
      hostDisp.textContent    = host || '—';

      let ws           = null;
      let heartbeatTimer = null;
      let pingStart    = 0;

      function setStatus(state, message) {
        dot.className = 'dot ' + state;
        statusText.textContent = message;
      }

      function connect() {
        if (!sessionId || !token) {
          setStatus('error', 'Invalid QR code — missing session or token');
          subtitle.textContent = 'Please rescan the QR code from the computer.';
          retryBtn.classList.remove('hidden');
          return;
        }

        setStatus('connecting', 'Connecting to car…');
        ws = new WebSocket(wsUrl);

        ws.addEventListener('open', () => {
          setStatus('connected', 'Connected — Ready to drive!');
          subtitle.textContent = 'Your phone is now controlling the car.';
          infoNote.textContent = 'Keep this page open. Touch controls coming in Part 36.';
          latencyRow.style.display = 'flex';
          retryBtn.classList.add('hidden');

          // Start heartbeat
          function sendHeartbeat() {
            if (ws.readyState !== WebSocket.OPEN) return;
            pingStart = Date.now();
            ws.send(JSON.stringify({ type: 'heartbeat', timestamp: pingStart }));
          }
          sendHeartbeat();
          heartbeatTimer = setInterval(sendHeartbeat, 500);
        });

        ws.addEventListener('message', (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'pong' && pingStart) {
              const rtt = Date.now() - pingStart;
              latencyVal.textContent = rtt + ' ms';
            }
          } catch (_) {}
        });

        ws.addEventListener('close', (evt) => {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
          if (evt.code === 4001) {
            setStatus('error', 'Session expired — rescan QR code');
            subtitle.textContent = 'The pairing session has expired on the computer.';
          } else if (evt.code === 4003) {
            setStatus('error', 'Invalid token — access denied');
            subtitle.textContent = 'Authentication failed. Rescan the QR code.';
          } else if (evt.code === 4409) {
            setStatus('error', 'Another device is already connected');
            subtitle.textContent = 'Disconnect the other phone first, then rescan.';
          } else {
            setStatus('error', 'Disconnected from car');
            subtitle.textContent = 'Connection lost. Tap Reconnect to try again.';
          }
          retryBtn.classList.remove('hidden');
          latencyRow.style.display = 'none';
        });

        ws.addEventListener('error', () => {
          setStatus('error', 'Connection error');
          subtitle.textContent = 'Could not reach the computer. Check Wi-Fi.';
        });
      }

      connect();
    })();
  </script>
</body>
</html>`;
}
