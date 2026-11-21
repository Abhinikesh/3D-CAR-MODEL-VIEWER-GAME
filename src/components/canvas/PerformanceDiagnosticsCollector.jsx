import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { usePerformanceStore } from '../../store/performanceStore.js';

/**
 * Performance Diagnostics Collector
 *
 * Lightweight R3F component inside the WebGL canvas that monitors:
 * 1. Exact draw calls, triangle counts, and geometry/texture memory buffers from WebGLRenderer.info.
 * 2. Rolling smoothed frame rate (FPS) and instantaneous frame time (ms).
 * 3. Browser JS heap memory (via performance.memory where supported).
 * 4. WebGL context loss and recovery lifecycle events.
 *
 * Updates Zustand store at a throttled 10 Hz rate to prevent React re-render churn.
 */
export default function PerformanceDiagnosticsCollector() {
  const { gl } = useThree();
  const lastSyncTimeRef = useRef(performance.now());
  const frameTimesRef = useRef([]);
  const updateMetrics = usePerformanceStore((s) => s.updateMetrics);
  const setContextLost = usePerformanceStore((s) => s.setContextLost);

  // Expose renderer to window for profiling tools
  useEffect(() => {
    if (gl) {
      window.__THREE_RENDERER__ = gl;
    }
  }, [gl]);

  // WebGL context loss and restoration lifecycle listeners
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const handleContextLost = (event) => {
      event.preventDefault();
      console.warn('[PerformanceDiagnosticsCollector] WebGL Context Lost! Initiating graceful pause.');
      setContextLost(true);
    };

    const handleContextRestored = () => {
      console.info('[PerformanceDiagnosticsCollector] WebGL Context Restored! Rebuilding 3D scene resources.');
      setContextLost(false);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl, setContextLost]);

  // Rolling frame rate calculation and telemetry synchronization
  useFrame((_, delta) => {
    const now = performance.now();
    const frameTimeMs = delta * 1000;

    // Maintain circular buffer of recent frame intervals (last 30 frames)
    const frameBuffer = frameTimesRef.current;
    frameBuffer.push(delta);
    if (frameBuffer.length > 30) {
      frameBuffer.shift();
    }

    // Throttle store updates to ~100ms (10 fps) to avoid re-rendering UI every frame
    if (now - lastSyncTimeRef.current >= 100) {
      lastSyncTimeRef.current = now;

      // Compute smoothed average FPS
      const avgDelta =
        frameBuffer.reduce((sum, d) => sum + d, 0) / Math.max(1, frameBuffer.length);
      const smoothedFps = Math.round(1 / Math.max(0.001, avgDelta));

      // Read WebGLRenderer info
      const renderInfo = gl.info.render;
      const memInfo = gl.info.memory;
      const programsCount = gl.info.programs ? gl.info.programs.length : 0;

      // Read JS heap if Chromium performance.memory API is available
      let heapMB = null;
      if (window.performance && window.performance.memory) {
        heapMB = +(window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
      }

      const snapshot = {
        fps: smoothedFps,
        frameTimeMs: +frameTimeMs.toFixed(1),
        drawCalls: renderInfo.calls,
        triangles: renderInfo.triangles,
        lines: renderInfo.lines,
        points: renderInfo.points,
        geometries: memInfo.geometries,
        textures: memInfo.textures,
        programs: programsCount,
        jsHeapMB: heapMB,
        webglVersion: gl.capabilities.isWebGL2 ? 'WebGL 2.0 (ANGLE)' : 'WebGL 1.0',
      };

      // Expose globally for headless CDP test harnesses
      window.__PERF_METRICS__ = snapshot;

      // Update store
      updateMetrics(snapshot);
    }
  });

  return null;
}
