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
        try {
          const list = JSON.parse(data);
          const target = list.find(t => t.type === 'page' && t.url.includes('5173')) || list[0];
          resolve(target.webSocketDebuggerUrl);
        } catch (e) {
          reject(e);
        }
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

  // Ensure navigated to http://localhost:5173/
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  console.log('[Capture] Navigated to http://localhost:5173/. Waiting 3.5s for WebGL scene load...');
  await new Promise(r => setTimeout(r, 3500));

  // Switch to SHOWROOM mode if in Driving
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const studioBtn = btns.find(b => b.textContent && b.textContent.includes('STUDIO'));
      if (studioBtn) studioBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Capture Showroom Hero with Customization Drawer Open
  console.log('[Capture] 1. Capturing Showroom with Refined Drawer...');
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'showroom_refined_customization_drawer.png'), Buffer.from(snap1.data, 'base64'));
  console.log('✓ Saved: python/reports/showroom_refined_customization_drawer.png');

  // 2. Close Customization Drawer to showcase Full-Bleed Hero Car Framing
  console.log('[Capture] 2. Closing drawer for Full-Bleed Hero Framing...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Find the Paint tab button and click it to toggle drawer closed
      const paintTab = btns.find(b => b.textContent && b.textContent.includes('Paint'));
      if (paintTab) paintTab.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1200));

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'showroom_refined_hero_fullbleed.png'), Buffer.from(snap2.data, 'base64'));
  console.log('✓ Saved: python/reports/showroom_refined_hero_fullbleed.png');

  // 3. Switch to Luxury Showroom Environment
  console.log('[Capture] 3. Switching to Luxury Showroom Environment...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Reopen drawer to Environment tab
      const btns = Array.from(document.querySelectorAll('button'));
      const envTab = btns.find(b => b.textContent && b.textContent.includes('Environment'));
      if (envTab) envTab.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1000));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const luxBtn = btns.find(b => b.textContent && b.textContent.includes('Luxury Showroom'));
      if (luxBtn) luxBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));

  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'showroom_refined_luxury_env.png'), Buffer.from(snap3.data, 'base64'));
  console.log('✓ Saved: python/reports/showroom_refined_luxury_env.png');

  // 4. Switch to Cinematic Stage Environment
  console.log('[Capture] 4. Switching to Cinematic Stage Environment...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cineBtn = btns.find(b => b.textContent && b.textContent.includes('Cinematic Stage'));
      if (cineBtn) cineBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));

  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'showroom_refined_cinematic_env.png'), Buffer.from(snap4.data, 'base64'));
  console.log('✓ Saved: python/reports/showroom_refined_cinematic_env.png');

  // Reset to default studio environment
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const studioEnvBtn = btns.find(b => b.textContent && b.textContent.includes('Premium Studio'));
      if (studioEnvBtn) studioEnvBtn.click();
      const paintTab = btns.find(b => b.textContent && b.textContent.includes('Paint'));
      if (paintTab) paintTab.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1000));

  ws.close();
  console.log('All visual refinement verification screenshots captured successfully!');
}

run().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
