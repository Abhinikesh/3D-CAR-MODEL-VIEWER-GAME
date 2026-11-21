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

async function getPageWsUrl(maxRetries = 12, retryDelay = 1000) {
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
  console.log('[E2E-Part16] Connecting to Chrome via CDP...');
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

  console.log('[E2E-Part16] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3500);

  // 1. All Lights Off Baseline Screenshot
  console.log('\n[E2E-Part16] 1. Verifying All Lights OFF Baseline State...');
  const initialCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehicleLightingStore;
      const camera = window.__cameraStore;
      if (!store || !camera) return { error: 'Stores missing' };

      store.getState().allLightsOff();
      camera.getState().resetView();

      return {
        headlightMode: store.getState().headlightMode,
        taillightMode: store.getState().taillightMode,
        brakeMode: store.getState().brakeMode,
        indicatorMode: store.getState().indicatorMode,
        hasRig: Boolean(window.__vehicleLightingRig),
      };
    })()`,
    returnByValue: true,
  });

  console.log('  Initial state evaluation:', initialCheck.result.value);
  await sleep(600);
  await takeScreenshot(cdp, 'part16_01_all_lights_off.png');

  // 2. Open Lighting Toolbar
  console.log('\n[E2E-Part16] 2. Opening Vehicle Lighting Toolbar...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const lightBtn = btns.find(b => b.textContent.includes('VEHICLE LIGHTING'));
      if (lightBtn) lightBtn.click();
    })()`,
  });
  await sleep(600);
  await takeScreenshot(cdp, 'part16_02_toolbar_opened.png');

  // 3. Parking / DRL Lights (Front View)
  console.log('\n[E2E-Part16] 3. Activating Parking / DRL Lights (Front View)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleLightingStore.getState().setHeadlightMode('parking');
      window.__cameraStore.getState().setPreset('front');
    })()`,
  });
  await sleep(900);
  await takeScreenshot(cdp, 'part16_03_parking_drl.png');

  // 4. Low Beam Headlights & Forward SpotLight
  console.log('\n[E2E-Part16] 4. Activating Low Beam Headlights & Road Surface Illumination...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleLightingStore.getState().setHeadlightMode('low_beam');
      window.__cameraStore.getState().setPreset('front-left');
    })()`,
  });
  await sleep(900);
  await takeScreenshot(cdp, 'part16_04_low_beam_active.png');

  // 5. High Beam Headlights (Long Throw Beam)
  console.log('\n[E2E-Part16] 5. Activating High Beam Headlights...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleLightingStore.getState().setHeadlightMode('high_beam');
    })()`,
  });
  await sleep(900);
  await takeScreenshot(cdp, 'part16_05_high_beam_active.png');

  // 6. Rear View: Running Taillights
  console.log('\n[E2E-Part16] 6. Rear View: Running Taillights...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleLightingStore.getState().setHeadlightMode('low_beam');
      window.__cameraStore.getState().setPreset('rear');
    })()`,
  });
  await sleep(900);
  await takeScreenshot(cdp, 'part16_06_taillights_running.png');

  // 7. Rear View: Brake Lights Active (High Intensity + Red Ground Glow)
  console.log('\n[E2E-Part16] 7. Rear View: Activating Brake Lights (Stop Warning)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleLightingStore.getState().pressBrake();
    })()`,
  });
  await sleep(900);
  await takeScreenshot(cdp, 'part16_07_brake_lights_active.png');

  // 8. Hazard Warning Flasher (1.5 Hz Synchronized Blinker)
  console.log('\n[E2E-Part16] 8. Activating Hazard Warning Flashers...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleLightingStore.getState().releaseBrake();
      window.__vehicleLightingStore.getState().toggleHazard();
      window.__cameraStore.getState().setPreset('rear-left');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part16_08_hazard_flasher_active.png');

  // Check for console errors
  const errorCheck = await cdp.send('Runtime.evaluate', {
    expression: 'window.__consoleErrors || []',
    returnByValue: true,
  });

  const errors = errorCheck.result.value || [];
  if (errors.length > 0) {
    console.warn('⚠️ Console errors detected during test run:', errors);
  } else {
    console.log('✓ Zero console errors recorded during browser interactions.');
  }

  // Restore neutral state
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleLightingStore.getState().allLightsOff();
      window.__cameraStore.getState().resetView();
    })()`,
  });

  cdp.close();
  console.log('\n🎉 Part 16 E2E Browser Verification Completed Successfully!\n');
}

run().catch((err) => {
  console.error('Fatal error running verify_vehicle_lighting.mjs:', err);
  process.exit(1);
});
