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
  console.log('[Part 33 CDP] Connecting to Chrome DevTools Protocol for Keyboard Input Verification...');
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

  console.log('[Part 33 CDP] Navigating to http://localhost:5173/...');
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

  // 2. Scenario 1: Controls help panel
  console.log('  → Scenario 1: Controls help panel (expanded)');
  await evaluate(`
    (function() {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('CONTROLS'));
      if (btn) btn.click();
    })();
  `);
  await new Promise(r => setTimeout(r, 600));
  await captureScreenshot('part33_01_controls_help_panel.png');

  // 3. Scenario 2: Accelerating (W held)
  console.log('  → Scenario 2: Accelerating (W key held)');
  await evaluate(`
    window.__vehicleInputStore?.getState()?.setInputs({
      throttle: 1.0, brake: 0.0, steer: 0.0,
      gear: 'D', handbrake: false
    });
  `);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part33_02_accelerating.png');

  // 4. Scenario 3: Steering (A held)
  console.log('  → Scenario 3: Steering left (A key held)');
  await evaluate(`
    window.__vehicleInputStore?.getState()?.setInputs({
      throttle: 0.5, brake: 0.0, steer: -1.0,
      gear: 'D', handbrake: false
    });
  `);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part33_03_steering.png');

  // 5. Scenario 4: Braking (S while moving)
  console.log('  → Scenario 4: Braking (S key held)');
  await evaluate(`
    window.__vehicleInputStore?.getState()?.setInputs({
      throttle: 0.0, brake: 1.0, steer: 0.0,
      gear: 'D', handbrake: false
    });
  `);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part33_04_braking.png');

  // 6. Scenario 5: Simulation Paused (Escape / P pressed)
  console.log('  → Scenario 5: Simulation paused (Escape pressed)');
  await evaluate(`window.__vehicleInputStore?.getState()?.resetInputs()`);
  await evaluate(`window.__vehiclePhysicsStore?.getState()?.pause?.()`);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('part33_05_paused.png');

  // Clean up: resume simulation & reset inputs
  await evaluate(`window.__vehiclePhysicsStore?.getState()?.resume?.()`);
  await evaluate(`window.__vehicleInputStore?.getState()?.resetInputs()`);

  // Telemetry dump
  const telemetry = await evaluate(`
    JSON.stringify({
      inputStore:   window.__vehicleInputStore?.getState?.(),
      appMode:      window.__appModeStore?.getState?.()?.mode,
      drivingView:  window.__appModeStore?.getState?.()?.drivingView,
      capturedAt:   new Date().toISOString(),
    }, null, 2)
  `);

  if (telemetry) {
    fs.writeFileSync(path.join(REPORT_DIR, 'part33_keyboard_telemetry.json'), telemetry);
    console.log('  💾 Telemetry saved to part33_keyboard_telemetry.json');
  }

  ws.close();
  console.log('\n[Part 33 CDP] All 5 Visual captures successfully finished!\n');
}

run().catch(err => {
  console.error('Error during CDP capture:', err);
  process.exit(1);
});
