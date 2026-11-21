import React, { useState, useCallback } from 'react';

/**
 * DrivingControlsHelp — Part 33
 *
 * Compact, collapsible keyboard-controls reference overlay for Driving Mode.
 * Mounted in the viewport alongside DrivingHUD; positioned bottom-right so it
 * never obstructs the road ahead.
 *
 * Visual language matches the Part 18 dark automotive HUD:
 *   - rgba(10, 14, 22, 0.88) background  +  backdrop-filter blur
 *   - Cyan accent (#00F0FF)
 *   - Monospace keyboard tags
 */

// ─── Key binding data ───────────────────────────────────────────────────────
const KEY_GROUPS = [
  {
    label: 'DRIVE',
    bindings: [
      { keys: ['W', '↑'],     action: 'Accelerate' },
      { keys: ['S', '↓'],     action: 'Brake / Reverse' },
      { keys: ['A', '←'],     action: 'Steer Left' },
      { keys: ['D', '→'],     action: 'Steer Right' },
      { keys: ['Space'],      action: 'Handbrake' },
      { keys: ['G'],          action: 'Reverse Mode' },
    ],
  },
  {
    label: 'SYSTEM',
    bindings: [
      { keys: ['R'],          action: 'Reset Vehicle' },
      { keys: ['C'],          action: 'Cycle Camera' },
      { keys: ['Esc', 'P'],   action: 'Pause / Resume' },
    ],
  },
];

// ─── Styles ─────────────────────────────────────────────────────────────────
const CYAN   = '#00F0FF';
const BG     = 'rgba(10, 14, 22, 0.88)';
const BORDER = 'rgba(0, 240, 255, 0.18)';

const styles = {
  root: {
    position: 'absolute',
    bottom: '84px',          // above DrivingCameraDock (~72 px tall + margin)
    right: '16px',
    zIndex: 120,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
    pointerEvents: 'auto',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    userSelect: 'none',
  },

  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: '8px',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    cursor: 'pointer',
    color: CYAN,
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    lineHeight: 1,
    transition: 'border-color 0.2s, background 0.2s',
  },

  toggleIcon: {
    fontSize: '12px',
    lineHeight: 1,
  },

  panel: {
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: '10px',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    padding: '12px 14px',
    minWidth: '210px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  },

  panelTitle: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: CYAN,
    textTransform: 'uppercase',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },

  titleDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: CYAN,
    boxShadow: `0 0 6px ${CYAN}`,
    flexShrink: 0,
  },

  group: {
    marginBottom: '10px',
  },

  groupLabel: {
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'rgba(0, 240, 255, 0.5)',
    textTransform: 'uppercase',
    marginBottom: '5px',
    paddingBottom: '3px',
    borderBottom: '1px solid rgba(0, 240, 255, 0.08)',
  },

  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
    gap: '8px',
  },

  keysWrap: {
    display: 'flex',
    gap: '3px',
    flexShrink: 0,
  },

  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '22px',
    padding: '2px 5px',
    background: 'rgba(0, 240, 255, 0.07)',
    border: '1px solid rgba(0, 240, 255, 0.28)',
    borderBottom: '2px solid rgba(0, 240, 255, 0.4)',
    borderRadius: '4px',
    fontFamily: "'Courier New', monospace",
    fontSize: '10px',
    fontWeight: 700,
    color: '#E8F4FF',
    letterSpacing: '0.02em',
    lineHeight: 1.4,
  },

  action: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.72)',
    fontWeight: 400,
    textAlign: 'right',
    flexGrow: 1,
  },

  separator: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function DrivingControlsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const togglePanel = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div style={styles.root}>
      {/* Collapsible panel */}
      {isOpen && (
        <div style={styles.panel} role="complementary" aria-label="Keyboard Controls Reference">
          {/* Panel header */}
          <div style={styles.panelTitle}>
            <span style={styles.titleDot} />
            Keyboard Controls
          </div>

          {/* Key groups */}
          {KEY_GROUPS.map((group) => (
            <div key={group.label} style={styles.group}>
              <div style={styles.groupLabel}>{group.label}</div>
              {group.bindings.map((binding, i) => (
                <div key={i} style={styles.row}>
                  {/* Key tags */}
                  <div style={styles.keysWrap}>
                    {binding.keys.map((k, ki) => (
                      <React.Fragment key={ki}>
                        {ki > 0 && <span style={styles.separator}>/</span>}
                        <kbd style={styles.kbd}>{k}</kbd>
                      </React.Fragment>
                    ))}
                  </div>
                  {/* Action label */}
                  <span style={styles.action}>{binding.action}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={togglePanel}
        style={styles.toggleBtn}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Hide keyboard controls' : 'Show keyboard controls'}
        title={isOpen ? 'Hide controls reference' : 'Show controls reference'}
      >
        <span style={styles.toggleIcon}>{isOpen ? '✕' : '⌨'}</span>
        <span>{isOpen ? 'HIDE' : 'CONTROLS'}</span>
      </button>
    </div>
  );
}
