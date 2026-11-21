import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.resolve(ROOT, 'python/reports');

async function getWsEndpoint() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const list = JSON.parse(data);
        const target = list.find(t => t.type === 'page' && t.url.includes('5173')) || list[0];
        resolve(target.webSocketDebuggerUrl);
      });
    }).on('error', reject);
  });
}

async function run() {
  const wsUrl = await getWsEndpoint();
  const ws = new WebSocket(wsUrl);

  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  // Switch to DRIVE mode if not already and click CHASE view
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const driveBtn = btns.find(b => b.textContent && b.textContent.includes('DRIVE'));
      if (driveBtn) driveBtn.click();
      const chaseBtn = document.querySelector('button[title="Rear Third-Person Follow"]');
      if (chaseBtn) chaseBtn.click();
    })()`,
  });

  await new Promise(r => setTimeout(r, 1500));

  console.log('[Capture] Capturing CHASE View (Car at spawn)...');
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part24_01_spawn_daylight_atmosphere.png'), Buffer.from(snap1.data, 'base64'));
  console.log('✓ Saved: part24_01_spawn_daylight_atmosphere.png');

  ws.close();
}

run().catch(console.error);
