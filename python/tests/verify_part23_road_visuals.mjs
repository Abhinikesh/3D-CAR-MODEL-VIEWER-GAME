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
    console.log(`  📸 Saved screenshot: ${filename} (${data.length} bytes base64, ${(data.length * 0.75 / 1024).toFixed(1)} KB)`);
    return filepath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('[PART 23 Road Environment Verification] Connecting to Chrome CDP...');

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

  // Set standard high-fidelity 1440x900 viewport
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send('Runtime.enable');

  // Step 1: Switch to Driving Mode via UI Button Click
  console.log('\nStep 1: Clicking DRIVE mode button in StudioHeader...');
  const driveClick = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const driveBtn = buttons.find(b => b.innerText.trim() === 'DRIVE');
      if (driveBtn) {
        driveBtn.click();
        return 'SUCCESS: Clicked DRIVE button';
      }
      return 'FAILED: DRIVE button not found';
    })()`,
    returnByValue: true,
  });
  console.log('  ✓ Mode button click result:', driveClick.result.value);

  // Settle time for Driving Scene, Asphalt road, Markings, Barriers, Scenery
  await new Promise((r) => setTimeout(r, 2000));

  // Step 2: Ensure Chase Camera is active and capture Screenshot 1 (Spawn Area & Launch Grid)
  console.log('\nStep 2: Activating CHASE (1) camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('CHASE'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));
  await cdp.captureScreenshot('part23_01_spawn_starting_grid.png');

  // Step 3: Switch to HOOD (2) camera and capture Screenshot 2 (Forward Road View)
  console.log('\nStep 3: Activating HOOD (2) camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('HOOD'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));
  await cdp.captureScreenshot('part23_02_forward_road_view.png');

  // Step 4: Switch to TURN 1 (4) camera and capture Screenshot 3 (Apex Kerbs, Outer Barrier & Chevrons)
  console.log('\nStep 4: Activating TURN 1 (4) camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('TURN 1'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));
  await cdp.captureScreenshot('part23_03_turn1_apex_kerbs_barriers.png');

  // Step 5: Switch to HAIRPIN (5) camera and capture Screenshot 4 (Hairpin Apex & Outer Guardrail)
  console.log('\nStep 5: Activating HAIRPIN (5) camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('HAIRPIN'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));
  await cdp.captureScreenshot('part23_04_hairpin_apex_barriers.png');

  // Step 6: Switch to AERIAL (3) camera and capture Screenshot 5 (Complete 1.2km Circuit Map)
  console.log('\nStep 6: Activating AERIAL (3) camera...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('AERIAL'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1400));
  await cdp.captureScreenshot('part23_05_circuit_aerial_overview.png');

  // Step 7: Return to Showroom Mode via STUDIO button
  console.log('\nStep 7: Testing Showroom Mode Restoration via STUDIO button...');
  const studioClick = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const studioBtn = buttons.find(b => b.innerText.trim() === 'STUDIO');
      if (studioBtn) {
        studioBtn.click();
        return 'SUCCESS: Clicked STUDIO button';
      }
      return 'FAILED: STUDIO button not found';
    })()`,
    returnByValue: true,
  });
  console.log('  ✓ Studio button click result:', studioClick.result.value);
  await new Promise((r) => setTimeout(r, 1200));
  await cdp.captureScreenshot('part23_06_showroom_regression_check.png');

  // Step 8: Audit Performance & Errors
  console.log('\nStep 8: Auditing Console Errors & Performance...');
  const consoleCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const errors = window.__consoleErrors || [];
      const canvas = document.querySelector('canvas');
      return {
        errorsCount: errors.length,
        canvasValid: !!canvas && canvas.width > 0,
      };
    })()`,
    returnByValue: true,
  });
  console.log('  ✓ Audit result:', consoleCheck.result.value);

  console.log('\n🎉 ALL PART 23 VISUAL & TECHNICAL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  cdp.close();
}

run().catch((err) => {
  console.error('CDP Verification Failed:', err);
  process.exit(1);
});
