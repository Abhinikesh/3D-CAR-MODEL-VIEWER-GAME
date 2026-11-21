import React, { useState } from 'react';
import {
  DoorClosed,
  DoorOpen,
  Sliders,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Check,
  Zap,
} from 'lucide-react';
import { useVehicleRigStore } from '../../store/vehicleRigStore.js';
import { CLOSURE_RIG_CONFIG, CLOSURE_IDS } from '../../utils/vehicleRigRegistry.js';
import { useCameraStore } from '../../store/cameraStore.js';

export function VehicleRigToolbar() {
  const [isOpen, setIsOpen] = useState(false);

  const closures = useVehicleRigStore((state) => state.closures);
  const isAnyAnimating = useVehicleRigStore((state) => state.isAnyAnimating);
  const toggleClosure = useVehicleRigStore((state) => state.toggleClosure);
  const openAll = useVehicleRigStore((state) => state.openAll);
  const closeAll = useVehicleRigStore((state) => state.closeAll);
  const resetAll = useVehicleRigStore((state) => state.resetAll);

  const handleFocus = (focusKey, e) => {
    e.stopPropagation();
    if (focusKey) {
      useCameraStore.getState().focusOn(focusKey);
    }
  };

  // Count open closures
  const openCount = Object.values(closures).filter((c) => c.currentProgress > 0.05).length;

  return (
    <div style={styles.container}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.triggerBtn,
          border: openCount > 0 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
        }}
        title="Automotive Closures & Rigging Controls (Doors, Bonnet, Boot)"
      >
        <div style={styles.triggerLeft}>
          <div
            style={{
              ...styles.iconBadge,
              backgroundColor: openCount > 0 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
            }}
          >
            {openCount > 0 ? (
              <DoorOpen size={16} color="var(--accent-cyan)" />
            ) : (
              <DoorClosed size={16} color="#A0AEC0" />
            )}
          </div>
          <div style={styles.triggerTextGroup}>
            <span style={styles.triggerLabel}>CLOSURES RIG</span>
            <span style={styles.triggerValue}>
              {openCount > 0 ? `${openCount}/4 OPEN` : 'ALL CLOSED'}
            </span>
          </div>
        </div>
        <ChevronDown
          size={14}
          color="var(--text-muted)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div style={styles.popover}>
          <div style={styles.popoverHeader}>
            <div style={styles.headerTitleGroup}>
              <Sliders size={14} color="var(--accent-cyan)" />
              <span style={styles.headerTitle}>AUTOMOTIVE RIG &amp; CLOSURES</span>
            </div>
            {isAnyAnimating && (
              <span style={styles.animBadge}>
                <span style={styles.animDot} /> ANIMATING
              </span>
            )}
          </div>

          {/* 4 Movable Closure Control Rows */}
          <div style={styles.closureList}>
            {CLOSURE_IDS.map((id) => {
              const config = CLOSURE_RIG_CONFIG[id];
              const data = closures[id];
              const pct = Math.round((data?.currentProgress ?? 0) * 100);
              const isOpenState = (data?.currentProgress ?? 0) > 0.5;

              let statusText = 'CLOSED';
              let statusColor = 'var(--text-muted)';
              if (data?.state === 'opening') {
                statusText = `OPENING (${pct}%)`;
                statusColor = 'var(--accent-cyan)';
              } else if (data?.state === 'closing') {
                statusText = `CLOSING (${pct}%)`;
                statusColor = 'var(--status-pending)';
              } else if (data?.state === 'open' || pct >= 99) {
                statusText = 'OPEN (100%)';
                statusColor = 'var(--status-ready)';
              }

              return (
                <div key={id} style={styles.closureRow}>
                  <div style={styles.closureInfo}>
                    <div style={styles.closureNameGroup}>
                      <span style={styles.closureName}>{config.shortName}</span>
                      <span style={{ ...styles.statusTag, color: statusColor }}>
                        {statusText}
                      </span>
                    </div>

                    {/* Progress Bar Track */}
                    <div style={styles.progressTrack}>
                      <div
                        style={{
                          ...styles.progressBar,
                          width: `${pct}%`,
                          backgroundColor:
                            pct > 95
                              ? 'var(--status-ready)'
                              : pct > 5
                              ? 'var(--accent-cyan)'
                              : 'transparent',
                        }}
                      />
                    </div>
                  </div>

                  <div style={styles.closureActions}>
                    <button
                      onClick={() => toggleClosure(id)}
                      style={{
                        ...styles.toggleBtn,
                        backgroundColor: isOpenState
                          ? 'rgba(231, 76, 60, 0.15)'
                          : 'rgba(0, 240, 255, 0.12)',
                        borderColor: isOpenState
                          ? 'rgba(231, 76, 60, 0.5)'
                          : 'rgba(0, 240, 255, 0.4)',
                        color: isOpenState ? '#FF7B7B' : 'var(--accent-cyan)',
                      }}
                      title={`Toggle ${config.name}`}
                    >
                      {isOpenState ? 'CLOSE' : 'OPEN'}
                    </button>

                    <button
                      onClick={(e) => handleFocus(config.cameraFocusTarget, e)}
                      style={styles.focusBtn}
                      title={`Frame camera on ${config.name}`}
                    >
                      <Maximize2 size={12} color="var(--text-muted)" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master Coordination Controls */}
          <div style={styles.masterControls}>
            <button
              onClick={openAll}
              style={styles.masterBtn}
              title="Open all 4 vehicle closures simultaneously"
            >
              <DoorOpen size={13} color="var(--accent-cyan)" />
              <span>OPEN ALL</span>
            </button>

            <button
              onClick={closeAll}
              style={styles.masterBtn}
              title="Close all 4 vehicle closures"
            >
              <DoorClosed size={13} color="var(--accent-teal)" />
              <span>CLOSE ALL</span>
            </button>

            <button
              onClick={resetAll}
              style={styles.resetBtn}
              title="Instantly snap all closures to factory closed position"
            >
              <RotateCcw size={12} />
              <span>RESET</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  triggerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.65rem',
    minWidth: '175px',
    padding: '0.45rem 0.75rem',
    backgroundColor: 'rgba(12, 16, 23, 0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  triggerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
  },
  iconBadge: {
    width: '28px',
    height: '28px',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.1rem',
  },
  triggerLabel: {
    fontSize: '0.62rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  triggerValue: {
    fontSize: '0.74rem',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
    color: '#FFFFFF',
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    width: '320px',
    backgroundColor: 'rgba(11, 15, 22, 0.96)',
    backdropFilter: 'blur(18px)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '10px',
    padding: '0.9rem',
    zIndex: 30,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.75), 0 0 16px rgba(0, 240, 255, 0.1)',
  },
  popoverHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.8rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid rgba(44, 54, 69, 0.6)',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  headerTitle: {
    fontSize: '0.74rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    color: '#FFFFFF',
    letterSpacing: '0.5px',
  },
  animBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.62rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
  },
  animDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-cyan)',
    boxShadow: '0 0 6px var(--accent-cyan)',
  },
  closureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    marginBottom: '0.85rem',
  },
  closureRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.65rem',
    backgroundColor: 'rgba(20, 27, 38, 0.7)',
    border: '1px solid rgba(44, 54, 69, 0.55)',
    borderRadius: '6px',
    gap: '0.65rem',
  },
  closureInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  closureNameGroup: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closureName: {
    fontSize: '0.72rem',
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'var(--font-mono)',
  },
  statusTag: {
    fontSize: '0.62rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: '500',
  },
  progressTrack: {
    width: '100%',
    height: '3px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.05s linear',
  },
  closureActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  toggleBtn: {
    padding: '0.3rem 0.55rem',
    borderRadius: '4px',
    border: '1px solid',
    fontSize: '0.66rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  focusBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.3rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
  },
  masterControls: {
    display: 'flex',
    gap: '0.45rem',
    paddingTop: '0.55rem',
    borderTop: '1px solid rgba(44, 54, 69, 0.6)',
  },
  masterBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.45rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(20, 27, 38, 0.85)',
    border: '1px solid rgba(44, 54, 69, 0.8)',
    color: '#FFFFFF',
    fontSize: '0.66rem',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    padding: '0.45rem 0.65rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: 'var(--text-muted)',
    fontSize: '0.66rem',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
};
