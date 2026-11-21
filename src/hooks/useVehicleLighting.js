import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVehicleLightingStore } from '../store/vehicleLightingStore.js';
import {
  HEADLIGHT_MODES,
  TAILLIGHT_MODES,
  BRAKE_MODES,
  INDICATOR_MODES,
  BLINK_PERIOD_MS,
  BLINK_DUTY_CYCLE,
  HEADLIGHT_EMISSIVE_PRESETS,
  TAILLIGHT_EMISSIVE_PRESETS,
  SIGNALLIGHT_EMISSIVE_PRESETS,
  LIGHT_SOURCE_SPECS,
} from '../utils/vehicleLightingRegistry.js';

/**
 * Custom React Three Fiber hook for dynamic automotive lighting.
 *
 * Implements:
 * 1. Emissive PBR material updates for BodyHeadlights, BodyTaillights, BodyTurnsignalsRear.
 * 2. Physical Three.js SpotLights and PointLights anchored to bonnet/boot pivots.
 * 3. ECE/SAE compliant 1.5 Hz blinker clock for left/right indicators and hazard flashers.
 * 4. Dual-intensity taillight/brake operation and low/high beam projection.
 * 5. Complete transform and material preservation on unmount / reset.
 */
export function useVehicleLighting(scene) {
  // References to meshes and original materials
  const originalMaterialsRef = useRef(new Map());
  const meshesRef = useRef({
    headlights: null,
    taillights: null,
    turnSignals: null,
  });

  // Application-owned materials
  const materialsRef = useRef({
    headlightMat: null,
    taillightMat: null,
    turnSignalMat: null,
  });

  // Real Three.js light instances
  const lightsRef = useRef({
    spotL: null,
    spotR: null,
    targetL: null,
    targetR: null,
    tailL: null,
    tailR: null,
    indicatorL: null,
    indicatorR: null,
  });

  // Blinker timer accumulator
  const blinkTimerRef = useRef(0);
  const lastPhaseRef = useRef(true);

  // Initialize meshes, materials, and light sources on scene mount
  useEffect(() => {
    if (!scene) return;

    // 1. Locate lighting meshes
    let headlightMesh = null;
    let taillightMesh = null;
    let turnSignalMesh = null;
    let pivotBonnet = null;
    let pivotBoot = null;

    scene.traverse((node) => {
      if (node.name === 'BodyHeadlights') headlightMesh = node;
      if (node.name === 'BodyTaillights') taillightMesh = node;
      if (node.name === 'BodyTurnsignalsRear') turnSignalMesh = node;
      if (node.name === 'Pivot_Bonnet') pivotBonnet = node;
      if (node.name === 'Pivot_Boot') pivotBoot = node;
    });

    meshesRef.current = {
      headlights: headlightMesh,
      taillights: taillightMesh,
      turnSignals: turnSignalMesh,
    };

    // Cache original materials
    [headlightMesh, taillightMesh, turnSignalMesh].forEach((mesh) => {
      if (mesh && !originalMaterialsRef.current.has(mesh.uuid)) {
        originalMaterialsRef.current.set(mesh.uuid, mesh.material);
      }
    });

    // 2. Create application-owned PBR standard materials
    const hlPreset = HEADLIGHT_EMISSIVE_PRESETS.off;
    const tlPreset = TAILLIGHT_EMISSIVE_PRESETS.off;
    const tsPreset = SIGNALLIGHT_EMISSIVE_PRESETS.off;

    const headlightMat = new THREE.MeshStandardMaterial({
      name: 'Dynamic_Headlight_Mat',
      color: new THREE.Color(hlPreset.color),
      emissive: new THREE.Color(hlPreset.emissive),
      emissiveIntensity: hlPreset.emissiveIntensity,
      roughness: hlPreset.roughness,
      metalness: hlPreset.metalness,
    });

    const taillightMat = new THREE.MeshStandardMaterial({
      name: 'Dynamic_Taillight_Mat',
      color: new THREE.Color(tlPreset.color),
      emissive: new THREE.Color(tlPreset.emissive),
      emissiveIntensity: tlPreset.emissiveIntensity,
      roughness: tlPreset.roughness,
      metalness: tlPreset.metalness,
    });

    const turnSignalMat = new THREE.MeshStandardMaterial({
      name: 'Dynamic_Turnsignal_Mat',
      color: new THREE.Color(tsPreset.color),
      emissive: new THREE.Color(tsPreset.emissive),
      emissiveIntensity: tsPreset.emissiveIntensity,
      roughness: tsPreset.roughness,
      metalness: tsPreset.metalness,
    });

    materialsRef.current = { headlightMat, taillightMat, turnSignalMat };

    if (headlightMesh) headlightMesh.material = headlightMat;
    if (taillightMesh) taillightMesh.material = taillightMat;
    if (turnSignalMesh) turnSignalMesh.material = turnSignalMat;

    // 3. Create physical Three.js light sources
    // Headlight SpotLights: attached to Pivot_Bonnet (or scene if pivot missing)
    const bonnetAnchor = pivotBonnet || scene;
    const bootAnchor = pivotBoot || scene;

    const hlSpecs = LIGHT_SOURCE_SPECS.headlights;
    const spotL = new THREE.SpotLight(hlSpecs.lowBeam.color, 0);
    const spotR = new THREE.SpotLight(hlSpecs.lowBeam.color, 0);
    spotL.position.set(...hlSpecs.leftPosLocal);
    spotR.position.set(...hlSpecs.rightPosLocal);

    const targetL = new THREE.Object3D();
    const targetR = new THREE.Object3D();
    targetL.position.set(hlSpecs.leftPosLocal[0], hlSpecs.lowBeam.targetLocal[1], hlSpecs.lowBeam.targetLocal[2]);
    targetR.position.set(hlSpecs.rightPosLocal[0], hlSpecs.lowBeam.targetLocal[1], hlSpecs.lowBeam.targetLocal[2]);

    spotL.target = targetL;
    spotR.target = targetR;

    bonnetAnchor.add(spotL);
    bonnetAnchor.add(spotR);
    bonnetAnchor.add(targetL);
    bonnetAnchor.add(targetR);

    // Taillight PointLights: attached to Pivot_Boot
    const tlSpecs = LIGHT_SOURCE_SPECS.taillights;
    const tailL = new THREE.PointLight(tlSpecs.running.color, 0, tlSpecs.running.distance);
    const tailR = new THREE.PointLight(tlSpecs.running.color, 0, tlSpecs.running.distance);
    tailL.position.set(...tlSpecs.leftPosLocal);
    tailR.position.set(...tlSpecs.rightPosLocal);

    bootAnchor.add(tailL);
    bootAnchor.add(tailR);

    // Indicator PointLights: attached to Pivot_Boot
    const inSpecs = LIGHT_SOURCE_SPECS.indicators;
    const indicatorL = new THREE.PointLight(inSpecs.amberColor, 0, inSpecs.distance);
    const indicatorR = new THREE.PointLight(inSpecs.amberColor, 0, inSpecs.distance);
    indicatorL.position.set(...inSpecs.leftPosLocal);
    indicatorR.position.set(...inSpecs.rightPosLocal);

    bootAnchor.add(indicatorL);
    bootAnchor.add(indicatorR);

    lightsRef.current = {
      spotL,
      spotR,
      targetL,
      targetR,
      tailL,
      tailR,
      indicatorL,
      indicatorR,
      bonnetAnchor,
      bootAnchor,
    };

    if (typeof window !== 'undefined') {
      window.__vehicleLightingRig = {
        meshes: meshesRef.current,
        materials: materialsRef.current,
        lights: lightsRef.current,
      };
    }

    return () => {
      // Clean up light sources
      if (bonnetAnchor) {
        bonnetAnchor.remove(spotL, spotR, targetL, targetR);
      }
      if (bootAnchor) {
        bootAnchor.remove(tailL, tailR, indicatorL, indicatorR);
      }

      // Dispose custom materials
      headlightMat.dispose();
      taillightMat.dispose();
      turnSignalMat.dispose();

      // Restore original materials
      originalMaterialsRef.current.forEach((origMat, uuid) => {
        scene.traverse((node) => {
          if (node.uuid === uuid) {
            node.material = origMat;
            if (node.material) node.material.needsUpdate = true;
          }
        });
      });
    };
  }, [scene]);

  // Per-frame animation tick: update blinker clock and dynamic light states
  useFrame((_, delta) => {
    const { headlightMat, taillightMat, turnSignalMat } = materialsRef.current;
    if (!headlightMat || !taillightMat || !turnSignalMat) return;

    const {
      headlightMode,
      taillightMode,
      brakeMode,
      indicatorMode,
      realLightsEnabled,
      setBlinkPhase,
    } = useVehicleLightingStore.getState();

    // ─── 1. Blinker Clock & Phase Calculation (1.5 Hz) ───
    const isBlinking = indicatorMode !== INDICATOR_MODES.OFF;
    let phase = false;

    if (isBlinking) {
      blinkTimerRef.current += Math.min(delta, 0.05) * 1000;
      const cycleMs = blinkTimerRef.current % BLINK_PERIOD_MS;
      phase = cycleMs < BLINK_PERIOD_MS * BLINK_DUTY_CYCLE;

      if (phase !== lastPhaseRef.current) {
        lastPhaseRef.current = phase;
        setBlinkPhase(phase);
      }
    } else {
      blinkTimerRef.current = 0;
      if (lastPhaseRef.current !== false) {
        lastPhaseRef.current = false;
        setBlinkPhase(false);
      }
    }

    // ─── 2. Headlight Emissive & Physical SpotLights ───
    const hlPreset = HEADLIGHT_EMISSIVE_PRESETS[headlightMode] || HEADLIGHT_EMISSIVE_PRESETS.off;
    headlightMat.color.set(hlPreset.color);
    headlightMat.emissive.set(hlPreset.emissive);
    headlightMat.emissiveIntensity = hlPreset.emissiveIntensity;
    headlightMat.roughness = hlPreset.roughness;

    const { spotL, spotR, targetL, targetR } = lightsRef.current;
    if (spotL && spotR && targetL && targetR) {
      if (realLightsEnabled && (headlightMode === HEADLIGHT_MODES.LOW_BEAM || headlightMode === HEADLIGHT_MODES.HIGH_BEAM)) {
        const isHigh = headlightMode === HEADLIGHT_MODES.HIGH_BEAM;
        const spec = isHigh
          ? LIGHT_SOURCE_SPECS.headlights.highBeam
          : LIGHT_SOURCE_SPECS.headlights.lowBeam;

        spotL.color.set(spec.color);
        spotR.color.set(spec.color);
        spotL.intensity = spec.intensity;
        spotR.intensity = spec.intensity;
        spotL.distance = spec.distance;
        spotR.distance = spec.distance;
        spotL.angle = spec.angle;
        spotR.angle = spec.angle;
        spotL.penumbra = spec.penumbra;
        spotR.penumbra = spec.penumbra;

        targetL.position.set(LIGHT_SOURCE_SPECS.headlights.leftPosLocal[0], spec.targetLocal[1], spec.targetLocal[2]);
        targetR.position.set(LIGHT_SOURCE_SPECS.headlights.rightPosLocal[0], spec.targetLocal[1], spec.targetLocal[2]);
      } else {
        spotL.intensity = 0;
        spotR.intensity = 0;
      }
    }

    // ─── 3. Taillight / Brake Light Emissive & PointLights ───
    const isBraking = brakeMode === BRAKE_MODES.ACTIVE;
    const isTailRunning = taillightMode === TAILLIGHT_MODES.RUNNING;

    let tlPreset;
    if (isBraking) {
      tlPreset = TAILLIGHT_EMISSIVE_PRESETS.brake;
    } else if (isTailRunning) {
      tlPreset = TAILLIGHT_EMISSIVE_PRESETS.running;
    } else {
      tlPreset = TAILLIGHT_EMISSIVE_PRESETS.off;
    }

    taillightMat.color.set(tlPreset.color);
    taillightMat.emissive.set(tlPreset.emissive);
    taillightMat.emissiveIntensity = tlPreset.emissiveIntensity;
    taillightMat.roughness = tlPreset.roughness;

    const { tailL, tailR } = lightsRef.current;
    if (tailL && tailR) {
      if (realLightsEnabled && (isBraking || isTailRunning)) {
        const spec = isBraking
          ? LIGHT_SOURCE_SPECS.taillights.brake
          : LIGHT_SOURCE_SPECS.taillights.running;

        tailL.color.set(spec.color);
        tailR.color.set(spec.color);
        tailL.intensity = spec.intensity;
        tailR.intensity = spec.intensity;
        tailL.distance = spec.distance;
        tailR.distance = spec.distance;
      } else {
        tailL.intensity = 0;
        tailR.intensity = 0;
      }
    }

    // ─── 4. Turn Signal / Hazard Emissive & Amber PointLights ───
    const tsPreset = isBlinking && phase
      ? SIGNALLIGHT_EMISSIVE_PRESETS.blink_on
      : SIGNALLIGHT_EMISSIVE_PRESETS.blink_off;

    turnSignalMat.color.set(tsPreset.color);
    turnSignalMat.emissive.set(tsPreset.emissive);
    turnSignalMat.emissiveIntensity = tsPreset.emissiveIntensity;
    turnSignalMat.roughness = tsPreset.roughness;

    const { indicatorL, indicatorR } = lightsRef.current;
    if (indicatorL && indicatorR) {
      if (realLightsEnabled && isBlinking && phase) {
        const inSpec = LIGHT_SOURCE_SPECS.indicators;
        const leftActive = indicatorMode === INDICATOR_MODES.LEFT || indicatorMode === INDICATOR_MODES.HAZARD;
        const rightActive = indicatorMode === INDICATOR_MODES.RIGHT || indicatorMode === INDICATOR_MODES.HAZARD;

        indicatorL.intensity = leftActive ? inSpec.intensity : 0;
        indicatorR.intensity = rightActive ? inSpec.intensity : 0;
      } else {
        indicatorL.intensity = 0;
        indicatorR.intensity = 0;
      }
    }
  });

  return null;
}
