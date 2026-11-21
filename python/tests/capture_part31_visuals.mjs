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
  console.log('[Part 31 CDP] Connecting to Chrome CDP for Driving Camera Verification...');
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

  // Navigate to application
  console.log('[Part 31 CDP] Navigating to http://localhost:5173/...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2200));

  // Helper to save screenshot
  const captureScreenshot = async (filename) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const filePath = path.join(REPORT_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`  [Screenshot Saved] ${filename} (${buffer.length} bytes)`);
  };

  // Helper to extract telemetry
  const getCameraTelemetry = async () => {
    const evalRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const phys = window.__vehiclePhysicsStore?.getState();
        const app = window.__appModeStore?.getState();
        const input = window.__vehicleInputStore?.getState();
        const sim = window.__physicsSim;

        return {
          appMode: app?.mode,
          drivingView: app?.drivingView,
          speedKmh: phys?.telemetry?.speedKmh || 0,
          speedLong: phys?.telemetry?.drivetrain?.speedLong || 0,
          gear: phys?.telemetry?.drivetrain?.gear || 'D',
          steerDeg: phys?.telemetry?.steering?.centralAngleDeg || 0,
          lateralG: phys?.telemetry?.steering?.lateralG || 0,
          vehiclePos: sim?.position ? [sim.position.x, sim.position.y, sim.position.z] : [0, 0, 0],
          vehicleHeading: sim?.quaternion ? [sim.quaternion.x, sim.quaternion.y, sim.quaternion.z, sim.quaternion.w] : [0, 0, 0, 1],
          surface: phys?.telemetry?.collision?.surfaceType || 'asphalt',
          isOffRoad: phys?.telemetry?.collision?.isOffRoad || false,
          hasCollided: phys?.telemetry?.collision?.hasCollided || false,
        };
      })()`,
      returnByValue: true,
    });
    return evalRes.result?.value || {};
  };

  const cameraTelemetryLog = {
    timestamp: new Date().toISOString(),
    scenarios: {},
  };

  // Switch to Driving Mode with default CHASE view
  console.log('[Part 31 CDP] Switching to Driving Mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('driving');
        window.__appModeStore.getState().setDrivingView('chase');
      }
    })()`,
  });

  // Wait for vehicle suspension to settle on the road surface
  await new Promise(r => setTimeout(r, 1800));

  // ─── Scenario 1: Default Third-Person Chase Camera ───
  console.log('\n[Scenario 1] Default Third-Person Chase Camera (Standstill at Spawn)...');
  cameraTelemetryLog.scenarios.defaultChase = await getCameraTelemetry();
  await captureScreenshot('part31_01_default_chase_camera.png');

  // ─── Scenario 2: Close Dynamic Chase Camera ───
  console.log('\n[Scenario 2] Close Dynamic Chase Camera...');
  await send('Runtime.evaluate', {
    expression: `window.__appModeStore.getState().setDrivingView('close')`,
  });
  await new Promise(r => setTimeout(r, 650));
  cameraTelemetryLog.scenarios.closeChase = await getCameraTelemetry();
  await captureScreenshot('part31_02_close_chase_camera.png');

  // ─── Scenario 3: Wide Cinematic Chase Camera ───
  console.log('\n[Scenario 3] Wide Track Cinematic Chase Camera...');
  await send('Runtime.evaluate', {
    expression: `window.__appModeStore.getState().setDrivingView('wide')`,
  });
  await new Promise(r => setTimeout(r, 650));
  cameraTelemetryLog.scenarios.wideChase = await getCameraTelemetry();
  await captureScreenshot('part31_03_wide_chase_camera.png');

  // ─── Scenario 4: Forward Bonnet / Hood Camera ───
  console.log('\n[Scenario 4] Forward Bonnet / Hood Cockpit Camera...');
  await send('Runtime.evaluate', {
    expression: `window.__appModeStore.getState().setDrivingView('hood')`,
  });
  await new Promise(r => setTimeout(r, 600));
  cameraTelemetryLog.scenarios.bonnetHood = await getCameraTelemetry();
  await captureScreenshot('part31_04_bonnet_hood_camera.png');

  // ─── Scenario 5: Low Front Splitter Bumper Camera ───
  console.log('\n[Scenario 5] Low Front Splitter Bumper Camera...');
  await send('Runtime.evaluate', {
    expression: `window.__appModeStore.getState().setDrivingView('bumper')`,
  });
  await new Promise(r => setTimeout(r, 600));
  cameraTelemetryLog.scenarios.frontBumper = await getCameraTelemetry();
  await captureScreenshot('part31_05_front_bumper_camera.png');

  // ─── Scenario 6: Road Curve Follow (Turn 1 Sweeper Navigation) ───
  console.log('\n[Scenario 6] Road Curve Follow Navigation (Switch to CHASE, Accelerate & Turn into Curve)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__appModeStore.getState().setDrivingView('chase');
      // Apply throttle and right steering to negotiate the curve
      window.__vehicleInputStore.getState().setInputs({
        throttle: 0.82,
        brake: 0,
        steer: 0.35,
        gear: 'D',
        handbrake: false,
      });
    })()`,
  });

  // Let the vehicle drive into the curve for 2.6 seconds
  await new Promise(r => setTimeout(r, 2600));
  cameraTelemetryLog.scenarios.roadCurve = await getCameraTelemetry();
  await captureScreenshot('part31_06_vehicle_road_curve.png');

  // ─── Scenario 7: High-Speed Acceleration Chase ───
  console.log('\n[Scenario 7] High-Speed Acceleration Chase (Pull-Back Distance & Dynamic FOV)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore.getState().setInputs({
        throttle: 1.0,
        brake: 0,
        steer: 0.05,
        gear: 'D',
        handbrake: false,
      });
    })()`,
  });

  // Accelerate down the road for 1.8 seconds
  await new Promise(r => setTimeout(r, 1800));
  cameraTelemetryLog.scenarios.highSpeedChase = await getCameraTelemetry();
  await captureScreenshot('part31_07_high_speed_chase.png');

  // Stop vehicle
  await send('Runtime.evaluate', {
    expression: `window.__vehicleInputStore.getState().setInputs({ throttle: 0, brake: 1.0, steer: 0, gear: 'D', handbrake: true })`,
  });
  await new Promise(r => setTimeout(r, 1000));

  // ─── Scenario 8: Vehicle Recovery & Reset Camera Synchronization ───
  console.log('\n[Scenario 8] Vehicle Recovery & Camera Immediate Synchronization...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehiclePhysicsStore.getState().requestReset();
      window.__vehicleInputStore.getState().resetInputs();
      window.__appModeStore.getState().setDrivingView('chase');
    })()`,
  });
  await new Promise(r => setTimeout(r, 500));
  cameraTelemetryLog.scenarios.vehicleRecovery = await getCameraTelemetry();
  await captureScreenshot('part31_08_vehicle_recovery_camera_sync.png');

  // ─── Scenario 9: Showroom Mode Isolation Check ───
  console.log('\n[Scenario 9] Showroom Mode Isolation Check...');
  await send('Runtime.evaluate', {
    expression: `window.__appModeStore.getState().setMode('showroom')`,
  });
  await new Promise(r => setTimeout(r, 1200));
  cameraTelemetryLog.scenarios.showroomMode = await getCameraTelemetry();
  await captureScreenshot('part31_09_showroom_isolation.png');

  // Save telemetry report
  const reportPath = path.join(REPORT_DIR, 'part31_camera_telemetry.json');
  fs.writeFileSync(reportPath, JSON.stringify(cameraTelemetryLog, null, 2));
  console.log(`\n[Part 31 CDP] Telemetry logged to ${reportPath}`);

  ws.close();
  console.log('[Part 31 CDP] Verification script completed successfully!');
}

run().catch((err) => {
  console.error('[Part 31 CDP Error]', err);
  process.exit(1);
});
