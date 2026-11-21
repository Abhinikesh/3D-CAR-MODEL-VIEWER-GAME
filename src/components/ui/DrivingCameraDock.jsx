import React from 'react';
import { Video, Compass, Eye } from 'lucide-react';
import { useAppModeStore, DRIVING_VIEWS } from '../../store/appModeStore.js';

const DRIVING_CAMERA_MODES = [
  { id: DRIVING_VIEWS.CHASE, label: 'CHASE (1)', desc: 'Third-Person Chase Follow (Default)' },
  { id: DRIVING_VIEWS.CLOSE, label: 'CLOSE (2)', desc: 'Close Dynamic Sports Follow' },
  { id: DRIVING_VIEWS.WIDE, label: 'WIDE (3)', desc: 'Wide Track Cinematic Chase' },
  { id: DRIVING_VIEWS.HOOD, label: 'BONNET (4)', desc: 'Forward Bonnet / Cockpit View' },
  { id: DRIVING_VIEWS.BUMPER, label: 'BUMPER (5)', desc: 'Low Front Splitter Speed View' },
  { id: DRIVING_VIEWS.ORBIT, label: 'ORBIT (6)', desc: '360° Vehicle Inspection Orbit' },
  { id: DRIVING_VIEWS.AERIAL, label: 'AERIAL (7)', desc: 'High-Altitude Circuit Map' },
  { id: DRIVING_VIEWS.TURN1, label: 'TURN 1 (8)', desc: 'North Sweeper Apex Spectator' },
  { id: DRIVING_VIEWS.HAIRPIN, label: 'HAIRPIN (9)', desc: 'South Hairpin Apex Spectator' },
];

export default function DrivingCameraDock() {
  const currentView = useAppModeStore((state) => state.drivingView);
  const setDrivingView = useAppModeStore((state) => state.setDrivingView);
  const cycleDrivingView = useAppModeStore((state) => state.cycleDrivingView);
  const resetDrivingCamera = useAppModeStore((state) => state.resetDrivingCamera);

  return (
    <div style={styles.container}>
      <div style={styles.dockBar}>
        <button
          onClick={cycleDrivingView}
          style={styles.dockLabelGroupBtn}
          title="Click or press 'C' to cycle camera perspectives"
        >
          <Video size={12} color="var(--accent-cyan)" />
          <span style={styles.dockLabel}>CAM [C]</span>
        </button>

        <div style={styles.divider} />

        <div style={styles.buttonScroll}>
          {DRIVING_CAMERA_MODES.map((cam) => {
            const isSelected = currentView === cam.id;
            return (
              <button
                key={cam.id}
                onClick={() => setDrivingView(cam.id)}
                style={{
                  ...styles.viewBtn,
                  ...(isSelected ? styles.viewBtnActive : {}),
                }}
                title={cam.desc}
              >
                <span style={isSelected ? styles.viewLabelActive : styles.viewLabel}>
                  {cam.label}
                </span>
                {isSelected && <span style={styles.activeDot} />}
              </button>
            );
          })}
        </div>

        <div style={styles.divider} />

        <button
          onClick={resetDrivingCamera}
          style={styles.resetBtn}
          title="Reset camera follow alignment"
        >
          <Compass size={11} color="#94A3B8" />
          <span style={styles.resetLabel}>ALIGN</span>
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
    zIndex: 20,
    pointerEvents: 'auto',
  },
  dockBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(15, 23, 42, 0.88)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '4px 8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
  },
  dockLabelGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '0 4px',
  },
  dockLabelGroupBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 6px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.15s ease',
  },
  dockLabel: {
    fontSize: '9px',
    fontWeight: '700',
    letterSpacing: '0.1em',
    color: 'var(--accent-cyan)',
    fontFamily: 'monospace',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 6px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  resetLabel: {
    fontSize: '9px',
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: '0.06em',
  },
  divider: {
    width: '1px',
    height: '14px',
    background: 'rgba(255, 255, 255, 0.1)',
  },
  buttonScroll: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '6px',
    padding: '4px 8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  viewBtnActive: {
    background: 'rgba(0, 240, 255, 0.12)',
    border: '1px solid rgba(0, 240, 255, 0.4)',
    boxShadow: '0 0 10px rgba(0, 240, 255, 0.2)',
  },
  viewLabel: {
    fontSize: '10px',
    fontWeight: '500',
    color: '#94A3B8',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  viewLabelActive: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#00F0FF',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  activeDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: '#00F0FF',
    boxShadow: '0 0 6px #00F0FF',
  },
};
