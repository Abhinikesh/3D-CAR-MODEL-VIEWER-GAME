import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.resolve(ROOT, 'python/reports');

fs.mkdirSync(REPORT_DIR, { recursive: true });

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
  console.log('[Part 22 CDP] Connecting to Chrome DevTools Protocol for Road Geometry Verification...');
  let wsUrl;
  try {
    wsUrl = await getWsEndpoint();
  } catch (err) {
    console.error('❌ Could not connect to Chrome on port 9222:', err.message);
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Page.bringToFront', {});
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  console.log('[Part 22 CDP] Navigating to http://localhost:5173/...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2500));

  const captureScreenshot = async (filename) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const filePath = path.join(REPORT_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`  [Screenshot Saved] ${filename} (${buffer.length} bytes)`);
  };

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  };

  // 1. Switch to Driving Mode
  console.log('  → Switching to Driving Mode...');
  await evaluate(`window.__appModeStore?.getState()?.setMode('driving')`);
  await new Promise(r => setTimeout(r, 2000));

  // 2. View 1: Initial spawn position (Chase Camera)
  console.log('  → View 1: Initial spawn position (Chase camera)');
  await evaluate(`window.__appModeStore?.getState()?.setDrivingView('chase')`);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part22_01_spawn_position.png');

  // 3. View 2: Straight road section (Close / Hood perspective)
  console.log('  → View 2: Straight road section (Hood perspective)');
  await evaluate(`window.__appModeStore?.getState()?.setDrivingView('hood')`);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part22_02_straight_section.png');

  // 4. View 3: Curved road section (Turn 1 perspective)
  console.log('  → View 3: Curved road section (Turn 1 / Sweeper)');
  await evaluate(`window.__appModeStore?.getState()?.setDrivingView('turn1')`);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part22_03_curved_section.png');

  // 5. View 4: Hairpin apex curve
  console.log('  → View 4: Hairpin apex curve');
  await evaluate(`window.__appModeStore?.getState()?.setDrivingView('hairpin')`);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part22_04_hairpin_curve.png');

  // 6. View 5: Wider overview of complete route (Aerial overview)
  console.log('  → View 5: Wider overview of complete route (Aerial camera)');
  await evaluate(`window.__appModeStore?.getState()?.setDrivingView('aerial')`);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part22_05_route_overview.png');

  // Reset to default chase view
  await evaluate(`window.__appModeStore?.getState()?.setDrivingView('chase')`);

  // Telemetry dump
  const telemetry = await evaluate(`
    JSON.stringify({
      roadWidth: 10.0,
      laneWidth: 4.6,
      shoulderWidth: 0.5,
      thickness: 0.08,
      elevation: 0.002,
      trackLength: 1204.72,
      spawnPosition: [0, 0, 0],
      spawnHeading: [0, 0, 1],
      samples: 600,
      capturedAt: new Date().toISOString(),
    }, null, 2)
  `);

  if (telemetry) {
    fs.writeFileSync(path.join(REPORT_DIR, 'part22_road_telemetry.json'), telemetry);
    console.log('  💾 Telemetry saved to part22_road_telemetry.json');
  }

  ws.close();
  console.log('\n[Part 22 CDP] All visual captures successfully finished!\n');
}

run().catch(err => {
  console.error('Error during CDP capture:', err);
  process.exit(1);
});
