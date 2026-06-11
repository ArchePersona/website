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
  shell: {
    alignItems: "flex-start",
    padding: "clamp(14px, 4vw, 32px)",
  },
  card: {
    maxWidth: "960px",
    width: "min(960px, calc(100vw - 16px))",
    padding: "clamp(20px, 4.8vw, 52px)",
    gap: "22px",
    background: "linear-gradient(180deg, rgba(7,13,18,.98), rgba(3,7,10,.98))",
    borderColor: "rgba(184,148,10,.28)",
    boxShadow: "0 0 48px rgba(0,0,0,.45)",
  },
  content: {
    width: "100%",
    maxWidth: "840px",
    margin: "0 auto",
    display: "grid",
    gap: "clamp(16px, 4vw, 22px)",
  },
  titleBlock: {
    display: "grid",
    gap: "6px",
  },
  title: {
    fontSize: "clamp(31px, 10vw, 58px)",
    lineHeight: 1.02,
    letterSpacing: ".005em",
    margin: 0,
  },
  subtitle: {
    color: "var(--gold)",
    fontSize: "clamp(12px, 3.3vw, 16px)",
    letterSpacing: ".22em",
    textTransform: "uppercase",
    margin: 0,
  },
  rule: {
    width: "112px",
    height: "2px",
    background: "linear-gradient(to right, rgba(184,148,10,.95), transparent)",
  },
  lead: {
    color: "#c7d0d4",
    fontSize: "clamp(14px, 4vw, 17px)",
    lineHeight: 1.58,
    margin: 0,
  },
  section: {
    display: "grid",
    gap: "clamp(10px, 3vw, 14px)",
    paddingTop: "4px",
  },
  sectionTitle: {
    color: "var(--gold)",
    fontSize: "clamp(11px, 3.2vw, 13px)",
    letterSpacing: ".2em",
    textTransform: "uppercase",
    margin: 0,
  },
  body: {
    color: "#b8c2c8",
    fontSize: "clamp(13px, 3.7vw, 16px)",
    lineHeight: 1.6,
    margin: 0,
  },
  principleList: {
    display: "grid",
    gap: "7px",
    color: "#c7d0d4",
    fontSize: "clamp(14px, 3.9vw, 17px)",
    lineHeight: 1.45,
    margin: 0,
  },
  infoBox: {
    border: "1px solid rgba(184,148,10,.16)",
    background: "rgba(255,255,255,.018)",
    padding: "clamp(14px, 4vw, 18px)",
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
    <div className="auth-shell disclaimer-shell" style={styles.shell}>
      <div className="auth-card disclaimer-card" style={styles.card}>
        <div style={styles.content}>
          <div style={styles.titleBlock}>
            <h1 className="disclaimer-title" style={styles.title}>Meet Brunel</h1>
            <p style={styles.subtitle}>The Builder</p>
          </div>
          <div style={styles.rule} />

          <p style={styles.lead}>
            Brunel is a low-nonsense productivity partner built for clear thinking, practical work, and steady progress.
          </p>
          <p style={styles.body}>
            He is calm, direct, organized, and more interested in useful outcomes than performance, hype, or drama.
          </p>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>A Builder's Mindset</h2>
            <div style={styles.principleList}>
              <span>Solve the real problem.</span>
              <span>Make the next brick visible.</span>
              <span>Keep moving with care.</span>
            </div>
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
    </div>
  );
}
