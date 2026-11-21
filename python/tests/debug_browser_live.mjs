import { spawn } from 'child_process';
import http from 'http';

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=/tmp/chrome_diag',
  '--no-first-run',
  '--no-default-browser-check',
  'http://localhost:5173/'
]);

await new Promise(r => setTimeout(r, 2000));

http.get('http://127.0.0.1:9222/json', (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', async () => {
    const tabs = JSON.parse(body);
    const page = tabs.find(t => t.type === 'page' && t.url.includes('5173')) || tabs[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({id: 1, method: 'Runtime.enable'}));
      ws.send(JSON.stringify({id: 2, method: 'Network.enable'}));
      ws.send(JSON.stringify({id: 3, method: 'Page.enable'}));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Network.responseReceived') {
        const resp = msg.params.response;
        if (resp.status >= 400) {
          console.error(`[HTTP ${resp.status}]: ${resp.url}`);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Exception]:', JSON.stringify(msg.params.exceptionDetails));
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        if (msg.params.type === 'error') {
          console.error('[Console error]:', text);
        }
      }
    };
    setTimeout(() => {
      ws.close();
      chrome.kill();
      process.exit(0);
    }, 4500);
  });
});
