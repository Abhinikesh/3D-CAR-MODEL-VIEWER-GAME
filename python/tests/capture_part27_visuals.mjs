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
  console.log('[Part 27] Connecting to Chrome CDP for Longitudinal Drivetrain Verification...');
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

  // Ensure active animation pump
  await send('Page.bringToFront', {});
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  // Navigate to app
  console.log('[Part 27] Navigating to app...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));

  // Switch to DRIVE mode
  console.log('[Part 27] Switching to DRIVE mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('driving');
        window.__appModeStore.getState().setDrivingView('chase');
      }
    })()`,
  });

  // Settle vehicle on road
  console.log('[Part 27] Waiting for vehicle suspension to settle on road...');
  await new Promise(r => setTimeout(r, 1500));

  const drivingTelemetryLog = {
    testTimestamp: new Date().toISOString(),
    phases: {},
  };

  // ─── Scenario 1: Forward Acceleration ───
  console.log('[Part 27] 1. Accelerating forward (Throttle 100%)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        throttle: 1.0,
        brake: 0.0,
        gear: 'D'
      });
    })()`,
  });

  // Accelerate for 2.2 seconds down launch straight
  await new Promise(r => setTimeout(r, 2200));

  const accelRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        positionZ: store.chassis.position[2],
        speedKmh: store.drivetrain.speedKmh,
        displaySpeed: store.drivetrain.displaySpeed,
        driveForce: store.drivetrain.driveForce,
        dragForce: store.drivetrain.dragForce,
        pitchAngleDeg: +(store.chassis.rotation[0] * 180 / Math.PI).toFixed(2),
      } : null;
    })()`,
    returnByValue: true
  });
  drivingTelemetryLog.phases.acceleration = accelRes?.result?.value;
  console.log(`[Part 27] Accelerated to: ${accelRes?.result?.value?.speedKmh} km/h, Dist: ${accelRes?.result?.value?.positionZ?.toFixed(2)}m (Squat Pitch: ${accelRes?.result?.value?.pitchAngleDeg}°)`);

  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part27_01_forward_acceleration.png'), Buffer.from(snap1.data, 'base64'));
  console.log('✓ Saved: part27_01_forward_acceleration.png');

  // ─── Scenario 2: Coasting (Throttle Released) ───
  console.log('[Part 27] 2. Releasing throttle (Coasting under drag and rolling resistance)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        throttle: 0.0,
        brake: 0.0
      });
    })()`,
  });

  // Coast for 1.4 seconds
  await new Promise(r => setTimeout(r, 1400));

  const coastRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        positionZ: store.chassis.position[2],
        speedKmh: store.drivetrain.speedKmh,
        displaySpeed: store.drivetrain.displaySpeed,
        dragForce: store.drivetrain.dragForce,
        rollingResistanceForce: store.drivetrain.rollingResistanceForce,
      } : null;
    })()`,
    returnByValue: true
  });
  drivingTelemetryLog.phases.coasting = coastRes?.result?.value;
  console.log(`[Part 27] Coasting speed: ${coastRes?.result?.value?.speedKmh} km/h (Decelerating)`);

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part27_02_coasting_drag.png'), Buffer.from(snap2.data, 'base64'));
  console.log('✓ Saved: part27_02_coasting_drag.png');

  // ─── Scenario 3: Progressive Braking to Complete Standstill ───
  console.log('[Part 27] 3. Applying service brakes (Brake 100%)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        throttle: 0.0,
        brake: 1.0
      });
    })()`,
  });

  // Wait for vehicle to come to complete halt
  await new Promise(r => setTimeout(r, 1600));

  const brakeRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        positionZ: store.chassis.position[2],
        speedKmh: store.drivetrain.speedKmh,
        displaySpeed: store.drivetrain.displaySpeed,
        isBraking: store.drivetrain.isBraking,
        isSettled: store.isSettled,
      } : null;
    })()`,
    returnByValue: true
  });
  drivingTelemetryLog.phases.brakingToStop = brakeRes?.result?.value;
  console.log(`[Part 27] Full stop reached: Speed = ${brakeRes?.result?.value?.speedKmh} km/h (Display: ${brakeRes?.result?.value?.displaySpeed} KM/H)`);

  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part27_03_braking_to_stop.png'), Buffer.from(snap3.data, 'base64'));
  console.log('✓ Saved: part27_03_braking_to_stop.png');

  // ─── Scenario 4: Reverse Driving ───
  console.log('[Part 27] 4. Engaging Reverse and accelerating backward (Reverse Throttle 100%)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState?.().setInputs({
        throttle: 1.0,
        brake: 0.0,
        gear: 'R'
      });
    })()`,
  });

  // Reverse for 1.8 seconds
  await new Promise(r => setTimeout(r, 1800));

  const reverseRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        positionZ: store.chassis.position[2],
        speedKmh: store.drivetrain.speedKmh,
        displaySpeed: store.drivetrain.displaySpeed,
        gear: store.drivetrain.gear,
        driveForce: store.drivetrain.driveForce,
      } : null;
    })()`,
    returnByValue: true
  });
  drivingTelemetryLog.phases.reverse = reverseRes?.result?.value;
  console.log(`[Part 27] Reverse speed: ${reverseRes?.result?.value?.speedKmh} km/h (Gear: ${reverseRes?.result?.value?.gear})`);

  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part27_04_reverse_acceleration.png'), Buffer.from(snap4.data, 'base64'));
  console.log('✓ Saved: part27_04_reverse_acceleration.png');

  // ─── Scenario 5: Forward / Reverse Transition ───
  console.log('[Part 27] 5. Transitioning from Reverse to Forward Drive...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Step on forward throttle to brake out of reverse and transition to Drive
      window.__vehicleInputStore?.getState?.().setInputs({
        throttle: 1.0,
        brake: 0.0,
        gear: 'D'
      });
    })()`,
  });

  await new Promise(r => setTimeout(r, 2000));

  const transitionRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const store = window.__vehiclePhysicsStore?.getState?.();
      return store ? {
        positionZ: store.chassis.position[2],
        speedKmh: store.drivetrain.speedKmh,
        displaySpeed: store.drivetrain.displaySpeed,
        gear: store.drivetrain.gear,
      } : null;
    })()`,
    returnByValue: true
  });
  drivingTelemetryLog.phases.transition = transitionRes?.result?.value;
  console.log(`[Part 27] Transitioned to forward motion: Speed = ${transitionRes?.result?.value?.speedKmh} km/h (Gear: ${transitionRes?.result?.value?.gear})`);

  const snap5 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part27_05_forward_reverse_transition.png'), Buffer.from(snap5.data, 'base64'));
  console.log('✓ Saved: part27_05_forward_reverse_transition.png');

  // ─── Scenario 6: Driving HUD & Telemetry Presentation ───
  console.log('[Part 27] 6. Capturing Driving HUD and Instrument Cluster...');
  const snap6 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part27_06_driving_hud_telemetry.png'), Buffer.from(snap6.data, 'base64'));
  console.log('✓ Saved: part27_06_driving_hud_telemetry.png');

  // ─── Scenario 7: Showroom Mode Return & Isolation Check ───
  console.log('[Part 27] 7. Returning to Showroom Mode and verifying physics disposal...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__appModeStore?.getState?.().setMode('showroom');
    })()`,
  });
  await new Promise(r => setTimeout(r, 1500));

  const disposalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const phys = window.__vehiclePhysicsStore?.getState?.();
      const input = window.__vehicleInputStore?.getState?.();
      return {
        isInitialized: phys?.isInitialized,
        isSimulating: phys?.isSimulating,
        appMode: window.__appModeStore?.getState?.().mode,
        inputThrottle: input?.throttle,
        inputBrake: input?.brake,
      };
    })()`,
    returnByValue: true
  });
  drivingTelemetryLog.phases.disposalCheck = disposalRes?.result?.value;
  console.log('[Part 27] Showroom Mode Disposed Check:', disposalRes?.result?.value);

  const snap7 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(REPORT_DIR, 'part27_07_showroom_isolation_check.png'), Buffer.from(snap7.data, 'base64'));
  console.log('✓ Saved: part27_07_showroom_isolation_check.png');

  // Save telemetry log
  fs.writeFileSync(
    path.resolve(REPORT_DIR, 'part27_driving_telemetry.json'),
    JSON.stringify(drivingTelemetryLog, null, 2)
  );
  console.log('✓ Saved: part27_driving_telemetry.json');

  console.log('\n[Part 27] All visual verification screenshots captured successfully!');
  ws.close();
}

run().catch((err) => {
  console.error('[Part 27] Capture failed:', err);
  process.exit(1);
});
