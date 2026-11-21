import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWheelAnimationStore } from '../store/wheelAnimationStore.js';
import {
  WHEEL_ANIMATION_CONFIG,
  WHEEL_IDS,
  BASE_SPIN_SPEED_RAD_PER_SEC,
  SPIN_MODES,
} from '../utils/wheelAnimationRegistry.js';

// Scratch Euler and static ID arrays to eliminate allocations in render loop
const _scratchSteerEuler = new THREE.Euler(0, 0, 0, 'ZYX');
const FRONT_WHEEL_IDS = ['wheel_fl', 'wheel_fr'];
const REAR_WHEEL_IDS = ['wheel_rl', 'wheel_rr'];

/**
 * Custom React Three Fiber hook for kinematic wheel rotation and front steering.
 * Operates on verified wheel assemblies within the GLTF scene graph hierarchy.
 *
 * Mechanical Isolation Principles:
 * 1. Steering Yaw:
 *    - Front wheel assemblies (FL, FR) rotate around their vertical steering axis (World Y / Local Z in BodyUnderside).
 *    - All children (rim, tire, brake disc, AND caliper) steer together with the steering knuckle.
 *    - Rear wheel assemblies (RL, RR) remain fixed at 0° steering yaw (rigid rear axle).
 *
 * 2. Axial Wheel Roll:
 *    - Rotating meshes (Rim, Tire, Brake Disc) rotate around their verified local pitch axis (Local X).
 *    - Brake caliper (Mesh_Caliper_*) remains completely stationary relative to the knuckle (0° roll).
 *    - Forward/Reverse direction and variable speed are supported.
 */
