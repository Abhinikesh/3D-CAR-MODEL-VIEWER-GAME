import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppModeStore, DRIVING_VIEWS } from '../../store/appModeStore.js';
import { useVehiclePhysicsStore } from '../../store/vehiclePhysicsStore.js';
import { DRIVING_CAMERA_CONFIG, DRIVING_CAMERA_MODES } from './drivingCameraConfig.js';
import {
  computeIdealCameraTransform,
  dampCameraTransform,
  computeOrbitSpringBack,
  clampOrbitAngles,
} from './drivingCameraUtils.js';

/**
 * DrivingCamera Component
 * Part 31: Third-Person Driving Camera and Follow System
 *
 * Implements a high-precision, frame-rate independent automotive camera system:
 * - Dynamic chase cameras (CHASE, CLOSE, WIDE) that orient with the vehicle's heading and speed.
 * - Dynamic speed-aware pull-back, height lift, and subtle FOV expansion.
 * - Driver cockpit perspectives (BONNET/HOOD and FRONT BUMPER).
 * - Trackside spectator cameras (AERIAL, TURN 1, HAIRPIN).
 * - Full 360° vehicle inspection orbit (ORBIT mode with Drei OrbitControls).
 * - Limited mouse glance / orbit with automatic spring-back centering.
 * - Instant, glitch-free recovery on vehicle reset (zero stale target or snap delay).
 */
