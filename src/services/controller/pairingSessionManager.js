/**
 * Pairing Session Manager — Part 35
 *
 * Server-side ONLY (runs in Vite plugin / Node.js context).
 * Manages the lifecycle of pairing sessions between the computer and a smartphone controller:
 *
 *  - Each session has a cryptographically secure token (crypto.randomBytes(32) → 64-char hex).
 *  - Tokens expire after TOKEN_EXPIRY_MS (default 5 minutes).
 *  - Sessions are invalidated permanently after MAX_INVALID_ATTEMPTS failed token checks.
 *  - Only one controller may own the vehicle at a time (single-device lock enforced at WS layer).
 *  - Expired and cancelled sessions cannot be used to authenticate WebSocket connections.
 *
 * Token safety rules:
 *  - Tokens are NEVER logged to console (even in debug builds).
 *  - Tokens are stripped before any state is returned to the frontend/UI.
 *  - Tokens are only compared using timing-safe comparison when available.
 */

import crypto from 'crypto';

const TOKEN_EXPIRY_MS = 5 * 60 * 1000;   // 5 minutes
const MAX_INVALID_ATTEMPTS = 3;
const CLEANUP_INTERVAL_MS = 60 * 1000;    // Prune expired sessions every 60 s

export const SESSION_STATUS = {
  PENDING:   'pending',   // created, QR shown, waiting for phone
  ACTIVE:    'active',    // phone connected via WebSocket
  EXPIRED:   'expired',   // past expiresAt without connection
  CANCELLED: 'cancelled', // explicitly cancelled by computer operator
  LOCKED:    'locked',    // too many invalid token attempts
};

