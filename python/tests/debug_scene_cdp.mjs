import http from 'http';

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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  const wsUrl = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const tabs = JSON.parse(body);
        const page = tabs.find(t => t.type === 'page' && t.url.includes('localhost:5173')) || tabs[0];
        resolve(page.webSocketDebuggerUrl);
      });
    }).on('error', reject);
  });

  const cdp = new CDPClient(wsUrl);
  await cdp.connect();

  const sceneInfo = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const assetMod = await import('/src/utils/carAssetRegistry.js');
        const camMod = await import('/src/store/cameraStore.js');
        const scene = window.__THREE_SCENE__;
        const renderer = window.__THREE_RENDERER__;
        if (!scene) return { error: 'No __THREE_SCENE__' };

        // Find car root
        let carRoot = null;
        scene.traverse((obj) => {
          if (obj.name === 'CarInteractiveRoot') carRoot = obj;
        });

        // Compute geometry bounds
        let carBounds = null;
        if (carRoot) {
          const graphData = assetMod.indexCarScene(carRoot);
          carBounds = graphData?.metrics?.bounds;
        }

        // Camera Store State
        const camState = camMod.useCameraStore.getState();

        // Floor Mesh
        const floors = [];
        scene.traverse((obj) => {
          if (obj.isMesh && (obj.geometry?.type === 'CircleGeometry' || obj.name?.toLowerCase().includes('floor'))) {
            floors.push({
              name: obj.name,
              position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
              rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
            });
          }
        });

        return {
          carBounds,
          cameraStore: {
            target: camState.target,
            activePreset: camState.activePreset,
            bounds: camState.bounds,
          },
          floors,
        };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });

  console.log('Scene Debug Info:\n', JSON.stringify(sceneInfo.result.value, null, 2));
  cdp.close();
}

run().catch(console.error);
