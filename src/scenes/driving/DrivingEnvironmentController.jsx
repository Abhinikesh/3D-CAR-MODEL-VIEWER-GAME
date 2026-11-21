import React, { useEffect, Suspense } from 'react';
import { useThree } from '@react-three/fiber';
import { Sky, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// Calibrated horizon & atmospheric haze color
const HORIZON_ATMOSPHERE_COLOR = '#98C5E8';

// Resilient fallback error boundary for environment HDR asset
class DrivingEnvironmentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.warn('[DrivingEnvironmentController] Environment map failed to load, falling back to hemisphere illumination.', error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * DrivingEnvironmentController Component
 *
 * Implements a cohesive, premium outdoor automotive proving ground visual atmosphere:
 * 1. Celestial Atmospheric Sky Dome (Drei Sky) with calibrated Rayleigh/Mie scattering.
 * 2. Physically-calibrated sun direction ([65, 52, -45]) producing natural forward-left shadows.
 * 3. Outdoor PBR reflection probe (Drei Environment) providing sky and horizon reflections in car clearcoat and glass.
 * 4. Dual-tone HemisphereLight (sky blue fill + meadow grass bounce) for physical ambient volume.
 * 5. High-resolution directional sunlight (2048x2048 PCF soft shadows) with calibrated frustum.
 * 6. High-density underbody ContactShadows grounding vehicle tires solidly to asphalt.
 * 7. Subtle atmospheric perspective fog (THREE.Fog) smoothly fusing distant mountains into the horizon.
 * 8. Clean lifecycle restoration ensuring showroom mode is 100% unaffected on return.
 */
export default function DrivingEnvironmentController() {
  const { scene, gl } = useThree();

  // Natural alpine proving ground sun coordinates (mid-afternoon south-east sun)
  const sunPosition = [65, 52, -45];

  // Configure atmospheric fog & color management during driving mode
  useEffect(() => {
    const originalFog = scene.fog;
    const originalBg = scene.background;
    const originalExposure = gl.toneMappingExposure;

    // Atmospheric perspective haze fusing distant mountain ridge (460m - 560m) into the sky dome.
    // Near boundary at 180m ensures the car, road, kerbs, barriers, and nearby trees remain 100% crisp.
    scene.fog = new THREE.Fog(HORIZON_ATMOSPHERE_COLOR, 180, 850);
    scene.background = new THREE.Color(HORIZON_ATMOSPHERE_COLOR);
    gl.toneMappingExposure = 1.02;

    return () => {
      // Clean up outdoor environment state on transition back to Showroom mode
      scene.fog = originalFog || null;
      scene.background = originalBg;
      gl.toneMappingExposure = originalExposure;
    };
  }, [scene, gl]);

  return (
    <group name="DrivingEnvironmentRig">
      {/* ─── 1. Procedural Atmospheric Sky Dome ─── */}
      <Sky
        distance={950}
        sunPosition={sunPosition}
        turbidity={3.2}
        rayleigh={1.25}
        mieCoefficient={0.0035}
        mieDirectionalG={0.82}
      />

      {/* ─── 2. Outdoor PBR Specular Reflection Map ─── */}
      <DrivingEnvironmentErrorBoundary>
        <Suspense fallback={null}>
          <Environment
            files="/environments/studio_small_08_1k.hdr"
            background={false}
            environmentIntensity={0.85}
            environmentRotation={[0, Math.PI / 4, 0]}
          />
        </Suspense>
      </DrivingEnvironmentErrorBoundary>

      {/* ─── 3. Dual-Tone Hemisphere Ambient Light ─── */}
      {/* Sky Blue zenith fill + Warm earthy meadow ground bounce */}
      <hemisphereLight
        skyColor="#98CBF5"
        groundColor="#2A3E1E"
        intensity={0.72}
      />

      {/* ─── 4. Directional Sunlight with High-Precision Shadow Map ─── */}
      <directionalLight
        position={sunPosition}
        intensity={2.6}
        color="#FFF6EA"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1.0}
        shadow-camera-far={160.0}
        shadow-camera-left={-28.0}
        shadow-camera-right={28.0}
        shadow-camera-top={28.0}
        shadow-camera-bottom={-28.0}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />

      {/* ─── 5. Secondary Ambient Horizon Fill Light ─── */}
      <directionalLight
        position={[-40, 25, 35]}
        intensity={0.48}
        color="#A2C8E6"
      />

      {/* ─── 6. High-Precision Underbody Contact Shadow ─── */}
      {/* Positioned at Y = 0.0025m (0.5mm above asphalt surface Y = 0.002m) */}
      <ContactShadows
        position={[0, 0.0025, 0]}
        opacity={0.85}
        scale={12}
        blur={1.6}
        far={2.5}
        resolution={1024}
        color="#0A120D"
      />
    </group>
  );
}
