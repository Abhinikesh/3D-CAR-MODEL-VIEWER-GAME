import { create } from 'zustand';

/**
 * Performance & Diagnostics Store
 *
 * Maintains live rendering telemetry, WebGL statistics, memory profiling,
 * and HUD visibility for real-time monitoring and benchmarking.
 */
export const usePerformanceStore = create((set, get) => ({
  // Telemetry state
  fps: 60,
  frameTimeMs: 16.6,
  drawCalls: 0,
  triangles: 0,
  lines: 0,
  points: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  jsHeapMB: null,
  webglVersion: 'WebGL 2.0',
  isContextLost: false,

  // HUD Visibility
  isDiagnosticsOpen: false,

  // Actions
  toggleDiagnostics: () =>
    set((state) => ({ isDiagnosticsOpen: !state.isDiagnosticsOpen })),

  setDiagnosticsOpen: (isOpen) =>
    set({ isDiagnosticsOpen: Boolean(isOpen) }),

  setContextLost: (lost) =>
    set({ isContextLost: Boolean(lost) }),

  updateMetrics: (metrics) =>
    set((state) => ({
      ...state,
      ...metrics,
    })),

  getSnapshot: () => {
    const s = get();
    return {
      fps: s.fps,
      frameTimeMs: s.frameTimeMs,
      drawCalls: s.drawCalls,
      triangles: s.triangles,
      geometries: s.geometries,
      textures: s.textures,
      programs: s.programs,
      jsHeapMB: s.jsHeapMB,
      isContextLost: s.isContextLost,
    };
  },
}));
