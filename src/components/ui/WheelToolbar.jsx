import React, { useRef } from 'react';
import { RotateCcw, Disc3 } from 'lucide-react';
import { useWheelStore } from '../../store/wheelStore.js';
import {
  RIM_FINISH_PRESETS,
  CALIPER_PRESETS,
  WHEEL_TARGET_MODES,
  RIM_STYLES,
} from '../../materials/wheelPresets.js';

export function WheelToolbar() {
  const targetMode = useWheelStore((s) => s.targetMode);
  const selectedWheel = useWheelStore((s) => s.selectedWheel);
  const rimFinishes = useWheelStore((s) => s.rimFinishes);
  const activePresetId = useWheelStore((s) => s.activePresetId);
  const customRimColor = useWheelStore((s) => s.customRimColor);
  const caliperPreset = useWheelStore((s) => s.caliperPreset);
  const customCaliperColor = useWheelStore((s) => s.customCaliperColor);
  const isFactoryWheels = useWheelStore((s) => s.isFactoryWheels);

  const setTargetMode = useWheelStore((s) => s.setTargetMode);
  const setSelectedWheel = useWheelStore((s) => s.setSelectedWheel);
  const setRimFinish = useWheelStore((s) => s.setRimFinish);
  const setCustomRimColor = useWheelStore((s) => s.setCustomRimColor);
  const setCaliperPreset = useWheelStore((s) => s.setCaliperPreset);
  const setCustomCaliperColor = useWheelStore((s) => s.setCustomCaliperColor);
  const resetWheelsToFactory = useWheelStore((s) => s.resetWheelsToFactory);

  const colorInputRef = useRef(null);
  const caliperInputRef = useRef(null);

  const activePreset = RIM_FINISH_PRESETS[activePresetId] || RIM_FINISH_PRESETS.factory;
  const activeCaliper = CALIPER_PRESETS[caliperPreset] || CALIPER_PRESETS.factory;

  // Selected target label
  let targetDisplay = 'All Wheels';
  if (targetMode === WHEEL_TARGET_MODES.FRONT_REAR) {
    targetDisplay = 'Front & Rear Split';
  } else if (targetMode === WHEEL_TARGET_MODES.INDIVIDUAL) {
    targetDisplay = `Wheel: ${selectedWheel.toUpperCase()}`;
  }

  return (
    <div style={styles.container} data-testid="wheel-customization-toolbar">
      {/* Header */}
      <div style={styles.headerRow}>
        <div style={styles.headerTitleGroup}>
          <Disc3 size={14} style={{ color: 'var(--accent-cyan, #66FCF1)' }} />
          <div style={styles.headerTextCol}>
            <span style={styles.headerLabel}>Wheels & Rims</span>
            <span style={styles.activeSubtext}>
              {activePreset.name} &bull; {targetDisplay}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={resetWheelsToFactory}
          title="Reset Wheels to Factory"
          style={{
            ...styles.resetBtn,
            opacity: isFactoryWheels ? 0.6 : 1,
            border: isFactoryWheels ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,100,100,0.4)',
          }}
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>
      </div>

      {/* Target Mode Selector */}
      <div style={styles.sectionCol}>
        <div style={styles.sectionHeaderRow}>
          <span style={styles.sectionLabel}>Target Wheels</span>
          <span style={styles.badgeStyle}>{RIM_STYLES.oem_5spoke.name}</span>
        </div>
        <div style={styles.targetBtnRow}>
          <button
            type="button"
            onClick={() => setTargetMode(WHEEL_TARGET_MODES.ALL)}
            style={styles.pillBtn(targetMode === WHEEL_TARGET_MODES.ALL)}
          >
            All 4
          </button>
          <button
            type="button"
            onClick={() => setTargetMode(WHEEL_TARGET_MODES.FRONT_REAR)}
            style={styles.pillBtn(targetMode === WHEEL_TARGET_MODES.FRONT_REAR)}
          >
            Front / Rear
          </button>
          <button
            type="button"
            onClick={() => setTargetMode(WHEEL_TARGET_MODES.INDIVIDUAL)}
            style={styles.pillBtn(targetMode === WHEEL_TARGET_MODES.INDIVIDUAL)}
          >
            Individual
          </button>
        </div>

        {/* Sub-selector for Front/Rear or Individual */}
        {targetMode === WHEEL_TARGET_MODES.FRONT_REAR && (
          <div style={styles.subTargetRow}>
            <button
              type="button"
              onClick={() => setSelectedWheel('front')}
              style={styles.subPillBtn(selectedWheel === 'front')}
            >
              Front Axle (FL/FR)
            </button>
            <button
              type="button"
              onClick={() => setSelectedWheel('rear')}
              style={styles.subPillBtn(selectedWheel === 'rear')}
            >
              Rear Axle (RL/RR)
            </button>
          </div>
        )}

        {targetMode === WHEEL_TARGET_MODES.INDIVIDUAL && (
          <div style={styles.subTargetRow}>
            {['fl', 'fr', 'rl', 'rr'].map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setSelectedWheel(pos)}
                style={styles.subPillBtn(selectedWheel === pos)}
              >
                {pos.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rim Finish Presets Grid */}
      <div style={styles.sectionCol}>
        <span style={styles.sectionLabel}>Rim Finish</span>
        <div style={styles.finishesGrid}>
          {Object.values(RIM_FINISH_PRESETS).map((p) => {
            const isSelected = activePresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (p.id === 'custom') {
                    colorInputRef.current?.click();
                  } else {
                    setRimFinish(p.id);
                  }
                }}
                style={styles.finishCard(isSelected)}
                title={p.description}
              >
                <div
                  style={{
                    ...styles.swatchDot,
                    backgroundColor: p.id === 'custom' ? customRimColor : p.color,
                  }}
                />
                <span style={styles.finishName}>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Hidden Native Color Input */}
        <input
          ref={colorInputRef}
          type="color"
          value={customRimColor}
          onChange={(e) => setCustomRimColor(e.target.value)}
          style={{ display: 'none' }}
        />
      </div>

      {/* Brake Calipers */}
      <div style={styles.sectionCol}>
        <div style={styles.sectionHeaderRow}>
          <span style={styles.sectionLabel}>Brake Caliper</span>
          <span style={styles.activeSubtext}>{activeCaliper.name}</span>
        </div>
        <div style={styles.caliperRow}>
          {Object.values(CALIPER_PRESETS).map((c) => {
            const isSelected = caliperPreset === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (c.id === 'custom') {
                    caliperInputRef.current?.click();
                  } else {
                    setCaliperPreset(c.id);
                  }
                }}
                style={styles.caliperBtn(isSelected)}
                title={c.name}
              >
                <span
                  style={{
                    ...styles.caliperDot,
                    backgroundColor: c.id === 'custom' ? customCaliperColor : c.color,
                  }}
                />
                <span>{c.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <input
          ref={caliperInputRef}
          type="color"
          value={customCaliperColor}
          onChange={(e) => setCustomCaliperColor(e.target.value)}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    padding: '0.6rem 0.75rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(11, 14, 20, 0.88)',
    border: '1px solid rgba(44, 54, 69, 0.85)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
    width: '280px',
    fontFamily: 'Inter, system-ui, sans-serif',
    userSelect: 'none',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '0.35rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  headerTextCol: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.15,
  },
  headerLabel: {
    fontSize: '0.62rem',
    color: '#8A92A6',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: '600',
  },
  activeSubtext: {
    fontSize: '0.7rem',
    fontWeight: '500',
    color: '#E0E6F0',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.2rem 0.45rem',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#E0E6F0',
    fontSize: '0.65rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  sectionCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: '0.58rem',
    color: '#70788C',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600',
  },
  badgeStyle: {
    fontSize: '0.55rem',
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.06)',
    color: '#9AA0B4',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  targetBtnRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.2rem',
  },
  pillBtn: (active) => ({
    padding: '0.22rem 0.3rem',
    borderRadius: '5px',
    border: `1px solid ${active ? 'rgba(102, 252, 241, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
    backgroundColor: active ? 'rgba(102, 252, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)',
    color: active ? '#66FCF1' : '#B0B8C8',
    fontSize: '0.62rem',
    cursor: 'pointer',
    textAlign: 'center',
    fontWeight: active ? '600' : '400',
    transition: 'all 0.15s ease',
  }),
  subTargetRow: {
    display: 'flex',
    gap: '0.2rem',
    marginTop: '0.15rem',
  },
  subPillBtn: (active) => ({
    flex: 1,
    padding: '0.18rem 0.2rem',
    borderRadius: '4px',
    border: `1px solid ${active ? 'rgba(102, 252, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
    backgroundColor: active ? 'rgba(102, 252, 241, 0.1)' : 'rgba(255, 255, 255, 0.03)',
    color: active ? '#66FCF1' : '#9098A8',
    fontSize: '0.58rem',
    cursor: 'pointer',
    textAlign: 'center',
    fontWeight: active ? '600' : '400',
  }),
  finishesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.25rem',
  },
  finishCard: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.25rem 0.35rem',
    borderRadius: '5px',
    border: `1px solid ${active ? 'rgba(102, 252, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
    backgroundColor: active ? 'rgba(102, 252, 241, 0.08)' : 'rgba(255, 255, 255, 0.03)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  }),
  swatchDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    flexShrink: 0,
  },
  finishName: {
    fontSize: '0.58rem',
    color: '#D0D8E6',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  caliperRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.2rem',
  },
  caliperBtn: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.2rem 0.3rem',
    borderRadius: '4px',
    border: `1px solid ${active ? 'rgba(102, 252, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
    backgroundColor: active ? 'rgba(102, 252, 241, 0.08)' : 'rgba(255, 255, 255, 0.03)',
    color: active ? '#66FCF1' : '#B0B8C8',
    fontSize: '0.58rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),
  caliperDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    flexShrink: 0,
  },
};
