/**
 * useControllerWebSocket — Parts 35–37
 *
 * React hook that bridges the Vite HMR custom event channel with the
 * controller session store and vehicle input system.
 *
 * The Vite plugin emits custom HMR events:
 *   - 'controller:paired'       → phone successfully authenticated
 *   - 'controller:input'        → driving input packet from phone
 *   - 'controller:disconnected' → phone WebSocket closed
 *   - 'controller:heartbeat'    → keep-alive tick from phone
 *
 * In reverse, this module provides `sendControllerTelemetry` to forward
 * live simulation metrics (speed, gear) to the connected smartphone.
 */

import { useEffect, useRef } from 'react';
import { useControllerSessionStore } from './controllerSessionStore.js';

/**
 * Send real-time vehicle telemetry (speed, gear) back to the connected phone.
 */
export function sendControllerTelemetry(telemetry) {
  if (typeof import.meta !== 'undefined' && import.meta.hot) {
    import.meta.hot.send('controller:telemetry', telemetry);
  }
}

/**
 * @returns {{ isListening: boolean }}
 */
export function useControllerWebSocket() {
  const connectController    = useControllerSessionStore((s) => s.connectController);
  const disconnectController = useControllerSessionStore((s) => s.disconnectController);
  const processIncomingInput = useControllerSessionStore((s) => s.processIncomingInput);

  const isListeningRef = useRef(false);

  useEffect(() => {
    // Guard: Vite HMR is only available in development via import.meta.hot
    if (typeof import.meta === 'undefined' || !import.meta.hot) {
      return;
    }

    isListeningRef.current = true;

    /**
     * controller:paired
     * Payload: { sessionId: string, deviceInfo: { id, name, ip } }
     */
    const onPaired = (data) => {
      if (!data || !data.deviceInfo) return;
      connectController(data.deviceInfo);
    };

    /**
     * controller:input
     * Payload: normalized input packet (throttle, brake, steer, handbrake, action, timestamp)
     */
    const onInput = (data) => {
      if (!data) return;
      processIncomingInput(data);
    };

    /**
     * controller:disconnected
     * Payload: { sessionId: string }
     */
    const onDisconnected = (_data) => {
      disconnectController();
    };

    /**
     * controller:heartbeat
     * Payload: { sessionId: string, timestamp: number }
     * The session store's processIncomingInput already updates lastSeen on
     * any packet, so we can route heartbeats through the same path.
     */
    const onHeartbeat = (data) => {
      if (!data) return;
      processIncomingInput({ timestamp: data.timestamp });
    };

    import.meta.hot.on('controller:paired',       onPaired);
    import.meta.hot.on('controller:input',        onInput);
    import.meta.hot.on('controller:disconnected', onDisconnected);
    import.meta.hot.on('controller:heartbeat',    onHeartbeat);

    return () => {
      isListeningRef.current = false;
      if (typeof import.meta.hot.off === 'function') {
        import.meta.hot.off('controller:paired', onPaired);
        import.meta.hot.off('controller:input', onInput);
        import.meta.hot.off('controller:disconnected', onDisconnected);
        import.meta.hot.off('controller:heartbeat', onHeartbeat);
      }
    };
  }, [connectController, disconnectController, processIncomingInput]);

  return { isListening: isListeningRef.current };
}
