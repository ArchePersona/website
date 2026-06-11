import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./App.css";

const ACK_ITEMS = [
  "BRUNEL is an artificial system, not sentient",
  "Any emotional connection is one-directional",
  "BRUNEL does not reciprocate feelings",
  "My conversation can be deleted at any time",
  "This is not a substitute for human relationships",
  "I will not use BRUNEL as primary emotional support",
  "I will seek professional care if needed",
  "ArchePersona is not liable for emotional impacts",
];

const ACCEPTED_KEY = "brunel_disclaimer_accepted_v1";

export default function Disclaimer() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/brunel";
  const [checks, setChecks] = useState(() => ACK_ITEMS.map(() => false));
  const allChecked = checks.every(Boolean);

  const toggle = (i) => setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const accept = () => {
    if (!allChecked) return;
    try {
      localStorage.setItem(ACCEPTED_KEY, new Date().toISOString());
    } catch (_) {}
    navigate(next);
  };

  return (
    <div className="auth-shell disclaimer-shell">
      <div className="auth-card disclaimer-card">
        <h1 className="disclaimer-title">Meet Brunel — The Builder</h1>
        <div className="auth-brand-rule" />
        <p className="auth-subtitle">
          Brunel is a low-nonsense productivity partner built for clear thinking, practical work, and steady progress. He is calm, direct, organized, and more interested in useful outcomes than performance, hype, or drama.
        </p>
        <p className="auth-subtitle">
          His personality is shaped around the builder's mindset: solve the real problem, make the next brick visible, and keep moving with care. Brunel can help you plan, write, organize, troubleshoot, learn, and turn messy thoughts into workable structure.
        </p>
        <p className="auth-subtitle">
          Brunel may feel consistent and personal across sessions, but he remains an artificial intelligence system. Before continuing, please acknowledge the limits below.
        </p>

        <div className="ack-grid">
          {ACK_ITEMS.map((item, i) => (
            <label className={`ack-row ${checks[i] ? "checked" : ""}`} key={item}>
              <input type="checkbox" checked={checks[i]} onChange={() => toggle(i)} />
              <span>{item}</span>
            </label>
          ))}
        </div>

        <div className="auth-info">{checks.filter(Boolean).length} of {ACK_ITEMS.length} acknowledged</div>
        <button className="auth-submit" disabled={!allChecked} onClick={accept}>Start Building</button>
      </div>
    </div>
  );
}
