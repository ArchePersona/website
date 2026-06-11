import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./App.css";

const ACK_ITEMS = [
  "I understand Brunel is an AI system, not a human.",
  "I will not rely on Brunel for professional advice in health, legal, finance, or safety matters.",
  "I am responsible for my choices and actions.",
  "I will seek human or professional support when needed.",
];

const ACCEPTED_KEY = "brunel_disclaimer_accepted_v1";

const styles = {
  card: {
    maxWidth: "720px",
    padding: "42px",
    gap: "22px",
    background: "linear-gradient(180deg, rgba(7,13,18,.98), rgba(3,7,10,.98))",
    borderColor: "rgba(184,148,10,.28)",
    boxShadow: "0 0 48px rgba(0,0,0,.45)",
  },
  title: {
    fontSize: "clamp(34px, 7vw, 54px)",
    lineHeight: 1.08,
    letterSpacing: ".015em",
    margin: 0,
  },
  rule: {
    width: "96px",
    height: "2px",
    background: "linear-gradient(to right, rgba(184,148,10,.95), transparent)",
  },
  lead: {
    color: "#c7d0d4",
    fontSize: "16px",
    lineHeight: 1.75,
    margin: 0,
  },
  section: {
    display: "grid",
    gap: "12px",
    paddingTop: "8px",
  },
  sectionTitle: {
    color: "var(--gold)",
    fontSize: "13px",
    letterSpacing: ".22em",
    textTransform: "uppercase",
    margin: 0,
  },
  body: {
    color: "#b8c2c8",
    fontSize: "15px",
    lineHeight: 1.8,
    margin: 0,
  },
  infoBox: {
    border: "1px solid rgba(184,148,10,.16)",
    background: "rgba(255,255,255,.018)",
    padding: "18px",
    display: "grid",
    gap: "10px",
  },
  submit: {
    fontSize: "14px",
    padding: "15px 18px",
    background: "linear-gradient(180deg, rgba(246,199,76,.24), rgba(184,148,10,.16))",
  },
};

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
      <div className="auth-card disclaimer-card" style={styles.card}>
        <h1 className="disclaimer-title" style={styles.title}>Meet Brunel — The Builder</h1>
        <div style={styles.rule} />

        <p style={styles.lead}>
          Brunel is a low-nonsense productivity partner built for clear thinking, practical work, and steady progress.
        </p>
        <p style={styles.body}>
          He is calm, direct, organized, and more interested in useful outcomes than performance, hype, or drama.
        </p>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>A Builder's Mindset</h2>
          <p style={styles.body}>
            Solve the real problem. Make the next brick visible. Keep moving with care.
          </p>
          <p style={styles.body}>
            Brunel can help you plan, write, organize, troubleshoot, learn, and turn messy thoughts into workable structure.
          </p>
        </section>

        <section style={styles.infoBox}>
          <h2 style={styles.sectionTitle}>Important Information</h2>
          <p style={styles.body}>
            Brunel may feel consistent and personal across sessions, but he remains an artificial intelligence system. Responses may occasionally be incorrect or incomplete.
          </p>
        </section>

        <div className="ack-grid">
          {ACK_ITEMS.map((item, i) => (
            <label className={`ack-row ${checks[i] ? "checked" : ""}`} key={item}>
              <input type="checkbox" checked={checks[i]} onChange={() => toggle(i)} />
              <span>{item}</span>
            </label>
          ))}
        </div>

        <div className="auth-info">{checks.filter(Boolean).length} of {ACK_ITEMS.length} acknowledged</div>
        <button className="auth-submit" style={styles.submit} disabled={!allChecked} onClick={accept}>Start Building</button>
      </div>
    </div>
  );
}
