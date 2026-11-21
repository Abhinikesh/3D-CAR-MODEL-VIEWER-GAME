import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Sky, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useShowroomEnvironmentStore } from '../../store/showroomEnvironmentStore.js';
import { getEnvironmentConfig } from '../../utils/showroomEnvironmentRegistry.js';
import { useCameraStore } from '../../store/cameraStore.js';
import { useSelectionStore } from '../../store/selectionStore.js';

// Scratch instances to avoid garbage collection inside render loop
const _scratchColor = new THREE.Color();
const _scratchVec = new THREE.Vector3();
const _scratchSecPos = new THREE.Vector3();

class EnvironmentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.warn('[ShowroomEnvironmentController] HDR Environment Map failed to load, falling back to photometric lighting rig.', error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * Dynamic Showroom Environment Controller
 *
 * Orchestrates:
 * 1. Environment reflection map (Poly Haven CC0 studio HDR) with dynamic intensity & rotation.
 * 2. Procedural Sky Dome for outdoor daylight presentations.
 * 3. Photometric 3-point + dual-rim lighting rig with smooth exponential damping interpolation.
 * 4. PBR Ground Stage floor with environment-specific materials (satin studio, polished marble, asphalt, wet obsidian).
 * 5. High-resolution soft ContactShadows under vehicle wheels.
 * 6. Dynamic tone mapping exposure control on WebGLRenderer.
 */
export default function ShowroomEnvironmentController() {
  const activeEnvironmentId = useShowroomEnvironmentStore((state) => state.activeEnvironmentId);
  const exposureMultiplier = useShowroomEnvironmentStore((state) => state.exposureMultiplier);
  const reflectionMultiplier = useShowroomEnvironmentStore((state) => state.reflectionMultiplier);
  const shadowMultiplier = useShowroomEnvironmentStore((state) => state.shadowMultiplier);
  const allowUnderside = useCameraStore((state) => state.allowUnderside);
  const { gl, scene } = useThree();

  const envConfig = useMemo(() => {
    return getEnvironmentConfig(activeEnvironmentId);
  }, [activeEnvironmentId]);

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

  // Floor material reference for smooth material transition
  const floorMatRef = useRef(null);

  // Target exposure
  const targetExposure = envConfig.exposure * exposureMultiplier;

  // Set scene background
  useMemo(() => {
    if (scene) {
      if (envConfig.hasSky) {
        // When Sky component is rendered, clear scene.background so Sky is visible
        scene.background = null;
      } else {
        scene.background = new THREE.Color(envConfig.bgColor);
      }
    }
  }, [scene, envConfig]);

  // Per-frame smooth interpolation of light intensities, colors, and camera exposure
  useFrame((_, delta) => {
    const alpha = Math.min(1, 1 - Math.exp(-6.0 * delta));
    const lighting = envConfig.lighting;

    // Ambient
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        lighting.ambientIntensity,
        alpha
      );
      _scratchColor.set(lighting.ambientColor);
      ambientRef.current.color.lerp(_scratchColor, alpha);
    }

    // Key Light
    if (keyLightRef.current) {
      keyLightRef.current.intensity = THREE.MathUtils.lerp(
        keyLightRef.current.intensity,
        lighting.keyIntensity,
        alpha
      );
      _scratchColor.set(lighting.keyColor);
      keyLightRef.current.color.lerp(_scratchColor, alpha);
      _scratchVec.set(lighting.keyPosition[0], lighting.keyPosition[1], lighting.keyPosition[2]);
      keyLightRef.current.position.lerp(_scratchVec, alpha);
    }

    // Fill Light
    if (fillLightRef.current) {
      fillLightRef.current.intensity = THREE.MathUtils.lerp(
        fillLightRef.current.intensity,
        lighting.fillIntensity,
        alpha
      );
      _scratchColor.set(lighting.fillColor);
      fillLightRef.current.color.lerp(_scratchColor, alpha);
      _scratchVec.set(lighting.fillPosition[0], lighting.fillPosition[1], lighting.fillPosition[2]);
      fillLightRef.current.position.lerp(_scratchVec, alpha);
    }

    // Primary Rim Light
    if (leftRimRef.current) {
      leftRimRef.current.intensity = THREE.MathUtils.lerp(
        leftRimRef.current.intensity,
        lighting.rimIntensity,
        alpha
      );
      _scratchColor.set(lighting.rimColor);
      leftRimRef.current.color.lerp(_scratchColor, alpha);
      _scratchVec.set(lighting.rimPosition[0], lighting.rimPosition[1], lighting.rimPosition[2]);
      leftRimRef.current.position.lerp(_scratchVec, alpha);
    }

    // Secondary Rim Light
    if (rightRimRef.current) {
      const secColor = lighting.secondaryRimColor || lighting.rimColor;
      const secIntensity = lighting.secondaryRimIntensity || lighting.rimIntensity * 0.8;
      const rawSecPos = lighting.secondaryRimPosition || [-lighting.rimPosition[0], lighting.rimPosition[1], lighting.rimPosition[2]];

      rightRimRef.current.intensity = THREE.MathUtils.lerp(
        rightRimRef.current.intensity,
        secIntensity,
        alpha
      );
      _scratchColor.set(secColor);
      rightRimRef.current.color.lerp(_scratchColor, alpha);
      _scratchSecPos.set(rawSecPos[0], rawSecPos[1], rawSecPos[2]);
      rightRimRef.current.position.lerp(_scratchSecPos, alpha);
    }

    // Overhead Light
    if (overheadRef.current) {
      overheadRef.current.intensity = THREE.MathUtils.lerp(
        overheadRef.current.intensity,
        lighting.overheadIntensity,
        alpha
      );
    }

    // Front & Rear Accents
    if (frontAccentRef.current) {
      frontAccentRef.current.intensity = THREE.MathUtils.lerp(
        frontAccentRef.current.intensity,
        lighting.frontIntensity,
        alpha
      );
    }
    if (rearAccentRef.current) {
      rearAccentRef.current.intensity = THREE.MathUtils.lerp(
        rearAccentRef.current.intensity,
        lighting.rearIntensity,
        alpha
      );
    }

    // Underside Light
    if (undersideRef.current) {
      const targetUnder = allowUnderside ? 1.8 : 0.0;
      undersideRef.current.intensity = THREE.MathUtils.lerp(
        undersideRef.current.intensity,
        targetUnder,
        alpha
      );
    }

    // Dynamic Tone Mapping Exposure
    if (gl) {
      gl.toneMappingExposure = THREE.MathUtils.lerp(
        gl.toneMappingExposure,
        targetExposure,
        alpha
      );
    }
  });

  return (
    <>
      {/* ─── 1. HDR Environment Reflection Map with Resilient Fallback ─── */}
      <EnvironmentErrorBoundary>
        <Environment
          files={envConfig.hdrFile}
          background={false}
          environmentIntensity={envConfig.envIntensity * reflectionMultiplier}
          environmentRotation={envConfig.envRotation}
        />
      </EnvironmentErrorBoundary>

      {/* ─── 2. Optional Sky Dome (for Outdoor Environment) ─── */}
      {envConfig.hasSky && envConfig.skyParams && (
        <Sky
          distance={450000}
          sunPosition={envConfig.skyParams.sunPosition}
          turbidity={envConfig.skyParams.turbidity}
          rayleigh={envConfig.skyParams.rayleigh}
          mieCoefficient={envConfig.skyParams.mieCoefficient}
          mieDirectionalG={envConfig.skyParams.mieDirectionalG}
        />
      )}

      {/* ─── 3. Baseline Ambient Fill ─── */}
      <ambientLight
        ref={ambientRef}
        intensity={envConfig.lighting.ambientIntensity}
        color={envConfig.lighting.ambientColor}
      />

      {/* ─── 4. Directional Lights ─── */}
      {/* Key Light (Sun / Main Softbox with High-Precision Shadows) */}
      <directionalLight
        ref={keyLightRef}
        position={envConfig.lighting.keyPosition}
        intensity={envConfig.lighting.keyIntensity}
        color={envConfig.lighting.keyColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1.0}
        shadow-camera-far={28.0}
        shadow-camera-left={-4.0}
        shadow-camera-right={4.0}
        shadow-camera-top={4.0}
        shadow-camera-bottom={-4.0}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />

      {/* Fill Light (Soft cool/warm bounce) */}
      <directionalLight
        ref={fillLightRef}
        position={envConfig.lighting.fillPosition}
        intensity={envConfig.lighting.fillIntensity}
        color={envConfig.lighting.fillColor}
      />

      {/* Primary Rim Light */}
      <directionalLight
        ref={leftRimRef}
        position={envConfig.lighting.rimPosition}
        intensity={envConfig.lighting.rimIntensity}
        color={envConfig.lighting.rimColor}
      />

      {/* Secondary Rim Light */}
      <directionalLight
        ref={rightRimRef}
        position={envConfig.lighting.secondaryRimPosition || [-envConfig.lighting.rimPosition[0], envConfig.lighting.rimPosition[1], envConfig.lighting.rimPosition[2]]}
        intensity={envConfig.lighting.secondaryRimIntensity || envConfig.lighting.rimIntensity * 0.8}
        color={envConfig.lighting.secondaryRimColor || envConfig.lighting.rimColor}
      />

      {/* Overhead Softbox */}
      <directionalLight
        ref={overheadRef}
        position={[0, 9.0, 0]}
        intensity={envConfig.lighting.overheadIntensity}
        color="#FFFFFF"
      />

      {/* Front Accent */}
      <directionalLight
        ref={frontAccentRef}
        position={[0, 1.6, 6.2]}
        intensity={envConfig.lighting.frontIntensity}
        color="#FFFFFF"
      />

      {/* Rear Accent */}
      <directionalLight
        ref={rearAccentRef}
        position={[0, 1.8, -6.2]}
        intensity={envConfig.lighting.rearIntensity}
        color="#FFFFFF"
      />

      {/* Underside Light */}
      <directionalLight
        ref={undersideRef}
        position={[0, -5.0, 0]}
        intensity={allowUnderside ? 1.8 : 0.0}
        color="#F8FAFC"
      />

      {/* ─── 5. Floor Stage & Contact Shadows ─── */}
      <group position={[0, 0, 0]} visible={!allowUnderside}>
        {/* Soft Ambient Contact Shadow Under Wheels */}
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={envConfig.floor.contactShadowOpacity * shadowMultiplier}
          scale={14}
          blur={1.8}
          far={3.2}
          resolution={1024}
          color="#000000"
        />

        {/* Circular / Architectural Stage Floor */}
        <mesh
          position={[0, -0.005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            useSelectionStore.getState().clearSelection();
          }}
        >
          <circleGeometry key={envConfig.floor.radius} args={[envConfig.floor.radius, 64]} />
          <meshStandardMaterial
            ref={floorMatRef}
            color={envConfig.floor.color}
            roughness={envConfig.floor.roughness}
            metalness={envConfig.floor.metalness}
            envMapIntensity={envConfig.floor.envMapIntensity * reflectionMultiplier}
          />
        </mesh>

        {/* ─── Architectural Turntable Podium & Depth Accents (Showroom/Studio modes) ─── */}
        {!envConfig.hasSky && (
          <group position={[0, 0, 0]}>
            {/* Presentation Podium Disc (Dark brushed titanium base) */}
            <mesh position={[0, -0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[3.8, 64]} />
              <meshStandardMaterial
                color="#0D1117"
                roughness={0.32}
                metalness={0.55}
                envMapIntensity={envConfig.floor.envMapIntensity * reflectionMultiplier * 0.9}
              />
            </mesh>

            {/* Glowing Architectural LED Ring encircling presentation podium */}
            <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[3.78, 3.84, 64]} />
              <meshBasicMaterial
                color={envConfig.themeColor || '#00F0FF'}
                transparent
                opacity={0.85}
              />
            </mesh>

            {/* Subtle Inner Concentric Calibrated Alignment Ring */}
            <mesh position={[0, -0.0025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[2.18, 2.20, 48]} />
              <meshBasicMaterial color="#334155" transparent opacity={0.4} />
            </mesh>

            {/* Outer Staging Calibration Ring */}
            <mesh position={[0, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[5.20, 5.23, 64]} />
              <meshBasicMaterial color="#1E293B" transparent opacity={0.5} />
            </mesh>

            {/* Curved Architectural Cyclorama Backdrop (Eliminates flat black void) */}
            <mesh position={[0, 4.0, 0]} rotation={[0, Math.PI * 0.25, 0]}>
              <cylinderGeometry args={[18, 18, 9, 48, 1, true, 0, Math.PI * 1.5]} />
              <meshStandardMaterial
                color="#07090E"
                roughness={0.92}
                metalness={0.08}
                side={THREE.BackSide}
              />
            </mesh>

            {/* Suspended Overhead Studio Softbox Light Banks (Visible reflections in clearcoat) */}
            <group position={[0, 5.6, 0]}>
              {/* Central Softbox Light Bank */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[2.2, 0.06, 5.2]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  emissive="#FFFFFF"
                  emissiveIntensity={1.8 * envConfig.lighting.overheadIntensity}
                  roughness={0.1}
                />
              </mesh>
              {/* Left Angled Studio Softbox */}
              <mesh position={[3.4, -0.3, 0]} rotation={[0, 0, Math.PI / 10]}>
                <boxGeometry args={[1.2, 0.05, 4.6]} />
                <meshStandardMaterial
                  color="#F8FAFC"
                  emissive="#F8FAFC"
                  emissiveIntensity={1.2 * envConfig.lighting.overheadIntensity}
                  roughness={0.1}
                />
              </mesh>
              {/* Right Angled Studio Softbox */}
              <mesh position={[-3.4, -0.3, 0]} rotation={[0, 0, -Math.PI / 10]}>
                <boxGeometry args={[1.2, 0.05, 4.6]} />
                <meshStandardMaterial
                  color="#F8FAFC"
                  emissive="#F8FAFC"
                  emissiveIntensity={1.2 * envConfig.lighting.overheadIntensity}
                  roughness={0.1}
                />
              </mesh>
            </group>
          </group>
        )}
      </group>
    </>
  );
}
