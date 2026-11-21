import React, { useEffect } from 'react';
import {
  Gauge,
  Zap,
  Flame,
  ShieldAlert,
  Camera,
  Pause,
  Play,
  RotateCcw,
  Video,
  LogOut,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import { useVehiclePhysicsStore } from '../../store/vehiclePhysicsStore.js';
import { useVehicleInputStore, VEHICLE_GEAR, INPUT_SOURCE } from '../../scenes/driving/vehicleInputStore.js';
import { useAppModeStore, APP_MODES } from '../../store/appModeStore.js';
import { useControllerSessionStore } from '../../services/controller/controllerSessionStore.js';
import { sendControllerTelemetry } from '../../services/controller/useControllerWebSocket.js';

/**
 * DrivingHUD Component (Part 32)
 *
 * Professional automotive instrument cluster and vehicle status HUD for single-player Driving Mode:
 * - Real SI-derived digital speedometer in km/h and m/s.
 * - Reverse speed formatting and standstill 0 km/h handling.
 * - Authentic PRND transmission gear indicator tied directly to physics kinematics.
 * - Live Throttle, Brake, and Handbrake intensity meters.
 * - Steering angle (degrees) with directional cues and lateral G force telemetry.
 * - Dynamic surface contact badge (Asphalt, Curb, Grass) and barrier collision warning.
 * - Driving camera perspective indicator with one-click view cycling.
 * - HUD quick actions: Pause/Resume, Vehicle Reset, Camera switch, and Exit to Showroom.
 * - Dedicated Simulation Pause modal overlay with live frozen telemetry and recovery controls.
 */
export default function DrivingHUD() {
  const drivetrain = useVehiclePhysicsStore((state) => state.drivetrain);
  const steering = useVehiclePhysicsStore((state) => state.steering);
  const collision = useVehiclePhysicsStore((state) => state.collision);
  const isPaused = useVehiclePhysicsStore((state) => state.isPaused);
  const togglePause = useVehiclePhysicsStore((state) => state.togglePause);
  const resume = useVehiclePhysicsStore((state) => state.resume);
  const requestReset = useVehiclePhysicsStore((state) => state.requestReset);

  const inputThrottle = useVehicleInputStore((state) => state.throttle);
  const inputBrake = useVehicleInputStore((state) => state.brake);
  const inputHandbrake = useVehicleInputStore((state) => state.handbrake);
  const activeSource = useVehicleInputStore((state) => state.activeSource);
  const isPhoneActive = activeSource === INPUT_SOURCE.SMARTPHONE;

  const appMode = useAppModeStore((state) => state.mode);
  const setAppMode = useAppModeStore((state) => state.setMode);
  const drivingView = useAppModeStore((state) => state.drivingView);
  const cycleDrivingView = useAppModeStore((state) => state.cycleDrivingView);

  // Speedometer & Drivetrain Telemetry
  const currentGear = drivetrain?.gear || VEHICLE_GEAR.DRIVE;
  const rawLongSpeed = drivetrain?.longitudinalSpeed || 0;
  const isAtStandstill = Math.abs(rawLongSpeed) < 0.05;
  const displaySpeed = isAtStandstill ? 0 : drivetrain?.displaySpeed || 0;
  const speedMs = isAtStandstill ? '0.0' : Math.abs(rawLongSpeed).toFixed(1);

  const isBraking = drivetrain?.isBraking || inputBrake > 0.01 || inputHandbrake;
  const isAccelerating = drivetrain?.isAccelerating || inputThrottle > 0.01;
  const isReversing = currentGear === VEHICLE_GEAR.REVERSE;

  // Part 37: Stream live vehicle speed telemetry to connected smartphone controller
  useEffect(() => {
    if (!isPhoneActive) return;
    sendControllerTelemetry({
      v: 1,
      type: 'telemetry',
      speedKmh: displaySpeed,
      gear: currentGear,
    });
  }, [isPhoneActive, displaySpeed, currentGear]);

  // Steering telemetry formatting
  const steerAngle = steering?.centralAngleDeg || 0;
  const steerDirection = steerAngle > 0.5 ? '◀ LEFT' : steerAngle < -0.5 ? 'RIGHT ▶' : 'CENTER';
  const lateralG = Math.abs(steering?.lateralG || 0).toFixed(2);

  // Surface & collision telemetry
  const isOffRoad = collision?.isOffRoad;
  const surfaceType = collision?.surfaceType || 'asphalt';
  let surfaceName = 'ASPHALT';
  let surfaceColor = '#10B981'; // Emerald
  if (surfaceType === 'grass') {
    surfaceName = 'GRASS RUNOFF';
    surfaceColor = '#F97316'; // Orange
  } else if (surfaceType === 'kerb') {
    surfaceName = 'CURB SHOULDER';
    surfaceColor = '#F59E0B'; // Amber
  }

  const hasCollided = collision?.hasCollided;
  const impactSpeedKmh = collision?.impactSpeedKmh || 0;

  // Active driving camera mode label
  const cameraLabel = drivingView?.toUpperCase() || 'CHASE';

  return (
    <>
      {/* ─── Non-intrusive HUD Container ─── */}
      <div style={styles.hudContainer}>
        {/* Quick-Actions Floating Control Bar */}
        <div style={styles.quickBar}>
          <button
            onClick={togglePause}
            style={{
              ...styles.quickBtn,
              backgroundColor: isPaused ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              borderColor: isPaused ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.12)',
              color: isPaused ? 'var(--accent-cyan)' : '#E2E8F0',
            }}
            title="Pause Simulation [ESC or P]"
          >
            {isPaused ? <Play size={11} /> : <Pause size={11} />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          <button
            onClick={() => requestReset()}
            style={styles.quickBtn}
            title="Reset Vehicle to Start Position [R]"
          >
            <RotateCcw size={11} />
            <span>RESET</span>
          </button>

          <button
            onClick={cycleDrivingView}
            style={styles.quickBtn}
            title="Cycle Camera Perspective [C]"
          >
            <Video size={11} />
            <span>CAM</span>
          </button>

          <button
            onClick={() => useControllerSessionStore.getState().togglePanel()}
            style={{
              ...styles.quickBtn,
              backgroundColor: isPhoneActive ? 'rgba(0, 240, 255, 0.18)' : 'rgba(255, 255, 255, 0.06)',
              borderColor: isPhoneActive ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.12)',
              color: isPhoneActive ? 'var(--accent-cyan)' : '#E2E8F0',
            }}
            title="Connect Phone Controller [Local Wi-Fi]"
          >
            <Smartphone size={11} />
            <span>{isPhoneActive ? 'PHONE' : 'CONNECT'}</span>
          </button>

          <button
            onClick={() => setAppMode(APP_MODES.SHOWROOM)}
            style={{
              ...styles.quickBtn,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#F87171',
            }}
            title="Exit to Showroom Configurator"
          >
            <LogOut size={11} />
            <span>EXIT</span>
          </button>
        </div>

        {/* ─── Main Automotive Instrument Cluster ─── */}
        <div style={styles.clusterCard}>
          {/* Top: Speedometer Gauge */}
          <div style={styles.speedSection}>
            <div style={styles.speedRow}>
              <span style={styles.speedNumber}>{displaySpeed}</span>
              <div style={styles.speedUnitCol}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={styles.speedUnit}>KM/H</span>
                  {isReversing && (
                    <span style={styles.reverseBadge}>REV</span>
                  )}
                </div>
                <span style={styles.speedSubUnit}>{speedMs} m/s</span>
              </div>
            </div>
          </div>

          {/* Middle: Transmission Gear Selector Pills */}
          <div style={styles.gearRow}>
            {['P', 'R', 'N', 'D'].map((gearLabel) => {
              const isParked = gearLabel === 'P' && displaySpeed === 0 && !isAccelerating && !isBraking;
              const isReverseActive = gearLabel === 'R' && currentGear === VEHICLE_GEAR.REVERSE;
              const isNeutral = gearLabel === 'N' && currentGear === VEHICLE_GEAR.NEUTRAL;
              const isDriveActive = gearLabel === 'D' && currentGear === VEHICLE_GEAR.DRIVE && !isParked;
              const isActive = isReverseActive || isDriveActive || isNeutral || isParked;

              let activeColor = '#00F0FF'; // Cyan for Drive
              if (gearLabel === 'R') activeColor = '#F59E0B'; // Amber for Reverse
              if (gearLabel === 'P') activeColor = '#94A3B8'; // Slate for Park
              if (gearLabel === 'N') activeColor = '#E2E8F0'; // Light gray for Neutral

              return (
                <div
                  key={gearLabel}
                  style={{
                    ...styles.gearPill,
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    borderColor: isActive ? activeColor : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? activeColor : '#64748B',
                    boxShadow: isActive ? `0 0 10px ${activeColor}40` : 'none',
                  }}
                >
                  {gearLabel}
                </div>
              );
            })}
          </div>

          {/* Bottom: Throttle & Brake Telemetry Bars */}
          <div style={styles.pedalsContainer}>
            {/* Throttle Bar */}
            <div style={styles.pedalGroup}>
              <div style={styles.pedalHeader}>
                <span style={styles.pedalLabel}>THROTTLE</span>
                <span style={styles.pedalValue}>{Math.round(inputThrottle * 100)}%</span>
              </div>
              <div style={styles.meterTrack}>
                <div
                  style={{
                    ...styles.meterFill,
                    width: `${Math.round(inputThrottle * 100)}%`,
                    backgroundColor: isReversing ? '#F59E0B' : '#00F0FF',
                    boxShadow: inputThrottle > 0 ? `0 0 8px ${isReversing ? '#F59E0B' : '#00F0FF'}` : 'none',
                  }}
                />
              </div>
            </div>

            {/* Brake Bar */}
            <div style={styles.pedalGroup}>
              <div style={styles.pedalHeader}>
                <span style={styles.pedalLabel}>BRAKE</span>
                <span style={{
                  ...styles.pedalValue,
                  color: inputHandbrake ? '#EF4444' : '#E2E8F0',
                  fontWeight: inputHandbrake ? '800' : '600',
                }}>
                  {inputHandbrake ? 'EBRAKE' : `${Math.round(inputBrake * 100)}%`}
                </span>
              </div>
              <div style={styles.meterTrack}>
                <div
                  style={{
                    ...styles.meterFill,
                    width: `${inputHandbrake ? 100 : Math.round(inputBrake * 100)}%`,
                    backgroundColor: '#EF4444',
                    boxShadow: isBraking ? '0 0 8px #EF4444' : 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Steering & Lateral G Telemetry Strip */}
          <div style={styles.steerTelemetryRow}>
            <div style={styles.steerCol}>
              <span style={styles.steerSubLabel}>STEERING</span>
              <span style={{
                ...styles.steerValue,
                color: Math.abs(steerAngle) > 0.5 ? '#00F0FF' : '#94A3B8',
              }}>
                {Math.abs(steerAngle).toFixed(1)}° {steerDirection}
              </span>
            </div>
            <div style={styles.steerColRight}>
              <span style={styles.steerSubLabel}>LATERAL</span>
              <span style={styles.steerValue}>{lateralG} G</span>
            </div>
          </div>

          {/* Surface & Barrier Collision Telemetry */}
          <div style={styles.statusRow}>
            <span style={styles.statusLabel}>SURFACE</span>
            <span style={{
              ...styles.statusValue,
              color: hasCollided ? '#EF4444' : surfaceColor,
            }}>
              {hasCollided ? `CONTACT (${impactSpeedKmh} KM/H)` : surfaceName}
            </span>
          </div>

          {/* Camera Mode Indicator */}
          <div style={styles.statusRow}>
            <span style={styles.statusLabel}>VIEWPOINT</span>
            <div
              onClick={cycleDrivingView}
              style={styles.cameraPill}
              title="Click to cycle camera view [C]"
            >
              <Video size={10} color="var(--accent-cyan)" />
              <span style={styles.cameraPillText}>{cameraLabel}</span>
            </div>
          </div>
        </div>

        {/* ─── Driving Controls Quick Guide ─── */}
        <div style={styles.controlsBadge}>
          <div style={styles.controlItem}>
            <kbd style={styles.keyTag}>W</kbd> / <kbd style={styles.keyTag}>▲</kbd> Gas
          </div>
          <span style={styles.separator}>•</span>
          <div style={styles.controlItem}>
            <kbd style={styles.keyTag}>A</kbd> <kbd style={styles.keyTag}>D</kbd> Steer
          </div>
          <span style={styles.separator}>•</span>
          <div style={styles.controlItem}>
            <kbd style={styles.keyTag}>S</kbd> / <kbd style={styles.keyTag}>▼</kbd> Brake/Rev
          </div>
          <span style={styles.separator}>•</span>
          <div style={styles.controlItem}>
            <kbd style={styles.keyTag}>SPACE</kbd> E-Brake
          </div>
          <span style={styles.separator}>•</span>
          <div style={styles.controlItem}>
            <kbd style={styles.keyTag}>R</kbd> Reset
          </div>
          <span style={styles.separator}>•</span>
          <div style={styles.controlItem}>
            <kbd style={styles.keyTag}>ESC</kbd> Pause
          </div>
        </div>
      </div>

      {/* ─── Simulation Pause Modal Overlay (Part 32) ─── */}
      {isPaused && (
        <div style={styles.pauseOverlay}>
          <div style={styles.pauseCard}>
            <div style={styles.pauseHeaderRow}>
              <div style={styles.pauseIconBadge}>
                <Pause size={18} color="var(--accent-cyan)" />
              </div>
              <div style={styles.pauseTitleCol}>
                <h2 style={styles.pauseTitle}>SIMULATION PAUSED</h2>
                <span style={styles.pauseSubtitle}>Vehicle physics frozen in place</span>
              </div>
            </div>

            {/* Frozen Telemetry Snapshot */}
            <div style={styles.snapshotGrid}>
              <div style={styles.snapshotCell}>
                <span style={styles.snapshotLabel}>SPEED</span>
                <span style={styles.snapshotValue}>{displaySpeed} km/h</span>
              </div>
              <div style={styles.snapshotCell}>
                <span style={styles.snapshotLabel}>TRANSMISSION</span>
                <span style={styles.snapshotValue}>{currentGear}</span>
              </div>
              <div style={styles.snapshotCell}>
                <span style={styles.snapshotLabel}>SURFACE</span>
                <span style={{ ...styles.snapshotValue, color: surfaceColor }}>{surfaceName}</span>
              </div>
              <div style={styles.snapshotCell}>
                <span style={styles.snapshotLabel}>CAMERA</span>
                <span style={styles.snapshotValue}>{cameraLabel}</span>
              </div>
            </div>

            {/* Modal Interactive Actions */}
            <div style={styles.pauseActionsCol}>
              <button
                onClick={resume}
                style={styles.primaryResumeBtn}
                title="Resume Driving [ESC or P]"
              >
                <Play size={15} fill="currentColor" />
                <span>RESUME SIMULATION</span>
                <kbd style={styles.btnShortcutTag}>ESC</kbd>
              </button>

              <div style={styles.pauseSecondaryRow}>
                <button
                  onClick={() => {
                    requestReset();
                    resume();
                  }}
                  style={styles.secondaryBtn}
                  title="Reset vehicle to starting line and resume"
                >
                  <RotateCcw size={13} />
                  <span>RESTART TRACK</span>
                  <kbd style={styles.btnShortcutTag}>R</kbd>
                </button>

                <button
                  onClick={() => {
                    resume();
                    setAppMode(APP_MODES.SHOWROOM);
                  }}
                  style={styles.secondaryExitBtn}
                  title="Return to Showroom Configurator"
                >
                  <LogOut size={13} />
                  <span>SHOWROOM</span>
                </button>
              </div>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div style={styles.pauseFooterNote}>
              Press <kbd style={styles.keyTag}>ESC</kbd> or <kbd style={styles.keyTag}>P</kbd> to toggle pause • <kbd style={styles.keyTag}>R</kbd> to reset • <kbd style={styles.keyTag}>C</kbd> to cycle camera
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  hudContainer: {
    position: 'absolute',
    bottom: '56px',
    left: '16px',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  quickBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    pointerEvents: 'auto',
  },
  quickBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'rgba(10, 14, 22, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: '#94A3B8',
    fontSize: '10px',
    fontWeight: '700',
    fontFamily: 'var(--font-mono, monospace)',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  clusterCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px 14px',
    backgroundColor: 'rgba(10, 14, 22, 0.88)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    minWidth: '190px',
    maxWidth: '215px',
    pointerEvents: 'auto',
  },
  speedSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  speedRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  speedNumber: {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '34px',
    fontWeight: '800',
    lineHeight: '1',
    letterSpacing: '-1px',
    color: '#FFFFFF',
    textShadow: '0 2px 10px rgba(0, 240, 255, 0.25)',
  },
  speedUnitCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  speedUnit: {
    fontFamily: 'var(--font-sans, sans-serif)',
    fontSize: '13px',
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: '0.5px',
  },
  reverseBadge: {
    fontSize: '9px',
    fontWeight: '800',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: '3px',
    padding: '0 3px',
    lineHeight: '1.2',
  },
  speedSubUnit: {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '10px',
    color: '#64748B',
  },
  gearRow: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'space-between',
  },
  gearPill: {
    flex: 1,
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid transparent',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '800',
    fontFamily: 'var(--font-mono, monospace)',
    transition: 'all 0.15s ease-out',
  },
  pedalsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  pedalGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  pedalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
    fontWeight: '700',
    fontFamily: 'var(--font-sans, sans-serif)',
    letterSpacing: '0.5px',
    color: '#94A3B8',
  },
  pedalLabel: {
    textTransform: 'uppercase',
  },
  pedalValue: {
    fontFamily: 'var(--font-mono, monospace)',
    color: '#E2E8F0',
  },
  meterTrack: {
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    transition: 'width 0.06s linear, background-color 0.15s ease',
  },
  steerTelemetryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '6px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  steerCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  steerColRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  steerSubLabel: {
    fontSize: '8.5px',
    fontWeight: '700',
    fontFamily: 'var(--font-sans, sans-serif)',
    letterSpacing: '0.5px',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  steerValue: {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '11px',
    fontWeight: '700',
    color: '#E2E8F0',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '6px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '11px',
  },
  statusLabel: {
    color: '#64748B',
    fontWeight: 600,
    fontSize: '9.5px',
    letterSpacing: '0.04em',
  },
  statusValue: {
    fontWeight: 700,
    letterSpacing: '0.04em',
    fontSize: '10.5px',
    fontFamily: 'var(--font-mono, monospace)',
  },
  cameraPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    padding: '2px 5px',
    borderRadius: '3px',
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    border: '1px solid rgba(0, 240, 255, 0.25)',
    transition: 'all 0.15s ease',
  },
  cameraPillText: {
    color: 'var(--accent-cyan)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    fontSize: '10px',
    fontFamily: 'var(--font-mono, monospace)',
  },
  controlsBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: 'rgba(8, 12, 18, 0.75)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '20px',
    fontSize: '10px',
    color: '#94A3B8',
  },
  controlItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
  },
  keyTag: {
    display: 'inline-block',
    padding: '1px 4px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '3px',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '9px',
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: '1.2',
  },
  separator: {
    color: 'rgba(255, 255, 255, 0.2)',
  },

  // ─── Simulation Pause Modal Styles ───
  pauseOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 8, 15, 0.78)',
    backdropFilter: 'blur(12px)',
    pointerEvents: 'auto',
    userSelect: 'none',
  },
  pauseCard: {
    width: '380px',
    maxWidth: '90vw',
    backgroundColor: 'rgba(13, 19, 32, 0.95)',
    border: '1px solid rgba(0, 240, 255, 0.25)',
    borderRadius: '14px',
    padding: '24px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 240, 255, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  pauseHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  pauseIconBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseTitleCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  pauseTitle: {
    margin: 0,
    fontSize: '17px',
    fontWeight: '800',
    letterSpacing: '0.08em',
    color: '#FFFFFF',
    fontFamily: 'var(--font-sans, sans-serif)',
  },
  pauseSubtitle: {
    fontSize: '11px',
    color: '#94A3B8',
  },
  snapshotGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
  },
  snapshotCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  snapshotLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: '0.06em',
  },
  snapshotValue: {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'var(--font-mono, monospace)',
  },
  pauseActionsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  primaryResumeBtn: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'var(--accent-cyan, #00F0FF)',
    border: 'none',
    borderRadius: '8px',
    color: '#040D1A',
    fontSize: '13px',
    fontWeight: '800',
    letterSpacing: '0.06em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 18px rgba(0, 240, 255, 0.35)',
    transition: 'all 0.15s ease',
  },
  pauseSecondaryRow: {
    display: 'flex',
    gap: '8px',
  },
  secondaryBtn: {
    flex: 1,
    padding: '9px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: '#E2E8F0',
    fontSize: '11.5px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  secondaryExitBtn: {
    flex: 1,
    padding: '9px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '6px',
    color: '#F87171',
    fontSize: '11.5px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  btnShortcutTag: {
    padding: '1px 5px',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: '3px',
    fontSize: '9.5px',
    fontWeight: '800',
    fontFamily: 'var(--font-mono, monospace)',
    marginLeft: 'auto',
  },
  pauseFooterNote: {
    fontSize: '10px',
    color: '#64748B',
    textAlign: 'center',
  },
};
