import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVehicleInputStore, VEHICLE_GEAR, INPUT_SOURCE } from './vehicleInputStore.js';
import { useVehiclePhysicsStore } from '../../store/vehiclePhysicsStore.js';
import { useAppModeStore } from '../../store/appModeStore.js';
import { VEHICLE_PHYSICS_CONFIG } from './vehiclePhysicsConfig.js';

/**
 * Keyboard Vehicle Input Controller  — Part 33 (Enhanced)
 *
 * Bridges physical keyboard events (WASD / Arrow Keys / Spacebar) to the abstracted
 * vehicleInputStore. Incorporates standard automotive pedal ergonomics:
 *
 * Continuous keys (held):
 *   W / ↑       — Accelerate forward
 *   S / ↓       — Brake (when moving forward) | Reverse (when stationary/reversing)
 *   A / ←       — Steer left  (steer = -1.0)
 *   D / →       — Steer right (steer = +1.0)
 *   Space       — Handbrake / emergency brake
 *   G           — Toggle explicit reverse intent (held = reverse mode)
 *
 * One-shot keys (fire once per press, repeat-safe):
 *   R           — Reset / recover vehicle
 *   C           — Cycle driving camera view
 *   P / Escape  — Toggle simulation pause / resume
 *
 * This component must remain the ONLY keyboard listener injecting into vehicleInputStore.
 * Do not add a second independent physics input system.
 */
