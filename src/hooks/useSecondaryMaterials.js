import { useEffect, useRef, useMemo } from 'react';
import { useSecondaryMaterialStore } from '../store/secondaryMaterialStore.js';
import { SecondaryMaterialEngine } from '../materials/secondaryMaterialEngine.js';

/**
 * React hook orchestrating runtime secondary material application.
 * Bridges Zustand secondaryMaterialStore with the Three.js scene graph.
 *
 * Usage: Call once inside CarSceneGraph alongside usePaintMaterials.
 * The engine is fully independent of the PaintOverrideEngine (Part 9).
 *
 * @param {THREE.Object3D} rootScene - Car model root scene object
 * @returns {Object} Public secondary material API
 */
export function useSecondaryMaterials(rootScene) {
  const engineRef = useRef(null);

  // Lazy-initialize engine singleton
  if (!engineRef.current) {
    engineRef.current = new SecondaryMaterialEngine();
  }

  // -------------------------------------------------------------------------
  // Subscribe to store state slices (granular — prevents over-rendering)
  // -------------------------------------------------------------------------
  const glassProfile = useSecondaryMaterialStore((s) => s.glassProfile);
  const chromeProfile = useSecondaryMaterialStore((s) => s.chromeProfile);
  const rubberProfile = useSecondaryMaterialStore((s) => s.rubberProfile);
  const plasticProfile = useSecondaryMaterialStore((s) => s.plasticProfile);
  const headlightsOn = useSecondaryMaterialStore((s) => s.headlightsOn);
  const taillightsOn = useSecondaryMaterialStore((s) => s.taillightsOn);
  const indicatorsOn = useSecondaryMaterialStore((s) => s.indicatorsOn);
  const brakeLightsOn = useSecondaryMaterialStore((s) => s.brakeLightsOn);
  const isFactorySecondary = useSecondaryMaterialStore((s) => s.isFactorySecondary);

  const setGlassProfile = useSecondaryMaterialStore((s) => s.setGlassProfile);
  const setChromeProfile = useSecondaryMaterialStore((s) => s.setChromeProfile);
  const setRubberProfile = useSecondaryMaterialStore((s) => s.setRubberProfile);
  const setPlasticProfile = useSecondaryMaterialStore((s) => s.setPlasticProfile);
  const setHeadlights = useSecondaryMaterialStore((s) => s.setHeadlights);
  const setTaillights = useSecondaryMaterialStore((s) => s.setTaillights);
  const setIndicators = useSecondaryMaterialStore((s) => s.setIndicators);
  const setBrakeLights = useSecondaryMaterialStore((s) => s.setBrakeLights);
  const resetAllSecondary = useSecondaryMaterialStore((s) => s.resetAllSecondary);
  const getSecondaryConfig = useSecondaryMaterialStore((s) => s.getSecondaryConfig);

  // -------------------------------------------------------------------------
  // Initialize engine when scene graph is ready
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (rootScene) {
      engineRef.current.initializeFromScene(rootScene);
      // Apply current store state to any initial non-factory values
      if (!isFactorySecondary) {
        engineRef.current.applyGlass(glassProfile);
        engineRef.current.applyChrome(chromeProfile);
        engineRef.current.applyRubber(rubberProfile);
        engineRef.current.applyPlastic(plasticProfile);
        engineRef.current.setHeadlights(headlightsOn);
        engineRef.current.setTaillights(taillightsOn);
        engineRef.current.setIndicators(indicatorsOn);
        engineRef.current.setBrakeLights(brakeLightsOn);
      }
    }
  }, [rootScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Factory restore: when isFactorySecondary becomes true, restore all
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!rootScene || !engineRef.current) return;
    if (isFactorySecondary) {
      engineRef.current.restoreAllSecondary();
    }
  }, [rootScene, isFactorySecondary]);

  // -------------------------------------------------------------------------
  // Per-category reactive effects
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!rootScene || isFactorySecondary) return;
    engineRef.current.applyGlass(glassProfile);
  }, [rootScene, glassProfile, isFactorySecondary]);

  useEffect(() => {
    if (!rootScene || isFactorySecondary) return;
    engineRef.current.applyChrome(chromeProfile);
  }, [rootScene, chromeProfile, isFactorySecondary]);

  useEffect(() => {
    if (!rootScene || isFactorySecondary) return;
    engineRef.current.applyRubber(rubberProfile);
  }, [rootScene, rubberProfile, isFactorySecondary]);

  useEffect(() => {
    if (!rootScene || isFactorySecondary) return;
    engineRef.current.applyPlastic(plasticProfile);
  }, [rootScene, plasticProfile, isFactorySecondary]);

  useEffect(() => {
    if (!rootScene) return;
    engineRef.current.setHeadlights(headlightsOn);
  }, [rootScene, headlightsOn]);

  useEffect(() => {
    if (!rootScene) return;
    engineRef.current.setTaillights(taillightsOn);
  }, [rootScene, taillightsOn]);

  useEffect(() => {
    if (!rootScene) return;
    engineRef.current.setIndicators(indicatorsOn);
  }, [rootScene, indicatorsOn]);

  useEffect(() => {
    if (!rootScene) return;
    engineRef.current.setBrakeLights(brakeLightsOn);
  }, [rootScene, brakeLightsOn]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  const api = useMemo(
    () => ({
      applyGlassProfile: setGlassProfile,
      applyChromeProfile: setChromeProfile,
      applyRubberProfile: setRubberProfile,
      applyPlasticProfile: setPlasticProfile,
      toggleHeadlights: setHeadlights,
      toggleTaillights: setTaillights,
      toggleIndicators: setIndicators,
      toggleBrakeLights: setBrakeLights,
      resetToFactory: resetAllSecondary,
      getConfig: getSecondaryConfig,
    }),
    [
      setGlassProfile, setChromeProfile, setRubberProfile, setPlasticProfile,
      setHeadlights, setTaillights, setIndicators, setBrakeLights,
      resetAllSecondary, getSecondaryConfig,
    ]
  );

  return api;
}
