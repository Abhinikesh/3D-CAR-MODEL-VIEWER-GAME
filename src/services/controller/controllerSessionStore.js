import { create } from 'zustand';
import {
  CONTROLLER_STATUS,
  INPUT_SOURCE,
  CONTROLLER_ACTION,
  STALE_INPUT_TIMEOUT_MS,
  HEARTBEAT_TIMEOUT_MS,
} from './controllerTypes.js';
import { validateControllerInput } from './inputValidator.js';
import { useVehicleInputStore } from '../../scenes/driving/vehicleInputStore.js';

/**
 * Controller Session Store — Parts 34–37
 *
 * Central state machine for managing smartphone wireless controller sessions:
 * - Local Wi-Fi network address discovery
 * - Connection lifecycle (DISCONNECTED, READY, CONNECTED, STALE)
 * - Single-active-controller lock (rejects multiple phones taking simultaneous control)
 * - Input validation & arbitration integration
 * - Two-tier timeout watchdog:
 *     1. Stale-input neutralization (> 750ms without input) -> zero throttle/steer safely
 *     2. Heartbeat loss emergency disconnect (> 2000ms) -> disconnect and revert to keyboard
 */
export const useControllerSessionStore = create((set, get) => ({
  status: CONTROLLER_STATUS.DISCONNECTED,
  isPanelOpen: false,

  // Active connected phone session details
  connectedDevice: null, // { id: string, name: string, ip: string, connectedAt: number, lastSeen: number, lastInputTime: number }

  // Local Wi-Fi network discovery info
  localNetwork: {
    ip: '127.0.0.1',
    port: 5173,
    url: 'http://127.0.0.1:5173/controller',
    isReady: false,
    error: null,
  },

  // Telemetry & diagnostics
  stats: {
    packetsReceived: 0,
    packetsRejected: 0,
    lastLatencyMs: 0,
    staleNeutralizations: 0,
  },

  // ─── UI Actions ───
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  // ─── Network Discovery ───
  setLocalNetwork: (networkInfo) => {
    set((s) => ({
      localNetwork: { ...s.localNetwork, ...networkInfo },
      status: s.status === CONTROLLER_STATUS.DISCONNECTED ? CONTROLLER_STATUS.READY : s.status,
    }));
  },

  fetchLocalNetworkInfo: async () => {
    try {
      if (typeof window === 'undefined') return;
      const res = await fetch('/api/controller/status');
      if (res.ok) {
        const data = await res.json();
        set((s) => ({
          localNetwork: {
            ip: data.localIp || window.location.hostname || '127.0.0.1',
            port: data.port || 5173,
            url: data.controllerUrl || `http://${data.localIp || window.location.hostname}:5173/controller`,
            isReady: true,
            error: null,
          },
          status: s.status === CONTROLLER_STATUS.DISCONNECTED ? CONTROLLER_STATUS.READY : s.status,
        }));
      } else {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch (err) {
      // Fallback to window.location if API is unavailable
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname || '127.0.0.1';
        const port = window.location.port || '5173';
        set((s) => ({
          localNetwork: {
            ip: hostname,
            port: Number(port),
            url: `http://${hostname}:${port}/controller`,
            isReady: true,
            error: null,
          },
          status: s.status === CONTROLLER_STATUS.DISCONNECTED ? CONTROLLER_STATUS.READY : s.status,
        }));
      }
    }
  },

  // ─── Connection Lifecycle ───

  /**
   * Pair and connect a smartphone controller.
   * Enforces single-device lock: if another phone is already controlling, rejects new connection.
   */
  connectController: (deviceInfo) => {
    const { status, connectedDevice } = get();

    // Single-controller lock check
    if (status === CONTROLLER_STATUS.CONNECTED && connectedDevice && connectedDevice.id !== deviceInfo.id) {
      return {
        success: false,
        error: 'Another smartphone controller is already connected. Disconnect it first.',
      };
    }

    const now = Date.now();
    const device = {
      id: deviceInfo?.id || `phone-${now.toString(36)}`,
      name: deviceInfo?.name || 'Smartphone Controller',
      ip: deviceInfo?.ip || 'Local Network Client',
      connectedAt: now,
      lastSeen: now,
      lastInputTime: now,
    };

    set({
      status: CONTROLLER_STATUS.CONNECTED,
      connectedDevice: device,
    });

    // Acquire input arbitration: switch active input source to SMARTPHONE
    // Note: setActiveSource zeroes out all inputs to ensure clean handover without stuck controls
    useVehicleInputStore.getState().setActiveSource(INPUT_SOURCE.SMARTPHONE, device.id);

    return { success: true, device };
  },

  /**
   * Safely disconnect the smartphone controller and return control to the desktop keyboard.
   * All continuous controls are neutralized immediately.
   */
  disconnectController: () => {
    set({
      status: CONTROLLER_STATUS.READY,
      connectedDevice: null,
    });

    // Neutralize inputs and return control back to Keyboard
    useVehicleInputStore.getState().neutralizeController(INPUT_SOURCE.SMARTPHONE);
  },

  // ─── Input Ingestion & Validation ───

  /**
   * Ingests, validates, and dispatches an incoming packet from a smartphone controller.
   */
  processIncomingInput: (rawPayload) => {
    const { status, connectedDevice } = get();

    // Reject inputs if no controller is paired
    if (status !== CONTROLLER_STATUS.CONNECTED && status !== CONTROLLER_STATUS.STALE || !connectedDevice) {
      set((s) => ({
        stats: { ...s.stats, packetsRejected: s.stats.packetsRejected + 1 },
      }));
      return { accepted: false, error: 'No smartphone controller is currently paired' };
    }

    // Strict validation
    const validation = validateControllerInput(rawPayload);
    if (!validation.valid) {
      set((s) => ({
        stats: { ...s.stats, packetsRejected: s.stats.packetsRejected + 1 },
      }));
      return { accepted: false, error: validation.error };
    }

    const data = validation.data;
    const now = Date.now();

    // Update heartbeat & latency
    const latency = rawPayload.timestamp ? Math.max(0, now - rawPayload.timestamp) : 0;
    const hasContinuousInput = data.throttle !== undefined || data.brake !== undefined || data.steer !== undefined;

    set((s) => ({
      status: CONTROLLER_STATUS.CONNECTED, // restore CONNECTED from STALE on valid input
      connectedDevice: s.connectedDevice ? {
        ...s.connectedDevice,
        lastSeen: now,
        lastInputTime: hasContinuousInput ? now : (s.connectedDevice.lastInputTime || now),
      } : null,
      stats: {
        packetsReceived: s.stats.packetsReceived + 1,
        packetsRejected: s.stats.packetsRejected,
        lastLatencyMs: latency,
        staleNeutralizations: s.stats.staleNeutralizations,
      },
    }));

    // Dispatch discrete one-time action if present
    if (data.action) {
      useVehicleInputStore.getState().dispatchAction(data.action, INPUT_SOURCE.SMARTPHONE);
    }

    // Apply continuous inputs (throttle, brake, steer, reverse, handbrake)
    if (hasContinuousInput || data.reverse !== undefined || data.handbrake !== undefined) {
      useVehicleInputStore.getState().setInputs(data, INPUT_SOURCE.SMARTPHONE);
    }

    return { accepted: true, data };
  },

  /**
   * Heartbeat Watchdog & Stale-Input Safety Checker.
   * Runs frequently (every 200ms) to guarantee:
   *  1. Stale-input neutralization (> 750ms without fresh input):
   *     Zeros throttle & steer, leaving gentle coasting so vehicle does not run away.
   *  2. Heartbeat loss timeout (> 2000ms without any signal):
   *     Emergency disconnect and handover to keyboard.
   */
  checkHeartbeatTimeout: () => {
    const { status, connectedDevice, disconnectController } = get();
    if ((status === CONTROLLER_STATUS.CONNECTED || status === CONTROLLER_STATUS.STALE) && connectedDevice) {
      const now = Date.now();
      const elapsedSinceSeen = now - (connectedDevice.lastSeen || now);
      const elapsedSinceInput = now - (connectedDevice.lastInputTime || connectedDevice.lastSeen || now);

      // Tier 1: Stale input timeout (> STALE_INPUT_TIMEOUT_MS)
      if (elapsedSinceInput > STALE_INPUT_TIMEOUT_MS && status === CONTROLLER_STATUS.CONNECTED) {
        set((s) => ({
          status: CONTROLLER_STATUS.STALE,
          stats: { ...s.stats, staleNeutralizations: s.stats.staleNeutralizations + 1 },
        }));
        // Neutralize continuous controls safely
        useVehicleInputStore.getState().setInputs({
          throttle: 0.0,
          brake: 0.0,
          steer: 0.0,
        }, INPUT_SOURCE.SMARTPHONE);
      }

      // Tier 2: Hard disconnect timeout (> HEARTBEAT_TIMEOUT_MS)
      if (elapsedSinceSeen > HEARTBEAT_TIMEOUT_MS) {
        disconnectController();
        return true;
      }
    }
    return false;
  },

  /**
   * Full session reset on unmount / mode exit.
   */
  resetSession: () => {
    const { disconnectController } = get();
    disconnectController();
    set({
      isPanelOpen: false,
      status: CONTROLLER_STATUS.DISCONNECTED,
      stats: { packetsReceived: 0, packetsRejected: 0, lastLatencyMs: 0, staleNeutralizations: 0 },
    });
  },
}));

// Expose globally for diagnostics and test harnesses
if (typeof window !== 'undefined') {
  window.__controllerSessionStore = useControllerSessionStore;
}

