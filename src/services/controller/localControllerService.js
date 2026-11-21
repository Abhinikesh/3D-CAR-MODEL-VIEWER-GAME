import { useControllerSessionStore } from './controllerSessionStore.js';
import { CONTROLLER_STATUS } from './controllerTypes.js';

/**
 * Local Controller Service Coordinator — Part 34
 *
 * Manages the background heartbeat watchdog timer and lifecycle hooks
 * for the smartphone wireless controller service.
 */
class LocalControllerService {
  constructor() {
    this.watchdogTimer = null;
    this.isInitialized = false;
  }

  /**
   * Start the controller service: discovers local network IP and starts the watchdog.
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Fetch network discovery info
    useControllerSessionStore.getState().fetchLocalNetworkInfo();

    // Start 200ms heartbeat & stale-input watchdog
    this.watchdogTimer = setInterval(() => {
      useControllerSessionStore.getState().checkHeartbeatTimeout();
    }, 200);
  }

  /**
   * Stop the controller service and cleanly dispose all timers and sessions.
   */
  dispose() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    useControllerSessionStore.getState().resetSession();
    this.isInitialized = false;
  }
}

export const localControllerService = new LocalControllerService();

// Expose globally for testing and diagnostics
if (typeof window !== 'undefined') {
  window.__localControllerService = localControllerService;
}