export default function DrivingCamera({ targetObjectRef }) {
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const gl = useThree((state) => state.gl);

  const drivingView = useAppModeStore((state) => state.drivingView);
  const setDrivingView = useAppModeStore((state) => state.setDrivingView);
  const cycleDrivingView = useAppModeStore((state) => state.cycleDrivingView);
  const cameraResetTrigger = useAppModeStore((state) => state.cameraResetTrigger);

  // Filtered/damped camera transform state
  const currentPosRef = useRef(new THREE.Vector3(0, 2.15, -5.6));
  const currentTargetRef = useRef(new THREE.Vector3(0, 0.90, 2.5));
  const currentFovRef = useRef(46.0);

  // User glance/orbit angle state (radians)
  const orbitAnglesRef = useRef({ azimuth: 0, polar: 0 });
  const isDraggingPointerRef = useRef(false);
  const lastPointerPosRef = useRef({ x: 0, y: 0 });

  // State synchronization flags
  const isFirstFrameRef = useRef(true);
  const lastResetCountRef = useRef(0);
  const lastCameraResetTriggerRef = useRef(0);
  const prevViewRef = useRef(drivingView);

  // Scratch instances to avoid allocations
  const _zeroPos = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const _identityQuat = useMemo(() => new THREE.Quaternion(), []);

  // 1. Keyboard shortcut listener for camera mode switching & cycling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'KeyC') {
        cycleDrivingView();
      } else if (e.key === '1') {
        setDrivingView(DRIVING_VIEWS.CHASE);
      } else if (e.key === '2') {
        setDrivingView(DRIVING_VIEWS.CLOSE);
      } else if (e.key === '3') {
        setDrivingView(DRIVING_VIEWS.WIDE);
      } else if (e.key === '4') {
        setDrivingView(DRIVING_VIEWS.HOOD);
      } else if (e.key === '5') {
        setDrivingView(DRIVING_VIEWS.BUMPER);
      } else if (e.key === '6') {
        setDrivingView(DRIVING_VIEWS.ORBIT);
      } else if (e.key === '7') {
        setDrivingView(DRIVING_VIEWS.AERIAL);
      } else if (e.key === '8') {
        setDrivingView(DRIVING_VIEWS.TURN1);
      } else if (e.key === '9') {
        setDrivingView(DRIVING_VIEWS.HAIRPIN);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setDrivingView, cycleDrivingView]);

  // 2. Mouse / pointer drag listener for limited glance in chase modes
  useEffect(() => {
    const domElement = gl?.domElement;
    if (!domElement) return;

    const handlePointerDown = (e) => {
      // Only handle drag when NOT in orbit mode (orbit mode uses OrbitControls)
      if (useAppModeStore.getState().drivingView === DRIVING_VIEWS.ORBIT) return;
      isDraggingPointerRef.current = true;
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e) => {
      if (!isDraggingPointerRef.current) return;
      if (useAppModeStore.getState().drivingView === DRIVING_VIEWS.ORBIT) return;

      const deltaX = e.clientX - lastPointerPosRef.current.x;
      const deltaY = e.clientY - lastPointerPosRef.current.y;
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

      const mode = useAppModeStore.getState().drivingView;
      const modeCfg = DRIVING_CAMERA_CONFIG.modes[mode] || DRIVING_CAMERA_CONFIG.modes.chase;
      if (!modeCfg.allowOrbit) return;

      const sensitivity = 0.005;
      const newAzimuth = orbitAnglesRef.current.azimuth - deltaX * sensitivity;
      const newPolar = orbitAnglesRef.current.polar - deltaY * sensitivity;

      orbitAnglesRef.current = clampOrbitAngles(
        newAzimuth,
        newPolar,
        modeCfg.maxOrbitAzimuth || (80 * Math.PI) / 180,
        modeCfg.maxOrbitPolar || (25 * Math.PI) / 180
      );
    };

    const handlePointerUp = () => {
      isDraggingPointerRef.current = false;
    };

    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [gl]);

  // 3. Render frame camera update loop (independent of framerate)
  useFrame((_, delta) => {
    const camera = cameraRef.current;
    if (!camera) return;

    const vehicleObj = targetObjectRef?.current;
    const vehiclePos = vehicleObj?.position || _zeroPos;
    const vehicleQuat = vehicleObj?.quaternion || _identityQuat;

    // Read vehicle telemetry for dynamic speed scaling
    const physicsStore = useVehiclePhysicsStore.getState();
    const speedLong = physicsStore.telemetry?.drivetrain?.speedLong || 0;
    const resetCount = physicsStore.resetCount || 0;

    // Detect vehicle recovery / reset or explicit camera realignment request
    const isReset =
      resetCount !== lastResetCountRef.current ||
      cameraResetTrigger !== lastCameraResetTriggerRef.current ||
      isFirstFrameRef.current;

    if (isReset) {
      lastResetCountRef.current = resetCount;
      lastCameraResetTriggerRef.current = cameraResetTrigger;
      isFirstFrameRef.current = false;

      // Reset glance angles immediately
      orbitAnglesRef.current = { azimuth: 0, polar: 0 };

      // Compute ideal transform at spawn and snap immediately (zero lerp latency)
      const ideal = computeIdealCameraTransform(
        vehiclePos,
        vehicleQuat,
        0,
        drivingView,
        orbitAnglesRef.current,
        DRIVING_CAMERA_CONFIG
      );

      currentPosRef.current.copy(ideal.position);
      currentTargetRef.current.copy(ideal.target);
      currentFovRef.current = ideal.fov;

      camera.position.copy(ideal.position);
      camera.lookAt(ideal.target);
      camera.fov = ideal.fov;
      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.copy(ideal.target);
        controlsRef.current.update();
      }
      return;
    }

    // Auto-spring-back return for user glance when pointer is released
    if (!isDraggingPointerRef.current) {
      const modeCfg = DRIVING_CAMERA_CONFIG.modes[drivingView] || DRIVING_CAMERA_CONFIG.modes.chase;
      const returnSpeed = modeCfg.orbitReturnSpeed || 4.0;
      orbitAnglesRef.current = computeOrbitSpringBack(orbitAnglesRef.current, delta, returnSpeed);
    }

    // Free Orbit Mode: hand off camera control to OrbitControls while keeping target pinned to vehicle
    if (drivingView === DRIVING_VIEWS.ORBIT) {
      if (controlsRef.current) {
        controlsRef.current.target.lerp(vehiclePos, Math.min(1.0, 1 - Math.exp(-12.0 * delta)));
        controlsRef.current.update();
      }
      prevViewRef.current = drivingView;
      return;
    }

    // Compute ideal target transform for current vehicle state
    const ideal = computeIdealCameraTransform(
      vehiclePos,
      vehicleQuat,
      speedLong,
      drivingView,
      orbitAnglesRef.current,
      DRIVING_CAMERA_CONFIG
    );

    const modeCfg = DRIVING_CAMERA_CONFIG.modes[drivingView] || DRIVING_CAMERA_CONFIG.modes.chase;

    // Check if mode just switched: if so, use a smooth transition rate
    const viewChanged = prevViewRef.current !== drivingView;
    if (viewChanged) {
      prevViewRef.current = drivingView;
    }

    const posDamping = viewChanged ? 6.0 : (modeCfg.posDamping || 8.5);
    const rotDamping = viewChanged ? 8.0 : (modeCfg.rotDamping || 10.0);

    // Apply exact exponential damping
    const damped = dampCameraTransform(
      currentPosRef.current,
      currentTargetRef.current,
      currentFovRef.current,
      ideal.position,
      ideal.target,
      ideal.fov,
      delta,
      posDamping,
      rotDamping
    );

    // Update physical camera
    camera.position.copy(damped.position);
    camera.lookAt(damped.target);

    // Update dynamic FOV if changed
    if (Math.abs(camera.fov - damped.fov) > 0.05) {
      camera.fov = damped.fov;
      camera.updateProjectionMatrix();
    }

    // Synchronize OrbitControls target so switching to Orbit is seamless
    if (controlsRef.current) {
      controlsRef.current.target.copy(damped.target);
    }
  });

  const isOrbitMode = drivingView === DRIVING_VIEWS.ORBIT;

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        fov={46.0}
        near={0.05}
        far={2500}
        position={[0, 2.15, -5.6]}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={isOrbitMode}
        target={[0, 0.90, 2.5]}
        minDistance={2.5}
        maxDistance={35.0}
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI / 2 - 0.05}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}
