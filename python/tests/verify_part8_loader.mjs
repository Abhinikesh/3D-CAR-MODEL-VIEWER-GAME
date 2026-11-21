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
  console.log('[E2E-Part8] Connecting to headless Chrome via CDP...');
  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to page CDP target.');

  // Enable Page, Runtime, and DOM
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  // Listen to runtime console errors
  const consoleErrors = [];
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

  console.log('[E2E-Part8] Waiting for Three.js Canvas and Scene Graph initialization...');
  await sleep(3000);

  // 1. Verify Three.js Canvas Element
  const canvasRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas[data-engine*="three.js"]');
      if (!canvas) return { ok: false, error: 'No Three.js canvas found' };
      const rect = canvas.getBoundingClientRect();
      return {
        ok: true,
        engine: canvas.getAttribute('data-engine'),
        width: rect.width,
        height: rect.height,
      };
    })()`,
    returnByValue: true,
  });

  console.log('Canvas check result:', canvasRes.result.value);
  if (!canvasRes.result.value.ok) {
    throw new Error(`Canvas verification failed: ${canvasRes.result.value.error}`);
  }

  // 2. Verify HUD Metrics and Registry text
  const hudRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body.innerText;
      const hasTitle = bodyText.includes('3D CAR MODEL') || bodyText.includes('AERO CONCEPT GT') || document.title.includes('3D Car Model');
      const hasRegistry = bodyText.includes('17/17') || bodyText.includes('REGISTRY') || bodyText.includes('Registry');
      const hasDimensions = bodyText.includes('4.56') || bodyText.includes('DIMENSIONS') || bodyText.includes('Dimensions');
      const hasGround = bodyText.includes('Y = 0.000m');
      const hasPart8 = bodyText.includes('PART 8') || bodyText.includes('STAGE') || bodyText.includes('MODULAR CAR MODEL LOADER');
      return {
        hasTitle,
        hasRegistry,
        hasDimensions,
        hasGround,
        hasPart8,
        preview: bodyText.slice(0, 500).replace(/\\s+/g, ' '),
      };
    })()`,
    returnByValue: true,
  });

  console.log('HUD check result:', hudRes.result.value);
  if (!hudRes.result.value.hasTitle || !hudRes.result.value.hasRegistry) {
    throw new Error('HUD missing expected title or registry confirmation');
  }

  // 3. Test Camera Preset Switching (Front View)
  console.log('[E2E-Part8] Testing Camera Preset switching...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('preset'));
      if (btn) btn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(i => i.innerText.includes('Front'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1500);

  // 4. Return to Isometric 3/4 Hero View for clean final screenshot
  console.log('[E2E-Part8] Returning to Hero 3/4 view...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('preset'));
      if (btn) btn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(i => i.innerText.includes('Hero'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1500);

  // 5. Capture Part 8 Showroom Refactor Screenshot
  console.log('[E2E-Part8] Capturing screenshot...');
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = 'python/reports/part8_showroom_refactor.png';
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`✓ Screenshot successfully saved to ${screenshotPath}`);

  // 6. Verify zero runtime errors
  const errRes = await cdp.send('Runtime.evaluate', {
    expression: `({ hadError: window.__hadError, errors: window.__consoleErrors })`,
    returnByValue: true,
  });
  console.log('Error state check:', errRes.result.value);

  if (errRes.result.value.hadError && errRes.result.value.errors.length > 0) {
    throw new Error(`Runtime errors detected: ${errRes.result.value.errors.join(', ')}`);
  }

  cdp.close();
  console.log('✨ [E2E-Part8] All Browser E2E verifications completed successfully!');
}

run().catch((err) => {
  console.error('❌ Part 8 E2E Test Failed:', err);
  process.exit(1);
});
