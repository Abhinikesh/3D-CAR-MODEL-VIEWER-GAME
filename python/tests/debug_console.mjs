import http from 'http';

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
  const wsUrl = await getWsEndpoint();
  const ws = new WebSocket(wsUrl);

  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log(`[Console ${msg.params.type}]`, ...msg.params.args.map(a => a.value || a.description));
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  await send('Runtime.enable');
  await send('Log.enable');

  const evalResult = await send('Runtime.evaluate', {
    expression: `(() => {
      // Check if there is an error on window
      return {
        url: window.location.href,
        errors: window.__errors || [],
      };
    })()`,
    returnByValue: true,
  });

  console.log('Eval result:', evalResult);

  // Switch to drive and check for errors
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const driveBtn = btns.find(b => b.textContent && b.textContent.includes('DRIVE'));
      if (driveBtn) driveBtn.click();
    })()`,
  });

  await new Promise(r => setTimeout(r, 1000));

  ws.close();
}

run().catch(console.error);