export default function KeyboardVehicleInput() {
  // ─── Ref-based key state (avoids React re-renders per frame) ─────────────
  const keysDownRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
    reverseIntent: false, // G key — explicit reverse mode toggle
  });

  // Track whether we last emitted active inputs so we can zero the store once on release
  const wasActiveRef = useRef(false);

  // ─── Store selectors ──────────────────────────────────────────────────────
  const setInputs  = useVehicleInputStore((s) => s.setInputs);
  const resetInputs = useVehicleInputStore((s) => s.resetInputs);

  // ─── Keyboard event handlers ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore keystrokes when focused in text inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // ── Continuous / held keys ──
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        keysDownRef.current.forward = true;
        return;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        keysDownRef.current.backward = true;
        return;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        keysDownRef.current.left = true;
        return;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        keysDownRef.current.right = true;
        return;
      }
      if (e.code === 'Space') {
        keysDownRef.current.handbrake = true;
        e.preventDefault(); // Prevent page scroll
        return;
      }
      if (e.code === 'KeyG') {
        // Toggle explicit reverse intent while G is held
        keysDownRef.current.reverseIntent = true;
        return;
      }

      // ── One-shot keys: guard against key-repeat firing ──
      if (e.repeat) return;

      if (e.code === 'KeyR') {
        // Vehicle reset / recovery (Part 30)
        useVehiclePhysicsStore.getState().requestReset?.();
        return;
      }
      if (e.code === 'KeyC') {
        // Cycle driving camera view (Part 31)
        useAppModeStore.getState().cycleDrivingView?.();
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        // Simulation pause / resume toggle (Part 32)
        useVehiclePhysicsStore.getState().togglePause?.();
        return;
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        keysDownRef.current.forward = false;
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        keysDownRef.current.backward = false;
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        keysDownRef.current.left = false;
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        keysDownRef.current.right = false;
      } else if (e.code === 'Space') {
        keysDownRef.current.handbrake = false;
      } else if (e.code === 'KeyG') {
        keysDownRef.current.reverseIntent = false;
      }
    };

    const handleWindowBlur = () => {
      // Clear all active keys to avoid stuck inputs when window loses focus
      const keys = keysDownRef.current;
      keys.forward       = false;
      keys.backward      = false;
      keys.left          = false;
      keys.right         = false;
      keys.handbrake     = false;
      keys.reverseIntent = false;
      wasActiveRef.current = false;
      resetInputs();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',   handleKeyUp);
    window.addEventListener('blur',    handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',   handleKeyUp);
      window.removeEventListener('blur',    handleWindowBlur);
      // Zero all inputs when this component unmounts (e.g. mode switch to Showroom)
      resetInputs();
    };
  }, [resetInputs]);

  // ─── Per-frame input injection ────────────────────────────────────────────
  useFrame(() => {
    // 1. Source Arbitration Guard: if smartphone controller is actively driving,
    // lock out desktop driving keys to avoid conflicting dual inputs
    const activeSource = useVehicleInputStore.getState().activeSource;
    if (activeSource !== INPUT_SOURCE.KEYBOARD) {
      if (wasActiveRef.current) {
        wasActiveRef.current = false;
      }
      return;
    }

    // 2. Pause guard: freeze simulation input when paused
    if (useVehiclePhysicsStore.getState().isPaused) {
      if (wasActiveRef.current) {
        resetInputs();
        wasActiveRef.current = false;
      }
      return;
    }

    const keys = keysDownRef.current;
    const { forward, backward, left, right, handbrake, reverseIntent } = keys;
    const hasActiveKey = forward || backward || left || right || handbrake || reverseIntent;

    // If no keys and store was already zeroed, skip to avoid unnecessary store writes
    if (!hasActiveKey && !wasActiveRef.current) {
      return;
    }

    wasActiveRef.current = hasActiveKey;

    // Current longitudinal speed from physics store (m/s, positive = forward)
    const currentSpeed   = useVehiclePhysicsStore.getState().chassis?.linearVelocity?.[2] ?? 0;
    const revThreshold   = VEHICLE_PHYSICS_CONFIG.drivetrain.reverseEngagementThreshold; // 0.35 m/s

    let throttle = 0.0;
    let brake    = 0.0;
    let gear     = VEHICLE_GEAR.DRIVE;

    // ── Priority order: handbrake → dual-pedal conflict → throttle/brake logic ──
    if (handbrake) {
      throttle = 0.0;
      brake    = 1.0;
      gear     = currentSpeed < -0.1 ? VEHICLE_GEAR.REVERSE : VEHICLE_GEAR.DRIVE;

    } else if (forward && backward) {
      // Both pedals simultaneously → brake wins (safety)
      throttle = 0.0;
      brake    = 1.0;
      gear     = currentSpeed < -0.1 ? VEHICLE_GEAR.REVERSE : VEHICLE_GEAR.DRIVE;

    } else if (reverseIntent && !forward) {
      // G held without W → explicit reverse engagement
      if (currentSpeed > revThreshold) {
        // Still moving forward → brake first
        throttle = 0.0;
        brake    = 1.0;
        gear     = VEHICLE_GEAR.DRIVE;
      } else {
        // Stopped or already reversing → engage reverse
        throttle = backward ? 1.0 : 0.0; // S while G held gives throttle in reverse
        brake    = 0.0;
        gear     = VEHICLE_GEAR.REVERSE;
      }

    } else if (forward) {
      if (currentSpeed < -revThreshold) {
        // Moving in reverse → W acts as a brake until stopped
        throttle = 0.0;
        brake    = 1.0;
        gear     = VEHICLE_GEAR.REVERSE;
      } else {
        // Normal forward acceleration
        throttle = 1.0;
        brake    = 0.0;
        gear     = VEHICLE_GEAR.DRIVE;
      }

    } else if (backward) {
      if (currentSpeed > revThreshold) {
        // Moving forward → S acts as a brake until stopped
        throttle = 0.0;
        brake    = 1.0;
        gear     = VEHICLE_GEAR.DRIVE;
      } else {
        // Stationary or reversing → engage REVERSE and accelerate backward
        throttle = 1.0;
        brake    = 0.0;
        gear     = VEHICLE_GEAR.REVERSE;
      }

    } else {
      // No pedals → coast under rolling resistance
      throttle = 0.0;
      brake    = 0.0;
      gear     = currentSpeed < -0.1 ? VEHICLE_GEAR.REVERSE : VEHICLE_GEAR.DRIVE;
    }

    // Steering: -1.0 = full LEFT, +1.0 = full RIGHT
    let steer = 0.0;
    if (left && !right) steer = -1.0;
    else if (right && !left) steer = 1.0;

    setInputs({ throttle, brake, steer, handbrake, gear }, INPUT_SOURCE.KEYBOARD);
  });

  return null;
}
