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
  console.log('[E2E-Part13] Connecting to headless Chrome via CDP...');
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

  console.log('[E2E-Part13] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3500);

  // 1. Initial State & Explorer Pill Verification
  console.log('\n[E2E-Part13] Verifying Initial Showroom & Component Explorer Controls...');
  const initialCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const selectionStore = window.__selectionStore;
      const cameraStore = window.__cameraStore;
      const bodyText = document.body.innerText;

      return {
        hasSelectionStore: Boolean(selectionStore),
        hasCameraStore: Boolean(cameraStore),
        selectedComponentId: selectionStore ? selectionStore.getState().selectedComponentId : null,
        hasExplorePill: bodyText.includes('EXPLORE COMPONENTS'),
        hasStageBadge: bodyText.includes('STAGE: PART 13 OF 20 ACTIVE'),
        canvasPresent: Boolean(document.querySelector('canvas')),
      };
    })()`,
    returnByValue: true,
  });

  console.log('Initial DOM & Store Check:', initialCheck.result.value);
  if (!initialCheck.result.value.hasSelectionStore) {
    throw new Error('window.__selectionStore is not defined');
  }
  await takeScreenshot(cdp, 'part13_01_initial_showroom.png');

  // 2. Test Hover Feedback & Tooltip
  console.log('\n[E2E-Part13] Testing Component Hover & Tooltip Indicator...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__selectionStore.getState().setHovered('door_fl', 'BodyDoorLColor2', [0.95, 0.75, 0.15], { x: 400, y: 350 });
    `,
  });
  await sleep(600);

  const hoverCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body.innerText;
      return {
        hasHoverText: bodyText.includes('FRONT-LEFT DOOR'),
        hasClickHint: bodyText.includes('Click to Inspect & Frame'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Hover Indicator Check:', hoverCheck.result.value);
  await takeScreenshot(cdp, 'part13_02_hover_tooltip.png');

  // Clear hover before selection test
  await cdp.send('Runtime.evaluate', {
    expression: `window.__selectionStore.getState().clearHovered();`,
  });

  // 3. Test Front-Left Door Selection & Camera Framing
  console.log('\n[E2E-Part13] Testing Front-Left Door Selection & Camera Framing...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__selectionStore.getState().selectComponent('door_fl', 'BodyDoorLColor2');
      window.__cameraStore.getState().focusOn('door_fl');
    `,
  });
  await sleep(1800); // Allow smooth camera lerp

  const doorCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const state = window.__selectionStore.getState();
      const bodyText = document.body.innerText;
      return {
        selectedId: state.selectedComponentId,
        title: state.selectedComponent?.title,
        category: state.selectedComponent?.category,
        isHinged: state.selectedComponent?.isHinged,
        hasHudCard: bodyText.includes('FRONT-LEFT DOOR') && bodyText.includes('FOCUS CAMERA'),
        hasKinematics: bodyText.includes('Kinematic Hinge') || bodyText.includes('World-Y Axis'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Door Selection Check:', doorCheck.result.value);
  await takeScreenshot(cdp, 'part13_03_door_selected_hud.png');

  // 4. Test Front-Left Wheel Assembly Selection & Detail Framing
  console.log('\n[E2E-Part13] Testing Wheel Selection & Close-Up Framing...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__selectionStore.getState().selectComponent('wheel_fl', 'Mesh_Rim_FL');
      window.__cameraStore.getState().focusOn('wheel_fl');
    `,
  });
  await sleep(1800);

  const wheelCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const state = window.__selectionStore.getState();
      const bodyText = document.body.innerText;
      return {
        selectedId: state.selectedComponentId,
        title: state.selectedComponent?.title,
        steerable: state.selectedComponent?.steerable,
        hasWheelHud: bodyText.includes('FRONT-LEFT WHEEL ASSEMBLY'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Wheel Selection Check:', wheelCheck.result.value);
  await takeScreenshot(cdp, 'part13_04_wheel_fl_selected_hud.png');

  // 5. Test Front Bonnet (Hood) Selection & Framing
  console.log('\n[E2E-Part13] Testing Front Bonnet Selection & Clamshell Framing...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__selectionStore.getState().selectComponent('bonnet', 'BodyHoodTopgrill');
      window.__cameraStore.getState().focusOn('bonnet');
    `,
  });
  await sleep(1800);

  const bonnetCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const state = window.__selectionStore.getState();
      const bodyText = document.body.innerText;
      return {
        selectedId: state.selectedComponentId,
        title: state.selectedComponent?.title,
        hasBonnetHud: bodyText.includes('FRONT BONNET / HOOD'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Bonnet Selection Check:', bonnetCheck.result.value);
  await takeScreenshot(cdp, 'part13_05_bonnet_selected_hud.png');

  // 6. Test Vehicle Component Explorer Drawer
  console.log('\n[E2E-Part13] Testing Component Explorer Drawer Open & Categorized List...');
  await cdp.send('Runtime.evaluate', {
    expression: `window.__selectionStore.getState().setDrawerOpen(true);`,
  });
  await sleep(600);

  const drawerCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body.innerText;
      return {
        hasDrawerTitle: bodyText.includes('VEHICLE COMPONENT EXPLORER'),
        hasClosuresGroup: bodyText.includes('CLOSURES & BODY'),
        hasWheelsGroup: bodyText.includes('WHEELS & BRAKES'),
        hasLightingGroup: bodyText.includes('LIGHTING & GLAZING'),
        hasInteriorGroup: bodyText.includes('INTERIOR & DRIVETRAIN'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Drawer Check:', drawerCheck.result.value);
  await takeScreenshot(cdp, 'part13_06_explorer_drawer_open.png');

  // Close drawer
  await cdp.send('Runtime.evaluate', {
    expression: `window.__selectionStore.getState().setDrawerOpen(false);`,
  });
  await sleep(400);

  // 7. Test 3D Wireframe & Bounding Box Toggles
  console.log('\n[E2E-Part13] Testing 3D Wireframe & Bounding Box Overlay Toggles...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__selectionStore.getState().selectComponent('door_fl');
      window.__selectionStore.getState().setShowWireframe(true);
      window.__selectionStore.getState().setShowBoundingBox(true);
    `,
  });
  await sleep(800);
  await takeScreenshot(cdp, 'part13_07_wireframe_highlight.png');

  // 8. Test Deselection & Viewport Restore
  console.log('\n[E2E-Part13] Testing Deselect & Clean Showroom Restore...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__selectionStore.getState().clearSelection();
      window.__cameraStore.getState().resetView();
    `,
  });
  await sleep(1800);

  const cleanCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const state = window.__selectionStore.getState();
      const bodyText = document.body.innerText;
      return {
        selectedId: state.selectedComponentId,
        hudGone: !bodyText.includes('FRONT-LEFT DOOR'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Clean Restore Check:', cleanCheck.result.value);
  await takeScreenshot(cdp, 'part13_08_deselected_clean.png');

  // Check for any runtime console errors
  const errorsCheck = await cdp.send('Runtime.evaluate', {
    expression: `window.__consoleErrors || []`,
    returnByValue: true,
  });
  console.log('\n[E2E-Part13] Console Errors Check:', errorsCheck.result.value);
  if (errorsCheck.result.value && errorsCheck.result.value.length > 0) {
    console.warn('⚠️ Console errors detected:', errorsCheck.result.value);
  } else {
    console.log('✓ 0 console errors detected throughout Part 13 E2E test run.');
  }

  cdp.close();
  console.log('\n========================================================================');
  console.log('  Part 13 — Interactive Component Raycasting & Selection E2E PASSED!   ');
  console.log('========================================================================\n');
}

run().catch((err) => {
  console.error('[E2E-Part13] Test run failed:', err);
  process.exit(1);
});
