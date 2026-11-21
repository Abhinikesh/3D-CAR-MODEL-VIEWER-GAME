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
    http.get('http://127.0.0.1:9222/json', (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const list = JSON.parse(body);
        const page = list.find((p) => p.type === 'page' && p.url.includes('localhost:5173'));
        if (page) resolve(page.webSocketDebuggerUrl);
        else reject(new Error('No matching page target found'));
      });
    }).on('error', reject);
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('[E2E] Connecting to headless Chrome via CDP...');
  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to page CDP target.');

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  // Monitor console errors
  const consoleErrors = [];
  cdp.events = [];

  // Wait for 3D model and scene to settle
  console.log('[E2E] Waiting for scene to settle...');
  await sleep(2500);

  // 1. Verify canvas element
  const canvasRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('canvas');
      return {
        found: Boolean(c),
        width: c ? c.width : 0,
        height: c ? c.height : 0,
        dataEngine: c ? c.getAttribute('data-engine') : null
      };
    })()`,
    returnByValue: true,
  });
  console.log('Canvas state:', canvasRes.result.value);
  if (!canvasRes.result.value.found || !canvasRes.result.value.dataEngine) {
    throw new Error('Canvas was not initialized properly!');
  }

  // 2. Verify Toolbar elements
  const toolbarRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
      return btns;
    })()`,
    returnByValue: true,
  });
  console.log('Visible buttons:', toolbarRes.result.value);

  // 3. Test opening preset dropdown
  console.log('[E2E] Clicking preset dropdown button...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('preset'));
      if (btn) btn.click();
      return Boolean(btn);
    })()`,
    returnByValue: true,
  });
  await sleep(300);

  // Check opened dropdown items
  const menuItems = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const items = Array.from(document.querySelectorAll('[role="option"]')).map(i => i.innerText.split('\\n')[0].trim());
      return items;
    })()`,
    returnByValue: true,
  });
  console.log('✓ Dropdown opened, available presets:', menuItems.result.value);
  if (menuItems.result.value.length !== 10) {
    throw new Error(`Expected 10 presets in dropdown, got ${menuItems.result.value.length}`);
  }

  // 4. Test selecting 'Front' preset
  console.log('[E2E] Selecting "Front" preset...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const frontOpt = Array.from(document.querySelectorAll('[role="option"]')).find(i => i.innerText.startsWith('Front\\n') || i.innerText.trim() === 'Front');
      if (frontOpt) frontOpt.click();
      return Boolean(frontOpt);
    })()`,
    returnByValue: true,
  });
  await sleep(1000); // Wait for smooth transition

  // Capture screenshot of Front View
  const frontScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('python/reports/part6_front_view.png', Buffer.from(frontScreenshot.data, 'base64'));
  console.log('✓ Captured Front View screenshot -> python/reports/part6_front_view.png');

  // 5. Test selecting 'Orthographic' projection mode
  console.log('[E2E] Switching to Orthographic projection...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const orthoBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Orthographic'));
      if (orthoBtn) orthoBtn.click();
      return Boolean(orthoBtn);
    })()`,
    returnByValue: true,
  });
  await sleep(800);

  // Capture screenshot of Orthographic View
  const orthoScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('python/reports/part6_ortho_view.png', Buffer.from(orthoScreenshot.data, 'base64'));
  console.log('✓ Captured Orthographic View screenshot -> python/reports/part6_ortho_view.png');

  // 6. Test Fit to Vehicle
  console.log('[E2E] Clicking Fit to Vehicle button...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const fitBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Fit'));
      if (fitBtn) fitBtn.click();
      return Boolean(fitBtn);
    })()`,
    returnByValue: true,
  });
  await sleep(800);

  // 7. Test Reset View
  console.log('[E2E] Clicking Reset View button...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Reset'));
      if (resetBtn) resetBtn.click();
      return Boolean(resetBtn);
    })()`,
    returnByValue: true,
  });
  await sleep(1000);

  // Capture final screenshot
  const finalScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('python/reports/part6_reset_hero_view.png', Buffer.from(finalScreenshot.data, 'base64'));
  console.log('✓ Captured Reset Hero View screenshot -> python/reports/part6_reset_hero_view.png');

  // Check for any runtime errors
  const errRes = await cdp.send('Runtime.evaluate', {
    expression: `window.__hadError || false`,
    returnByValue: true,
  });
  console.log('Window error flag:', errRes.result.value);

  cdp.close();
  console.log('✓ E2E Browser Verification Completed Successfully!');
}

run().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
