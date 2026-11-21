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
  console.log('[E2E-Part10] Connecting to headless Chrome via CDP...');
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

  console.log('[E2E-Part10] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3500);

  // 1. Verify Canvas, Paint Toolbar, and Secondary Toolbar in DOM
  const domCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas[data-engine*="three.js"]');
      const bodyText = document.body.innerText;
      const hasSecondaryToolbar = Boolean(document.querySelector('[data-testid="secondary-material-toolbar"]'));
      const hasPaintToolbar = bodyText.includes('AUTOMOTIVE PAINT');
      return {
        hasCanvas: Boolean(canvas),
        hasSecondaryToolbar,
        hasPaintToolbar,
        activePart: bodyText.includes('PART 10') ? 10 : 9,
      };
    })()`,
    returnByValue: true,
  });

  console.log('Initial DOM check:', domCheck.result.value);
  if (!domCheck.result.value.hasCanvas) {
    throw new Error('Canvas missing in DOM');
  }
  if (!domCheck.result.value.hasSecondaryToolbar) {
    throw new Error('SecondaryMaterialToolbar missing in DOM');
  }

  // Helper to capture and write screenshot
  async function captureShot(filepath, description) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(shot.data, 'base64'));
    console.log(`✓ [Screenshot] ${description} -> ${path.relative(ROOT, filepath)}`);
  }

  // Click button helper
  async function clickButtonWithText(text) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
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

  // 2. Capture Factory Defaults
  await captureShot(
    path.resolve(REPORTS_DIR, 'part10_factory_secondary.png'),
    'Factory Secondary Materials (OEM default)'
  );

  // 3. Test Glass Profile: Dark Tint
  console.log('[E2E-Part10] Selecting Glass: Dark Tint...');
  const darkGlassClicked = await clickButtonWithText('Dark Tint');
  if (!darkGlassClicked) throw new Error('Could not find Dark Tint button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part10_glass_dark_tint.png'),
    'Glass Profile: Privacy Dark Tint'
  );

  // Restore factory glass
  await clickButtonWithText('Factory');
  await sleep(500);

  // 4. Test Chrome / Metal Profile: Brushed Aluminium
  console.log('[E2E-Part10] Selecting Chrome: Brushed...');
  const brushedClicked = await clickButtonWithText('Brushed');
  if (!brushedClicked) throw new Error('Could not find Brushed button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part10_chrome_brushed.png'),
    'Chrome Profile: Brushed Aluminium'
  );

  // 5. Test Emissive Headlights ON
  console.log('[E2E-Part10] Toggling Headlights ON...');
  const headClicked = await clickButtonWithText('Head');
  if (!headClicked) throw new Error('Could not find Head toggle button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part10_headlights_on.png'),
    'Lighting: Headlights ON (Blue-White LED)'
  );

  // 6. Test Emissive Taillights ON
  console.log('[E2E-Part10] Toggling Taillights ON...');
  const tailClicked = await clickButtonWithText('Tail');
  if (!tailClicked) throw new Error('Could not find Tail toggle button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part10_taillights_on.png'),
    'Lighting: Taillights ON (Red Glow)'
  );

  // 7. Test Brake Lights ON
  console.log('[E2E-Part10] Toggling Brake Lights ON...');
  const brakeClicked = await clickButtonWithText('Brake');
  if (!brakeClicked) throw new Error('Could not find Brake toggle button');
  await sleep(1000);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part10_brakelights_on.png'),
    'Lighting: Brake Lights ON (High-Intensity Red)'
  );

  // 8. Test Part 9 Paint & Part 10 Secondary Co-existence
  console.log('[E2E-Part10] Applying Metallic Deep Blue paint alongside secondary materials...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const trigger = document.querySelector('button[title*="Paint Color"]');
      if (trigger) trigger.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  const paintClicked = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(o => o.innerText.includes('Deep Blue'));
      if (opt) {
        opt.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true,
  });

  if (!paintClicked.result.value) throw new Error('Could not find Deep Blue paint option in dropdown');
  await sleep(1200);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part10_paint_and_secondary.png'),
    'Combined State: Metallic Deep Blue Paint + Active Secondary & Lights'
  );

  // 9. Reset Secondary Materials to Factory
  console.log('[E2E-Part10] Resetting secondary materials to factory...');
  const resetClicked = await clickButtonWithText('Reset Secondary');
  if (!resetClicked) throw new Error('Could not find Reset Secondary button');
  await sleep(800);

  // 10. Check runtime errors
  const errCheck = await cdp.send('Runtime.evaluate', {
    expression: `({ hadError: window.__hadError, errors: window.__consoleErrors })`,
    returnByValue: true,
  });
  console.log('Error check:', errCheck.result.value);
  if (errCheck.result.value.hadError && errCheck.result.value.errors.length > 0) {
    throw new Error(`Browser encountered errors: ${JSON.stringify(errCheck.result.value.errors)}`);
  }

  console.log('\n======================================================');
  console.log('✅ Part 10 E2E Secondary Material Verification PASSED!');
  console.log('======================================================\n');

  cdp.close();
}

run().catch((err) => {
  console.error('❌ E2E Verification FAILED:', err);
  process.exit(1);
});
