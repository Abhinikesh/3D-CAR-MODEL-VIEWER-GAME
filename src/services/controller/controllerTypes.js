/**
 * Controller Types & Constants — Parts 34–37
 *
 * Defines the unified input sources, connection states, discrete actions,
 * protocol version, and safety timing thresholds for the smartphone wireless controller architecture.
 */

export const INPUT_SOURCE = {
  KEYBOARD: 'keyboard',
  SMARTPHONE: 'smartphone',
  GAMEPAD: 'gamepad',
};

export const CONTROLLER_STATUS = {
  DISCONNECTED: 'disconnected',
  READY: 'ready',
  PAIRING: 'pairing',
  CONNECTED: 'connected',
  STALE: 'stale',
};

export const CONTROLLER_ACTION = {
  CAMERA: 'camera',
  RESET: 'reset',
  PAUSE: 'pause',
};

// Protocol & Safety Thresholds — Part 37
export const CONTROLLER_PROTOCOL_VERSION = 1;
export const STALE_INPUT_TIMEOUT_MS = 750;     // Neutralize continuous controls if no update in 750ms
export const HEARTBEAT_TIMEOUT_MS = 2000;      // Hard disconnect and revert to keyboard after 2000ms
export const MAX_PAYLOAD_BYTES = 2048;         // Maximum allowed WebSocket frame size
export const RATE_LIMIT_MAX_PACKETS = 60;      // Maximum allowed packets per second per controller

