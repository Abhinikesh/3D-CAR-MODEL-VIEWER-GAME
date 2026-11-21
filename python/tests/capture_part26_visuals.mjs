import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.resolve(ROOT, 'python/reports');

async function getWsEndpoint() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const list = JSON.parse(data);
        const target = list.find(t => t.type === 'page' && t.url.includes('5173')) || list[0];
        resolve(target.webSocketDebuggerUrl);
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('[Part 26] Connecting to Chrome CDP for Physics Verification...');
  const wsUrl = await getWsEndpoint();
  const ws = new WebSocket(wsUrl);

  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  // Set standard 1440x900 viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Ensure tab is treated as active and focused so requestAnimationFrame runs at full 60fps
  await send('Page.bringToFront', {});
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  // Navigate to application
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  console.log('[Part 26] Navigated to app. Waiting for initial load...');
  await new Promise(r => setTimeout(r, 2500));

  // Switch to DRIVE mode
  console.log('[Part 26] Switching to DRIVE mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('driving');
        window.__appModeStore.getState().setDrivingView('chase');
      }
    })()`,
  });

  // 1. Capture right after spawn (initial physics state)
  await new Promise(r => setTimeout(r, 500));
  console.log('[Part 26] Capturing 1: Vehicle right after physics spawn...');
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part26_01_physics_spawn_initial.png'), Buffer.from(snap1.data, 'base64'));
  console.log('✓ Saved: part26_01_physics_spawn_initial.png');

  // 2. Wait for suspension to settle under gravity
  console.log('[Part 26] Waiting for suspension to settle onto road surface under gravity...');
  let settleTelemetry = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 150));
    const evalRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const store = window.__vehiclePhysicsStore?.getState?.();
        return store ? {
          isSettled: store.isSettled,
          settleProgress: store.settleProgress,
          chassisY: store.chassis.position[1],
          linearVelY: store.chassis.linearVelocity[1],
          totalSteps: store.stats.totalPhysicsSteps,
          wheelFL_force: store.wheels.fl.suspensionForce,
          wheelFR_force: store.wheels.fr.suspensionForce,
          wheelRL_force: store.wheels.rl.suspensionForce,
          wheelRR_force: store.wheels.rr.suspensionForce,
        } : null;
      })()`,
      returnByValue: true
    });
    settleTelemetry = evalRes?.result?.value;
    if (settleTelemetry?.isSettled) {
      console.log(`[Part 26] Suspension settled at step ${settleTelemetry.totalSteps}! Chassis Y = ${settleTelemetry.chassisY.toFixed(4)}m`);
      break;
    }
  }

  // 2. Capture settled vehicle from CHASE view
  console.log('[Part 26] Capturing 2: Settled vehicle (CHASE view)...');
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part26_02_suspension_settled.png'), Buffer.from(snap2.data, 'base64'));
  console.log('✓ Saved: part26_02_suspension_settled.png');

  // 3. Capture settled vehicle from SIDE PROFILE view
  console.log('[Part 26] Capturing 3: Settled vehicle (SIDE profile)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.__THREE_SCENE__;
      scene?.traverse(o => {
        if (o.isCamera && o.position) {
          o.position.set(5.5, 0.95, 0.0);
          o.lookAt(0, 0.75, 0);
          o.updateProjectionMatrix();
        }
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 1000));
  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part26_03_side_profile_settled.png'), Buffer.from(snap3.data, 'base64'));
  console.log('✓ Saved: part26_03_side_profile_settled.png');

  // 4. Capture settled vehicle from FRONT THREE-QUARTER view
  console.log('[Part 26] Capturing 4: Settled vehicle (FRONT 3/4)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.__THREE_SCENE__;
      scene?.traverse(o => {
        if (o.isCamera && o.position) {
          o.position.set(3.6, 1.45, 4.2);
          o.lookAt(0, 0.75, 0);
          o.updateProjectionMatrix();
        }
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 1000));
  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part26_04_front_suspension_geometry.png'), Buffer.from(snap4.data, 'base64'));
  console.log('✓ Saved: part26_04_front_suspension_geometry.png');

  // 5. Capture settled vehicle from REAR THREE-QUARTER view
  console.log('[Part 26] Capturing 5: Settled vehicle (REAR 3/4)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.__THREE_SCENE__;
      scene?.traverse(o => {
        if (o.isCamera && o.position) {
          o.position.set(-3.6, 1.45, -4.2);
          o.lookAt(0, 0.75, 0);
          o.updateProjectionMatrix();
        }
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 1000));
  const snap5 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part26_05_rear_suspension_geometry.png'), Buffer.from(snap5.data, 'base64'));
  console.log('✓ Saved: part26_05_rear_suspension_geometry.png');

  // 6. Return to Showroom Mode and verify physics disposal
  console.log('[Part 26] Returning to Showroom Mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('showroom');
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 2000));

  const disposalCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return {
        isInitialized: store?.isInitialized,
        isSimulating: store?.isSimulating,
        appMode: window.__appModeStore?.getState?.().mode
      };
    })()`,
    returnByValue: true
  });
  console.log('[Part 26] Showroom Mode Disposed Physics Check:', disposalCheck?.result?.value);

  const snap6 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part26_06_showroom_isolation_check.png'), Buffer.from(snap6.data, 'base64'));
  console.log('✓ Saved: part26_06_showroom_isolation_check.png');

  // Record settling telemetry log
  fs.writeFileSync(
    path.resolve(REPORT_DIR, 'part26_settlement_telemetry.json'),
    JSON.stringify(settleTelemetry, null, 2)
  );
  console.log('✓ Saved: part26_settlement_telemetry.json');

  console.log('\n[Part 26] All visual verification screenshots captured successfully!');
  ws.close();
}

run().catch((err) => {
  console.error('[Part 26] Capture failed:', err);
  process.exit(1);
});
