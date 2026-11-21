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
  console.log('[E2E-Part12] Connecting to headless Chrome via CDP...');
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

  console.log('[E2E-Part12] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3500);

  // 1. Initial DOM and Camera Toolbar verification
  const domCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas[data-engine*="three.js"]');
      const bodyText = document.body.innerText;
      const hasTurntableBtn = bodyText.includes('Turntable') || bodyText.includes('Rotating');
      return {
        hasCanvas: Boolean(canvas),
        hasTurntableBtn,
        activePart: bodyText.includes('PART 12') ? 12 : 11,
      };
    })()`,
    returnByValue: true,
  });

  console.log('Initial DOM check:', domCheck.result.value);
  if (!domCheck.result.value.hasCanvas) {
    throw new Error('Canvas missing in DOM');
  }

  // Helper to capture and write screenshot
  async function captureShot(filepath, description) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(shot.data, 'base64'));
    console.log(`✓ [Screenshot] ${description} -> ${path.relative(ROOT, filepath)}`);
  }

  // Helper to set preset via Zustand store in page context
  async function triggerPreset(presetId) {
    await cdp.send('Runtime.evaluate', {
      expression: `window.__cameraStore?.getState?.()?.setPreset?.('${presetId}')`,
      returnByValue: true,
    });
  }

  // 2. Front Three-Quarter (Default Hero Showcase)
  console.log('[E2E-Part12] Viewpoint: Front-Left Three-Quarter...');
  await triggerPreset('front-left');
  await sleep(1400);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part12_front_three_quarter.png'),
    'Front Three-Quarter Showcase (Hero Perspective)'
  );

  // 3. Rear Three-Quarter
  console.log('[E2E-Part12] Viewpoint: Rear-Left Three-Quarter...');
  await triggerPreset('rear-left');
  await sleep(1400);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part12_rear_three_quarter.png'),
    'Rear Three-Quarter Showcase'
  );

  // 4. Side Profile (Left Profile)
  console.log('[E2E-Part12] Viewpoint: Left Side Profile...');
  await triggerPreset('left');
  await sleep(1400);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part12_side_profile.png'),
    'Left Side Profile View'
  );

  // 5. Top-Down Plan View
  console.log('[E2E-Part12] Viewpoint: Top-Down Plan View...');
  await triggerPreset('top');
  await sleep(1400);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part12_top_down.png'),
    'Top-Down Plan Inspection'
  );

  // 6. Wheel Detail Close-Up
  console.log('[E2E-Part12] Viewpoint: Wheel Detail Framing...');
  await triggerPreset('wheel-detail');
  await sleep(1400);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part12_wheel_detail.png'),
    'Wheel Close-Up (Front-Left Rim & Caliper Framing)'
  );

  // 7. Cinematic Showcase Position (Elevated Front)
  console.log('[E2E-Part12] Viewpoint: Elevated Front Showcase...');
  await triggerPreset('elevated-front');
  await sleep(1400);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part12_cinematic_elevated.png'),
    'Cinematic Showcase (Elevated Front Perspective)'
  );

  // 8. Orthographic Inspection View via UI Button
  console.log('[E2E-Part12] Clicking Orthographic toggle button...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const orthoBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Orthographic'));
      if (orthoBtn) orthoBtn.click();
      else window.__cameraStore?.getState?.()?.setProjectionMode?.('orthographic');
    })()`,
    returnByValue: true,
  });
  await triggerPreset('front');
  await sleep(1400);
  await captureShot(
    path.resolve(REPORTS_DIR, 'part12_orthographic_inspection.png'),
    'Orthographic Technical Inspection (Front View)'
  );

  // Restore Perspective via UI Button
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const perspBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Perspective'));
      if (perspBtn) perspBtn.click();
      else window.__cameraStore?.getState?.()?.setProjectionMode?.('perspective');
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  // 9. Automatic Turntable Presentation via UI Button
  console.log('[E2E-Part12] Activating Showroom Turntable via UI Button...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const turnBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('turntable'));
      if (turnBtn) turnBtn.click();
      else window.__cameraStore?.getState?.()?.toggleTurntable?.(true);
    })()`,
    returnByValue: true,
  });
  await sleep(1800); // let it rotate in active presentation
  await captureShot(
    path.resolve(REPORTS_DIR, 'part12_turntable_rotation.png'),
    'Automatic Turntable Presentation in Motion'
  );

  // Stop turntable and reset view via Reset button
  console.log('[E2E-Part12] Stopping turntable and resetting camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const turnBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('turntable'));
      if (turnBtn && (turnBtn.innerText.includes('Rotating') || turnBtn.innerText.includes('Turntable'))) {
        window.__cameraStore?.getState?.()?.stopTurntable?.();
      }
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Reset camera'));
      if (resetBtn) resetBtn.click();
      else window.__cameraStore?.getState?.()?.resetView?.();
    })()`,
    returnByValue: true,
  });
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
  console.log('✅ Part 12 E2E Camera & Cinematic System PASSED!');
  console.log('======================================================\n');

  cdp.close();
}

run().catch((err) => {
  console.error('❌ E2E Verification FAILED:', err);
  process.exit(1);
});
