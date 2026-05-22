import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
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
    } catch (_) {
      // ignore localStorage failures
    }
    navigate(next);
  };

  return (
    <div className="auth-shell disclaimer-shell">
      <div className="auth-card disclaimer-card">
        <div className="auth-brand">
          <div className="auth-brand-name">BRUNEL</div>
          <div className="auth-brand-rule" />
          <div className="auth-brand-sub">Powered by ARCHE</div>
        </div>

        <div className="disclaimer-kicker"><AlertTriangle size={14} /> Bonding & Emotional Attachment Disclaimer</div>
        <h1 className="disclaimer-title">Important — read before use</h1>
        <p className="auth-subtitle">
          BRUNEL is an artificial intelligence product designed to maintain persistent conversational memory and relational context across sessions. It is engineered to produce relational continuity, but it is not sentient and does not reciprocate emotion.
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
        <button className="auth-submit" disabled={!allChecked} onClick={accept}>I Accept</button>
      </div>
    </div>
  );
}
