/**
 * capture_part36_visuals.mjs — CDP screenshot capture for Part 36 mobile controller
 *
 * Captures the mobile controller page in both portrait and landscape orientations
 * using Chrome DevTools Protocol (raw WebSocket, no external packages).
 *
 * Usage:
 *   # Start Vite dev server first: npm run dev
 *   node python/tests/capture_part36_visuals.mjs
 */

import { createConnection } from 'net';
import { createWriteStream } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.resolve(__dirname, '..', 'reports');

// Minimal CDP client using raw WebSocket
async function cdpConnect(port = 9222) {
  const infoUrl = `http://localhost:${port}/json`;
  const { default: http } = await import('http');

  const pages = await new Promise((resolve, reject) => {
    http.get(infoUrl, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); }});
    }).on('error', reject);
  });

  const targetPage = pages.find(p => p.type === 'page' && p.webSocketDebuggerUrl);
  if (!targetPage) throw new Error('No debuggable page found on port ' + port);

  const { default: ws } = await import('ws');
  const socket = new ws(targetPage.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  socket.on('message', raw => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  await new Promise((res, rej) => { socket.on('open', res); socket.on('error', rej); });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  return { send, close: () => socket.close() };
}

async function captureController() {
  await mkdir(REPORTS, { recursive: true });

  let cdp;
  try {
    cdp = await cdpConnect(9222);
  } catch (e) {
    console.warn('⚠️  Chrome DevTools not available. Skipping visual captures.');
    console.warn('   Start Chrome with: open -a "Google Chrome" --args --remote-debugging-port=9222');
    return;
  }

  const { send, close } = cdp;

  // Navigate to controller page (no session — will show error screen, which is correct)
  const controllerUrl = 'http://localhost:5173/controller?session=test-session&token=invalid-token';

  // Portrait orientation (iPhone-like)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Page.navigate', { url: controllerUrl });
  await new Promise(r => setTimeout(r, 1500));

  const portrait = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
  await writeFile(path.join(REPORTS, 'part36_01_portrait_error_screen.png'),
    Buffer.from(portrait.data, 'base64'));
  console.log('✅ Captured portrait error screen');

  // Landscape orientation (like a phone rotated)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 844, height: 390,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: { type: 'landscapePrimary', angle: 90 },
  });
  await new Promise(r => setTimeout(r, 500));

  const landscape = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
  await writeFile(path.join(REPORTS, 'part36_02_landscape_error_screen.png'),
    Buffer.from(landscape.data, 'base64'));
  console.log('✅ Captured landscape error screen');

  // Navigate back to main app
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await send('Emulation.clearDeviceMetricsOverride', {});

  close();
  console.log('\nCapture complete. Screenshots saved to python/reports/');
}

captureController().catch(e => {
  console.warn('⚠️  Visual capture skipped:', e.message);
  process.exit(0); // Non-fatal
});
