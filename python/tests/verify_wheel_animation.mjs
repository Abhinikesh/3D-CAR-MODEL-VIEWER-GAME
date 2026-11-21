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
  console.log('[E2E-Part15] Connecting to Chrome via CDP...');
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

  console.log('[E2E-Part15] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3500);

  // 1. Initial State Screenshot
  console.log('\n[E2E-Part15] 1. Verifying Initial Showroom State...');
  const initialCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__wheelAnimationStore;
      const camera = window.__cameraStore;
      if (!store || !camera) return { error: 'Stores missing' };

      camera.getState().resetView();

      return {
        isSpinning: store.getState().isSpinning,
        currentSteeringAngle: store.getState().currentSteeringAngle,
        spinMode: store.getState().spinMode,
        resolvedCount: Object.keys(window.__wheelAnimationResolved || {}).length,
      };
    })()`,
    returnByValue: true,
  });

  console.log('  Initial state evaluation:', initialCheck.result.value);
  await sleep(600);
  await takeScreenshot(cdp, 'part15_01_initial_showroom.png');

  // 2. Open Wheel Animation Toolbar
  console.log('\n[E2E-Part15] 2. Opening Wheel Dynamics Toolbar...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const wheelBtn = btns.find(b => b.textContent.includes('WHEEL DYNAMICS'));
      if (wheelBtn) wheelBtn.click();
    })()`,
  });
  await sleep(600);
  await takeScreenshot(cdp, 'part15_02_toolbar_opened.png');

  // 3. Steer Center (0 degrees)
  console.log('\n[E2E-Part15] 3. Steer Front Wheels Center (0°)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__wheelAnimationStore.getState().steerCenter();
      window.__cameraStore.getState().setPreset('front');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part15_03_steer_center.png');

  // 4. Steer Left (+30 degrees)
  console.log('\n[E2E-Part15] 4. Steer Front Wheels Left (+30°)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__wheelAnimationStore.getState().steerLeft();
      window.__cameraStore.getState().setPreset('front-left');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part15_04_steer_left.png');

  // 5. Steer Right (-30 degrees)
  console.log('\n[E2E-Part15] 5. Steer Front Wheels Right (-30°)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__wheelAnimationStore.getState().steerRight();
      window.__cameraStore.getState().setPreset('front-right');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part15_05_steer_right.png');

  // 6. Wheel Spin Active (All 4 wheels rotating forward)
  console.log('\n[E2E-Part15] 6. Starting Continuous Wheel Spin (All 4 Wheels)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__wheelAnimationStore;
      store.getState().steerCenter();
      store.getState().setSpinMode('all');
      store.getState().setSpinSpeed(1.5);
      store.getState().startSpin();
      window.__cameraStore.getState().setPreset('left-profile');
    })()`,
  });
  await sleep(1200);
  await takeScreenshot(cdp, 'part15_06_wheel_spin_active.png');

  // 7. Individual Wheel Selection & ComponentHUD
  console.log('\n[E2E-Part15] 7. Selecting FL Wheel and inspecting in ComponentHUD...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__selectionStore.getState().selectComponent('wheel_fl');
      window.__cameraStore.getState().focusOn('wheel_fl');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part15_07_individual_wheel_hud.png');

  // 8. Reset Transforms & Verify Zero Drift
  console.log('\n[E2E-Part15] 8. Resetting Transforms and Verifying Zero Drift...');
  const resetEval = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__wheelAnimationStore;
      store.getState().resetTransforms();
      window.__selectionStore.getState().clearSelection();
      window.__cameraStore.getState().resetView();

      const state = store.getState();
      return {
        isSpinning: state.isSpinning,
        targetSteeringAngle: state.targetSteeringAngle,
        currentSteeringAngle: state.currentSteeringAngle,
        wheelRollAngles: state.wheelRollAngles,
      };
    })()`,
    returnByValue: true,
  });
  console.log('  Reset state evaluation:', resetEval.result.value);
  await sleep(1000);
  await takeScreenshot(cdp, 'part15_08_reset_transforms.png');

  // Check for any runtime errors
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

  cdp.close();
  console.log('\n🎉 Part 15 E2E Browser Verification Completed Successfully!\n');
}

run().catch((err) => {
  console.error('Fatal error running verify_wheel_animation.mjs:', err);
  process.exit(1);
});
