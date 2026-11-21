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
  console.log('[Part 25] Connecting to Chrome CDP...');
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
  console.log('[Part 25] Navigated to app. Waiting for initial scene load...');
  await new Promise(r => setTimeout(r, 3000));

  // Switch to DRIVE mode
  console.log('[Part 25] Switching to DRIVE mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('driving');
      } else {
        const btns = Array.from(document.querySelectorAll('button'));
        const driveBtn = btns.find(b => b.textContent && b.textContent.includes('DRIVE'));
        if (driveBtn) driveBtn.click();
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 2500));

  // 1. Screenshot 1: Vehicle at the initial road spawn (CHASE view)
  console.log('[Part 25] Capturing 1: Vehicle at initial road spawn (CHASE)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) window.__appModeStore.getState().setDrivingView('chase');
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part25_01_spawn_placement.png'), Buffer.from(snap1.data, 'base64'));
  console.log('✓ Saved: part25_01_spawn_placement.png');

  // 2. Screenshot 2: Front three-quarter view
  console.log('[Part 25] Capturing 2: Front three-quarter view...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) window.__appModeStore.getState().setDrivingView('orbit');
      const scene = window.__THREE_SCENE__;
      const camera = scene?.children?.find(c => c.isCamera || c.isPerspectiveCamera);
      // Position camera at front-right three-quarter
      const controls = window.__THREE_RENDERER__?.__controls;
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part25_02_front_three_quarter.png'), Buffer.from(snap2.data, 'base64'));
  console.log('✓ Saved: part25_02_front_three_quarter.png');

  // 3. Screenshot 3: Side profile view
  console.log('[Part 25] Capturing 3: Side view...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.__THREE_SCENE__;
      scene?.traverse(o => {
        if (o.isCamera && o.position) {
          o.position.set(5.8, 1.1, 0.0);
          o.lookAt(0, 0.75, 0);
          o.updateProjectionMatrix();
        }
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 1200));
  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part25_03_side_view.png'), Buffer.from(snap3.data, 'base64'));
  console.log('✓ Saved: part25_03_side_view.png');

  // 4. Screenshot 4: Rear three-quarter view
  console.log('[Part 25] Capturing 4: Rear three-quarter view...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.__THREE_SCENE__;
      scene?.traverse(o => {
        if (o.isCamera && o.position) {
          o.position.set(-3.8, 1.45, -4.5);
          o.lookAt(0, 0.75, 0);
          o.updateProjectionMatrix();
        }
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 1200));
  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part25_04_rear_three_quarter.png'), Buffer.from(snap4.data, 'base64'));
  console.log('✓ Saved: part25_04_rear_three_quarter.png');

  // 5. Screenshot 5: Customized vehicle with non-default paint color
  console.log('[Part 25] Applying British Racing Green paint customization...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__paintStore) {
        window.__paintStore.getState().applyPreset('british_racing_green');
        window.__paintStore.getState().setFinish('metallic');
      }
      const scene = window.__THREE_SCENE__;
      scene?.traverse(o => {
        if (o.isCamera && o.position) {
          o.position.set(3.6, 1.35, 3.8);
          o.lookAt(0, 0.75, 0);
          o.updateProjectionMatrix();
        }
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap5 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part25_05_customized_paint_driving.png'), Buffer.from(snap5.data, 'base64'));
  console.log('✓ Saved: part25_05_customized_paint_driving.png');

  // 6. Screenshot 6: Customized rims and brake calipers
  console.log('[Part 25] Applying Gloss Gold rims and Brembo Yellow calipers...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__wheelStore) {
        window.__wheelStore.getState().setRimFinish('all', 'gloss_gold');
        window.__wheelStore.getState().setCaliperPreset('brembo_yellow');
      }
      const scene = window.__THREE_SCENE__;
      scene?.traverse(o => {
        if (o.isCamera && o.position) {
          o.position.set(2.8, 0.85, 2.2);
          o.lookAt(0.97, 0.38, 1.48);
          o.updateProjectionMatrix();
        }
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));
  const snap6 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part25_06_customized_wheels_driving.png'), Buffer.from(snap6.data, 'base64'));
  console.log('✓ Saved: part25_06_customized_wheels_driving.png');

  // 7. Screenshot 7: Return to Showroom Mode after visiting Driving Mode
  console.log('[Part 25] Returning to Showroom Mode to verify customization retention...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('showroom');
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 2500));
  const snap7 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part25_07_showroom_mode_return.png'), Buffer.from(snap7.data, 'base64'));
  console.log('✓ Saved: part25_07_showroom_mode_return.png');

  console.log('\n[Part 25] All 7 verification screenshots captured successfully!');
  ws.close();
}

run().catch((err) => {
  console.error('[Part 25] Capture failed:', err);
  process.exit(1);
});
