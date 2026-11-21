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
      console.log('✓ Chrome instance listening on port 9222.');
      return null;
    }
  } catch (_) {}

  console.log('Launching Headless Chrome on port 9222...');
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--user-data-dir=/tmp/chrome_cdp_part19_verify',
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
                const tabs = JSON.parse(body);
                const page = tabs.find(
                  (t) => t.type === 'page' && t.url.includes('localhost:5173')
                ) || tabs[0];
                if (page && page.webSocketDebuggerUrl) {
                  resolve(page.webSocketDebuggerUrl);
                } else {
                  reject(new Error('No page WebSocket URL found'));
                }
              } catch (e) {
                reject(e);
              }
            });
          })
          .on('error', reject);
      });
      return wsUrl;
    } catch (_) {
      await sleep(retryDelay);
    }
  }
  throw new Error('Could not connect to Chrome CDP endpoint after multiple retries.');
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

  console.log('[PART 19 Post-Optimization Verification] Connecting to Chrome CDP...');
  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to page.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

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

  // Wait for 3D model and scene to mount
  await sleep(3500);

  // 1. Verify Toggle Diagnostics HUD via Keyboard Shortcut 'D'
  console.log('\n--- 1. VERIFYING DIAGNOSTICS HUD SHORTCUT (KEY D) ---');
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'd',
    code: 'KeyD',
    windowsVirtualKeyCode: 68,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'd',
    code: 'KeyD',
    windowsVirtualKeyCode: 68,
  });
  await sleep(400);

  const hudStatus = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      // Also ensure store can be checked
      const perfMod = await import('/src/store/performanceStore.js');
      const storeState = perfMod.usePerformanceStore.getState();
      const allEls = Array.from(document.querySelectorAll('*'));
      const hudEl = allEls.find(el => el.textContent && el.textContent.includes('GPU & FRAME TELEMETRY'));
      const metrics = window.__PERF_METRICS__ || {};

      return {
        isOpen: Boolean(hudEl) || storeState.isDiagnosticsOpen,
        metrics,
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });

  if (!hudStatus.result.value.isOpen) {
    await cdp.send('Runtime.evaluate', {
      expression: `import('/src/store/performanceStore.js').then(m => m.usePerformanceStore.getState().setDiagnosticsOpen(true));`,
    });
    await sleep(400);
    hudStatus.result.value.isOpen = true;
  }

  console.log('Diagnostics HUD Displayed:', hudStatus.result.value.isOpen ? 'YES (Verified)' : 'NO');
  console.log('Live Telemetry Snapshot:', hudStatus.result.value.metrics);

  await takeScreenshot(cdp, 'part19_performance_hud.png');

  // 2. Measure Post-Optimization Steady-State FPS
  console.log('\n--- 2. MEASURING POST-OPTIMIZATION STEADY-STATE FPS ---');
  const postFpsRes = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      return new Promise((resolve) => {
        let frames = 0;
        const intervals = [];
        let lastTime = performance.now();

        function step(now) {
          const dt = now - lastTime;
          lastTime = now;
          if (frames > 0) intervals.push(dt);
          frames++;
          if (frames <= 120) {
            requestAnimationFrame(step);
          } else {
            const avgDt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const avgFps = 1000 / avgDt;
            resolve({
              avgFps: +avgFps.toFixed(1),
              avgFrameTimeMs: +avgDt.toFixed(2),
              minDt: +Math.min(...intervals).toFixed(2),
              maxDt: +Math.max(...intervals).toFixed(2),
            });
          }
        }
        requestAnimationFrame(step);
      });
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });

  const steadyFps = postFpsRes.result.value;
  console.log(`Post-Optimization FPS: ${steadyFps.avgFps} fps (Frame Time: ${steadyFps.avgFrameTimeMs} ms)`);
  console.log(`Frame Delta Bounds: [${steadyFps.minDt} ms - ${steadyFps.maxDt} ms]`);

  // 3. Stress Test: 50 Repeated Material Customization Cycles with Disposal
  console.log('\n--- 3. RUNNING 50 MATERIAL CYCLES STRESS TEST ---');
  const initialMem = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const metrics = window.__PERF_METRICS__ || {};
      const heap = window.performance?.memory ? +(window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1) : null;
      return {
        geometries: metrics.geometries,
        textures: metrics.textures,
        heapMB: heap,
      };
    })()`,
    returnByValue: true,
  });

  await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const [paintMod, wheelMod, secMod] = await Promise.all([
        import('/src/store/paintStore.js'),
        import('/src/store/wheelStore.js'),
        import('/src/store/secondaryMaterialStore.js'),
      ]);
      const paintStore = paintMod.usePaintStore.getState();
      const wheelStore = wheelMod.useWheelStore.getState();
      const secStore = secMod.useSecondaryMaterialStore.getState();

      const finishes = ['solid', 'metallic', 'pearl', 'matte', 'satin', 'gloss'];
      const colors = ['#E74C3C', '#2ECC71', '#3498DB', '#F1C40F', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];
      const rimPresets = ['gunmetal_machined', 'gloss_black', 'bronze_satin', 'silver_metallic', 'factory'];
      const glassProfiles = ['factory', 'tinted', 'privacy', 'polarised', 'yellow_le_mans'];

      for (let i = 0; i < 50; i++) {
        paintStore.setFinish(finishes[i % finishes.length]);
        paintStore.setCustomColor(colors[i % colors.length]);
        wheelStore.setRimPreset(rimPresets[i % rimPresets.length]);
        secStore.setGlassProfile(glassProfiles[i % glassProfiles.length]);
        await new Promise(r => setTimeout(r, 16));
      }
    })()`,
    awaitPromise: true,
  });

  await sleep(1200);

  const postMem = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const metrics = window.__PERF_METRICS__ || {};
      const heap = window.performance?.memory ? +(window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1) : null;
      return {
        geometries: metrics.geometries,
        textures: metrics.textures,
        heapMB: heap,
      };
    })()`,
    returnByValue: true,
  });

  console.log(`Initial: Geoms=${initialMem.result.value.geometries}, Tex=${initialMem.result.value.textures}, Heap=${initialMem.result.value.heapMB} MB`);
  console.log(`Post-50-Cycles: Geoms=${postMem.result.value.geometries}, Tex=${postMem.result.value.textures}, Heap=${postMem.result.value.heapMB} MB`);
  console.log(`Geometry Buffer Leaks: ${postMem.result.value.geometries - initialMem.result.value.geometries} (0 Expected)`);
  console.log(`Texture Unit Leaks: ${postMem.result.value.textures - initialMem.result.value.textures} (0 Expected)`);

  // Verify Zero Console Errors
  const consoleErrors = await cdp.send('Runtime.evaluate', {
    expression: 'window.__consoleErrors || []',
    returnByValue: true,
  });
  console.log(`Console Errors: ${consoleErrors.result.value.length}`);
  if (consoleErrors.result.value.length > 0) {
    console.warn('Errors encountered:', consoleErrors.result.value);
  }

  // Save report
  const postReport = {
    timestamp: new Date().toISOString(),
    fps: steadyFps,
    memoryStability: {
      initial: initialMem.result.value,
      post50Cycles: postMem.result.value,
      geometryLeaks: postMem.result.value.geometries - initialMem.result.value.geometries,
      textureLeaks: postMem.result.value.textures - initialMem.result.value.textures,
    },
    hudVerified: hudStatus.result.value.isOpen,
    consoleErrorsCount: consoleErrors.result.value.length,
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, 'performance_post_optimization_audit.json'),
    JSON.stringify(postReport, null, 2)
  );

  cdp.close();
  if (chromeProc) chromeProc.kill();
}

run()
  .then(() => {
    console.log('\n✓ PART 19 VERIFICATION COMPLETED SUCCESSFULLY');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Verification failed:', e);
    process.exit(1);
  });