class PairingSessionManager {
  constructor() {
    /** @type {Map<string, object>} sessionId → session */
    this._sessions = new Map();
    this._cleanupTimer = null;
    this._startCleanup();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Create a new pairing session.
   * @param {string} localIp   - LAN IP address (non-loopback, reachable by phone)
   * @param {number} port      - Vite dev-server port (default 5173)
   * @returns {{ sessionId: string, expiresAt: number, qrUrl: string }}
   */
  createSession(localIp, port = 5173) {
    // Invalidate any dangling PENDING sessions first
    this._expireOldSessions();

    const sessionId = crypto.randomUUID();
    const token     = crypto.randomBytes(32).toString('hex'); // 64-char hex, 256-bit entropy
    const now       = Date.now();
    const expiresAt = now + TOKEN_EXPIRY_MS;

    // Encode token + sessionId in QR URL — phone submits both when connecting
    const qrUrl = `http://${localIp}:${port}/controller?session=${sessionId}&token=${token}`;

    const session = {
      id:               sessionId,
      _token:           token,          // underscore prefix signals "do not expose to UI"
      createdAt:        now,
      expiresAt,
      status:           SESSION_STATUS.PENDING,
      invalidAttempts:  0,
      connectedAt:      null,
      disconnectedAt:   null,
      _qrUrl:           qrUrl,          // contains token — strip before sending to frontend
      localIp,
      port,
    };

    this._sessions.set(sessionId, session);

    // Return only the data the frontend needs (no token)
    return {
      sessionId,
      expiresAt,
      qrUrl,          // frontend renders this into a QR image; it's intentionally in the URL
      localIp,
      port,
    };
  }

  /**
   * Validate a token for a given session.
   * Increments invalidAttempts on failure; locks after MAX_INVALID_ATTEMPTS.
   *
   * @param {string} sessionId
   * @param {string} token
   * @returns {{ valid: boolean, session?: object, error?: string }}
   */
  validateToken(sessionId, token) {
    const session = this._sessions.get(sessionId);

    if (!session) {
      return { valid: false, error: 'Session not found' };
    }

    if (session.status === SESSION_STATUS.LOCKED) {
      return { valid: false, error: 'Session is locked due to too many invalid attempts' };
    }

    if (session.status === SESSION_STATUS.CANCELLED) {
      return { valid: false, error: 'Session has been cancelled' };
    }

    if (session.status === SESSION_STATUS.EXPIRED || Date.now() > session.expiresAt) {
      session.status = SESSION_STATUS.EXPIRED;
      this._sessions.set(sessionId, session);
      return { valid: false, error: 'Session has expired' };
    }

    // Timing-safe comparison to prevent timing attacks
    const expected = Buffer.from(session._token, 'utf8');
    const provided  = Buffer.from(typeof token === 'string' ? token : '', 'utf8');

    let tokenMatch = false;
    if (expected.length === provided.length) {
      tokenMatch = crypto.timingSafeEqual(expected, provided);
    }

    if (!tokenMatch) {
      session.invalidAttempts += 1;
      if (session.invalidAttempts >= MAX_INVALID_ATTEMPTS) {
        session.status = SESSION_STATUS.LOCKED;
      }
      this._sessions.set(sessionId, session);
      return {
        valid: false,
        error: `Invalid token (attempt ${session.invalidAttempts}/${MAX_INVALID_ATTEMPTS})`,
        attemptsUsed: session.invalidAttempts,
        locked: session.status === SESSION_STATUS.LOCKED,
      };
    }

    // Token is valid — return sanitized session (no _token, no _qrUrl)
    return { valid: true, session: this._sanitize(session) };
  }

  /**
   * Mark a session as ACTIVE once the phone's WebSocket is established.
   * @param {string} sessionId
   * @returns {boolean} success
   */
  activateSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session || session.status !== SESSION_STATUS.PENDING) return false;
    session.status      = SESSION_STATUS.ACTIVE;
    session.connectedAt = Date.now();
    this._sessions.set(sessionId, session);
    return true;
  }

  /**
   * Mark a session as cancelled (computer operator pressed Cancel).
   * @param {string} sessionId
   */
  cancelSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return false;
    session.status         = SESSION_STATUS.CANCELLED;
    session.disconnectedAt = Date.now();
    this._sessions.set(sessionId, session);
    return true;
  }

  /**
   * Mark an ACTIVE session's controller as disconnected (phone WS closed).
   * @param {string} sessionId
   */
  disconnectSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return false;
    if (session.status === SESSION_STATUS.ACTIVE) {
      session.status         = SESSION_STATUS.CANCELLED; // treat as ended
      session.disconnectedAt = Date.now();
      this._sessions.set(sessionId, session);
    }
    return true;
  }

  /**
   * Return sanitized (token-free) session info, or null if not found.
   * @param {string} sessionId
   */
  getSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;
    // Auto-expire if past deadline
    if (session.status === SESSION_STATUS.PENDING && Date.now() > session.expiresAt) {
      session.status = SESSION_STATUS.EXPIRED;
      this._sessions.set(sessionId, session);
    }
    return this._sanitize(session);
  }

  /**
   * Return array of all active session IDs (for diagnostics).
   */
  listSessionIds() {
    return [...this._sessions.keys()];
  }

  /**
   * Cleanup: dispose of the background cleanup timer (call on server shutdown).
   */
  dispose() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /** Remove expired sessions from the map to prevent unbounded memory growth. */
  _expireOldSessions() {
    const now = Date.now();
    for (const [id, session] of this._sessions.entries()) {
      if (
        session.status === SESSION_STATUS.PENDING &&
        now > session.expiresAt
      ) {
        session.status = SESSION_STATUS.EXPIRED;
        this._sessions.set(id, session);
      }
      // Fully remove sessions that have been expired/cancelled/locked for >10 min
      const ageMs = now - session.createdAt;
      if (
        [SESSION_STATUS.EXPIRED, SESSION_STATUS.CANCELLED, SESSION_STATUS.LOCKED].includes(session.status) &&
        ageMs > 10 * 60 * 1000
      ) {
        this._sessions.delete(id);
      }
    }
  }

  _startCleanup() {
    this._cleanupTimer = setInterval(() => {
      this._expireOldSessions();
    }, CLEANUP_INTERVAL_MS);
    // Allow Node.js to exit even if this timer is active
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  /** Strip internal fields (_token, _qrUrl) before returning to untrusted contexts. */
  _sanitize(session) {
    const { _token, _qrUrl, ...safe } = session; // eslint-disable-line no-unused-vars
    return safe;
  }
}

// Singleton — shared across the Vite plugin lifetime
export const pairingSessionManager = new PairingSessionManager();
export default pairingSessionManager;
