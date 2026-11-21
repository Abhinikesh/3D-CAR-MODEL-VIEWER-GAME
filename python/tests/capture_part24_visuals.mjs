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

  // Set standard 1440x900 viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Navigate to application and allow asset loading
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  console.log('[Part 24] Navigated to app. Waiting for initial scene load...');
  await new Promise(r => setTimeout(r, 3500));

  // Switch to DRIVE mode
  console.log('[Part 24] Switching to DRIVE mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const driveBtn = btns.find(b => b.textContent && b.textContent.includes('DRIVE'));
      if (driveBtn) driveBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 2500));

  // 1. Screenshot 1: Car at spawn location under outdoor daylight (CHASE view)
  console.log('[Part 24] Capturing 1: Car at spawn location (CHASE)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const chaseBtn = btns.find(b => b.textContent && b.textContent.includes('CHASE'));
      if (chaseBtn) chaseBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part24_01_spawn_daylight_atmosphere.png'), Buffer.from(snap1.data, 'base64'));
  console.log('✓ Saved: part24_01_spawn_daylight_atmosphere.png');

  // 2. Screenshot 2: Road curve with environment visible (TURN 1 view)
  console.log('[Part 24] Capturing 2: Road curve & scenery (TURN 1)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const t1Btn = btns.find(b => b.textContent && b.textContent.includes('TURN 1'));
      if (t1Btn) t1Btn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part24_02_curve_scenery_atmosphere.png'), Buffer.from(snap2.data, 'base64'));
  console.log('✓ Saved: part24_02_curve_scenery_atmosphere.png');

  // 3. Screenshot 3: Road from wider overview (AERIAL view)
  console.log('[Part 24] Capturing 3: Wide road & circuit overview (AERIAL)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const aerialBtn = btns.find(b => b.textContent && b.textContent.includes('AERIAL'));
      if (aerialBtn) aerialBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part24_03_wide_aerial_circuit_overview.png'), Buffer.from(snap3.data, 'base64'));
  console.log('✓ Saved: part24_03_wide_aerial_circuit_overview.png');

  // 4. Screenshot 4: Vehicle under final daylight lighting (VEHICLE / ORBIT 3/4 showcase view)
  console.log('[Part 24] Capturing 4: Vehicle under final daylight lighting (VEHICLE 6)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const vehBtn = btns.find(b => b.textContent && b.textContent.includes('VEHICLE'));
      if (vehBtn) vehBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part24_04_vehicle_daylight_lighting.png'), Buffer.from(snap4.data, 'base64'));
  console.log('✓ Saved: part24_04_vehicle_daylight_lighting.png');

  // 5. Screenshot 5: Forward cockpit view (HOOD view)
  console.log('[Part 24] Capturing 5: Forward cockpit road view (HOOD)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const hoodBtn = btns.find(b => b.textContent && b.textContent.includes('HOOD'));
      if (hoodBtn) hoodBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap5 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part24_05_forward_cockpit_road_view.png'), Buffer.from(snap5.data, 'base64'));
  console.log('✓ Saved: part24_05_forward_cockpit_road_view.png');

  // 6. Screenshot 6: Regression check - return to SHOWROOM mode
  console.log('[Part 24] Capturing 6: Return to SHOWROOM mode (regression check)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const studioBtn = btns.find(b => b.textContent && b.textContent.includes('STUDIO'));
      if (studioBtn) studioBtn.click();
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap6 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part24_06_showroom_regression_check.png'), Buffer.from(snap6.data, 'base64'));
  console.log('✓ Saved: part24_06_showroom_regression_check.png');

  ws.close();
  console.log('All Part 24 verification screenshots captured successfully!');
}

run().catch(console.error);
