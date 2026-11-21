import React, { useState, useRef, useEffect } from 'react';
import { Palette, Sparkles, RotateCcw, ChevronDown, Check } from 'lucide-react';
import { usePaintStore } from '../../store/paintStore.js';
import { PAINT_COLOR_PRESETS, PAINT_FINISH_TYPES } from '../../materials/paintPresets.js';

export default function PaintToolbar() {
  const {
    activePresetId,
    activeFinish,
    primaryColor,
    isFactory,
    applyPreset,
    setFinish,
    setCustomColor,
    resetToFactory,
  } = usePaintStore();

  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setPresetDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activePreset =
    PAINT_COLOR_PRESETS.find((p) => p.id === activePresetId) || PAINT_COLOR_PRESETS[0];
  const activeFinishData = PAINT_FINISH_TYPES[activeFinish] || PAINT_FINISH_TYPES.metallic;

  return (
    <div style={styles.container}>
      {/* Header / Active Indicator */}
      <div style={styles.headerRow}>
        <div style={styles.indicatorGroup}>
          <div
            style={{
              ...styles.colorDot,
              backgroundColor: primaryColor,
              boxShadow: `0 0 10px ${primaryColor}88`,
            }}
          />
          <div style={styles.labelCol}>
            <span style={styles.titleLabel}>Automotive Paint</span>
            <span style={styles.activeValueText}>
              {activePreset.name} &bull; {activeFinishData.name}
            </span>
          </div>
        </div>

        {/* Factory Reset Action */}
        <button
          type="button"
          onClick={resetToFactory}
          title="Reset to Factory Paint"
          style={{
            ...styles.actionBtn,
            opacity: isFactory ? 0.6 : 1,
            border: isFactory ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--accent-cyan)',
          }}
        >
          <RotateCcw size={13} />
          <span>Factory</span>
        </button>
      </div>

      {/* Preset Dropdown Trigger & Finish Tabs */}
      <div style={styles.controlsRow}>
        {/* Preset Selector Dropdown */}
        <div style={styles.dropdownWrapper} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setPresetDropdownOpen((prev) => !prev)}
            style={styles.dropdownBtn}
            title="Select Paint Color Preset"
          >
            <div style={styles.btnContent}>
              <div
                style={{
                  ...styles.miniSwatch,
                  backgroundColor: primaryColor,
                }}
              />
              <span style={styles.dropdownBtnText}>{activePreset.name}</span>
            </div>
            <ChevronDown size={13} style={{ transform: presetDropdownOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {presetDropdownOpen && (
            <div style={styles.menuPopover} role="listbox">
              <div style={styles.menuHeader}>Automotive Color Presets</div>
              <div style={styles.presetsList}>
                {PAINT_COLOR_PRESETS.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        applyPreset(preset.id);
                        setPresetDropdownOpen(false);
                      }}
                      style={{
                        ...styles.menuItem,
                        backgroundColor: isSelected ? 'rgba(102, 252, 241, 0.12)' : 'transparent',
                      }}
                    >
                      <div style={styles.itemLeft}>
                        <div
                          style={{
                            ...styles.itemSwatch,
                            backgroundColor: preset.primaryColor,
                            border: '1px solid rgba(255,255,255,0.2)',
                          }}
                        />
                        <div style={styles.itemTextCol}>
                          <span style={styles.itemName}>{preset.name}</span>
                          <span style={styles.itemCategory}>{preset.category}</span>
                        </div>
                      </div>
                      {isSelected && <Check size={13} color="var(--accent-cyan)" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Custom Color Input */}
        <label style={styles.customColorPickerWrapper} title="Choose custom body color">
          <Palette size={13} color="var(--accent-cyan)" />
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setCustomColor(e.target.value)}
            style={styles.nativeColorInput}
          />
        </label>
      </div>

      {/* Finish Type Tabs */}
      <div style={styles.finishesRow}>
        {Object.values(PAINT_FINISH_TYPES).map((finish) => {
          const isSelected = activeFinish === finish.id;
          return (
            <button
              key={finish.id}
              type="button"
              onClick={() => setFinish(finish.id)}
              title={finish.description}
              style={{
                ...styles.finishTab,
                backgroundColor: isSelected ? 'rgba(102, 252, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                borderColor: isSelected ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.08)',
                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontWeight: isSelected ? '600' : '400',
              }}
            >
              {finish.name.split(' ')[0]}
            </button>
          );
        })}
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
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '0.35rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  indicatorGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  colorDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid rgba(255, 255, 255, 0.6)',
  },
  labelCol: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.15,
  },
  titleLabel: {
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  activeValueText: {
    fontSize: '0.74rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.2rem 0.45rem',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: 'var(--text-primary)',
    fontSize: '0.65rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  dropdownWrapper: {
    position: 'relative',
    flex: 1,
  },
  dropdownBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.35rem 0.5rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.72rem',
  },
  btnContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  miniSwatch: {
    width: '10px',
    height: '10px',
    borderRadius: '3px',
    border: '1px solid rgba(255,255,255,0.3)',
  },
  dropdownBtnText: {
    fontWeight: '500',
    maxWidth: '180px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  menuPopover: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    width: '240px',
    maxHeight: '220px',
    backgroundColor: 'rgba(15, 20, 29, 0.96)',
    border: '1px solid rgba(102, 252, 241, 0.25)',
    borderRadius: '8px',
    boxShadow: '0 12px 28px rgba(0,0,0,0.7)',
    backdropFilter: 'blur(12px)',
    zIndex: 100,
    overflowY: 'auto',
  },
  menuHeader: {
    padding: '0.4rem 0.6rem',
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    letterSpacing: '0.04em',
  },
  presetsList: {
    padding: '0.2rem',
  },
  menuItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.35rem 0.5rem',
    borderRadius: '5px',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  itemSwatch: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
  },
  itemTextCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  itemName: {
    fontSize: '0.7rem',
    fontWeight: '500',
  },
  itemCategory: {
    fontSize: '0.58rem',
    color: 'var(--text-muted)',
  },
  customColorPickerWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  nativeColorInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  finishesRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '0.2rem',
  },
  finishTab: {
    padding: '0.2rem 0',
    fontSize: '0.6rem',
    borderRadius: '4px',
    border: '1px solid',
    cursor: 'pointer',
    textAlign: 'center',
    textTransform: 'capitalize',
    transition: 'all 0.15s ease',
  },
};
