import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVehicleRigStore } from '../store/vehicleRigStore.js';
import {
  CLOSURE_RIG_CONFIG,
  CLOSURE_IDS,
  easeInOutCubic,
} from '../utils/vehicleRigRegistry.js';

/**
 * Custom React Three Fiber hook for kinematic vehicle closure animations.
 * Operates on verified pivot nodes within the GLTF scene graph hierarchy.
 *
 * Kinematics Rules:
 * 1. Pivot rotation is driven around local hinge axes.
 * 2. Original local rotation values are recorded on mount and never overwritten.
 * 3. Cubic ease-in-out interpolation ensures smooth, non-linear acceleration/deceleration.
 * 4. Mid-flight reversal is supported seamlessly without angular jumps.
 */
export function useVehicleRig(scene) {
  // References to the actual Three.js Object3D pivot nodes in the scene
  const pivotNodesRef = useRef({});
  // Store initial local rotations to guarantee exact restoration
  const initialRotationsRef = useRef({});

  // Resolve pivot nodes when scene changes
  useEffect(() => {
    if (!scene) return;

    const resolved = {};
    const initials = {};

    scene.traverse((node) => {
      for (const id of CLOSURE_IDS) {
        const config = CLOSURE_RIG_CONFIG[id];
        if (node.name === config.pivotNodeName) {
          resolved[id] = node;
          initials[id] = {
            x: node.rotation.x,
            y: node.rotation.y,
            z: node.rotation.z,
          };
        }
      }
    });

    pivotNodesRef.current = resolved;
    initialRotationsRef.current = initials;

    if (typeof window !== 'undefined') {
      window.__vehicleRigPivots = resolved;
      window.__vehicleRigInitials = initials;
    }

    // Reset store to closed state on scene mount
    useVehicleRigStore.getState().resetAll();

    return () => {
      // Restore initial rotations on unmount
      for (const [id, node] of Object.entries(resolved)) {
        const init = initials[id];
        if (node && init) {
          node.rotation.set(init.x, init.y, init.z);
          node.updateMatrixWorld(true);
        }
      }
    };
  }, [scene]);

  // Per-frame animation tick
  useFrame((_, delta) => {
    const pivots = pivotNodesRef.current;
    const initials = initialRotationsRef.current;
    if (!pivots || Object.keys(pivots).length === 0) return;

    const { closures, animationSpeed, updateProgress, setAnyAnimating } =
      useVehicleRigStore.getState();

    let hasActiveMovement = false;

    // Safe clamped delta time (max 50ms to prevent huge jumps on tab switch)
    const dt = Math.min(delta, 0.05);

    for (const id of CLOSURE_IDS) {
      const config = CLOSURE_RIG_CONFIG[id];
      const data = closures[id];
      const pivot = pivots[id];
      const initialRot = initials[id];

      if (!config || !data || !pivot || !initialRot) continue;

      const { currentProgress, targetProgress } = data;

      if (currentProgress !== targetProgress) {
        hasActiveMovement = true;

        // Calculate progress delta based on configured duration and speed
        const durationSec = (config.durationMs / 1000) / animationSpeed;
        const step = dt / Math.max(0.1, durationSec);

        let nextProgress;
        if (targetProgress > currentProgress) {
          nextProgress = Math.min(targetProgress, currentProgress + step);
        } else {
          nextProgress = Math.max(targetProgress, currentProgress - step);
        }

        // Apply cubic ease-in-out easing
        const eased = easeInOutCubic(nextProgress);
        const targetAngle = initialRot[config.axis] + eased * config.openAngleRad;

        // Update Three.js local rotation on verified hinge axis
        pivot.rotation[config.axis] = targetAngle;
        pivot.updateMatrixWorld(true);

        // Update store state
        updateProgress(id, nextProgress);
      }
    }

    if (!hasActiveMovement && useVehicleRigStore.getState().isAnyAnimating) {
      setAnyAnimating(false);
    }
  });

  return {
    pivotNodes: pivotNodesRef.current,
  };
}
