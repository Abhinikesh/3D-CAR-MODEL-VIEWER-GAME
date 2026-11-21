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

  // Set 1440x900 viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Clear any active component selection for clean showcase
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__selectionStore) {
        window.__selectionStore.getState().clearSelection();
      }
      const btns = Array.from(document.querySelectorAll('button'));
      const clearBtn = btns.find(b => b.textContent && b.textContent.includes('Clear Selection'));
      if (clearBtn) clearBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 400));

  // Click the Close button on the drawer
  await send('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.querySelector('button[title="Collapse Panel"]');
      if (closeBtn) closeBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 800));

  console.log('[Capture] Capturing Full-Bleed Hero Viewport...');
  const snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'showroom_refined_hero_fullbleed.png'), Buffer.from(snap.data, 'base64'));
  console.log('✓ Saved: python/reports/showroom_refined_hero_fullbleed.png');

  // Now capture with drawer open on Paintwork
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const paintTab = btns.find(b => b.textContent && b.textContent.includes('PAINTWORK'));
      if (paintTab) paintTab.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 800));

  // Also select Carmine Red preset so it looks clean OEM red
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const redPreset = btns.find(b => b.textContent && b.textContent.includes('Carmine Red'));
      if (redPreset) redPreset.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('[Capture] Capturing Refined Drawer Viewport...');
  const snapDrawer = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'showroom_refined_customization_drawer.png'), Buffer.from(snapDrawer.data, 'base64'));
  console.log('✓ Saved: python/reports/showroom_refined_customization_drawer.png');

  ws.close();
}

run().catch(console.error);
