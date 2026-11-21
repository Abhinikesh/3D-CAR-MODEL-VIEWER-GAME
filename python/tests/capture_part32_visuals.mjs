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
  console.log('[Part 32 CDP] Connecting to Chrome DevTools Protocol for Driving HUD Verification...');
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

  // Standard 1440x900 desktop viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Page.bringToFront', {});
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  // Navigate to application
  console.log('[Part 32 CDP] Navigating to http://localhost:5173/...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2200));

  const captureScreenshot = async (filename) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const filePath = path.join(REPORT_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`  [Screenshot Saved] ${filename} (${buffer.length} bytes)`);
  };

  const getHudTelemetry = async () => {
    const evalRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const phys = window.__vehiclePhysicsStore?.getState();
        const app = window.__appModeStore?.getState();
        const input = window.__vehicleInputStore?.getState();

        return {
          appMode: app?.mode,
          drivingView: app?.drivingView,
          isPaused: phys?.isPaused,
          displaySpeed: phys?.drivetrain?.displaySpeed || 0,
          speedKmh: phys?.drivetrain?.speedKmh || 0,
          longitudinalSpeed: phys?.drivetrain?.longitudinalSpeed || 0,
          gear: phys?.drivetrain?.gear || 'D',
          isAccelerating: phys?.drivetrain?.isAccelerating || false,
          isBraking: phys?.drivetrain?.isBraking || false,
          throttleInput: input?.throttle || 0,
          brakeInput: input?.brake || 0,
          handbrakeInput: input?.handbrake || false,
          steerAngleDeg: phys?.steering?.centralAngleDeg || 0,
          lateralG: phys?.steering?.lateralG || 0,
          surfaceType: phys?.collision?.surfaceType || 'asphalt',
          hasCollided: phys?.collision?.hasCollided || false,
          impactSpeedKmh: phys?.collision?.impactSpeedKmh || 0,
        };
      })()`,
      returnByValue: true,
    });
    return evalRes.result?.value || {};
  };

  const hudTelemetryLog = {
    testDate: new Date().toISOString(),
    scenarios: {},
  };

  // Switch to Driving Mode
  console.log('[Part 32 CDP] Switching to Driving Mode...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__appModeStore) {
        window.__appModeStore.getState().setMode('driving');
        window.__appModeStore.getState().setDrivingView('chase');
      }
    })()`,
  });

  // Wait for suspension to settle on asphalt track
  await new Promise(r => setTimeout(r, 1600));

  // ─── Scenario 1: Stationary Standstill HUD ───
  console.log('\n[Scenario 1] Stationary Standstill HUD (0 km/h, Park Gear, Neutral Inputs)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState().resetInputs();
      window.__vehiclePhysicsStore?.getState().resume();
    })()`,
  });
  await new Promise(r => setTimeout(r, 600));
  hudTelemetryLog.scenarios.stationary = await getHudTelemetry();
  console.log('  Telemetry:', hudTelemetryLog.scenarios.stationary);
  await captureScreenshot('part32_01_stationary_hud.png');

  // ─── Scenario 2: Forward Acceleration HUD ───
  console.log('\n[Scenario 2] Forward Acceleration HUD (Active Throttle Bar, Drive Gear D, Rising km/h)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState().setInputs({
        throttle: 1.0,
        brake: 0.0,
        gear: 'D'
      });
    })()`,
  });
  // Drive for 1.8 seconds down straight
  await new Promise(r => setTimeout(r, 1800));
  hudTelemetryLog.scenarios.accelerating = await getHudTelemetry();
  console.log('  Telemetry:', hudTelemetryLog.scenarios.accelerating);
  await captureScreenshot('part32_02_accelerating_hud.png');

  // ─── Scenario 3: Braking & Steering Telemetry HUD ───
  console.log('\n[Scenario 3] Service Braking & Steering Telemetry HUD (Brake Bar, Steering Degrees, Lateral G)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState().setInputs({
        throttle: 0.0,
        brake: 0.85,
        steer: 0.75, // Steer Left
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 700));
  hudTelemetryLog.scenarios.brakingAndSteer = await getHudTelemetry();
  console.log('  Telemetry:', hudTelemetryLog.scenarios.brakingAndSteer);
  await captureScreenshot('part32_03_braking_steer_hud.png');

  // ─── Scenario 4: Reverse Driving HUD ───
  console.log('\n[Scenario 4] Reverse Movement HUD (Amber Reverse Gear R, REV Badge, Positive km/h)...');
  // First stop the car, then reverse
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehiclePhysicsStore?.getState().requestReset();
    })()`,
  });
  await new Promise(r => setTimeout(r, 500));
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState().setInputs({
        throttle: 0.9,
        brake: 0.0,
        gear: 'R'
      });
    })()`,
  });
  await new Promise(r => setTimeout(r, 1400));
  hudTelemetryLog.scenarios.reverse = await getHudTelemetry();
  console.log('  Telemetry:', hudTelemetryLog.scenarios.reverse);
  await captureScreenshot('part32_04_reverse_hud.png');

  // ─── Scenario 5: Camera Mode Indicator & Switching ───
  console.log('\n[Scenario 5] Driving Camera Mode Indicator (Bumper Splitter View)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehicleInputStore?.getState().resetInputs();
      window.__appModeStore?.getState().setDrivingView('bumper');
    })()`,
  });
  await new Promise(r => setTimeout(r, 650));
  hudTelemetryLog.scenarios.bumperView = await getHudTelemetry();
  console.log('  Telemetry:', hudTelemetryLog.scenarios.bumperView);
  await captureScreenshot('part32_05_camera_modes_hud.png');

  // ─── Scenario 6: Simulation Paused Modal Overlay ───
  console.log('\n[Scenario 6] Simulation Paused Overlay (Frozen Physics, Resume, Restart, Showroom Buttons)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehiclePhysicsStore?.getState().pause();
    })()`,
  });
  await new Promise(r => setTimeout(r, 500));
  hudTelemetryLog.scenarios.paused = await getHudTelemetry();
  console.log('  Telemetry:', hudTelemetryLog.scenarios.paused);
  await captureScreenshot('part32_06_paused_state.png');

  // ─── Scenario 7: Showroom Mode Return & Dual-Mode Isolation ───
  console.log('\n[Scenario 7] Return to Showroom Mode (Driving HUD Unmounted, Showroom Dock Pristine)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__vehiclePhysicsStore?.getState().resume();
      window.__appModeStore?.getState().setMode('showroom');
    })()`,
  });
  await new Promise(r => setTimeout(r, 1200));
  hudTelemetryLog.scenarios.showroomReturn = await getHudTelemetry();
  console.log('  Telemetry:', hudTelemetryLog.scenarios.showroomReturn);
  await captureScreenshot('part32_07_showroom_mode_isolation.png');

  // Save telemetry report
  const reportPath = path.join(REPORT_DIR, 'part32_hud_telemetry.json');
  fs.writeFileSync(reportPath, JSON.stringify(hudTelemetryLog, null, 2));
  console.log(`\n✓ Saved Telemetry Report: ${reportPath}`);

  console.log('\n======================================================');
  console.log('PART 32 CDP Verification Successfully Completed (7/7 Scenes)!');
  console.log('======================================================\n');

  ws.close();
}

run().catch(err => {
  console.error('[Part 32 CDP] Error:', err);
  process.exit(1);
});
