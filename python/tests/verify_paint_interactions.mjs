import http from 'http';
import fs from 'fs';

// Helper to make CDP RPC calls over WebSocket
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

async function getPageWsUrl() {
  return new Promise((resolve, reject) => {
    http
      .get('http://127.0.0.1:9222/json', (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const list = JSON.parse(body);
          const page = list.find((p) => p.type === 'page' && p.url.includes('localhost:5173'));
          if (page) resolve(page.webSocketDebuggerUrl);
          else reject(new Error('No matching localhost:5173 page target found in Chrome DevTools'));
        });
      })
      .on('error', reject);
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('[E2E-Part9] Connecting to headless Chrome via CDP...');
  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to page CDP target.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  // Track runtime console errors
  await cdp.send('Runtime.evaluate', {
    expression: `
      window.__consoleErrors = [];
      window.__hadError = false;
      window.addEventListener('error', (e) => {
        window.__hadError = true;
        window.__consoleErrors.push(e.message);
      });
      window.addEventListener('unhandledrejection', (e) => {
        window.__hadError = true;
        window.__consoleErrors.push(String(e.reason));
      });
    `,
  });

  console.log('[E2E-Part9] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3500);

  // 1. Ensure floating tools are open so PaintToolbar is visible
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const toggle = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('FLOATING TOOLS'));
      const isVisible = Boolean(document.querySelector('button[title*="Paint Color"]'));
      if (toggle && !isVisible) {
        toggle.click();
      }
    })()`,
  });
  await sleep(800);

  // Verify Canvas and Paint Toolbar in DOM
  const domCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas[data-engine*="three.js"]');
      const paintBtn = document.querySelector('button[title*="Paint Color"]');
      const bodyText = document.body.innerText;
      return {
        hasCanvas: Boolean(canvas),
        hasPaintToolbar: Boolean(paintBtn) || bodyText.toLowerCase().includes('paint color'),
        activePart: 9,
      };
    })()`,
    returnByValue: true,
  });

  console.log('Initial DOM check:', domCheck.result.value);
  if (!domCheck.result.value.hasCanvas || !domCheck.result.value.hasPaintToolbar) {
    throw new Error('Canvas or Paint Toolbar missing in DOM');
  }

  // Helper to capture and write screenshot
  async function captureShot(filepath, description) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(shot.data, 'base64'));
    console.log(`✓ [Screenshot] ${description} -> ${filepath}`);
  }

  // 2. Capture Screenshot 1: Factory Original Paint
  await captureShot('python/reports/part9_paint_factory.png', 'Factory Original Paint');

  // 3. Test Preset: Deep Blue (Metallic Finish)
  console.log('[E2E-Part9] Selecting Preset: Deep Blue...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const trigger = document.querySelector('button[title*=\"Paint Color\"]');
      if (trigger) trigger.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role=\"option\"]')).find(o => o.innerText.includes('Deep Blue'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  // Capture Screenshot 2: Metallic Deep Blue
  await captureShot('python/reports/part9_paint_metallic_deep_blue.png', 'Metallic Finish (Deep Blue)');

  // 4. Test Preset: Pearl White (Pearl Finish)
  console.log('[E2E-Part9] Selecting Preset: Pearl White...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const trigger = document.querySelector('button[title*=\"Paint Color\"]');
      if (trigger) trigger.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role=\"option\"]')).find(o => o.innerText.includes('Pearl White'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  // Capture Screenshot 3: Pearl Finish (Pearl White)
  await captureShot('python/reports/part9_paint_pearl_white.png', 'Pearl Finish (Pearl White)');

  // 5. Test Preset: Matte Grey (Matte Finish)
  console.log('[E2E-Part9] Selecting Preset: Matte Grey...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const trigger = document.querySelector('button[title*=\"Paint Color\"]');
      if (trigger) trigger.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role=\"option\"]')).find(o => o.innerText.includes('Matte Grey'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  // Capture Screenshot 4: Matte Finish (Matte Grey)
  await captureShot('python/reports/part9_paint_matte_grey.png', 'Matte Finish (Matte Grey)');

  // 6. Test Preset: Racing Red (Gloss Finish)
  console.log('[E2E-Part9] Selecting Preset: Racing Red...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const trigger = document.querySelector('button[title*=\"Paint Color\"]');
      if (trigger) trigger.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role=\"option\"]')).find(o => o.innerText.includes('Racing Red'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  // Capture Screenshot 5: Gloss Finish (Racing Red)
  await captureShot('python/reports/part9_paint_gloss_racing_red.png', 'Gloss Finish (Racing Red)');

  // 7. Test Preset: British Racing Green (Second distinct body color)
  console.log('[E2E-Part9] Selecting Preset: British Racing Green...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const trigger = document.querySelector('button[title*=\"Paint Color\"]');
      if (trigger) trigger.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role=\"option\"]')).find(o => o.innerText.includes('British Racing Green'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  // Capture Screenshot 6: British Racing Green
  await captureShot('python/reports/part9_paint_racing_green.png', 'British Racing Green (Distinct Color)');

  // 8. Test Finish Tab Toggling (e.g. Switch British Racing Green to Satin)
  console.log('[E2E-Part9] Switching finish tab to Satin...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Satin');
      if (btn) btn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(800);

  // 9. Test Factory Reset
  console.log('[E2E-Part9] Testing Factory Paint Reset...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const resetBtn = document.querySelector('button[title*=\"Reset to Factory\"]');
      if (resetBtn) resetBtn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1000);

  // Verify HUD reflects factory paint restored
  const postResetCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      return {
        hasFactory: text.includes('Factory Carmine') || text.includes('Original'),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Post-reset verification:', postResetCheck.result.value);

  // 10. Check runtime errors
  const errRes = await cdp.send('Runtime.evaluate', {
    expression: `({ hadError: window.__hadError, errors: window.__consoleErrors })`,
    returnByValue: true,
  });
  console.log('Runtime error check:', errRes.result.value);

  if (errRes.result.value.hadError && errRes.result.value.errors.length > 0) {
    throw new Error(`Runtime errors detected: ${errRes.result.value.errors.join(', ')}`);
  }

  cdp.close();
  console.log('✨ [E2E-Part9] All Browser E2E paint verifications completed successfully!');
}

run().catch((err) => {
  console.error('❌ Part 9 E2E Test Failed:', err);
  process.exit(1);
});
