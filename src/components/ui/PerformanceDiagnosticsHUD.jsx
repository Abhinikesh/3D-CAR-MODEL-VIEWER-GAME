import React, { useEffect } from 'react';
import {
  Activity,
  Layers,
  Cpu,
  Database,
  X,
  Gauge,
  AlertTriangle,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { usePerformanceStore } from '../../store/performanceStore.js';

/**
 * Performance Diagnostics HUD
 *
 * Professional automotive-grade telemetry overlay for real-time 3D profiling.
 * Displays live FPS, frame budget, WebGL draw calls, geometry & texture counts,
 * and memory metrics. Toggleable via 'D' key or header button.
 */
export default function PerformanceDiagnosticsHUD() {
  const {
    fps,
    frameTimeMs,
    drawCalls,
    triangles,
    geometries,
    textures,
    programs,
    jsHeapMB,
    webglVersion,
    isContextLost,
    isDiagnosticsOpen,
    toggleDiagnostics,
    setDiagnosticsOpen,
  } = usePerformanceStore();

  // Keyboard shortcut listener: 'D' or 'd' toggles HUD
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleDiagnostics();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDiagnostics]);

  if (!isDiagnosticsOpen && !isContextLost) return null;

  // Frame rate color status
  const fpsColor =
    fps >= 55 ? '#10B981' : fps >= 30 ? '#F59E0B' : '#EF4444';
  const fpsStatus =
    fps >= 55 ? 'OPTIMAL' : fps >= 30 ? 'ACCEPTABLE' : 'DEGRADED';

  return (
    <div style={styles.hudOverlay}>
      {/* Context Loss Alert Banner */}
      {isContextLost && (
        <div style={styles.contextLostBanner}>
          <AlertTriangle size={18} color="#EF4444" />
          <div>
            <strong>WebGL Context Lost</strong>
            <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.85 }}>
              Graphics context paused. Attempting automatic resource restoration...
            </p>
          </div>
        </div>
      )}

      {/* Main Diagnostics Panel */}
      {isDiagnosticsOpen && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <Gauge size={16} color="var(--accent-cyan, #45A29E)" />
              <span style={styles.headerTitle}>GPU & FRAME TELEMETRY</span>
              <span style={styles.hotkeyBadge}>KEY: D</span>
            </div>
            <button
              onClick={() => setDiagnosticsOpen(false)}
              style={styles.closeButton}
              title="Close HUD (Press D)"
            >
              <X size={15} />
            </button>
          </div>

          {/* Primary FPS & Frame Time Gauge */}
          <div style={styles.heroGaugeRow}>
            <div style={styles.heroGaugeCard}>
              <span style={styles.gaugeLabel}>RENDER FPS</span>
              <div style={styles.gaugeValueRow}>
                <span style={{ ...styles.fpsNumber, color: fpsColor }}>{fps}</span>
                <span style={{ ...styles.fpsBadge, backgroundColor: `${fpsColor}20`, color: fpsColor }}>
                  {fpsStatus}
                </span>
              </div>
              <div style={styles.frameTimeSubtext}>
                Frame budget: <strong>{frameTimeMs.toFixed(1)} ms</strong> / 16.6 ms
              </div>
            </div>

            <div style={styles.heroGaugeCard}>
              <span style={styles.gaugeLabel}>DRAW CALLS</span>
              <div style={styles.gaugeValueRow}>
                <span style={styles.heroMetricValue}>{drawCalls}</span>
                <span style={styles.metricUnit}>calls/frame</span>
              </div>
              <div style={styles.frameTimeSubtext}>
                Triangles: <strong>{(triangles / 1000).toFixed(1)}k</strong> rendered
              </div>
            </div>
          </div>

          {/* Detailed GPU & Memory Grid */}
          <div style={styles.metricsGrid}>
            <div style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <Layers size={13} color="#60A5FA" />
                <span>Geometries</span>
              </div>
              <span style={styles.metricValue}>{geometries}</span>
              <span style={styles.metricSub}>Active GPU buffers</span>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <Database size={13} color="#A78BFA" />
                <span>Textures</span>
              </div>
              <span style={styles.metricValue}>{textures}</span>
              <span style={styles.metricSub}>VRAM texture units</span>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <Cpu size={13} color="#34D399" />
                <span>Shaders</span>
              </div>
              <span style={styles.metricValue}>{programs}</span>
              <span style={styles.metricSub}>Compiled GL programs</span>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <Flame size={13} color="#FBBF24" />
                <span>JS Heap</span>
              </div>
              <span style={styles.metricValue}>
                {jsHeapMB ? `${jsHeapMB} MB` : 'N/A'}
              </span>
              <span style={styles.metricSub}>V8 process memory</span>
            </div>
          </div>

          {/* Engine Footer */}
          <div style={styles.footer}>
            <div style={styles.engineInfo}>
              <CheckCircle2 size={12} color="#10B981" />
              <span>{webglVersion} • THREE.WebGLRenderer • Dithering Active</span>
            </div>
            <span style={styles.footerHint}>Press [D] to dismiss</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  hudOverlay: {
    position: 'absolute',
    top: '72px',
    right: '24px',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    pointerEvents: 'none',
  },
  contextLostBanner: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    backgroundColor: '#7F1D1D',
    border: '1px solid #DC2626',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    color: '#FEE2E2',
    fontSize: '0.8rem',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  panel: {
    pointerEvents: 'auto',
    width: '320px',
    backgroundColor: 'rgba(11, 15, 23, 0.94)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    padding: '1rem',
    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(69, 162, 158, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  headerTitle: {
    fontSize: '0.74rem',
    fontWeight: '800',
    letterSpacing: '0.06em',
    color: '#F8FAFC',
    fontFamily: 'var(--font-mono, monospace)',
  },
  hotkeyBadge: {
    fontSize: '0.6rem',
    fontWeight: '700',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: 'var(--accent-cyan, #45A29E)',
    padding: '1px 5px',
    borderRadius: '4px',
    border: '1px solid rgba(69, 162, 158, 0.3)',
    fontFamily: 'var(--font-mono, monospace)',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'color 0.15s',
  },
  heroGaugeRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.6rem',
  },
  heroGaugeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    padding: '0.65rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  gaugeLabel: {
    fontSize: '0.62rem',
    fontWeight: '700',
    letterSpacing: '0.04em',
    color: '#94A3B8',
    fontFamily: 'var(--font-mono, monospace)',
  },
  gaugeValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
  },
  fpsNumber: {
    fontSize: '1.6rem',
    fontWeight: '900',
    lineHeight: 1.1,
    fontFamily: 'var(--font-mono, monospace)',
  },
  fpsBadge: {
    fontSize: '0.56rem',
    fontWeight: '800',
    padding: '1px 5px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-mono, monospace)',
  },
  frameTimeSubtext: {
    fontSize: '0.64rem',
    color: '#64748B',
    fontFamily: 'var(--font-mono, monospace)',
    marginTop: '0.15rem',
  },
  heroMetricValue: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: '#F8FAFC',
    lineHeight: 1.1,
    fontFamily: 'var(--font-mono, monospace)',
  },
  metricUnit: {
    fontSize: '0.62rem',
    color: '#64748B',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '0.5rem 0.65rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.64rem',
    fontWeight: '600',
    color: '#94A3B8',
  },
  metricValue: {
    fontSize: '0.95rem',
    fontWeight: '800',
    color: '#F8FAFC',
    fontFamily: 'var(--font-mono, monospace)',
  },
  metricSub: {
    fontSize: '0.58rem',
    color: '#475569',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '0.45rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  engineInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.6rem',
    color: '#64748B',
    fontFamily: 'var(--font-mono, monospace)',
  },
  footerHint: {
    fontSize: '0.58rem',
    color: '#475569',
    fontFamily: 'var(--font-mono, monospace)',
  },
};
