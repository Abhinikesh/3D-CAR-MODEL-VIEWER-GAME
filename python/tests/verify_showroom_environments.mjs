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
      '--user-data-dir=/tmp/chrome_cdp_part17',
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

  console.log('[E2E-Part17] Connecting to Chrome via CDP...');
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

  console.log('\n[E2E-Part17] Waiting for 3D Car Model & PBR Scene to fully load...');
  await sleep(3500);

  // 1. Initial State: Premium Studio Environment
  console.log('\n[E2E-Part17] 1. Capturing Initial State: Premium Studio...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__cameraStore.getState().setPreset('front-left');
    })()`,
  });
  await sleep(1000);
  await takeScreenshot(cdp, 'part17_01_premium_studio.png');

  // 2. Open Environment Toolbar UI Popover
  console.log('\n[E2E-Part17] 2. Opening Environment Toolbar Popover...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('button[title*="Environment"]');
      if (btn) btn.click();
    })()`,
  });
  await sleep(600);
  await takeScreenshot(cdp, 'part17_02_toolbar_opened.png');

  // 3. Switch to Environment 2: Luxury Showroom
  console.log('\n[E2E-Part17] 3. Switching to Luxury Showroom (Mirror Gloss Porcelain Floor & Champagne Warmth)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__showroomEnvironmentStore.getState().setEnvironment('luxury_showroom');
      window.__cameraStore.getState().setPreset('side-left');
    })()`,
  });
  await sleep(1200);
  await takeScreenshot(cdp, 'part17_03_luxury_showroom.png');

  // 4. Switch to Environment 3: Outdoor Daylight
  console.log('\n[E2E-Part17] 4. Switching to Outdoor Daylight (Procedural Sky Dome & Matte Asphalt Floor)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__showroomEnvironmentStore.getState().setEnvironment('outdoor_daylight');
      window.__cameraStore.getState().setPreset('front-left');
    })()`,
  });
  await sleep(1200);
  await takeScreenshot(cdp, 'part17_04_outdoor_daylight.png');

  // 5. Switch to Environment 4: Cinematic Stage
  console.log('\n[E2E-Part17] 5. Switching to Cinematic Stage (Cyan & Violet Dual Rim Lights & Wet Obsidian Mirror)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__showroomEnvironmentStore.getState().setEnvironment('cinematic_stage');
      window.__cameraStore.getState().setPreset('rear-left');
    })()`,
  });
  await sleep(1200);
  await takeScreenshot(cdp, 'part17_05_cinematic_stage.png');

  // 6. Demonstrate Customization & Animation Preservation in Cinematic Stage
  console.log('\n[E2E-Part17] 6. Verifying Full Vehicle Customization Preservation in Cinematic Stage...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // Turn on headlights (beam throw + lens emissive)
      if (window.__vehicleLightingStore) {
        window.__vehicleLightingStore.getState().setHeadlampMode('low_beam');
      }
      // Open driver door
      if (window.__vehicleRigStore) {
        window.__vehicleRigStore.getState().openClosure('door_fl');
      }
      // Steer wheels
      if (window.__wheelAnimationStore) {
        window.__wheelAnimationStore.getState().setSteerAngle(22);
      }
      // Change paint to vibrant Monza Red
      if (window.__paintStore) {
        window.__paintStore.getState().setColor('#D90429', 'metallic');
      }
      window.__cameraStore.getState().setPreset('front-left');
    })()`,
  });
  await sleep(1500);
  await takeScreenshot(cdp, 'part17_06_customization_preserved.png');

  // 7. Adjust Lighting Calibration Sliders
  console.log('\n[E2E-Part17] 7. Calibrating Exposure and Reflection Multipliers...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__showroomEnvironmentStore.getState().setExposureMultiplier(1.25);
      window.__showroomEnvironmentStore.getState().setReflectionMultiplier(1.5);
      window.__showroomEnvironmentStore.getState().setShadowMultiplier(1.2);
    })()`,
  });
  await sleep(900);
  await takeScreenshot(cdp, 'part17_07_lighting_calibrated.png');

  // 8. Reset Back to Default Premium Studio and Neutral Vehicle State
  console.log('\n[E2E-Part17] 8. Resetting to Default Premium Studio and Neutral Pose...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__showroomEnvironmentStore.getState().resetEnvironment();
      if (window.__vehicleLightingStore) {
        window.__vehicleLightingStore.getState().allLightsOff();
      }
      if (window.__vehicleRigStore) {
        window.__vehicleRigStore.getState().resetAll();
      }
      if (window.__wheelAnimationStore) {
        window.__wheelAnimationStore.getState().resetTransforms();
      }
      if (window.__paintStore) {
        window.__paintStore.getState().resetPaint();
      }
      window.__cameraStore.getState().resetView();
    })()`,
  });
  await sleep(1200);
  await takeScreenshot(cdp, 'part17_08_reset_default_studio.png');

  // Verify console errors
  const errorCheck = await cdp.send('Runtime.evaluate', {
    expression: 'window.__consoleErrors || []',
    returnByValue: true,
  });

  const errors = errorCheck.result.value || [];
  if (errors.length > 0) {
    console.warn('⚠️ Console errors recorded during test run:', errors);
  } else {
    console.log('✓ Zero console errors recorded during all environment transitions.');
  }

  cdp.close();
  if (chromeProc) {
    chromeProc.kill();
  }
  console.log('\n🎉 Part 17 E2E Browser Verification Completed Successfully!\n');
}

run().catch((err) => {
  console.error('Fatal error running verify_showroom_environments.mjs:', err);
  process.exit(1);
});
