import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const REPORTS_DIR = path.resolve(ROOT, 'python/reports');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

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

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureChromeRunning() {
  try {
    const res = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9222/json', (r) => resolve(r.statusCode)).on('error', reject);
    });
    if (res === 200) {
      console.log('✓ Chrome instance already listening on port 9222.');
      return null;
    }
  } catch (_) {}

  console.log('Launching Headless Chrome with Angle WebGL on port 9222...');
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--user-data-dir=/tmp/chrome_cdp_part18',
      '--use-gl=angle',
      '--no-first-run',
      '--no-default-browser-check',
      'http://localhost:5173',
    ],
    { stdio: 'ignore' }
  );

  await sleep(2500);
  return chromeProcess;
}

async function getPageWsUrl(maxRetries = 15, retryDelay = 1000) {
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

async function takeScreenshot(cdp, filename) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  const outPath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`  📸 Saved screenshot: ${filename} (${buffer.length} bytes)`);
}

async function run() {
  const chromeProc = await ensureChromeRunning();

  console.log('[E2E-Part18] Connecting to Chrome via CDP...');
  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to page CDP target.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  // Set desktop viewport for crisp automotive presentation
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Track console errors
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__consoleErrors = [];
      const origError = console.error;
      console.error = (...args) => {
        window.__consoleErrors.push(args.map(a => String(a)).join(' '));
        origError.apply(console, args);
      };
    })()`,
  });

  console.log('\n[E2E-Part18] Waiting for 3D Car Model & PBR Scene to fully load...');
  await sleep(3500);

  // 1. Main Configurator Workspace Overview
  console.log('\n[E2E-Part18] 1. Capturing Main Configurator Workspace...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__cameraStore.getState().setPreset('front-left');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part18_01_main_configurator_workspace.png');

  // 2. Paint Customization Tab
  console.log('\n[E2E-Part18] 2. Activating Paint Customization (Monza Red Metallic)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const paintBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('PAINTWORK'));
      if (paintBtn) paintBtn.click();
      if (window.__paintStore) {
        window.__paintStore.getState().setColor('#D90429', 'metallic');
      }
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part18_02_paint_customization.png');

  // 3. Wheel Customization Tab
  console.log('\n[E2E-Part18] 3. Activating Wheel Customization (Gloss Black Rims & Red Calipers)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const wheelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('WHEELS'));
      if (wheelBtn) wheelBtn.click();
      if (window.__wheelStore) {
        window.__wheelStore.getState().setRimFinish('gloss_black');
        window.__wheelStore.getState().setCaliperPreset('red');
      }
      window.__cameraStore.getState().setPreset('detail-wheel');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part18_03_wheel_customization.png');

  // 4. Secondary Material Customization Tab
  console.log('\n[E2E-Part18] 4. Activating Material Customization (Dark Smoke Glass & Chrome)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const matBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('MATERIALS'));
      if (matBtn) matBtn.click();
      if (window.__secondaryMaterialStore) {
        window.__secondaryMaterialStore.getState().setGlassProfile('dark');
        window.__secondaryMaterialStore.getState().setChromeProfile('chrome');
      }
      window.__cameraStore.getState().setPreset('side-left');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part18_04_material_customization.png');

  // 5. Component Selection & Raycasting Telemetry
  console.log('\n[E2E-Part18] 5. Selecting Component (Brembo Brake Caliper FL) for 3D Wireframe HUD...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__selectionStore) {
        window.__selectionStore.getState().selectComponent('caliper_fl');
      }
    })()`,
  });
  await sleep(1200);
  await takeScreenshot(cdp, 'part18_05_component_selection.png');

  // 6. Vehicle Animation: Closures & Dynamics
  console.log('\n[E2E-Part18] 6. Activating Aerodynamics & Kinematics (Driver Door Open, Bonnet Lifted, Wheels Steered)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__selectionStore) {
        window.__selectionStore.getState().clearSelection();
      }
      const closureBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('AERODYNAMICS'));
      if (closureBtn) closureBtn.click();
      if (window.__vehicleRigStore) {
        window.__vehicleRigStore.getState().openClosure('door_fl');
        window.__vehicleRigStore.getState().openClosure('bonnet');
      }
      if (window.__wheelAnimationStore) {
        window.__wheelAnimationStore.getState().setTargetSteeringAngle((22 * Math.PI) / 180);
      }
      window.__cameraStore.getState().setPreset('front-left');
    })()`,
  });
  await sleep(1500);
  await takeScreenshot(cdp, 'part18_06_vehicle_animation.png');

  // 7. Lighting & Environment Controls
  console.log('\n[E2E-Part18] 7. Activating Lighting Systems & Cinematic Stage Environment...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const lightBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('LIGHTING'));
      if (lightBtn) lightBtn.click();
      if (window.__vehicleLightingStore) {
        window.__vehicleLightingStore.getState().setHeadlightMode('low_beam');
        window.__vehicleLightingStore.getState().toggleHazard();
      }
      if (window.__showroomEnvironmentStore) {
        window.__showroomEnvironmentStore.getState().setEnvironment('cinematic_stage');
      }
      window.__cameraStore.getState().setPreset('rear-left');
    })()`,
  });
  await sleep(1500);
  await takeScreenshot(cdp, 'part18_07_lighting_environment_controls.png');

  // 8. Complete Full-Bleed Showroom Presentation
  console.log('\n[E2E-Part18] 8. Capturing Complete Art-Directed Showroom Presentation (Drawer Toggled Closed)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('HIDE PANEL') || b.textContent.includes('CONTROLS'));
      if (toggleBtn && toggleBtn.textContent.includes('HIDE PANEL')) toggleBtn.click();
      window.__cameraStore.getState().setPreset('front-left');
    })()`,
  });
  await sleep(1200);
  await takeScreenshot(cdp, 'part18_08_complete_showroom_presentation.png');

  // Check console errors
  const errorCheck = await cdp.send('Runtime.evaluate', {
    expression: 'window.__consoleErrors || []',
    returnByValue: true,
  });

  const errors = errorCheck.result.value || [];
  if (errors.length > 0) {
    console.warn('⚠️ Console errors recorded during test run:', errors);
  } else {
    console.log('✓ Zero console errors recorded during all configurator interactions.');
  }

  // Restore neutral pose
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__paintStore) window.__paintStore.getState().resetToFactory();
      if (window.__wheelStore) window.__wheelStore.getState().resetWheelsToFactory();
      if (window.__secondaryMaterialStore) window.__secondaryMaterialStore.getState().resetToFactory();
      if (window.__vehicleRigStore) window.__vehicleRigStore.getState().resetAll();
      if (window.__wheelAnimationStore) window.__wheelAnimationStore.getState().resetTransforms();
      if (window.__vehicleLightingStore) window.__vehicleLightingStore.getState().allLightsOff();
      if (window.__showroomEnvironmentStore) window.__showroomEnvironmentStore.getState().resetEnvironment();
      window.__cameraStore.getState().resetView();
    })()`,
  });

  cdp.close();
  if (chromeProc) {
    chromeProc.kill();
  }
  console.log('\n🎉 Part 18 E2E Browser Verification Completed Successfully!\n');
}

run().catch((err) => {
  console.error('Fatal error running verify_configurator_redesign.mjs:', err);
  process.exit(1);
});
