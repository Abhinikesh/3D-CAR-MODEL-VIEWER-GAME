import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
  GizmoHelper,
  GizmoViewport,
} from '@react-three/drei';
import * as THREE from 'three';
import { useCameraStore, DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from '../../store/cameraStore.js';

export default function CameraController() {
  const {
    activePreset,
    projectionMode,
    target,
    desiredPosition,
    desiredTarget,
    isTransitioning,
    transitionSmoothing,
    isTurntableActive,
    turntableSpeed,
    allowUnderside,
    finishTransition,
    stopTurntable,
    setCustomView,
  } = useCameraStore();

  const controlsRef = useRef(null);
  const perspectiveCamRef = useRef(null);
  const orthographicCamRef = useRef(null);

  const size = useThree((state) => state.size);
  const currentCamera = useThree((state) => state.camera);

  // Scratch vectors to avoid garbage collection inside render loop
  const destPos = useMemo(() => new THREE.Vector3(), []);
  const destTarget = useMemo(() => new THREE.Vector3(), []);
  const dirVector = useMemo(() => new THREE.Vector3(), []);
  const targetVector = useMemo(() => new THREE.Vector3(), []);

  // Compute equivalent orthographic zoom to match perspective framing
  const calculateOrthoZoom = useCallback((distance, fovDeg) => {
    const fovRad = (fovDeg * Math.PI) / 180;
    const visibleWorldHeight = 2 * distance * Math.tan(fovRad / 2);
    // Drei's OrthographicCamera has top = size.height / 2, bottom = -size.height / 2
    // Therefore world units on screen = size.height / zoom
    // Equating gives: zoom = size.height / visibleWorldHeight
    return Math.max(10, size.height / Math.max(0.1, visibleWorldHeight));
  }, [size.height]);

  // Compute equivalent perspective distance from orthographic zoom
  const calculatePerspDistance = useCallback((zoom, fovDeg) => {
    const fovRad = (fovDeg * Math.PI) / 180;
    const visibleWorldHeight = size.height / Math.max(1, zoom);
    return Math.max(1, visibleWorldHeight / (2 * Math.tan(fovRad / 2)));
  }, [size.height]);

  // Synchronize cameras when projectionMode switches
  const prevModeRef = useRef(projectionMode);
  useEffect(() => {
    if (prevModeRef.current === projectionMode) return;
    const prevMode = prevModeRef.current;
    prevModeRef.current = projectionMode;

    const perspCam = perspectiveCamRef.current;
    const orthoCam = orthographicCamRef.current;
    const controls = controlsRef.current;
    if (!perspCam || !orthoCam) return;

    const currentTgt = controls ? controls.target : new THREE.Vector3(...DEFAULT_CAMERA_TARGET);

    if (projectionMode === 'orthographic') {
      // Switching Perspective -> Orthographic
      // 1. Copy position and orientation
      orthoCam.position.copy(perspCam.position);
      orthoCam.quaternion.copy(perspCam.quaternion);

      // 2. Calculate matching zoom
      const distance = perspCam.position.distanceTo(currentTgt);
      const matchingZoom = calculateOrthoZoom(distance, perspCam.fov || 40);
      orthoCam.zoom = matchingZoom;
      orthoCam.updateProjectionMatrix();

      if (controls) {
        controls.target.copy(currentTgt);
        controls.update();
      }
    } else {
      // Switching Orthographic -> Perspective
      // 1. Calculate matching distance from orthographic zoom
      const matchingDistance = calculatePerspDistance(orthoCam.zoom || 100, perspCam.fov || 40);

      // 2. Position perspective camera along current viewing line from target
      dirVector.subVectors(orthoCam.position, currentTgt).normalize();
      if (dirVector.lengthSq() < 0.001) {
        dirVector.set(0, 0.5, 1).normalize();
      }
      perspCam.position.copy(currentTgt).addScaledVector(dirVector, matchingDistance);
      perspCam.quaternion.copy(orthoCam.quaternion);
      perspCam.updateProjectionMatrix();

      if (controls) {
        controls.target.copy(currentTgt);
        controls.update();
      }
    }
  }, [projectionMode, calculateOrthoZoom, calculatePerspDistance, dirVector]);

  // Smooth camera transition loop
  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const camera = state.camera;

    if (isTransitioning && desiredPosition && desiredTarget) {
      // Clamped delta to avoid frame spikes after background tab switches
      const safeDelta = Math.min(delta, 0.1);
      // Exponential decay smoothing factor
      const alpha = 1 - Math.exp(-(transitionSmoothing || 7.5) * safeDelta);

      destPos.set(desiredPosition[0], desiredPosition[1], desiredPosition[2]);
      destTarget.set(desiredTarget[0], desiredTarget[1], desiredTarget[2]);

      // Lerp camera position and controls target
      camera.position.lerp(destPos, alpha);
      controls.target.lerp(destTarget, alpha);

      // If in orthographic mode, adjust zoom towards target framing
      if (camera.isOrthographicCamera) {
        const dist = destPos.distanceTo(destTarget);
        const targetZoom = calculateOrthoZoom(dist, 40);
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, targetZoom, alpha);
        camera.updateProjectionMatrix();
      }

      controls.update();

      // Check convergence threshold
      const posDist = camera.position.distanceTo(destPos);
      const tgtDist = controls.target.distanceTo(destTarget);

      if (posDist < 0.015 && tgtDist < 0.008) {
        camera.position.copy(destPos);
        controls.target.copy(destTarget);
        if (camera.isOrthographicCamera) {
          const dist = destPos.distanceTo(destTarget);
          camera.zoom = calculateOrthoZoom(dist, 40);
          camera.updateProjectionMatrix();
        }
        controls.update();
        finishTransition();
      }
    }
  });

  // Target getter for GizmoHelper
  const getTarget = useCallback(() => {
    if (controlsRef.current) {
      return controlsRef.current.target;
    }
    targetVector.set(target[0], target[1], target[2]);
    return targetVector;
  }, [target, targetVector]);

  // When user interacts manually, switch preset indicator to 'custom' and halt turntable
  const handleControlStart = useCallback(() => {
    if (isTransitioning) {
      finishTransition();
    }
    if (isTurntableActive) {
      stopTurntable();
    }
    setCustomView();
  }, [isTransitioning, isTurntableActive, finishTransition, stopTurntable, setCustomView]);

  return (
    <>
      {/* Perspective Camera for Realistic Showroom */}
      <PerspectiveCamera
        ref={perspectiveCamRef}
        makeDefault={projectionMode === 'perspective'}
        fov={40}
        near={0.1}
        far={100}
        position={DEFAULT_CAMERA_POSITION}
      />

      {/* Orthographic Camera for Technical Inspection */}
      <OrthographicCamera
        ref={orthographicCamRef}
        makeDefault={projectionMode === 'orthographic'}
        near={0.1}
        far={100}
        position={DEFAULT_CAMERA_POSITION}
        zoom={calculateOrthoZoom(7.3, 40)}
      />

      {/* OrbitControls */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={DEFAULT_CAMERA_TARGET}
        minDistance={1.2}
        maxDistance={18.0}
        minPolarAngle={0.04}
        maxPolarAngle={allowUnderside ? Math.PI - 0.05 : Math.PI / 2 - 0.04}
        enableDamping
        dampingFactor={0.05}
        enablePan
        enableZoom
        autoRotate={isTurntableActive && !isTransitioning}
        autoRotateSpeed={turntableSpeed || 1.8}
        onStart={handleControlStart}
      />

      {/* Interactive 3D Orientation Gizmo */}
      <GizmoHelper
        alignment="bottom-right"
        margin={[75, 75]}
        renderPriority={1}
        onTarget={getTarget}
      >
        <GizmoViewport
          axisColors={['#E74C3C', '#2ECC71', '#3498DB']}
          labelColor="#07090D"
          font="bold 15px Inter, -apple-system, BlinkMacSystemFont, sans-serif"
          labels={['X', 'Y', 'Z']}
          axisHeadScale={1.15}
        />
      </GizmoHelper>
    </>
  );
}
