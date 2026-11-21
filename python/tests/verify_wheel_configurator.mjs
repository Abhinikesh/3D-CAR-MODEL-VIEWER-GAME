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

async function run() {
  console.log('[E2E-Part11] Connecting to headless Chrome via CDP...');
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

  console.log('[E2E-Part11] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3500);

  // 1. Verify Canvas, Paint Toolbar, Secondary Toolbar, and Wheel Toolbar in DOM
  const domCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas[data-engine*="three.js"]');
      const bodyText = document.body.innerText;
      const hasWheelToolbar = Boolean(document.querySelector('[data-testid="wheel-customization-toolbar"]'));
      const hasPaintToolbar = bodyText.includes('AUTOMOTIVE PAINT');
      const hasSecondaryToolbar = Boolean(document.querySelector('[data-testid="secondary-material-toolbar"]'));
      return {
        hasCanvas: Boolean(canvas),
        hasWheelToolbar,
        hasPaintToolbar,
        hasSecondaryToolbar,
        activePart: bodyText.includes('PART 11') ? 11 : 10,
      };
    })()`,
    returnByValue: true,
  });

  console.log('Initial DOM check:', domCheck.result.value);
  if (!domCheck.result.value.hasCanvas) {
    throw new Error('Canvas missing in DOM');
  }
  if (!domCheck.result.value.hasWheelToolbar) {
    throw new Error('WheelToolbar missing in DOM');
  }

  // Helper to capture and write screenshot
  async function captureShot(filepath, description) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(shot.data, 'base64'));
    console.log(`✓ [Screenshot] ${description} -> ${path.relative(ROOT, filepath)}`);
  }

  // Helper to click button inside Wheel Toolbar
  async function clickWheelButton(text) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const toolbar = document.querySelector('[data-testid="wheel-customization-toolbar"]');
        if (!toolbar) return false;
        const buttons = Array.from(toolbar.querySelectorAll('button'));
        const btn = buttons.find(b => b.innerText.trim().includes(${JSON.stringify(text)}));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()`,
      returnByValue: true,
    });
    return res.result.value;
  }

  // 2. Capture Factory OEM Wheels
  await captureShot(
    path.resolve(REPORTS_DIR, 'part11_factory_wheels.png'),
    'Factory OEM Wheels (Stock Two-Tone Rims & Red Calipers)'
  );

  // 3. Test Gloss Black Rims (All 4 wheels)
  console.log('[E2E-Part11] Selecting Rim Finish: Gloss Black...');
  const blackClicked = await clickWheelButton('Gloss Black');
  if (!blackClicked) throw new Error('Could not find Gloss Black button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part11_rims_gloss_black.png'),
    'Rim Finish: Gloss Black'
  );

  // 4. Test Silver Metallic Rims
  console.log('[E2E-Part11] Selecting Rim Finish: Silver Metallic...');
  const silverClicked = await clickWheelButton('Silver Metallic');
  if (!silverClicked) throw new Error('Could not find Silver Metallic button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part11_rims_silver_metallic.png'),
    'Rim Finish: Silver Metallic'
  );

  // 5. Test Satin Bronze Rims
  console.log('[E2E-Part11] Selecting Rim Finish: Satin Bronze...');
  const bronzeClicked = await clickWheelButton('Satin Bronze');
  if (!bronzeClicked) throw new Error('Could not find Satin Bronze button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part11_rims_bronze.png'),
    'Rim Finish: Satin Bronze'
  );

  // 6. Test Front / Rear Split (Staggered Finish)
  console.log('[E2E-Part11] Setting Front / Rear Target Mode...');
  await clickWheelButton('Front / Rear');
  await sleep(300);

  // Select Front axle -> Gold
  await clickWheelButton('Front Axle');
  await sleep(300);
  await clickWheelButton('Race Gold');
  await sleep(600);

  // Select Rear axle -> Gunmetal
  await clickWheelButton('Rear Axle');
  await sleep(300);
  await clickWheelButton('Gunmetal');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part11_rims_front_rear_split.png'),
    'Staggered Axle Customization: Gold (Front) & Gunmetal (Rear)'
  );

  // 7. Test Brake Caliper: Speed Yellow
  console.log('[E2E-Part11] Selecting Caliper Finish: Speed Yellow...');
  const yellowClicked = await clickWheelButton('Speed');
  if (!yellowClicked) throw new Error('Could not find Speed Yellow caliper button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part11_calipers_performance_yellow.png'),
    'Brake Calipers: Speed Yellow'
  );

  // 8. Test Custom Rim Color (via Store dispatch)
  console.log('[E2E-Part11] Setting Custom Rim Color (#FF4422)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // Return to All 4 wheels
      const toolbar = document.querySelector('[data-testid="wheel-customization-toolbar"]');
      const allBtn = Array.from(toolbar.querySelectorAll('button')).find(b => b.innerText.includes('All 4'));
      if (allBtn) allBtn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(300);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('input[type="color"]');
      if (input) {
        input.value = '#FF4422';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`,
    returnByValue: true,
  });
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part11_rims_custom_color.png'),
    'Rim Finish: Custom Color (#FF4422 High-Saturation Orange)'
  );

  // 9. Combine with Part 9 Paint & Part 10 Lights
  console.log('[E2E-Part11] Testing combination with Paint & Secondary systems...');
  // Open Paint dropdown & pick British Racing Green
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const trigger = document.querySelector('button[title*="Paint Color"]');
      if (trigger) trigger.click();
    })()`,
    returnByValue: true,
  });
  await sleep(300);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(o => o.innerText.includes('British Racing Green'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  await captureShot(
    path.resolve(REPORTS_DIR, 'part11_wheels_and_paint.png'),
    'Complete Vehicle: Custom Wheels + Racing Green Paint + Viewport HDR'
  );

  // 10. Reset wheels to factory
  console.log('[E2E-Part11] Resetting wheels to factory...');
  await clickWheelButton('Reset');
  await sleep(800);

  // 11. Check runtime errors
  const errCheck = await cdp.send('Runtime.evaluate', {
    expression: `({ hadError: window.__hadError, errors: window.__consoleErrors })`,
    returnByValue: true,
  });
  console.log('Error check:', errCheck.result.value);
  if (errCheck.result.value.hadError && errCheck.result.value.errors.length > 0) {
    throw new Error(`Browser encountered errors: ${JSON.stringify(errCheck.result.value.errors)}`);
  }

  console.log('\n======================================================');
  console.log('✅ Part 11 E2E Wheel & Rim Configurator PASSED!');
  console.log('======================================================\n');

  cdp.close();
}

run().catch((err) => {
  console.error('❌ E2E Verification FAILED:', err);
  process.exit(1);
});
