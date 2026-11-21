import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useLightingStore, LIGHTING_PRESETS } from '../../store/lightingStore.js';
import { useCameraStore } from '../../store/cameraStore.js';

export default function StudioLighting() {
  const activePreset = useLightingStore((state) => state.activePreset);
  const allowUnderside = useCameraStore((state) => state.allowUnderside);
  const gl = useThree((state) => state.gl);

  const presetConfig = useMemo(() => {
    return LIGHTING_PRESETS[activePreset] || LIGHTING_PRESETS['studio'];
  }, [activePreset]);

  // Light references for smooth interpolation
  const ambientRef = useRef(null);
  const keyLightRef = useRef(null);
  const fillLightRef = useRef(null);
  const leftRimRef = useRef(null);
  const rightRimRef = useRef(null);
  const frontAccentRef = useRef(null);
  const rearAccentRef = useRef(null);
  const overheadRef = useRef(null);
  const undersideRef = useRef(null);

  // Smoothly interpolate light intensities and tone mapping exposure
  useFrame((state, delta) => {
    const alpha = Math.min(1, 1 - Math.exp(-6.0 * delta));

    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        presetConfig.ambientIntensity,
        alpha
      );
    }
    if (keyLightRef.current) {
      keyLightRef.current.intensity = THREE.MathUtils.lerp(
        keyLightRef.current.intensity,
        presetConfig.keyIntensity,
        alpha
      );
    }
    if (fillLightRef.current) {
      fillLightRef.current.intensity = THREE.MathUtils.lerp(
        fillLightRef.current.intensity,
        presetConfig.fillIntensity,
        alpha
      );
    }
    if (leftRimRef.current) {
      leftRimRef.current.intensity = THREE.MathUtils.lerp(
        leftRimRef.current.intensity,
        presetConfig.rimIntensity,
        alpha
      );
    }
    if (rightRimRef.current) {
      rightRimRef.current.intensity = THREE.MathUtils.lerp(
        rightRimRef.current.intensity,
        presetConfig.rimIntensity * 0.8,
        alpha
      );
    }
    if (frontAccentRef.current) {
      frontAccentRef.current.intensity = THREE.MathUtils.lerp(
        frontAccentRef.current.intensity,
        presetConfig.frontIntensity,
        alpha
      );
    }
    if (rearAccentRef.current) {
      rearAccentRef.current.intensity = THREE.MathUtils.lerp(
        rearAccentRef.current.intensity,
        presetConfig.rearIntensity,
        alpha
      );
    }
    if (overheadRef.current) {
      overheadRef.current.intensity = THREE.MathUtils.lerp(
        overheadRef.current.intensity,
        presetConfig.overheadIntensity,
        alpha
      );
    }
    if (undersideRef.current) {
      const targetUnderside = allowUnderside ? 1.8 : 0.0;
      undersideRef.current.intensity = THREE.MathUtils.lerp(
        undersideRef.current.intensity,
        targetUnderside,
        alpha
      );
    }

    // Dynamic exposure adjustment
    if (gl) {
      gl.toneMappingExposure = THREE.MathUtils.lerp(
        gl.toneMappingExposure,
        presetConfig.exposure,
        alpha
      );
    }
  });

  return (
    <>
      {/* 
        High Dynamic Range (HDR) Studio Reflection Environment
        Loaded locally from public/environments/studio_small_08_1k.hdr (Poly Haven CC0)
        background={false} keeps our clean dark showroom background while providing
        photorealistic reflections on paint, clearcoat, chrome rims, and glass.
      */}
      <Environment
        files="/environments/studio_small_08_1k.hdr"
        background={false}
        environmentIntensity={presetConfig.envIntensity}
        environmentRotation={[0, -Math.PI / 4, 0]}
      />

      {/* Baseline Ambient Fill */}
      <ambientLight
        ref={ambientRef}
        intensity={presetConfig.ambientIntensity}
        color="#F1F5F9"
      />

      {/* 
        Key Light: Primary Body-Form Illumination with High-Precision Shadow Mapping
        Tight bounding box minimizes shadow-map texel dispersion over the 4.56m vehicle.
      */}
      <directionalLight
        ref={keyLightRef}
        position={[5.5, 7.5, 5.0]}
        intensity={presetConfig.keyIntensity}
        color={presetConfig.keyColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1.0}
        shadow-camera-far={22.0}
        shadow-camera-left={-3.8}
        shadow-camera-right={3.8}
        shadow-camera-top={3.8}
        shadow-camera-bottom={-3.8}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />

      {/* Fill Light: Soft Cool Bounce to Preserve Panel Shadow Details */}
      <directionalLight
        ref={fillLightRef}
        position={[-6.0, 4.5, -4.5]}
        intensity={presetConfig.fillIntensity}
        color={presetConfig.fillColor}
      />

      {/* Dual Silhouette / Rim Lights: Carves Roofline, Shoulders & Aerodynamic Curves */}
      <directionalLight
        ref={leftRimRef}
        position={[4.5, 5.0, -6.5]}
        intensity={presetConfig.rimIntensity}
        color={presetConfig.rimColor}
      />
      <directionalLight
        ref={rightRimRef}
        position={[-4.5, 5.0, -6.5]}
        intensity={presetConfig.rimIntensity * 0.8}
        color={presetConfig.rimColor}
      />

      {/* Front Bumper, Headlight & Lower Splitter Accent */}
      <directionalLight
        ref={frontAccentRef}
        position={[0, 1.6, 6.2]}
        intensity={presetConfig.frontIntensity}
        color="#FFFFFF"
      />

      {/* Rear Diffuser, Aerodynamic Wing & Taillight Accent */}
      <directionalLight
        ref={rearAccentRef}
        position={[0, 1.8, -6.2]}
        intensity={presetConfig.rearIntensity}
        color="#FFFFFF"
      />

      {/* Soft Overhead Ceiling Softbox Strip: Creates Iconic Automotive Specular Highlight */}
      <directionalLight
        ref={overheadRef}
        position={[0, 9.0, 0]}
        intensity={presetConfig.overheadIntensity}
        color="#FFFFFF"
      />

      {/* Underside Inspection Light: Dedicated Illuminator for Undercarriage Viewing */}
      <directionalLight
        ref={undersideRef}
        position={[0, -5.0, 0]}
        intensity={allowUnderside ? 1.8 : 0.0}
        color="#F8FAFC"
      />
    </>
  );
}
