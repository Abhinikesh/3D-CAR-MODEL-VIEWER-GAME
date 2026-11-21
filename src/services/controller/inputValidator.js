import { CONTROLLER_ACTION, CONTROLLER_PROTOCOL_VERSION } from './controllerTypes.js';

/**
 * Controller Input Validator & Sanitizer — Parts 34–37
 *
 * Enforces strict validation on all incoming controller payloads before they are
 * dispatched into the vehicle physics input system:
 * - Protocol version validation (supports v1 or unversioned backward compatibility)
 * - Clamps continuous inputs to valid mathematical ranges
 * - Rejects malformed or malicious data
 * - Enforces boolean typing on flags
 * - Separates continuous inputs from one-time discrete actions
 * - Rejects unknown actions and non-finite numeric inputs
 */
export function validateControllerInput(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be a non-null object' };
  }

  // Protocol version check (if present, must match supported version)
  if (payload.v !== undefined && payload.v !== null) {
    const version = Number(payload.v);
    if (version !== CONTROLLER_PROTOCOL_VERSION) {
      return { valid: false, error: `Unsupported protocol version: ${payload.v}` };
    }
  }

  const sanitized = {};

  // 1. Throttle: continuous float in [0.0, 1.0]
  if (payload.throttle !== undefined) {
    const val = Number(payload.throttle);
    if (!Number.isFinite(val)) {
      return { valid: false, error: 'Throttle must be a finite number' };
    }
    sanitized.throttle = Math.max(0.0, Math.min(1.0, val));
  }

  // 2. Brake: continuous float in [0.0, 1.0]
  if (payload.brake !== undefined) {
    const val = Number(payload.brake);
    if (!Number.isFinite(val)) {
      return { valid: false, error: 'Brake must be a finite number' };
    }
    sanitized.brake = Math.max(0.0, Math.min(1.0, val));
  }

  // 3. Steering: continuous float in [-1.0, 1.0] (supports 'steering' or 'steer')
  const steerRaw = payload.steering !== undefined ? payload.steering : payload.steer;
  if (steerRaw !== undefined) {
    const val = Number(steerRaw);
    if (!Number.isFinite(val)) {
      return { valid: false, error: 'Steering must be a finite number' };
    }
    sanitized.steer = Math.max(-1.0, Math.min(1.0, val));
  }

  // 4. Reverse: boolean flag
  if (payload.reverse !== undefined) {
    sanitized.reverse = Boolean(payload.reverse);
  }

  // 5. Handbrake: boolean flag
  if (payload.handbrake !== undefined) {
    sanitized.handbrake = Boolean(payload.handbrake);
  }

  // 6. Discrete One-Time Action: strictly validated against known actions
  if (payload.action !== undefined) {
    if (typeof payload.action !== 'string') {
      return { valid: false, error: 'Action must be a string' };
    }
    const normalizedAction = payload.action.trim().toLowerCase();
    const validActions = Object.values(CONTROLLER_ACTION);
    if (!validActions.includes(normalizedAction)) {
      return { valid: false, error: `Invalid action: ${payload.action}` };
    }
    sanitized.action = normalizedAction;
  }

  return { valid: true, data: sanitized };
}

