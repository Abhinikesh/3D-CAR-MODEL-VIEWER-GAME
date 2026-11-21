import { spawn } from 'child_process';
import http from 'http';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log('--- CLEAN BROWSER AUDIT ---');

async function ensureChrome() {
  try {
    const res = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9222/json', (r) => resolve(r.statusCode)).on('error', reject);
    });
    if (res === 200) {
      console.log('✓ Found existing Chrome instance listening on port 9222.');
      return null;
    }
  } catch (_) {}

  console.log('Launching Headless Chrome on port 9222...');
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--user-data-dir=/tmp/chrome_clean_audit',
      '--use-gl=angle',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--no-first-run',
      '--no-default-browser-check',
      'http://localhost:5173',
    ],
    { stdio: 'ignore' }
  );

  await sleep(2500);
  return chromeProcess;
}

async function getPageWsUrl(maxRetries = 15, retryDelay = 600) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const wsUrl = await new Promise((resolve, reject) => {
        http
          .get('http://127.0.0.1:9222/json', (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => {
              try {
                const tabs = JSON.parse(body);
                const page =
                  tabs.find((t) => t.type === 'page' && t.url.includes('5173')) ||
                  tabs.find((t) => t.type === 'page');
                if (page && page.webSocketDebuggerUrl) {
                  resolve(page.webSocketDebuggerUrl);
                } else {
                  reject(new Error('No page WebSocket URL found'));
                }
              } catch (e) {
                reject(e);
              }
            });
          })
          .on('error', reject);
      });
      return wsUrl;
    } catch (_) {
      await sleep(retryDelay);
    }
  }
  throw new Error('Could not connect to Chrome on 127.0.0.1:9222');
}

async function run() {
  const chromeProc = await ensureChrome();
  const wsUrl = await getPageWsUrl();
  console.log('Connected to Chrome DevTools CDP session.');

  const ws = new WebSocket(wsUrl);
  const errors = [];
  const warnings = [];
  const httpFailures = [];

  await new Promise((resolve) => {
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Page.enable' }));
      resolve();
    };
  });

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Network.responseReceived') {
      const resp = msg.params.response;
      if (resp.status >= 400) {
        httpFailures.push({ status: resp.status, url: resp.url });
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(JSON.stringify(msg.params.exceptionDetails));
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => (a.value !== undefined ? a.value : JSON.stringify(a))).join(' ');
      if (msg.params.type === 'error') {
        errors.push(text);
      } else if (msg.params.type === 'warning') {
        warnings.push(text);
      }
    }
  };

  console.log('Monitoring browser console and network for 6 seconds...');
  await sleep(6000);

  ws.close();
  if (chromeProc) {
    chromeProc.kill();
  }

  console.log('\n--- AUDIT RESULTS ---');
  console.log(`HTTP 4xx/5xx Errors: ${httpFailures.length}`);
  httpFailures.forEach((f) => console.log(`  [HTTP ${f.status}] ${f.url}`));

  console.log(`Console Errors: ${errors.length}`);
  errors.forEach((e) => console.log(`  [ERROR] ${e}`));

  console.log(`Console Warnings: ${warnings.length}`);
  warnings.forEach((w) => console.log(`  [WARN] ${w}`));

  if (httpFailures.length === 0 && errors.length === 0) {
    console.log('\n✅ BROWSER AUDIT PASSED: 0 HTTP errors, 0 Console errors.');
    process.exit(0);
  } else {
    console.error('\n❌ BROWSER AUDIT FAILED: Errors or 404s detected.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error running audit:', err);
  process.exit(1);
});