export function useWheelAnimation(scene) {
  const resolvedWheelsRef = useRef({});
  const rollAnglesRef = useRef({
    wheel_fl: 0,
    wheel_fr: 0,
    wheel_rl: 0,
    wheel_rr: 0,
  });
  const lastStoreSyncRef = useRef(0);

  // Resolve wheel assemblies and mesh references when scene loads
  useEffect(() => {
    if (!scene) return;

    const resolved = {};

    WHEEL_IDS.forEach((id) => {
      const config = WHEEL_ANIMATION_CONFIG[id];
      const assembly = scene.getObjectByName(config.assemblyNodeName);

      if (assembly) {
        // Collect spinning meshes (Rim, Tire, Brake Disc)
        const spinMeshes = [];
        config.spinMeshNames.forEach((meshName) => {
          const mesh = assembly.getObjectByName(meshName) || scene.getObjectByName(meshName);
          if (mesh) {
            spinMeshes.push({
              node: mesh,
              initialRotation: {
                x: mesh.rotation.x,
                y: mesh.rotation.y,
                z: mesh.rotation.z,
              },
            });
          }
        });

        // Collect stationary caliper mesh
        let caliper = null;
        config.stationaryMeshNames.forEach((caliperName) => {
          const cMesh = assembly.getObjectByName(caliperName) || scene.getObjectByName(caliperName);
          if (cMesh) {
            caliper = {
              node: cMesh,
              initialRotation: {
                x: cMesh.rotation.x,
                y: cMesh.rotation.y,
                z: cMesh.rotation.z,
              },
            };
          }
        });

        resolved[id] = {
          config,
          assembly,
          initialPos: assembly.position.clone(),
          initialQuat: assembly.quaternion.clone(),
          initialEuler: assembly.rotation.clone(),
          spinMeshes,
          caliper,
        };
      }
    });

    resolvedWheelsRef.current = resolved;

    if (typeof window !== 'undefined') {
      window.__wheelAnimationResolved = resolved;
    }

    // Set initial front wheel steering from store
    const storeState = useWheelAnimationStore.getState();
    const steerAngle = storeState.currentSteeringAngle;
    ['wheel_fl', 'wheel_fr'].forEach((frontId) => {
      const wheel = resolved[frontId];
      if (wheel?.assembly) {
        const euler = new THREE.Euler(wheel.config.baseEulerXRad, 0, steerAngle, 'ZYX');
        wheel.assembly.quaternion.setFromEuler(euler);
        wheel.assembly.updateMatrixWorld(true);
      }
    });

    return () => {
      // Restore initial transforms on unmount
      Object.values(resolved).forEach((wheel) => {
        if (wheel.assembly && wheel.initialPos) {
          wheel.assembly.position.copy(wheel.initialPos);
        }
        if (wheel.assembly && wheel.initialQuat) {
          wheel.assembly.quaternion.copy(wheel.initialQuat);
          wheel.assembly.updateMatrixWorld(true);
        }
        wheel.spinMeshes.forEach(({ node, initialRotation }) => {
          if (node && initialRotation) {
            node.rotation.set(initialRotation.x, initialRotation.y, initialRotation.z);
            node.updateMatrix();
          }
        });
        if (wheel.caliper?.node && wheel.caliper.initialRotation) {
          const { node, initialRotation } = wheel.caliper;
          node.rotation.set(initialRotation.x, initialRotation.y, initialRotation.z);
          node.updateMatrix();
        }
      });
    };
  }, [scene]);

  // Per-frame animation tick
  useFrame((_, delta) => {
    const wheels = resolvedWheelsRef.current;
    if (!wheels || Object.keys(wheels).length === 0) return;

    const dt = Math.min(delta, 0.05); // Clamp dt for safety
    const {
      isSpinning,
      spinDirection,
      spinSpeed,
      spinMode,
      activeIndividualWheel,
      currentSteeringAngle,
      targetSteeringAngle,
      steeringSpeed,
      drivingSteerAngles,
      drivingWheelTransforms,
      setCurrentSteeringAngle,
      updateWheelRollAngles,
    } = useWheelAnimationStore.getState();

    // ─── Case 1: Physics-Driven Wheel Dynamics (Driving Mode Active) ───
    if (drivingWheelTransforms) {
      const { rollAngles, steerAngles, suspensionOffsets } = drivingWheelTransforms;

      for (let i = 0; i < WHEEL_IDS.length; i++) {
        const id = WHEEL_IDS[i];
        const wheel = wheels[id];
        if (!wheel?.assembly) continue;

        // 1. Steering Articulation (Front wheels steer via Ackermann; Rear wheels fixed at 0 rad)
        const steerAngle = steerAngles?.[id] ?? 0.0;
        _scratchSteerEuler.set(
          wheel.config.baseEulerXRad,
          0,
          steerAngle,
          'ZYX'
        );
        wheel.assembly.quaternion.setFromEuler(_scratchSteerEuler);

        // 2. Suspension Vertical Deflection (Along vertical Z axis in BodyUnderside frame)
        const suspOffset = suspensionOffsets?.[id] ?? 0.0;
        wheel.assembly.position.z = wheel.initialPos.z + suspOffset;
        wheel.assembly.updateMatrixWorld(true);

        // 3. Physics-Driven Wheel Spin around Local X (Rim, Tire, Brake Disc)
        const rollAngle = rollAngles?.[id] ?? 0.0;
        wheel.spinMeshes.forEach(({ node, initialRotation }) => {
          node.rotation.x = initialRotation.x + rollAngle;
          node.updateMatrix();
        });

        // 4. Brake Caliper Isolation (Stationary relative to the knuckle, 0 axial roll)
        if (wheel.caliper) {
          const { node, initialRotation } = wheel.caliper;
          node.rotation.x = initialRotation.x;
          node.updateMatrix();
        }
      }
      return;
    }

    // ─── Case 2: Showroom Configurator Animation Mode ───
    // Restore nominal assembly position in showroom mode if previously displaced
    for (let i = 0; i < WHEEL_IDS.length; i++) {
      const wheel = wheels[WHEEL_IDS[i]];
      if (wheel?.assembly && wheel.assembly.position.z !== wheel.initialPos.z) {
        wheel.assembly.position.z = wheel.initialPos.z;
        wheel.assembly.updateMatrixWorld(true);
      }
    }

    // ─── 1. Front-Wheel Steering Articulation ───
    let effectiveSteerAngle = currentSteeringAngle;

    if (!drivingSteerAngles) {
      const angleDiff = targetSteeringAngle - currentSteeringAngle;
      if (Math.abs(angleDiff) > 0.0001) {
        // Smooth exponential damping towards target steering angle
        effectiveSteerAngle = THREE.MathUtils.damp(
          currentSteeringAngle,
          targetSteeringAngle,
          steeringSpeed,
          dt
        );

        // Snap if close enough
        if (Math.abs(targetSteeringAngle - effectiveSteerAngle) < 0.0005) {
          effectiveSteerAngle = targetSteeringAngle;
        }

        setCurrentSteeringAngle(effectiveSteerAngle);
      }
    }

    // Apply steering to front wheel assemblies without heap allocations
    for (let i = 0; i < FRONT_WHEEL_IDS.length; i++) {
      const frontId = FRONT_WHEEL_IDS[i];
      const wheel = wheels[frontId];
      if (wheel?.assembly) {
        const wheelAngle = drivingSteerAngles?.[frontId] ?? effectiveSteerAngle;
        _scratchSteerEuler.set(
          wheel.config.baseEulerXRad,
          0,
          wheelAngle,
          'ZYX'
        );
        wheel.assembly.quaternion.setFromEuler(_scratchSteerEuler);
        wheel.assembly.updateMatrixWorld(true);
      }
    }

    // ─── 2. Axial Wheel Roll (Spin) ───
    if (isSpinning) {
      const deltaRoll = spinDirection * spinSpeed * BASE_SPIN_SPEED_RAD_PER_SEC * dt;

      // Determine which wheels are actively rolling
      let activeIds;
      if (spinMode === SPIN_MODES.ALL) {
        activeIds = WHEEL_IDS;
      } else if (spinMode === SPIN_MODES.FRONT) {
        activeIds = FRONT_WHEEL_IDS;
      } else if (spinMode === SPIN_MODES.REAR) {
        activeIds = REAR_WHEEL_IDS;
      } else {
        activeIds = [activeIndividualWheel];
      }

      activeIds.forEach((id) => {
        const wheel = wheels[id];
        if (!wheel) return;

        // Accumulate roll angle
        rollAnglesRef.current[id] = (rollAnglesRef.current[id] || 0) + deltaRoll;
        const currentRoll = rollAnglesRef.current[id];

        // Rotate only spinning meshes (Rim, Tire, Brake Disc) around Local X
        wheel.spinMeshes.forEach(({ node, initialRotation }) => {
          node.rotation.x = initialRotation.x + currentRoll;
          node.updateMatrix();
        });

        // Ensure caliper remains completely stationary relative to the knuckle
        if (wheel.caliper) {
          const { node, initialRotation } = wheel.caliper;
          node.rotation.x = initialRotation.x;
          node.updateMatrix();
        }
      });

      // Throttled store sync (~15fps) for roll angles telemetry
      const now = performance.now();
      if (now - lastStoreSyncRef.current > 66) {
        lastStoreSyncRef.current = now;
        updateWheelRollAngles({ ...rollAnglesRef.current });
      }
    } else {
      // If not spinning, check if reset happened
      const storeRollAngles = useWheelAnimationStore.getState().wheelRollAngles;
      let needsReset = false;
      for (const id of WHEEL_IDS) {
        if (storeRollAngles[id] === 0 && rollAnglesRef.current[id] !== 0) {
          needsReset = true;
          break;
        }
      }

      if (needsReset) {
        rollAnglesRef.current = { wheel_fl: 0, wheel_fr: 0, wheel_rl: 0, wheel_rr: 0 };
        // Apply 0 roll to all spinning meshes
        WHEEL_IDS.forEach((id) => {
          const wheel = wheels[id];
          if (!wheel) return;
          wheel.spinMeshes.forEach(({ node, initialRotation }) => {
            node.rotation.x = initialRotation.x;
            node.updateMatrix();
          });
        });
      }
    }
  });

  return null;
}
