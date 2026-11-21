import { useEffect, useRef, useMemo } from 'react';
import { useWheelStore } from '../store/wheelStore.js';
import { WheelCustomizationEngine } from '../materials/wheelCustomizationEngine.js';
import { ALL_RIM_MESH_NAMES, ALL_CALIPER_MESH_NAMES } from '../materials/wheelMaterialFactory.js';

/**
 * React hook connecting the wheelStore state to the Three.js 3D scene.
 *
 * @param {THREE.Object3D} rootScene - Root 3D car scene graph
 * @returns {Object} Public Wheel Customization API
 */
export function useWheelCustomization(rootScene) {
  const engineRef = useRef(null);

  if (!engineRef.current) {
    engineRef.current = new WheelCustomizationEngine();
  }

  // Subscribe to granular store state
  const rimFinishes = useWheelStore((s) => s.rimFinishes);
  const caliperPreset = useWheelStore((s) => s.caliperPreset);
  const customCaliperColor = useWheelStore((s) => s.customCaliperColor);
  const isFactoryWheels = useWheelStore((s) => s.isFactoryWheels);

  const setRimFinish = useWheelStore((s) => s.setRimFinish);
  const setCustomRimColor = useWheelStore((s) => s.setCustomRimColor);
  const setCaliperPreset = useWheelStore((s) => s.setCaliperPreset);
  const setCustomCaliperColor = useWheelStore((s) => s.setCustomCaliperColor);
  const setTargetMode = useWheelStore((s) => s.setTargetMode);
  const setSelectedWheel = useWheelStore((s) => s.setSelectedWheel);
  const resetWheelsToFactory = useWheelStore((s) => s.resetWheelsToFactory);
  const getWheelConfig = useWheelStore((s) => s.getWheelConfig);

  // Initialize engine on scene load
  useEffect(() => {
    if (rootScene) {
      engineRef.current.initializeFromScene(rootScene);
      if (!isFactoryWheels) {
        engineRef.current.applyRimFinishes(rimFinishes);
        engineRef.current.applyCaliperFinish(caliperPreset, customCaliperColor);
      }
    }
  }, [rootScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronize rim finishes
  useEffect(() => {
    if (!rootScene || !engineRef.current) return;
    if (isFactoryWheels) {
      engineRef.current.restoreFactoryWheels();
    } else {
      engineRef.current.applyRimFinishes(rimFinishes);
    }
  }, [rootScene, rimFinishes, isFactoryWheels]);

  // Synchronize caliper finish
  useEffect(() => {
    if (!rootScene || !engineRef.current) return;
    if (!isFactoryWheels || caliperPreset !== 'factory') {
      engineRef.current.applyCaliperFinish(caliperPreset, customCaliperColor);
    }
  }, [rootScene, caliperPreset, customCaliperColor, isFactoryWheels]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  // Public API
  const api = useMemo(
    () => ({
      setRimFinish,
      setCustomRimColor,
      setCaliperPreset,
      setCustomCaliperColor,
      setTargetMode,
      setSelectedWheel,
      restoreFactoryWheels: resetWheelsToFactory,
      getWheelConfig,
      getAffectedMeshes: () => ({
        rims: [...ALL_RIM_MESH_NAMES],
        calipers: [...ALL_CALIPER_MESH_NAMES],
      }),
    }),
    [
      setRimFinish,
      setCustomRimColor,
      setCaliperPreset,
      setCustomCaliperColor,
      setTargetMode,
      setSelectedWheel,
      resetWheelsToFactory,
      getWheelConfig,
    ]
  );

  return api;
}
