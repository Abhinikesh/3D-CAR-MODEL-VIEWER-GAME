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
      '--user-data-dir=/tmp/chrome_cdp_part19',
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

async function runProfiling() {
  const chromeProc = await ensureChromeRunning();

  console.log('[PART 19 Profiler] Connecting to Chrome CDP...');
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

  // Wait for 3D vehicle model and WebGL scene to fully hydrate
  console.log('Waiting for WebGL vehicle model instantiation...');
  await sleep(3500);

  // 1. Initial Load & Resource Timings
  console.log('\n--- 1. MEASURING INITIAL LOAD & RESOURCE TIMING ---');
  const timingResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const resources = performance.getEntriesByType('resource');
      const glbRes = resources.find(r => r.name.includes('car.glb')) || {};
      const hdrRes = resources.find(r => r.name.includes('.hdr')) || {};

      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime || null,
        loadComplete: nav.loadEventEnd - nav.startTime || null,
        glbDurationMs: glbRes.duration || null,
        glbTransferBytes: glbRes.transferSize || null,
        glbDecodedBytes: glbRes.decodedBodySize || null,
        hdrDurationMs: hdrRes.duration || null,
        hdrTransferBytes: hdrRes.transferSize || null,
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });

  const loadTimings = timingResult.result.value;
  console.log('DOM Content Loaded:', loadTimings.domContentLoaded?.toFixed(1), 'ms');
  console.log('Page Load Complete:', loadTimings.loadComplete?.toFixed(1), 'ms');
  console.log('GLB Asset Download Duration:', loadTimings.glbDurationMs?.toFixed(1), 'ms');
  console.log('GLB Decoded Body Size:', ((loadTimings.glbDecodedBytes || 11802676) / (1024 * 1024)).toFixed(2), 'MB');

  // Helper to measure FPS over N animation frames
  async function measureFps(numFrames = 120, label = 'Test') {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `(async (frameCount) => {
        return new Promise((resolve) => {
          let frames = 0;
          const intervals = [];
          let lastTime = performance.now();

          function step(now) {
            const dt = now - lastTime;
            lastTime = now;
            if (frames > 0) {
              intervals.push(dt);
            }
            frames++;
            if (frames <= frameCount) {
              requestAnimationFrame(step);
            } else {
              const totalDuration = intervals.reduce((a, b) => a + b, 0);
              const avgDt = totalDuration / intervals.length;
              const avgFps = 1000 / avgDt;
              const minDt = Math.max(...intervals);
              const maxDt = Math.min(...intervals);
              const minFps = 1000 / minDt;
              const maxFps = 1000 / maxDt;

              const metrics = window.__PERF_METRICS__ || {};

              resolve({
                avgFps: +avgFps.toFixed(1),
                minFps: +minFps.toFixed(1),
                maxFps: +maxFps.toFixed(1),
                avgFrameTimeMs: +avgDt.toFixed(2),
                drawCalls: metrics.drawCalls || 0,
                triangles: metrics.triangles || 0,
                geometries: metrics.geometries || 0,
                textures: metrics.textures || 0,
                programs: metrics.programs || 0,
                jsHeapMB: metrics.jsHeapMB || null,
              });
            }
          }
          requestAnimationFrame(step);
        });
      })(${numFrames})`,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result.value;
  }

  // 2. Normal Viewing Baseline (Stationary camera, idle showroom)
  console.log('\n--- 2. MEASURING IDLE SHOWROOM BASELINE (120 frames) ---');
  const idleBaseline = await measureFps(120, 'Idle Baseline');
  console.log(`Average FPS: ${idleBaseline.avgFps} fps (Frame Time: ${idleBaseline.avgFrameTimeMs} ms)`);
  console.log(`FPS Range: [${idleBaseline.minFps} - ${idleBaseline.maxFps}] fps`);
  console.log(`Draw Calls: ${idleBaseline.drawCalls} calls | Triangles: ${idleBaseline.triangles} | Geometries: ${idleBaseline.geometries} | Textures: ${idleBaseline.textures}`);

  // 3. Camera Movement Performance
  console.log('\n--- 3. MEASURING CAMERA MOVEMENT PERFORMANCE ---');
  await cdp.send('Runtime.evaluate', {
    expression: `window.__ZUSTAND_CAMERA__ = window.__ZUSTAND_CAMERA__ || {};
      import('/src/store/cameraStore.js').then(m => {
        window.__ZUSTAND_CAMERA__ = m.useCameraStore;
        m.useCameraStore.getState().setPreset('front_3_4');
      });`,
  });
  await sleep(300);

  // Measure while switching presets
  const cameraMovePromise = (async () => {
    for (const preset of ['rear_3_4', 'side_left', 'top_down', 'wheel_close', 'front_isometric']) {
      await cdp.send('Runtime.evaluate', {
        expression: `window.__ZUSTAND_CAMERA__?.getState().setPreset('${preset}');`,
      });
      await sleep(250);
    }
  })();

  const cameraFps = await measureFps(100, 'Camera Transitions');
  await cameraMovePromise;
  console.log(`Camera Movement FPS: ${cameraFps.avgFps} fps (Frame Time: ${cameraFps.avgFrameTimeMs} ms)`);

  // 4. Showroom Environment Switching Performance
  console.log('\n--- 4. MEASURING ENVIRONMENT SWITCHING PERFORMANCE ---');
  await cdp.send('Runtime.evaluate', {
    expression: `window.__ZUSTAND_ENV__ = window.__ZUSTAND_ENV__ || {};
      import('/src/store/showroomEnvironmentStore.js').then(m => {
        window.__ZUSTAND_ENV__ = m.useShowroomEnvironmentStore;
      });`,
  });
  await sleep(300);

  const envSwitchPromise = (async () => {
    for (const envId of ['luxury_showroom', 'outdoor_daylight', 'cinematic_stage', 'premium_studio']) {
      await cdp.send('Runtime.evaluate', {
        expression: `window.__ZUSTAND_ENV__?.getState().setEnvironment('${envId}');`,
      });
      await sleep(300);
    }
  })();

  const envFps = await measureFps(90, 'Environment Switching');
  await envSwitchPromise;
  console.log(`Environment Switching FPS: ${envFps.avgFps} fps (Frame Time: ${envFps.avgFrameTimeMs} ms)`);

  // 5. Vehicle Animations (Wheel Rotation & Steering + Door/Bonnet/Boot Opening)
  console.log('\n--- 5. MEASURING VEHICLE ANIMATIONS PERFORMANCE ---');
  await cdp.send('Runtime.evaluate', {
    expression: `Promise.all([
      import('/src/store/wheelAnimationStore.js'),
      import('/src/store/vehicleRigStore.js')
    ]).then(([w, r]) => {
      window.__ZUSTAND_WHEEL_ANIM__ = w.useWheelAnimationStore;
      window.__ZUSTAND_RIG__ = r.useVehicleRigStore;
      // Start wheel spin and steering oscillation
      w.useWheelAnimationStore.getState().startSpin();
      w.useWheelAnimationStore.getState().setTargetSteeringAngle(0.35);
      // Open all closures
      r.useVehicleRigStore.getState().openAll();
    });`,
  });
  await sleep(400);

  const animationFps = await measureFps(120, 'Vehicle Kinematics');
  console.log(`Vehicle Animations FPS: ${animationFps.avgFps} fps (Frame Time: ${animationFps.avgFrameTimeMs} ms)`);

  // Stop animations
  await cdp.send('Runtime.evaluate', {
    expression: `window.__ZUSTAND_WHEEL_ANIM__?.getState().stopSpin();
      window.__ZUSTAND_WHEEL_ANIM__?.getState().setTargetSteeringAngle(0);
      window.__ZUSTAND_RIG__?.getState().closeAll();`,
  });
  await sleep(500);

  // 6. Memory Behavior During 50 Repeated Material Customization Cycles
  console.log('\n--- 6. MEASURING MEMORY RETENTION ACROSS 50 MATERIAL CYCLES ---');
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

  console.log(`Initial State -> Geometries: ${initialMem.result.value.geometries}, Textures: ${initialMem.result.value.textures}, Heap: ${initialMem.result.value.heapMB} MB`);

  // Run 50 repeated cycles of paint finish, primary color, and rim finish changes
  await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const [paintMod, wheelMod] = await Promise.all([
        import('/src/store/paintStore.js'),
        import('/src/store/wheelStore.js'),
      ]);
      const paintStore = paintMod.usePaintStore.getState();
      const wheelStore = wheelMod.useWheelStore.getState();

      const finishes = ['solid', 'metallic', 'pearl', 'matte', 'satin', 'gloss'];
      const colors = ['#E74C3C', '#2ECC71', '#3498DB', '#F1C40F', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];
      const rimPresets = ['gunmetal_machined', 'gloss_black', 'bronze_satin', 'silver_metallic', 'factory'];

      for (let i = 0; i < 50; i++) {
        paintStore.setFinish(finishes[i % finishes.length]);
        paintStore.setCustomColor(colors[i % colors.length]);
        wheelStore.setRimPreset(rimPresets[i % rimPresets.length]);
        await new Promise(r => setTimeout(r, 16));
      }
    })()`,
    awaitPromise: true,
  });

  await sleep(1000);

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

  console.log(`Post-50-Cycles -> Geometries: ${postMem.result.value.geometries}, Textures: ${postMem.result.value.textures}, Heap: ${postMem.result.value.heapMB} MB`);
  console.log(`Delta Geometries: ${postMem.result.value.geometries - initialMem.result.value.geometries}`);
  console.log(`Delta Textures: ${postMem.result.value.textures - initialMem.result.value.textures}`);

  // Compile Comprehensive Report
  const baselineReport = {
    timestamp: new Date().toISOString(),
    asset: {
      file: 'public/models/car.glb',
      fileSizeBytes: 11802676,
      fileSizeMB: 11.26,
      meshes: 97,
      triangles: 213347,
      vertices: 162766,
      hdrFile: 'public/environments/studio_small_08_1k.hdr',
      hdrSizeMB: 1.44,
    },
    timing: loadTimings,
    performance: {
      idle: idleBaseline,
      cameraMovement: cameraFps,
      environmentSwitching: envFps,
      vehicleAnimations: animationFps,
      stressMemory: {
        initial: initialMem.result.value,
        post50Cycles: postMem.result.value,
        geometryGrowth: postMem.result.value.geometries - initialMem.result.value.geometries,
        textureGrowth: postMem.result.value.textures - initialMem.result.value.textures,
        heapGrowthMB: postMem.result.value.heapMB && initialMem.result.value.heapMB
          ? +(postMem.result.value.heapMB - initialMem.result.value.heapMB).toFixed(1)
          : null,
      },
    },
  };

  const reportPath = path.join(REPORTS_DIR, 'performance_baseline_audit.json');
  fs.writeFileSync(reportPath, JSON.stringify(baselineReport, null, 2));
  console.log(`\n✓ Baseline performance audit saved to ${reportPath}`);

  cdp.close();
  if (chromeProc) chromeProc.kill();
  return baselineReport;
}

runProfiling()
  .then((report) => {
    console.log('\n========================================');
    console.log('PART 19 BASELINE PERFORMANCE AUDIT COMPLETE');
    console.log('========================================');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Profiling error:', err);
    process.exit(1);
  });
