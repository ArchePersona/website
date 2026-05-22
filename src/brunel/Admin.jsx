import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://brunel-5lxo.onrender.com";
const API = `${BACKEND_URL}/api`;

const STATES = ["baseline", "curious", "warm", "guarded", "offended", "reflective", "repair", "elevated", "fatigued"];
const MODES = ["normal", "sentinel", "social", "repair", "reflective", "workstation", "low-power"];
const AGENTS = ["Core", "EGO", "SOCIAL", "REASON", "THREAT", "MEMORY", "TRIBUNAL", "WHISPERERS"];
const MEMORY_TIERS = ["cache", "short-term", "working", "long-term", "archive"];

const DEFAULT_PROFILE = {
  state: "baseline",
  mode: "normal",
  agent: "Core",
  memoryTier: "working",
  activationThreshold: 50,
  decayRate: 50,
  compressionStrength: 50,
  memoryWeight: 50,
  threatSensitivity: 35,
  socialSoftness: 55,
  expressionPressure: 45,
  deescalationTrim: 55,
  tribunalCore: 50,
  tribunalSafety: 50,
  tribunalRelational: 50,
  notes: "",
  testInput: "",
  expectedBehavior: "",
  observedBehavior: "",
};

function Slider({ label, value, onChange, hint }) {
  return (
    <label className="tuning-control">
      <div className="tuning-label-row">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {hint && <div className="tuning-hint">{hint}</div>}
      <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="tuning-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function PacketBrokerModal({ authHeader }) {
  const [open, setOpen] = useState(true);
  const [volume, setVolume] = useState(0);
  const [savedVolume, setSavedVolume] = useState(0);
  const [status, setStatus] = useState("loading broker knob...");
  const [lastSummary, setLastSummary] = useState(null);
  const [position, setPosition] = useState({ x: 36, y: 118 });
  const dragRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/admin/packet-broker`, { headers: authHeader });
        if (cancelled) return;
        const nextVolume = Number(r.data?.volume || 0);
        setVolume(nextVolume);
        setSavedVolume(nextVolume);
        setLastSummary(r.data?.last_summary || null);
        setStatus("broker linked");
      } catch (e) {
        setStatus(`broker unavailable: ${e?.response?.data?.detail || e.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [authHeader]);

  const startDrag = (event) => {
    const pointer = event.touches?.[0] || event;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: pointer.clientX,
      startY: pointer.clientY,
      baseX: position.x,
      baseY: position.y,
    };
    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const moveDrag = (event) => {
    if (!dragRef.current) return;
    const pointer = event.touches?.[0] || event;
    const dx = pointer.clientX - dragRef.current.startX;
    const dy = pointer.clientY - dragRef.current.startY;
    setPosition({
      x: Math.max(8, dragRef.current.baseX + dx),
      y: Math.max(8, dragRef.current.baseY + dy),
    });
  };

  const stopDrag = () => {
    dragRef.current = null;
  };

  const saveVolume = async () => {
    try {
      setStatus("saving broker volume...");
      const r = await axios.put(`${API}/admin/packet-broker`, { volume }, { headers: authHeader });
      const nextVolume = Number(r.data?.volume || volume);
      setSavedVolume(nextVolume);
      setVolume(nextVolume);
      setStatus(`saved at ${nextVolume}`);
    } catch (e) {
      setStatus(`save failed: ${e?.response?.data?.detail || e.message}`);
    }
  };

  const modeLabel = useMemo(() => {
    if (volume === 0) return "offline";
    if (volume <= 25) return "observe only";
    if (volume <= 60) return "light trim";
    if (volume <= 85) return "active trim";
    return "hot / full pressure";
  }, [volume]);

  if (!open) {
    return <button className="floating-broker-tab" onClick={() => setOpen(true)}>Packet Broker</button>;
  }

  return (
    <div className="broker-modal" style={{ left: position.x, top: position.y }}>
      <div
        className="broker-modal-header"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <span>Packet Broker</span>
        <button onClick={() => setOpen(false)} aria-label="close packet broker modal">×</button>
      </div>

      <div className="broker-modal-body">
        <div className="broker-readout">
          <strong>{volume}</strong>
          <span>{modeLabel}</span>
        </div>
        <input className="broker-volume" type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        <div className="broker-scale">
          <span>0 silent</span>
          <span>50 trim</span>
          <span>100 hot</span>
        </div>
        <button className="auth-submit compact" onClick={saveVolume} disabled={volume === savedVolume}>Save Broker Volume</button>
        <div className="broker-status">{status}</div>
        {lastSummary?.packet_count !== undefined && (
          <div className="broker-last">
            <span>last packets: {lastSummary.packet_count}</span>
            <span>influence: {lastSummary.influence_enabled ? "yes" : "no"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [savedAt, setSavedAt] = useState(null);

  const authHeader = useMemo(
    () => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    [session?.access_token]
  );

  useEffect(() => {
    const raw = window.localStorage.getItem("arche.tuningBench.v1");
    if (!raw) return;
    try {
      setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
    } catch (_) {
      setProfile(DEFAULT_PROFILE);
    }
  }, []);

  const update = (key, value) => setProfile((current) => ({ ...current, [key]: value }));

  const saveLocal = () => {
    window.localStorage.setItem("arche.tuningBench.v1", JSON.stringify(profile));
    setSavedAt(new Date().toLocaleTimeString());
  };

  const reset = () => {
    setProfile(DEFAULT_PROFILE);
    setSavedAt(null);
  };

  const profileSummary = useMemo(() => {
    return `${profile.state}/${profile.mode}/${profile.agent} · memory:${profile.memoryTier} · compressor:${profile.compressionStrength}`;
  }, [profile]);

  return (
    <div className="admin-shell">
      <PacketBrokerModal authHeader={authHeader} />

      <div className="admin-topbar">
        <div className="auth-brand">
          <div className="auth-brand-name">ARCHE</div>
          <div className="auth-brand-rule" />
          <div className="auth-brand-sub">tuning bench</div>
        </div>
        <div className="admin-actions">
          <button className="reset-btn" onClick={() => navigate("/brunel")}>Back to BRUNEL</button>
          <button className="reset-btn" onClick={reset}>Reset</button>
          <button className="auth-submit compact" onClick={saveLocal}>Save Draft Locally</button>
        </div>
      </div>

      <div className="admin-grid">
        <section className="tuning-card tuning-hero-card">
          <div className="admin-kicker">Behavioral Physics Control Room</div>
          <h1>ARCHE Tuning Bench</h1>
          <p>
            Draft runtime settings here without changing live Brunel behavior. Use this bench to sculpt states,
            modes, Tribunal pressure, memory tier weighting, compressor behavior, and test notes.
          </p>
          <div className="profile-strip">{profileSummary}</div>
          {savedAt && <div className="save-note">saved locally at {savedAt}</div>}
        </section>

        <section className="tuning-card">
          <div className="admin-kicker">Target Selection</div>
          <div className="select-grid">
            <SelectField label="State" value={profile.state} options={STATES} onChange={(value) => update("state", value)} />
            <SelectField label="Mode" value={profile.mode} options={MODES} onChange={(value) => update("mode", value)} />
            <SelectField label="Agent" value={profile.agent} options={AGENTS} onChange={(value) => update("agent", value)} />
            <SelectField label="Memory Tier" value={profile.memoryTier} options={MEMORY_TIERS} onChange={(value) => update("memoryTier", value)} />
          </div>
        </section>

        <section className="tuning-card">
          <div className="admin-kicker">Compressor</div>
          <Slider label="Activation threshold" value={profile.activationThreshold} onChange={(value) => update("activationThreshold", value)} hint="How much signal is needed before this profile wakes up." />
          <Slider label="Decay rate" value={profile.decayRate} onChange={(value) => update("decayRate", value)} hint="How quickly the system returns toward baseline." />
          <Slider label="Compression strength" value={profile.compressionStrength} onChange={(value) => update("compressionStrength", value)} hint="How hard raw signal gets squeezed into stable behavior." />
          <Slider label="Expression pressure" value={profile.expressionPressure} onChange={(value) => update("expressionPressure", value)} hint="How much feeling/personality can leak into output." />
        </section>

        <section className="tuning-card">
          <div className="admin-kicker">Memory + Safety Trim</div>
          <Slider label="Memory weight" value={profile.memoryWeight} onChange={(value) => update("memoryWeight", value)} hint="How strongly prior continuity should influence this state." />
          <Slider label="Threat sensitivity" value={profile.threatSensitivity} onChange={(value) => update("threatSensitivity", value)} hint="How readily safety/threat systems flag the input." />
          <Slider label="Social softness" value={profile.socialSoftness} onChange={(value) => update("socialSoftness", value)} hint="How much relational cushioning is applied before response." />
          <Slider label="Whisperer de-escalation trim" value={profile.deescalationTrim} onChange={(value) => update("deescalationTrim", value)} hint="How strongly long-running drift pushes the system back down." />
        </section>

        <section className="tuning-card tribunal-card">
          <div className="admin-kicker">Tribunal Weights</div>
          <Slider label="Core coherence vote" value={profile.tribunalCore} onChange={(value) => update("tribunalCore", value)} />
          <Slider label="Safety / Sentinel vote" value={profile.tribunalSafety} onChange={(value) => update("tribunalSafety", value)} />
          <Slider label="Relational / Social vote" value={profile.tribunalRelational} onChange={(value) => update("tribunalRelational", value)} />
          <div className="tribunal-note">
            Low confidence: gather more evidence. Two-member convergence: strong recommendation. Three-member convergence: forced state/mode shift.
          </div>
        </section>

        <section className="tuning-card test-card">
          <div className="admin-kicker">Test Harness Notes</div>
          <label className="tuning-textarea">
            <span>Test input</span>
            <textarea value={profile.testInput} onChange={(e) => update("testInput", e.target.value)} placeholder="Paste the prompt or user input you want to test..." />
          </label>
          <label className="tuning-textarea">
            <span>Expected behavior</span>
            <textarea value={profile.expectedBehavior} onChange={(e) => update("expectedBehavior", e.target.value)} placeholder="What should the system do if this tuning is right?" />
          </label>
          <label className="tuning-textarea">
            <span>Observed behavior</span>
            <textarea value={profile.observedBehavior} onChange={(e) => update("observedBehavior", e.target.value)} placeholder="What actually happened when you tested it?" />
          </label>
        </section>

        <section className="tuning-card notes-card">
          <div className="admin-kicker">Architect Notes</div>
          <label className="tuning-textarea tall">
            <span>Notes</span>
            <textarea value={profile.notes} onChange={(e) => update("notes", e.target.value)} placeholder="What are you trying to sculpt? What felt too hot, too soft, too robotic, too loose, too corporate, too goblin?" />
          </label>
        </section>
      </div>
    </div>
  );
}
