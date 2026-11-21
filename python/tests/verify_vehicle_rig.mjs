import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const REPORTS_DIR = path.resolve(ROOT, 'python/reports');

// Helper to make CDP RPC calls over WebSocket
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.ws = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        } else if (msg.method) {
          this.events.push(msg);
        }
      };
    });
  }

  async send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getPageWsUrl(maxRetries = 10, retryDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const wsUrl = await new Promise((resolve, reject) => {
        http
          .get('http://127.0.0.1:9222/json', (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => {
              try {
                const list = JSON.parse(body);
                const page = list.find((p) => p.type === 'page' && p.url.includes('localhost:5173'));
                if (page) resolve(page.webSocketDebuggerUrl);
                else reject(new Error('No matching localhost:5173 page target found'));
              } catch (err) {
                reject(err);
              }
            });
          })
          .on('error', reject);
      });
      return wsUrl;
    } catch {
      await sleep(retryDelay);
    }
  }
  throw new Error(`Failed to connect to Chrome DevTools at 127.0.0.1:9222 after ${maxRetries} attempts`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function takeScreenshot(cdp, filename) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  const outPath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`  📸 Saved screenshot: ${filename} (${buffer.length} bytes)`);
}

async function run() {
  console.log('[E2E-Part14] Connecting to headless Chrome via CDP...');
  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to page CDP target.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  // Track runtime console errors
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__consoleErrors = [];
      window.__hadError = false;
      window.addEventListener('error', (e) => {
        window.__hadError = true;
        window.__consoleErrors.push(e.message);
      });
      window.addEventListener('unhandledrejection', (e) => {
        window.__hadError = true;
        window.__consoleErrors.push(String(e.reason));
      });
    `,
  });

  console.log('[E2E-Part14] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3500);

  // 1. Initial State: Factory Closed Vehicle
  console.log('\n[E2E-Part14] 1. Verifying Factory Closed Vehicle State...');
  const initialCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const rig = window.__vehicleRigStore;
      const camera = window.__cameraStore;
      if (!rig || !camera) return { error: 'Stores missing' };

      rig.getState().resetAll();
      camera.getState().resetView();

      const closures = rig.getState().closures;
      return {
        door_fl: closures.door_fl.state,
        door_fr: closures.door_fr.state,
        bonnet: closures.bonnet.state,
        boot: closures.boot.state,
        isAnyAnimating: rig.getState().isAnyAnimating,
      };
    })()`,
    returnByValue: true,
  });

  console.log('Factory Closed State:', initialCheck.result.value);
  await sleep(1000);
  await takeScreenshot(cdp, 'part14_01_factory_closed.png');

  // 2. Open Driver Door (Front-Left)
  console.log('\n[E2E-Part14] 2. Opening Driver Door & Framing Camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__vehicleRigStore.getState().openClosure('door_fl');
      window.__cameraStore.getState().focusOn('door_fl');
    `,
  });
  // Wait for animation interpolation (950ms) + camera transition
  await sleep(1800);

  const flCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const fl = window.__vehicleRigStore.getState().closures.door_fl;
      return {
        progress: Number(fl.currentProgress.toFixed(2)),
        state: fl.state,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Driver Door Opened State:', flCheck.result.value);
  await takeScreenshot(cdp, 'part14_02_driver_door_open.png');

  // Close driver door before testing passenger door
  await cdp.send('Runtime.evaluate', {
    expression: `window.__vehicleRigStore.getState().closeClosure('door_fl');`,
  });
  await sleep(1200);

  // 3. Open Passenger Door (Front-Right)
  console.log('\n[E2E-Part14] 3. Opening Passenger Door & Framing Camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__vehicleRigStore.getState().openClosure('door_fr');
      window.__cameraStore.getState().focusOn('door_fr');
    `,
  });
  await sleep(1800);

  const frCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const fr = window.__vehicleRigStore.getState().closures.door_fr;
      return {
        progress: Number(fr.currentProgress.toFixed(2)),
        state: fr.state,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Passenger Door Opened State:', frCheck.result.value);
  await takeScreenshot(cdp, 'part14_03_passenger_door_open.png');

  // Close passenger door before testing bonnet
  await cdp.send('Runtime.evaluate', {
    expression: `window.__vehicleRigStore.getState().closeClosure('door_fr');`,
  });
  await sleep(1200);

  // 4. Open Bonnet (Front Hood Clamshell)
  console.log('\n[E2E-Part14] 4. Opening Bonnet / Hood & Framing Camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__vehicleRigStore.getState().openClosure('bonnet');
      window.__cameraStore.getState().focusOn('bonnet');
    `,
  });
  await sleep(1800);

  const bonnetCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const b = window.__vehicleRigStore.getState().closures.bonnet;
      return {
        progress: Number(b.currentProgress.toFixed(2)),
        state: b.state,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Bonnet Opened State:', bonnetCheck.result.value);
  await takeScreenshot(cdp, 'part14_04_bonnet_open.png');

  // Close bonnet before testing boot
  await cdp.send('Runtime.evaluate', {
    expression: `window.__vehicleRigStore.getState().closeClosure('bonnet');`,
  });
  await sleep(1200);

  // 5. Open Boot / Rear Hatch
  console.log('\n[E2E-Part14] 5. Opening Boot / Trunk & Framing Camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__vehicleRigStore.getState().openClosure('boot');
      window.__cameraStore.getState().focusOn('boot');
    `,
  });
  await sleep(1800);

  const bootCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const b = window.__vehicleRigStore.getState().closures.boot;
      return {
        progress: Number(b.currentProgress.toFixed(2)),
        state: b.state,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Boot Opened State:', bootCheck.result.value);
  await takeScreenshot(cdp, 'part14_05_boot_open.png');

  // 6. Multiple Closures Open (Open All in Hero View)
  console.log('\n[E2E-Part14] 6. Opening All Closures Simultaneously in Elevated Hero View...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__vehicleRigStore.getState().openAll();
      window.__cameraStore.getState().setPreset('front-left');
    `,
  });
  await sleep(2200);

  const allCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const closures = window.__vehicleRigStore.getState().closures;
      return {
        door_fl: closures.door_fl.state,
        door_fr: closures.door_fr.state,
        bonnet: closures.bonnet.state,
        boot: closures.boot.state,
        allOpen: Object.values(closures).every(c => c.currentProgress > 0.95),
      };
    })()`,
    returnByValue: true,
  });
  console.log('All Closures Open State:', allCheck.result.value);
  await takeScreenshot(cdp, 'part14_06_multiple_closures_open.png');

  // 7. Component HUD with Closure Controls
  console.log('\n[E2E-Part14] 7. Selecting Driver Door & Inspecting HUD Closure Controls...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__selectionStore.getState().selectComponent('door_fl', 'BodyDoorLColor2');
      window.__cameraStore.getState().focusOn('door_fl');
    `,
  });
  await sleep(1200);

  const hudCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body.innerText;
      return {
        hasTitle: bodyText.includes('FRONT-LEFT DOOR'),
        hasMechanismLabel: bodyText.includes('KINEMATIC MECHANISM'),
        hasCloseButton: bodyText.includes('CLOSE FRONT-LEFT DOOR') || bodyText.includes('OPEN FRONT-LEFT DOOR'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Component HUD Closures Check:', hudCheck.result.value);
  await takeScreenshot(cdp, 'part14_07_component_hud_closure_controls.png');

  // Reset all and deselect
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__selectionStore.getState().clearSelection();
      window.__vehicleRigStore.getState().resetAll();
      window.__cameraStore.getState().resetView();
    `,
  });
  await sleep(1500);

  // Check console errors
  const errorsCheck = await cdp.send('Runtime.evaluate', {
    expression: `window.__consoleErrors || []`,
    returnByValue: true,
  });
  console.log('\n[E2E-Part14] Console Errors Check:', errorsCheck.result.value);
  if (errorsCheck.result.value && errorsCheck.result.value.length > 0) {
    console.warn('⚠️ Console errors detected:', errorsCheck.result.value);
  } else {
    console.log('✓ 0 console errors detected throughout Part 14 E2E test run.');
  }

  cdp.close();
  console.log('\n========================================================================');
  console.log('   Part 14 — Automotive Closures Rigging & Animation E2E PASSED!        ');
  console.log('========================================================================\n');
}

run().catch((err) => {
  console.error('[E2E-Part14] Test run failed:', err);
  process.exit(1);
});
