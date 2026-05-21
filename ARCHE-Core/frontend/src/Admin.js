import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/AuthContext";
import "@/App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Admin() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();

  const authHeader = useMemo(
    () => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    [session?.access_token]
  );

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [validStates, setValidStates] = useState([]);
  const [validModes, setValidModes] = useState([]);
  const [activeState, setActiveState] = useState(null);
  const [activeMode, setActiveMode] = useState(null);

  const [pickState, setPickState] = useState("");
  const [pickMode, setPickMode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setMsg("");
    try {
      const r = await axios.get(`${API}/admin/override`, { headers: authHeader });
      setValidStates(r.data.valid_states || []);
      setValidModes(r.data.valid_modes || []);
      setActiveState(r.data.state);
      setActiveMode(r.data.mode);
      setPickState(r.data.state || "");
      setPickMode(r.data.mode || "");
      setForbidden(false);
    } catch (e) {
      if (e?.response?.status === 403) setForbidden(true);
      else setMsg(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const apply = async () => {
    setBusy(true);
    setMsg("");
    try {
      const body = {
        state: pickState || null,
        mode: pickMode || null,
      };
      const r = await axios.put(`${API}/admin/override`, body, { headers: authHeader });
      setActiveState(r.data.state);
      setActiveMode(r.data.mode);
      setMsg("override applied");
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setMsg("");
    try {
      await axios.delete(`${API}/admin/override`, { headers: authHeader });
      setActiveState(null);
      setActiveMode(null);
      setPickState("");
      setPickMode("");
      setMsg("override cleared — natural emergence restored");
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-shell" data-testid="admin-loading">
        <div className="auth-loading-text">…</div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="auth-shell" data-testid="admin-forbidden">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-name">BRUNEL</div>
            <div className="auth-brand-rule" />
            <div className="auth-brand-sub">admin · forbidden</div>
          </div>
          <div className="auth-title">403</div>
          <div className="auth-subtitle">
            Your account ({user?.email}) is not on the admin allowlist. Add it to <code>ADMIN_EMAILS</code> in the backend env.
          </div>
          <button className="auth-submit" onClick={() => navigate("/brunel")} data-testid="admin-back">
            Back to BRUNEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell" data-testid="admin-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-brand">
          <div className="auth-brand-name">BRUNEL</div>
          <div className="auth-brand-rule" />
          <div className="auth-brand-sub">admin · override</div>
        </div>

        <div className="auth-title">Force a state / mode</div>
        <div className="auth-subtitle">
          Overrides natural emergence for this account&rsquo;s next replies.
          Clear to restore.
        </div>

        <div className="admin-current" data-testid="admin-current">
          <div className="admin-current-label">Currently forced:</div>
          <div className="admin-current-row">
            <span className="admin-pill" data-testid="admin-current-state">
              state · {activeState || "—"}
            </span>
            <span className="admin-pill" data-testid="admin-current-mode">
              mode · {activeMode || "—"}
            </span>
          </div>
        </div>

        <div className="auth-form">
          <label className="admin-label">State</label>
          <select
            className="auth-input"
            value={pickState}
            onChange={(e) => setPickState(e.target.value)}
            data-testid="admin-state-select"
          >
            <option value="">— natural —</option>
            {validStates.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <label className="admin-label">Mode</label>
          <select
            className="auth-input"
            value={pickMode}
            onChange={(e) => setPickMode(e.target.value)}
            data-testid="admin-mode-select"
          >
            <option value="">— natural —</option>
            {validModes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {msg && <div className="auth-info" data-testid="admin-msg">{msg}</div>}

          <button
            className="auth-submit"
            onClick={apply}
            disabled={busy}
            data-testid="admin-apply"
          >
            {busy ? "..." : "Apply override"}
          </button>
          <button
            className="auth-oauth"
            onClick={clear}
            disabled={busy}
            style={{ cursor: "pointer" }}
            data-testid="admin-clear"
          >
            Clear override
          </button>
        </div>

        <div className="auth-toggle">
          <button type="button" className="auth-link" onClick={() => navigate("/brunel")} data-testid="admin-to-chat">
            ← Back to BRUNEL
          </button>
          <span style={{ margin: "0 10px", color: "var(--dim)" }}>·</span>
          <button type="button" className="auth-link" onClick={() => {
            if (window.confirm("Sign out of BRUNEL?")) signOut();
          }} data-testid="admin-signout">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
