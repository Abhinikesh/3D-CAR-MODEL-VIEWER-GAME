import React from 'react';
import {
  Compass,
  RotateCw,
  Eye,
  Maximize2,
  Disc,
  CircleDot,
  ArrowUpRight,
} from 'lucide-react';
import { useCameraStore } from '../../store/cameraStore.js';

const QUICK_VIEWPOINTS = [
  { id: 'front-left', label: 'FRONT 3/4' },
  { id: 'side-left', label: 'SIDE PROFILE' },
  { id: 'rear-left', label: 'REAR 3/4' },
  { id: 'front', label: 'FRONT' },
  { id: 'rear', label: 'REAR' },
  { id: 'cockpit', label: 'COCKPIT' },
  { id: 'detail-wheel', label: 'WHEEL CLOSE' },
  { id: 'bottom', label: 'UNDERSIDE' },
];

export default function AutomotiveCameraDock() {
  const activePreset = useCameraStore((state) => state.activePreset);
  const setPreset = useCameraStore((state) => state.setPreset);
  const isTurntableActive = useCameraStore((state) => state.isTurntableActive);
  const toggleTurntable = useCameraStore((state) => state.toggleTurntable);
  const resetView = useCameraStore((state) => state.resetView);

  return (
    <div style={styles.container}>
      <div style={styles.dockBar}>
        <div style={styles.dockLabelGroup}>
          <Eye size={12} color="var(--accent-cyan)" />
          <span style={styles.dockLabel}>VIEWPOINTS</span>
        </div>

        <div style={styles.divider} />

        <div style={styles.buttonScroll}>
          {QUICK_VIEWPOINTS.map((vp) => {
            const isSelected = activePreset === vp.id;
            return (
              <button
                key={vp.id}
                onClick={() => setPreset(vp.id)}
                style={{
                  ...styles.viewBtn,
                  ...(isSelected ? styles.viewBtnActive : {}),
                }}
                title={`Switch camera to ${vp.label}`}
              >
                <span style={isSelected ? styles.viewLabelActive : styles.viewLabel}>
                  {vp.label}
                </span>
                {isSelected && <span style={styles.activeDot} />}
              </button>
            );
          })}
        </div>

        <div style={styles.divider} />

        {/* Quick Turntable */}
        <button
          onClick={toggleTurntable}
          style={{
            ...styles.toolBtn,
            color: isTurntableActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            border: isTurntableActive ? '1px solid var(--accent-cyan)' : '1px solid transparent',
          }}
          title={isTurntableActive ? 'Stop Turntable' : 'Start 360° Turntable'}
        >
          <RotateCw
            size={13}
            style={{
              animation: isTurntableActive ? 'spin 6s linear infinite' : 'none',
            }}
          />
          <span style={styles.toolBtnText}>360° SPIN</span>
        </button>

        {/* Quick Reset */}
        <button
          onClick={resetView}
          style={styles.toolBtn}
          title="Reset to default view"
        >
          <Compass size={13} />
          <span style={styles.toolBtnText}>RESET</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 15,
    pointerEvents: 'auto',
    maxWidth: 'calc(100% - 24px)',
  },
  dockBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 6px',
    backgroundColor: 'rgba(10, 14, 22, 0.82)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    maxWidth: '100%',
  },
  dockLabelGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0 5px',
    flexShrink: 0,
  },
  dockLabel: {
    fontSize: '0.62rem',
    fontWeight: '800',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
    letterSpacing: '0.08em',
  },
  divider: {
    width: '1px',
    height: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    flexShrink: 0,
  },
  buttonScroll: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 9px',
    borderRadius: '16px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.67rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    transition: 'all 0.15s ease',
  },
  viewBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.14)',
    color: '#FFFFFF',
    border: '1px solid rgba(0, 240, 255, 0.35)',
  },
  viewLabel: {
    color: 'var(--text-muted)',
  },
  viewLabelActive: {
    color: 'var(--accent-cyan)',
    fontWeight: '800',
  },
  activeDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-cyan)',
    boxShadow: '0 0 6px var(--accent-cyan)',
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 8px',
    borderRadius: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.65rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    transition: 'all 0.15s ease',
  },
  toolBtnText: {
    letterSpacing: '0.04em',
  },
};
