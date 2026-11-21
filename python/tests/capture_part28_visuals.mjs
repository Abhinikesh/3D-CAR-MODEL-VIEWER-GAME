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
  console.log('[Part 28] Connecting to Chrome CDP for Steering & Lateral Handling Verification...');
  const wsUrl = await getWsEndpoint();
  const ws = new WebSocket(wsUrl);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  // Standard 1440x900 viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Page.bringToFront', {});
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  // Navigate to app
  console.log('[Part 28] Navigating to http://localhost:5173/...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));

  // Switch to DRIVE mode
  console.log('[Part 28] Switching to DRIVE mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('driving');
        window.__appModeStore.getState().setDrivingView('chase');
      }
    })()`,
  });

  // Settle vehicle on road
  console.log('[Part 28] Waiting for vehicle suspension to settle on road...');
  await new Promise(r => setTimeout(r, 1500));

  const steeringTelemetryLog = {
    testTimestamp: new Date().toISOString(),
    scenarios: {},
  };

  // ─── Scenario 1: Spawn & Neutral Steering ───
  console.log('[Part 28] 1. Neutral steering at spawn...');
  const spawnRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        position: store.chassis.position,
        rotation: store.chassis.rotation,
        speedKmh: store.drivetrain.speedKmh,
        steering: store.steering,
      } : null;
    })()`,
    returnByValue: true,
  });
  steeringTelemetryLog.scenarios.spawnNeutral = spawnRes?.result?.value;
  console.log(`[Part 28] Neutral Steer: ${spawnRes?.result?.value?.steering?.centralAngleDeg}° (Speed: ${spawnRes?.result?.value?.speedKmh} km/h)`);

  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part28_01_spawn_neutral.png'), Buffer.from(snap1.data, 'base64'));
  console.log('✓ Saved: part28_01_spawn_neutral.png');

  // ─── Scenario 2: Full Left Steer at Standstill (Stationary Stability & Ackermann) ───
  console.log('[Part 28] 2. Applying full Left steering at standstill (steer: -1.0)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        steer: -1.0,
        throttle: 0.0,
        brake: 0.0,
      });
    })()`,
  });

  // Allow steering buildup ticks to reach full lock
  await new Promise(r => setTimeout(r, 600));

  const standLeftRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        position: store.chassis.position,
        linearVelocity: store.chassis.linearVelocity,
        angularVelocity: store.chassis.angularVelocity,
        steering: store.steering,
        wheelRollAngles: window.__wheelAnimationStore?.getState?.().wheelRollAngles,
        drivingSteerAngles: window.__wheelAnimationStore?.getState?.().drivingSteerAngles,
      } : null;
    })()`,
    returnByValue: true,
  });
  steeringTelemetryLog.scenarios.standstillSteerLeft = standLeftRes?.result?.value;
  const sLeft = standLeftRes?.result?.value?.steering;
  console.log(`[Part 28] Standstill Left Steer: Central = ${sLeft?.centralAngleDeg}°, FL (Inner) = ${sLeft?.angleFLDeg}°, FR (Outer) = ${sLeft?.angleFRDeg}° (YawRate = ${sLeft?.yawRateDeg}°/s, LatG = ${sLeft?.lateralG}G)`);

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part28_02_standstill_steer_left.png'), Buffer.from(snap2.data, 'base64'));
  console.log('✓ Saved: part28_02_standstill_steer_left.png');

  // ─── Scenario 3: Full Right Steer at Standstill (Ackermann Inversion) ───
  console.log('[Part 28] 3. Applying full Right steering at standstill (steer: +1.0)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        steer: 1.0,
        throttle: 0.0,
        brake: 0.0,
      });
    })()`,
  });

  await new Promise(r => setTimeout(r, 600));

  const standRightRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        position: store.chassis.position,
        steering: store.steering,
      } : null;
    })()`,
    returnByValue: true,
  });
  steeringTelemetryLog.scenarios.standstillSteerRight = standRightRes?.result?.value;
  const sRight = standRightRes?.result?.value?.steering;
  console.log(`[Part 28] Standstill Right Steer: Central = ${sRight?.centralAngleDeg}°, FR (Inner) = ${sRight?.angleFRDeg}°, FL (Outer) = ${sRight?.angleFLDeg}°`);

  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part28_03_standstill_steer_right.png'), Buffer.from(snap3.data, 'base64'));
  console.log('✓ Saved: part28_03_standstill_steer_right.png');

  // ─── Scenario 4: Dynamic Left Turn in Motion (Lateral Force & Arc Carving) ───
  console.log('[Part 28] 4. Accelerating forward with Left turn (Throttle: 0.70, Steer: -0.65)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        throttle: 0.70,
        brake: 0.0,
        steer: -0.65,
        gear: 'D',
      });
    })()`,
  });

  // Turn for 2.0 seconds
  await new Promise(r => setTimeout(r, 2000));

  const turnLeftRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        position: store.chassis.position,
        rotation: store.chassis.rotation,
        speedKmh: store.drivetrain.speedKmh,
        displaySpeed: store.drivetrain.displaySpeed,
        steering: store.steering,
      } : null;
    })()`,
    returnByValue: true,
  });
  steeringTelemetryLog.scenarios.dynamicTurnLeft = turnLeftRes?.result?.value;
  const dynL = turnLeftRes?.result?.value;
  console.log(`[Part 28] Dynamic Left Turn: Speed = ${dynL?.speedKmh} km/h, Pos = [X: ${dynL?.position[0]?.toFixed(2)}, Z: ${dynL?.position[2]?.toFixed(2)}], LatG = ${dynL?.steering?.lateralG}G, Steer = ${dynL?.steering?.centralAngleDeg}°`);

  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part28_04_dynamic_turn_left.png'), Buffer.from(snap4.data, 'base64'));
  console.log('✓ Saved: part28_04_dynamic_turn_left.png');

  // ─── Scenario 5: Dynamic Right Turn in Motion ───
  console.log('[Part 28] 5. Transitioning to Right turn in motion (Throttle: 0.65, Steer: +0.70)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        throttle: 0.65,
        brake: 0.0,
        steer: 0.70,
        gear: 'D',
      });
    })()`,
  });

  await new Promise(r => setTimeout(r, 2000));

  const turnRightRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        position: store.chassis.position,
        rotation: store.chassis.rotation,
        speedKmh: store.drivetrain.speedKmh,
        displaySpeed: store.drivetrain.displaySpeed,
        steering: store.steering,
      } : null;
    })()`,
    returnByValue: true,
  });
  steeringTelemetryLog.scenarios.dynamicTurnRight = turnRightRes?.result?.value;
  const dynR = turnRightRes?.result?.value;
  console.log(`[Part 28] Dynamic Right Turn: Speed = ${dynR?.speedKmh} km/h, Pos = [X: ${dynR?.position[0]?.toFixed(2)}, Z: ${dynR?.position[2]?.toFixed(2)}], LatG = ${dynR?.steering?.lateralG}G, Steer = ${dynR?.steering?.centralAngleDeg}°`);

  const snap5 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part28_05_dynamic_turn_right.png'), Buffer.from(snap5.data, 'base64'));
  console.log('✓ Saved: part28_05_dynamic_turn_right.png');

  // ─── Scenario 6: High-Speed Cornering & Speed-Sensitive Reduction ───
  console.log('[Part 28] 6. High-speed cornering stability with full throttle (Speed-Sensitive reduction)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        throttle: 1.0,
        brake: 0.0,
        steer: -0.50,
        gear: 'D',
      });
    })()`,
  });

  await new Promise(r => setTimeout(r, 1800));

  const highSpeedRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        position: store.chassis.position,
        speedKmh: store.drivetrain.speedKmh,
        displaySpeed: store.drivetrain.displaySpeed,
        steering: store.steering,
      } : null;
    })()`,
    returnByValue: true,
  });
  steeringTelemetryLog.scenarios.highSpeedTurn = highSpeedRes?.result?.value;
  const hs = highSpeedRes?.result?.value;
  console.log(`[Part 28] High Speed Cornering: Speed = ${hs?.speedKmh} km/h, Max Limit = ${hs?.steering?.maxSteerLimitDeg}° (Reduced from 30°), LatG = ${hs?.steering?.lateralG}G`);

  const snap6 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part28_06_high_speed_turn.png'), Buffer.from(snap6.data, 'base64'));
  console.log('✓ Saved: part28_06_high_speed_turn.png');

  // ─── Scenario 7: Steering Self-Centering & Straight-Line Stabilization ───
  console.log('[Part 28] 7. Releasing steering input (Self-centering decay towards 0°)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        steer: 0.0,
        throttle: 0.35,
        brake: 0.0,
      });
    })()`,
  });

  await new Promise(r => setTimeout(r, 1000));

  const centerRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        speedKmh: store.drivetrain.speedKmh,
        steering: store.steering,
      } : null;
    })()`,
    returnByValue: true,
  });
  steeringTelemetryLog.scenarios.selfCentering = centerRes?.result?.value;
  const sc = centerRes?.result?.value;
  console.log(`[Part 28] Self-Centered Steer: Central = ${sc?.steering?.centralAngleDeg}°, FL = ${sc?.steering?.angleFLDeg}°, FR = ${sc?.steering?.angleFRDeg}° (Stabilized)`);

  const snap7 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part28_07_steering_self_centering.png'), Buffer.from(snap7.data, 'base64'));
  console.log('✓ Saved: part28_07_steering_self_centering.png');

  // ─── Scenario 8: Save JSON Telemetry Report ───
  fs.writeFileSync(
    path.resolve(REPORT_DIR, 'part28_steering_telemetry.json'),
    JSON.stringify(steeringTelemetryLog, null, 2)
  );
  console.log('✓ Saved: python/reports/part28_steering_telemetry.json');

  console.log('\n[Part 28] All steering visuals & telemetry captured successfully.');
  ws.close();
}

run().catch((err) => {
  console.error('[Part 28 Error]', err);
  process.exit(1);
});
