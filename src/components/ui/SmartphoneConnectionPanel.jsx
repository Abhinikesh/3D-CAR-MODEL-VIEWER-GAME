import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Smartphone,
  Wifi,
  ShieldCheck,
  Radio,
  X,
  CheckCircle2,
  AlertCircle,
  Unplug,
  RefreshCw,
  Clock,
  Link,
  Copy,
  Check,
} from 'lucide-react';
import { useControllerSessionStore } from '../../services/controller/controllerSessionStore.js';
import { CONTROLLER_STATUS, INPUT_SOURCE } from '../../services/controller/controllerTypes.js';
import { useVehicleInputStore } from '../../scenes/driving/vehicleInputStore.js';
import { useControllerWebSocket } from '../../services/controller/useControllerWebSocket.js';

// ─── QR Code Renderer ───────────────────────────────────────────────────────
// qrcode package is a devDependency (Vite handles the import)
let QRCode = null;
let qrcodeLoadAttempted = false;

async function loadQRCode() {
  if (QRCode) return QRCode;
  if (qrcodeLoadAttempted) return null;
  qrcodeLoadAttempted = true;
  try {
    const mod = await import('qrcode');
    QRCode = mod.default || mod;
    return QRCode;
  } catch (_) {
    return null;
  }
}

// ─── Panel States ─────────────────────────────────────────────────────────────
const PANEL_STATE = {
  IDLE: 'idle',           // initial / after cancel
  GENERATING: 'generating',     // POST in progress
  READY: 'ready',          // QR shown, waiting for phone
  PAIRED: 'paired',         // phone connected
  EXPIRED: 'expired',        // countdown hit zero
  CANCELLED: 'cancelled',      // user pressed cancel
  ERROR: 'error',          // network/server error
};

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!expiresAt) { setRemaining(null); return; }
    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function formatCountdown(secs) {
  if (secs === null) return '--:--';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SmartphoneConnectionPanel() {
  const isPanelOpen = useControllerSessionStore((s) => s.isPanelOpen);
  const closePanel = useControllerSessionStore((s) => s.closePanel);
  const status = useControllerSessionStore((s) => s.status);
  const connectedDevice = useControllerSessionStore((s) => s.connectedDevice);
  const localNetwork = useControllerSessionStore((s) => s.localNetwork);
  const fetchLocalNetworkInfo = useControllerSessionStore((s) => s.fetchLocalNetworkInfo);
  const disconnectController = useControllerSessionStore((s) => s.disconnectController);
  const stats = useControllerSessionStore((s) => s.stats);
  const activeSource = useVehicleInputStore((s) => s.activeSource);

  // Wire up Vite HMR ↔ store bridge (safe no-op in prod)
  useControllerWebSocket();

  // Panel-local state
  const [panelState, setPanelState] = useState(PANEL_STATE.IDLE);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const expiryTimerRef = useRef(null);
  const sessionIdRef = useRef(null);

  const remaining = useCountdown(expiresAt);

  // Track session paired state via store status
  const isConnected = status === CONTROLLER_STATUS.CONNECTED && connectedDevice;

  // When controller connects, switch panel to PAIRED
  useEffect(() => {
    if (isConnected && panelState === PANEL_STATE.READY) {
      setPanelState(PANEL_STATE.PAIRED);
    }
  }, [isConnected, panelState]);

  // When countdown hits 0, mark expired
  useEffect(() => {
    if (remaining === 0 && panelState === PANEL_STATE.READY) {
      setPanelState(PANEL_STATE.EXPIRED);
    }
  }, [remaining, panelState]);

  // On panel open, fetch network info
  useEffect(() => {
    if (isPanelOpen) {
      fetchLocalNetworkInfo();
      // If already connected, show PAIRED immediately
      if (status === CONTROLLER_STATUS.CONNECTED && connectedDevice) {
        setPanelState(PANEL_STATE.PAIRED);
      }
    } else {
      // On close, clean up expiry timer
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    }
  }, [isPanelOpen, fetchLocalNetworkInfo, status, connectedDevice]);

  // On panel close, clean up
  useEffect(() => {
    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, []);

  // ─── Generate QR ─────────────────────────────────────────────────────────
  const generateQR = useCallback(async () => {
    setPanelState(PANEL_STATE.GENERATING);
    setQrDataUrl(null);
    setQrUrl(null);
    setSessionId(null);
    setExpiresAt(null);
    setErrorMsg('');

    try {
      // 1. Create session on server
      const res = await fetch('/api/controller/create-session', { method: 'POST' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      if (!data.sessionId || !data.qrUrl || !data.expiresAt) {
        throw new Error('Invalid session response from server');
      }

      setSessionId(data.sessionId);
      sessionIdRef.current = data.sessionId;
      setQrUrl(data.qrUrl);
      setExpiresAt(data.expiresAt);

      // 2. Render QR code to data URL
      const qrc = await loadQRCode();
      if (qrc) {
        const dataUrl = await qrc.toDataURL(data.qrUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 220,
          color: { dark: '#000000', light: '#FFFFFF' },
        });
        setQrDataUrl(dataUrl);
      }

      setPanelState(PANEL_STATE.READY);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate pairing session');
      setPanelState(PANEL_STATE.ERROR);
    }
  }, []);

  // ─── Cancel session ───────────────────────────────────────────────────────
  const cancelSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (sid) {
      try {
        await fetch(`/api/controller/session/${encodeURIComponent(sid)}`, { method: 'DELETE' });
      } catch (_) { }
    }
    setPanelState(PANEL_STATE.CANCELLED);
    setQrDataUrl(null);
    setQrUrl(null);
    setSessionId(null);
    setExpiresAt(null);
    sessionIdRef.current = null;
  }, []);

  // ─── Copy URL ─────────────────────────────────────────────────────────────
  const copyUrl = useCallback(() => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { });
  }, [qrUrl]);

  if (!isPanelOpen) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={S.overlay} onClick={closePanel}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.titleGroup}>
            <div style={S.iconBadge}><Smartphone size={18} color="var(--accent-cyan)" /></div>
            <div>
              <div style={S.title}>Smartphone Wireless Controller</div>
              <div style={S.subtitle}>QR Code Pairing — Local Wi-Fi Only</div>
            </div>
          </div>
          <button onClick={closePanel} style={S.closeBtn} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* Status banner */}
          <div style={{
            ...S.statusBanner,
            borderColor: isConnected ? '#10B981' : panelState === PANEL_STATE.ERROR ? '#EF4444' : 'rgba(0,240,255,0.3)',
            backgroundColor: isConnected ? 'rgba(16,185,129,0.08)' : panelState === PANEL_STATE.ERROR ? 'rgba(239,68,68,0.06)' : 'rgba(0,240,255,0.05)',
          }}>
            <div style={S.statusLeft}>
              <Radio size={14} color={isConnected ? '#10B981' : panelState === PANEL_STATE.ERROR ? '#EF4444' : 'var(--accent-cyan)'} />
              <span style={{ fontSize: 11, fontWeight: 700, color: isConnected ? '#10B981' : panelState === PANEL_STATE.ERROR ? '#EF4444' : 'var(--accent-cyan)', letterSpacing: '0.04em' }}>
                {isConnected ? 'PHONE CONNECTED' :
                  panelState === PANEL_STATE.READY ? 'WAITING FOR PHONE' :
                    panelState === PANEL_STATE.GENERATING ? 'GENERATING QR…' :
                      panelState === PANEL_STATE.EXPIRED ? 'SESSION EXPIRED' :
                        panelState === PANEL_STATE.ERROR ? 'ERROR' :
                          'READY'}
              </span>
            </div>
            <div style={S.sourcePill}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Input: </span>
              <strong style={{ color: activeSource === INPUT_SOURCE.SMARTPHONE ? 'var(--accent-cyan)' : '#E2E8F0', fontSize: 10 }}>
                {activeSource.toUpperCase()}
              </strong>
            </div>
          </div>

          {/* IDLE / CANCELLED / EXPIRED: show Generate button */}
          {(panelState === PANEL_STATE.IDLE || panelState === PANEL_STATE.CANCELLED || panelState === PANEL_STATE.EXPIRED) && (
            <div style={S.card}>
              <div style={S.cardHeader}>
                <ShieldCheck size={14} color="var(--accent-cyan)" />
                <span style={S.cardTitle}>Secure Pairing</span>
              </div>
              <p style={S.bodyText}>
                Generate a QR code and scan it with your phone's camera. Both devices must be on the same Wi-Fi network. No internet required.
              </p>
              {panelState === PANEL_STATE.EXPIRED && (
                <div style={S.warnBadge}><AlertCircle size={12} /> Session expired — generate a new QR code.</div>
              )}
              {panelState === PANEL_STATE.CANCELLED && (
                <div style={S.infoBadge}><Radio size={12} /> Previous session cancelled.</div>
              )}
              <div style={S.networkRow}>
                <Wifi size={12} color="rgba(255,255,255,0.4)" />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  Computer IP: <strong style={{ color: '#E2E8F0' }}>{localNetwork.ip || '—'}</strong> &nbsp;Port: <strong style={{ color: '#E2E8F0' }}>{localNetwork.port || 5173}</strong>
                </span>
              </div>
              <button style={S.primaryBtn} onClick={generateQR}>
                <Smartphone size={14} /> Generate QR Code
              </button>
            </div>
          )}

          {/* GENERATING */}
          {panelState === PANEL_STATE.GENERATING && (
            <div style={{ ...S.card, alignItems: 'center', padding: '32px 20px' }}>
              <RefreshCw size={24} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 12 }}>
                Generating secure pairing session…
              </span>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* ERROR */}
          {panelState === PANEL_STATE.ERROR && (
            <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.3)' }}>
              <div style={S.cardHeader}><AlertCircle size={14} color="#EF4444" /><span style={{ ...S.cardTitle, color: '#EF4444' }}>Error</span></div>
              <p style={{ ...S.bodyText, color: '#FCA5A5' }}>{errorMsg}</p>
              <button style={S.primaryBtn} onClick={generateQR}>Retry</button>
            </div>
          )}

          {/* READY: QR displayed */}
          {panelState === PANEL_STATE.READY && (
            <div style={S.card}>
              <div style={S.cardHeader}>
                <Clock size={14} color={remaining !== null && remaining < 60 ? '#F59E0B' : 'var(--accent-cyan)'} />
                <span style={S.cardTitle}>Scan QR Code</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: remaining !== null && remaining < 60 ? '#F59E0B' : 'rgba(255,255,255,0.65)', fontFamily: 'monospace' }}>
                  {formatCountdown(remaining)}
                </span>
              </div>

              {/* QR image */}
              <div style={S.qrWrapper}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Pairing QR Code" width={220} height={220} style={S.qrImage} />
                ) : (
                  <div style={S.qrPlaceholder}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Rendering QR…</span>
                  </div>
                )}
              </div>

              {/* Fallback URL */}
              {qrUrl && (
                <div style={S.urlBox}>
                  <Link size={11} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
                  <span style={S.urlText}>{qrUrl}</span>
                  <button style={S.copyBtn} onClick={copyUrl} title="Copy URL">
                    {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                  </button>
                </div>
              )}

              <p style={S.bodyText}>
                1. Open your phone camera and scan the QR code.<br />
                2. Tap the notification to open in your browser.<br />
                3. Keep phone and computer on the same Wi-Fi.
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.secondaryBtn} onClick={generateQR}>
                  <RefreshCw size={12} /> Refresh QR
                </button>
                <button style={S.dangerBtn} onClick={cancelSession}>
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* PAIRED: phone connected */}
          {(panelState === PANEL_STATE.PAIRED || isConnected) && connectedDevice && (
            <div style={{ ...S.card, borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.04)' }}>
              <div style={S.cardHeader}>
                <CheckCircle2 size={14} color="#10B981" />
                <span style={{ ...S.cardTitle, color: '#10B981' }}>Phone Connected</span>
                <button style={{ ...S.dangerBtn, marginLeft: 'auto' }} onClick={disconnectController}>
                  <Unplug size={12} /> Disconnect
                </button>
              </div>

              <div style={S.deviceGrid}>
                <div style={S.deviceCell}>
                  <span style={S.cellLabel}>Device</span>
                  <span style={S.cellValue}>{connectedDevice.name || 'Smartphone'}</span>
                </div>
                <div style={S.deviceCell}>
                  <span style={S.cellLabel}>IP</span>
                  <span style={S.cellValue}>{connectedDevice.ip || '—'}</span>
                </div>
                <div style={S.deviceCell}>
                  <span style={S.cellLabel}>Connected</span>
                  <span style={S.cellValue}>
                    {connectedDevice.connectedAt
                      ? new Date(connectedDevice.connectedAt).toLocaleTimeString()
                      : '—'}
                  </span>
                </div>
                <div style={S.deviceCell}>
                  <span style={S.cellLabel}>Packets</span>
                  <span style={S.cellValue}>{stats.packetsReceived} recv / {stats.packetsRejected} rej</span>
                </div>
              </div>

              <div style={S.arbitrationNote}>
                📡 Smartphone controller is active. Keyboard input is suspended while phone is connected.
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={S.footer}>
          <span style={S.footerText}>Part 35 — Local Wi-Fi · No internet required · Tokens expire in 5 min</span>
          <button style={S.doneBtn} onClick={closePanel}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    width: '100%', maxWidth: 480,
    backgroundColor: '#0D1117', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  titleGroup: { display: 'flex', alignItems: 'center', gap: 12 },
  iconBadge: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: { fontSize: 14, fontWeight: 700, color: '#FFFFFF' },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer', padding: 6, borderRadius: 6,
  },
  body: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' },
  statusBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', borderRadius: 8, border: '1px solid',
  },
  statusLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  sourcePill: {
    padding: '2px 8px', borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#FFF', textTransform: 'uppercase', letterSpacing: '0.06em' },
  bodyText: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0 },
  warnBadge: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 10px' },
  infoBadge: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent-cyan)', backgroundColor: 'rgba(0,240,255,0.06)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 6, padding: '6px 10px' },
  networkRow: { display: 'flex', alignItems: 'center', gap: 6 },
  primaryBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '10px 16px', borderRadius: 8,
    backgroundColor: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.35)',
    color: 'var(--accent-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
  dangerBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#EF4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  },
  qrWrapper: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: 12, backgroundColor: '#FFFFFF', borderRadius: 10,
  },
  qrImage: { display: 'block', borderRadius: 4 },
  qrPlaceholder: {
    width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8,
  },
  urlBox: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 10px', borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  urlText: {
    flex: 1, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  copyBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', flexShrink: 0,
  },
  deviceGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10,
  },
  deviceCell: { display: 'flex', flexDirection: 'column', gap: 2 },
  cellLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  cellValue: { fontSize: 11, fontWeight: 600, color: '#E2E8F0', fontFamily: 'monospace', wordBreak: 'break-all' },
  arbitrationNote: {
    fontSize: 11, color: '#10B981', lineHeight: 1.4, padding: '8px 10px',
    backgroundColor: 'rgba(16,185,129,0.06)', borderRadius: 6, border: '1px solid rgba(16,185,129,0.2)',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  footerText: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  doneBtn: {
    padding: '6px 14px', borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
};
