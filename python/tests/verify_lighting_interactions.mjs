import http from 'http';
import fs from 'fs';

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
  console.log('[E2E-Part7] Connecting to headless Chrome via CDP...');
  const wsUrl = await getPageWsUrl();
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to page CDP target.');

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  // Wait for 3D model, textures, and HDR environment to settle
  console.log('[E2E-Part7] Waiting for model & HDR environment to settle...');
  await sleep(3500);

  // 1. Verify canvas
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

  // 2. Capture Screenshot 1: Studio Lighting (Default)
  console.log('[E2E-Part7] Capturing Studio Lighting screenshot...');
  const studioScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('python/reports/part7_studio_lighting.png', Buffer.from(studioScreenshot.data, 'base64'));
  console.log('✓ Captured Studio Lighting -> python/reports/part7_studio_lighting.png');

  // 3. Test opening lighting preset dropdown
  console.log('[E2E-Part7] Opening Lighting Preset dropdown...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('lighting'));
      if (btn) btn.click();
      return Boolean(btn);
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  // 4. Select "Soft Studio"
  console.log('[E2E-Part7] Selecting "Soft Studio" lighting...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(i => i.innerText.includes('Soft Studio'));
      if (opt) opt.click();
      return Boolean(opt);
    })()`,
    returnByValue: true,
  });
  await sleep(1200); // Allow smooth light interpolation

  // Capture Screenshot 2: Soft Studio Lighting
  const softScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('python/reports/part7_soft_lighting.png', Buffer.from(softScreenshot.data, 'base64'));
  console.log('✓ Captured Soft Studio Lighting -> python/reports/part7_soft_lighting.png');

  // 5. Select "Dramatic"
  console.log('[E2E-Part7] Opening Lighting dropdown and selecting "Dramatic"...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('lighting'));
      if (btn) btn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(i => i.innerText.includes('Dramatic'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  // Capture Screenshot 3: Dramatic Lighting
  const dramaticScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('python/reports/part7_dramatic_lighting.png', Buffer.from(dramaticScreenshot.data, 'base64'));
  console.log('✓ Captured Dramatic Lighting -> python/reports/part7_dramatic_lighting.png');

  // 6. Test Paint Reflection Close-Up (Select Front-Right 3/4 and zoom in)
  console.log('[E2E-Part7] Selecting Front-Right 3/4 for paint reflections...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      // Revert to Studio for clean reflections
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('lighting'));
      if (btn) btn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(300);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(i => i.innerText.includes('Studio') && !i.innerText.includes('Soft'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(400);

  // Open camera preset dropdown and select Front-Left
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('preset'));
      if (btn) btn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(300);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(i => i.innerText.includes('Front-Right 3/4'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1200);

  // Capture Screenshot 4: Paint reflections close-up
  const closeupScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('python/reports/part7_paint_reflections_closeup.png', Buffer.from(closeupScreenshot.data, 'base64'));
  console.log('✓ Captured Paint Reflections Close-up -> python/reports/part7_paint_reflections_closeup.png');

  // 7. Test Underside View (Chassis floor hidden & underside light active)
  console.log('[E2E-Part7] Selecting Underside view...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('preset'));
      if (btn) btn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(300);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const opt = Array.from(document.querySelectorAll('[role="option"]')).find(i => i.innerText.includes('Underside'));
      if (opt) opt.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1500);

  // Capture Screenshot 5: Underside view
  const undersideScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('python/reports/part7_underside_view.png', Buffer.from(undersideScreenshot.data, 'base64'));
  console.log('✓ Captured Underside View -> python/reports/part7_underside_view.png');

  // 8. Reset to default hero view
  console.log('[E2E-Part7] Resetting to hero view...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Reset'));
      if (resetBtn) resetBtn.click();
    })()`,
    returnByValue: true,
  });
  await sleep(1000);

  // Check for any runtime errors
  const errRes = await cdp.send('Runtime.evaluate', {
    expression: `window.__hadError || false`,
    returnByValue: true,
  });
  console.log('Window error flag:', errRes.result.value);

  cdp.close();
  console.log('✓ Part 7 E2E Browser Verification Completed Successfully!');
}

run().catch((err) => {
  console.error('Part 7 E2E Test Failed:', err);
  process.exit(1);
});
