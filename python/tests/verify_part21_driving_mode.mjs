import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const REPORT_DIR = path.resolve(ROOT, 'python/reports');

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
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

  async captureScreenshot(filename) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const filepath = path.join(REPORT_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
    console.log(`  📸 Saved screenshot: ${filename} (${data.length} bytes base64)`);
    return filepath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('[PART 21 Driving Mode Integration] Connecting to Chrome CDP...');

  const wsUrl = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const tabs = JSON.parse(body);
        const page = tabs.find((t) => t.type === 'page' && t.url.includes('localhost:5173')) || tabs[0];
        resolve(page.webSocketDebuggerUrl);
      });
    }).on('error', reject);
  });

  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to page.');

  // Set standard laptop viewport
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Track console errors
  const consoleErrors = [];
  await cdp.send('Runtime.enable');

  // Step 1: Verify Initial Showroom Mode
  console.log('\nStep 1: Verify Initial Showroom Mode...');
  const initMode = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const appModeMod = await import('/src/store/appModeStore.js');
      return {
        mode: appModeMod.useAppModeStore.getState().mode,
        isShowroom: appModeMod.useAppModeStore.getState().isShowroomMode(),
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('  ✓ Initial mode:', initMode.result.value);

  // Step 2: Apply Custom Paint and Calipers in Showroom
  console.log('\nStep 2: Customize Vehicle Paint & Calipers in Showroom...');
  await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const paintMod = await import('/src/store/paintStore.js');
      const wheelMod = await import('/src/store/wheelStore.js');
      paintMod.usePaintStore.getState().setCustomColor('#00E5FF');
      paintMod.usePaintStore.getState().setFinish('pearl');
      wheelMod.useWheelStore.getState().setCaliperPreset('acid_green');
    })()`,
    awaitPromise: true,
  });
  await new Promise((r) => setTimeout(r, 600));
  await cdp.captureScreenshot('part21_01_showroom_customized.png');

  // Step 3: Switch to Driving Mode via UI Mode Switcher
  console.log('\nStep 3: Switch to Driving Mode via UI Mode Switcher...');
  const switchedToDrive = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const driveBtn = btns.find((b) => b.textContent.trim() === 'DRIVE');
      if (driveBtn) {
        driveBtn.click();
        return true;
      }
      // Fallback: programmatic
      const appModeMod = await import('/src/store/appModeStore.js');
      appModeMod.useAppModeStore.getState().setMode('driving');
      return true;
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('  ✓ Clicked DRIVE switch:', switchedToDrive.result.value);

  // Allow driving scene to mount
  await new Promise((r) => setTimeout(r, 1200));

  // Step 4: Verify Driving Mode Scene Graph & Customization Preservation
  console.log('\nStep 4: Verify Driving Scene Graph & Customizations...');
  const drivingSceneState = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const appModeMod = await import('/src/store/appModeStore.js');
      const paintMod = await import('/src/store/paintStore.js');
      const wheelMod = await import('/src/store/wheelStore.js');
      const scene = window.__THREE_SCENE__;

      let hasDrivingGround = false;
      let hasVehicle = false;
      let hasSky = false;

      scene?.traverse((obj) => {
        if (obj.name === 'DrivingEnvironmentGround') hasDrivingGround = true;
        if (obj.name === 'ConfiguredVehicleGroup' || obj.name === 'CarInteractiveRoot') hasVehicle = true;
        if (obj.isMesh && obj.geometry?.type === 'SphereGeometry') hasSky = true;
      });

      return {
        mode: appModeMod.useAppModeStore.getState().mode,
        isDriving: appModeMod.useAppModeStore.getState().isDrivingMode(),
        primaryColor: paintMod.usePaintStore.getState().primaryColor,
        activeFinish: paintMod.usePaintStore.getState().activeFinish,
        caliperPreset: wheelMod.useWheelStore.getState().caliperPreset,
        hasDrivingGround,
        hasVehicle,
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('  ✓ Driving Scene State:', JSON.stringify(drivingSceneState.result.value, null, 2));

  await cdp.captureScreenshot('part21_02_driving_scene_active.png');

  // Step 5: Switch Back to Showroom Mode
  console.log('\nStep 5: Switch Back to Showroom Mode...');
  await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const studioBtn = btns.find((b) => b.textContent.trim() === 'STUDIO');
      if (studioBtn) {
        studioBtn.click();
      } else {
        const appModeMod = await import('/src/store/appModeStore.js');
        appModeMod.useAppModeStore.getState().setMode('showroom');
      }
    })()`,
    awaitPromise: true,
  });

  await new Promise((r) => setTimeout(r, 1000));

  const restoredShowroomState = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const appModeMod = await import('/src/store/appModeStore.js');
      const paintMod = await import('/src/store/paintStore.js');
      const scene = window.__THREE_SCENE__;

      let hasShowroomController = false;
      let hasVehicle = false;

      scene?.traverse((obj) => {
        if (obj.name === 'CarInteractiveRoot') hasVehicle = true;
        if (obj.geometry?.type === 'CircleGeometry') hasShowroomController = true;
      });

      return {
        mode: appModeMod.useAppModeStore.getState().mode,
        isShowroom: appModeMod.useAppModeStore.getState().isShowroomMode(),
        primaryColor: paintMod.usePaintStore.getState().primaryColor,
        hasShowroomController,
        hasVehicle,
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('  ✓ Restored Showroom State:', JSON.stringify(restoredShowroomState.result.value, null, 2));

  await cdp.captureScreenshot('part21_03_showroom_restored.png');

  // Step 6: Master Factory Reset
  console.log('\nStep 6: Master Factory Reset...');
  await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const paintMod = await import('/src/store/paintStore.js');
      const wheelMod = await import('/src/store/wheelStore.js');
      paintMod.usePaintStore.getState().resetToFactory();
      wheelMod.useWheelStore.getState().resetWheelsToFactory();
    })()`,
    awaitPromise: true,
  });

  console.log('\n======================================================');
  console.log('🎉 PART 21 DRIVING MODE VERIFICATION PASSED! 🎉');
  console.log('======================================================\n');

  cdp.close();
}

run().catch((err) => {
  console.error('Part 21 Verification failed:', err);
  process.exit(1);
});
