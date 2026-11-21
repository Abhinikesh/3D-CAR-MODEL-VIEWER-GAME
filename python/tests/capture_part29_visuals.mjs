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
  console.log('[Part 29] Connecting to Chrome CDP for Wheel Kinematics & Rotation Verification...');
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
  console.log('[Part 29] Navigating to http://localhost:5173/...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));

  // Switch to DRIVE mode
  console.log('[Part 29] Switching to DRIVE mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('driving');
        window.__appModeStore.getState().setDrivingView('chase');
      }
    })()`,
  });

  // Settle vehicle on road
  console.log('[Part 29] Waiting for vehicle suspension to settle on road...');
  await new Promise(r => setTimeout(r, 1800));

  const wheelTelemetryLog = {
    testTimestamp: new Date().toISOString(),
    scenarios: {},
  };

  // Helper to save screenshot
  const captureScreenshot = async (filename) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const filePath = path.join(REPORT_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`[Part 29] Captured: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  };

  // Helper to read live telemetry
  const readTelemetry = async () => {
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const pStore = window.__vehiclePhysicsStore?.getState?.();
        const wStore = window.__wheelAnimationStore?.getState?.();
        return {
          chassis: pStore?.chassis,
          drivetrain: pStore?.drivetrain,
          steering: pStore?.steering,
          wheels: pStore?.wheels,
          drivingWheelTransforms: wStore?.drivingWheelTransforms,
        };
      })()`,
      returnByValue: true,
    });
    return res?.result?.value;
  };

  // ─── Scenario 1: Stationary Settled Wheels ───
  console.log('[Part 29] 1. Stationary settled wheels at spawn...');
  const tSpawn = await readTelemetry();
  wheelTelemetryLog.scenarios.stationarySettled = tSpawn;
  console.log(`[Part 29] Stationary Speed: ${tSpawn?.drivetrain?.speedKmh} km/h, FL RPM: ${tSpawn?.wheels?.fl?.rpm}, Deflection: ${tSpawn?.wheels?.fl?.suspensionOffsetMm} mm`);
  await captureScreenshot('part29_01_stationary_wheels.png');

  // ─── Scenario 2: Forward Acceleration & Wheel Spin ───
  console.log('[Part 29] 2. Accelerating forward with physics-driven wheel rotation...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__vehicleInputStore) {
        window.__vehicleInputStore.getState().setInputs({ throttle: 1.0, brake: 0, steer: 0, gear: 'D' });
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 1600));

  const tForward = await readTelemetry();
  wheelTelemetryLog.scenarios.forwardSpin = tForward;
  console.log(`[Part 29] Forward Speed: ${tForward?.drivetrain?.speedKmh} km/h, FL RPM: ${tForward?.wheels?.fl?.rpm}, Roll: ${tForward?.wheels?.fl?.rollAngle} rad`);
  await captureScreenshot('part29_02_forward_wheel_rotation.png');

  // ─── Scenario 3: Hard Braking & Suspension Dive ───
  console.log('[Part 29] 3. Hard braking & dynamic suspension dive...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__vehicleInputStore) {
        window.__vehicleInputStore.getState().setInputs({ throttle: 0, brake: 1.0, steer: 0, gear: 'D' });
      }
    })()`,
  });
  // Capture mid-braking during maximum dive
  await new Promise(r => setTimeout(r, 400));
  const tBraking = await readTelemetry();
  wheelTelemetryLog.scenarios.brakingDive = tBraking;
  console.log(`[Part 29] Braking Speed: ${tBraking?.drivetrain?.speedKmh} km/h, FL Deflection: ${tBraking?.wheels?.fl?.suspensionOffsetMm} mm, RL Deflection: ${tBraking?.wheels?.rl?.suspensionOffsetMm} mm`);
  await captureScreenshot('part29_05_braking_suspension_dive.png');

  // Wait to come to a complete stop
  await new Promise(r => setTimeout(r, 1200));

  // ─── Scenario 4: Reverse Driving & Negative Wheel Spin ───
  console.log('[Part 29] 4. Reverse driving with negative wheel roll...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__vehicleInputStore) {
        window.__vehicleInputStore.getState().setInputs({ throttle: 0.8, brake: 0, steer: 0, gear: 'R' });
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 1400));
  const tReverse = await readTelemetry();
  wheelTelemetryLog.scenarios.reverseSpin = tReverse;
  console.log(`[Part 29] Reverse Speed: ${tReverse?.drivetrain?.speedKmh} km/h, FL RPM: ${tReverse?.wheels?.fl?.rpm}, Roll: ${tReverse?.wheels?.fl?.rollAngle} rad`);
  await captureScreenshot('part29_03_reverse_wheel_rotation.png');

  // Stop reversing
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__vehicleInputStore) {
        window.__vehicleInputStore.getState().setInputs({ throttle: 0, brake: 1.0, steer: 0, gear: 'D' });
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 800));

  // ─── Scenario 5: Ackermann Front Steering Articulation & Differential Cornering ───
  console.log('[Part 29] 5. Cornering with Ackermann steering & differential wheel speeds...');
  // Switch to bumper/hood view for clear front wheel view
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setDrivingView('hood');
      }
      if (window.__vehicleInputStore) {
        window.__vehicleInputStore.getState().setInputs({ throttle: 0.6, brake: 0, steer: -1.0, gear: 'D' });
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 1200));
  const tCornering = await readTelemetry();
  wheelTelemetryLog.scenarios.corneringAckermann = tCornering;
  console.log(`[Part 29] Cornering: Central ${tCornering?.steering?.centralAngleDeg}°, FL: ${tCornering?.steering?.angleFLDeg}°, FR: ${tCornering?.steering?.angleFRDeg}°`);
  console.log(`[Part 29] Differential Speeds: Inner FL ${tCornering?.wheels?.fl?.groundSpeed} m/s vs Outer FR ${tCornering?.wheels?.fr?.groundSpeed} m/s`);
  await captureScreenshot('part29_04_steering_articulation.png');

  // ─── Scenario 6: Custom Rims & Preserved Styling in Driving Scene ───
  console.log('[Part 29] 6. Preserved custom wheels & brake calipers in driving mode...');
  // Switch back to chase view and neutral steer
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setDrivingView('chase');
      }
      if (window.__vehicleInputStore) {
        window.__vehicleInputStore.getState().setInputs({ throttle: 0.3, brake: 0, steer: 0, gear: 'D' });
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 1000));
  const tCustomWheels = await readTelemetry();
  wheelTelemetryLog.scenarios.customWheelsDriving = tCustomWheels;
  await captureScreenshot('part29_06_custom_wheels_driving.png');

  // Neutralize driver inputs
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__vehicleInputStore) {
        window.__vehicleInputStore.getState().setInputs({ throttle: 0, brake: 1.0, steer: 0, gear: 'D' });
      }
    })()`,
  });
  await new Promise(r => setTimeout(r, 800));
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__vehicleInputStore) {
        window.__vehicleInputStore.getState().setInputs({ throttle: 0, brake: 0, steer: 0, gear: 'D' });
      }
    })()`,
  });

  // Save full telemetry log
  const telemetryPath = path.join(REPORT_DIR, 'part29_wheel_telemetry.json');
  fs.writeFileSync(telemetryPath, JSON.stringify(wheelTelemetryLog, null, 2));
  console.log(`[Part 29] Telemetry log saved to ${telemetryPath}`);

  ws.close();
  console.log('[Part 29] Visual verification completed successfully!');
}

run().catch((err) => {
  console.error('[Part 29] Capture error:', err);
  process.exit(1);
});
