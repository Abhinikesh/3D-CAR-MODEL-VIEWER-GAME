import React, { useState } from 'react';
import {
  Sparkles,
  Sun,
  Building2,
  Tv,
  Camera,
  ChevronDown,
  RotateCcw,
  Compass,
  Check,
  Sliders,
  Eye,
} from 'lucide-react';
import { useShowroomEnvironmentStore } from '../../store/showroomEnvironmentStore.js';
import {
  SHOWROOM_ENVIRONMENTS,
  ENVIRONMENT_IDS,
} from '../../utils/showroomEnvironmentRegistry.js';
import { useCameraStore } from '../../store/cameraStore.js';

export function EnvironmentToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSliders, setShowSliders] = useState(false);

  const activeEnvironmentId = useShowroomEnvironmentStore(
    (state) => state.activeEnvironmentId
  );
  const exposureMultiplier = useShowroomEnvironmentStore(
    (state) => state.exposureMultiplier
  );
  const reflectionMultiplier = useShowroomEnvironmentStore(
    (state) => state.reflectionMultiplier
  );
  const shadowMultiplier = useShowroomEnvironmentStore(
    (state) => state.shadowMultiplier
  );

  const setEnvironment = useShowroomEnvironmentStore(
    (state) => state.setEnvironment
  );
  const setExposureMultiplier = useShowroomEnvironmentStore(
    (state) => state.setExposureMultiplier
  );
  const setReflectionMultiplier = useShowroomEnvironmentStore(
    (state) => state.setReflectionMultiplier
  );
  const setShadowMultiplier = useShowroomEnvironmentStore(
    (state) => state.setShadowMultiplier
  );
  const resetEnvironment = useShowroomEnvironmentStore(
    (state) => state.resetEnvironment
  );

  const activeEnv = SHOWROOM_ENVIRONMENTS[activeEnvironmentId] || SHOWROOM_ENVIRONMENTS.premium_studio;

  const getEnvIcon = (id) => {
    switch (id) {
      case 'luxury_showroom':
        return <Building2 size={15} color="#FFD700" />;
      case 'outdoor_daylight':
        return <Sun size={15} color="#48DBFB" />;
      case 'cinematic_stage':
        return <Tv size={15} color="#BD00FF" />;
      default:
        return <Sparkles size={15} color="var(--accent-cyan)" />;
    }
  };

  const handleFocus = () => {
    useCameraStore.getState().resetView();
  };

  return (
    <div style={styles.container}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.triggerBtn,
          borderColor: activeEnv.themeColor,
        }}
        title="Automotive Showroom Environments & Presentation Spaces"
      >
        <div style={styles.triggerLeft}>
          <div
            style={{
              ...styles.iconBadge,
              backgroundColor: `${activeEnv.themeColor}22`,
            }}
          >
            {getEnvIcon(activeEnvironmentId)}
          </div>
          <div style={styles.triggerTextGroup}>
            <span style={styles.triggerLabel}>SHOWROOM SCENE</span>
            <span style={styles.triggerValue}>{activeEnv.name.toUpperCase()}</span>
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
          {/* Header */}
          <div style={styles.popoverHeader}>
            <div style={styles.headerTitleGroup}>
              <Sparkles size={14} color="var(--accent-cyan)" />
              <span style={styles.headerTitle}>SHOWROOM ENVIRONMENTS</span>
            </div>
            <button
              onClick={() => setShowSliders(!showSliders)}
              style={{
                ...styles.tuneBtn,
                color: showSliders ? 'var(--accent-cyan)' : 'var(--text-muted)',
              }}
              title="Toggle Lighting & Shadow Sliders"
            >
              <Sliders size={12} />
              <span>{showSliders ? 'HIDE CALIBRATION' : 'TUNE LIGHTING'}</span>
            </button>
          </div>

          {/* 4 Distinct Environment Cards */}
          <div style={styles.envGrid}>
            {ENVIRONMENT_IDS.map((id) => {
              const env = SHOWROOM_ENVIRONMENTS[id];
              const isSelected = activeEnvironmentId === id;

              return (
                <div
                  key={id}
                  onClick={() => setEnvironment(id)}
                  style={{
                    ...styles.envCard,
                    borderColor: isSelected ? env.themeColor : 'rgba(255, 255, 255, 0.08)',
                    backgroundColor: isSelected
                      ? `${env.themeColor}15`
                      : 'rgba(255, 255, 255, 0.03)',
                  }}
                >
                  <div style={styles.envCardTop}>
                    <div style={styles.envCardTitleGroup}>
                      <div
                        style={{
                          ...styles.envBadge,
                          backgroundColor: `${env.themeColor}25`,
                          color: env.themeColor,
                        }}
                      >
                        {env.badge}
                      </div>
                      <span style={styles.envName}>{env.name}</span>
                    </div>
                    {isSelected && (
                      <div
                        style={{
                          ...styles.checkBadge,
                          backgroundColor: env.themeColor,
                        }}
                      >
                        <Check size={11} color="#000000" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p style={styles.envSubtitle}>{env.subtitle}</p>
                </div>
              );
            })}
          </div>

          {/* Optional Lighting Calibration Sliders */}
          {showSliders && (
            <div style={styles.calibrationSection}>
              <div style={styles.sliderGroup}>
                <div style={styles.sliderHeader}>
                  <span style={styles.sliderLabel}>EXPOSURE CALIBRATION</span>
                  <span style={styles.sliderValue}>{exposureMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={exposureMultiplier}
                  onChange={(e) => setExposureMultiplier(Number(e.target.value))}
                  style={styles.slider}
                />
              </div>

              <div style={styles.sliderGroup}>
                <div style={styles.sliderHeader}>
                  <span style={styles.sliderLabel}>REFLECTION INTENSITY</span>
                  <span style={styles.sliderValue}>{reflectionMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={reflectionMultiplier}
                  onChange={(e) => setReflectionMultiplier(Number(e.target.value))}
                  style={styles.slider}
                />
              </div>

              <div style={styles.sliderGroup}>
                <div style={styles.sliderHeader}>
                  <span style={styles.sliderLabel}>CONTACT SHADOW OPACITY</span>
                  <span style={styles.sliderValue}>{shadowMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.5"
                  step="0.1"
                  value={shadowMultiplier}
                  onChange={(e) => setShadowMultiplier(Number(e.target.value))}
                  style={styles.slider}
                />
              </div>
            </div>
          )}

          {/* Action Row */}
          <div style={styles.actionRow}>
            <button
              onClick={resetEnvironment}
              style={styles.resetBtn}
              title="Reset to default Premium Studio environment"
            >
              <RotateCcw size={12} />
              <span>RESET STUDIO</span>
            </button>

            <button
              onClick={handleFocus}
              style={styles.focusBtn}
              title="Reset camera to default hero perspective"
            >
              <Compass size={12} />
              <span>RESET CAMERA</span>
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
  },
  triggerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '240px',
    padding: '8px 12px',
    backgroundColor: 'rgba(10, 14, 20, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  triggerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  iconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  triggerTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  triggerLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
  },
  triggerValue: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '330px',
    backgroundColor: 'rgba(10, 14, 20, 0.95)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '10px',
    padding: '14px',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  popoverHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  headerTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: '0.06em',
  },
  tuneBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '9px',
    fontWeight: '700',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
  envGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  envCard: {
    padding: '10px 12px',
    border: '1px solid',
    borderRadius: '7px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  envCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  envCardTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  envBadge: {
    fontSize: '8px',
    fontWeight: '800',
    padding: '2px 5px',
    borderRadius: '3px',
    letterSpacing: '0.06em',
  },
  envName: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkBadge: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  envSubtitle: {
    margin: 0,
    fontSize: '9px',
    color: 'var(--text-muted)',
    lineHeight: '1.3',
  },
  calibrationSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  sliderGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '8px',
    fontFamily: 'monospace',
  },
  sliderLabel: {
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  sliderValue: {
    color: 'var(--accent-cyan)',
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    accentColor: 'var(--accent-cyan)',
    cursor: 'pointer',
    height: '4px',
  },
  actionRow: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '6px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '8px',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '6px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '5px',
    color: '#A0AEC0',
    fontSize: '9px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  focusBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '6px 8px',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '5px',
    color: 'var(--accent-cyan)',
    fontSize: '9px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};

export default EnvironmentToolbar;
