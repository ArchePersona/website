import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import brunelHeaderImage from "../images/file_00000000947c720c8056c2feeeac6d4f.png";
import "./App.css";

const ACK_ITEMS = [
  "I understand Brunel is an AI system.",
  "I remain responsible for my decisions.",
  "I will seek human support when needed.",
  "Brunel is a companion, not a replacement.",
];

const ACCEPTED_KEY = "brunel_disclaimer_accepted_v1";

const styles = {
  shell: {
    alignItems: "flex-start",
    padding: "clamp(8px, 2.8vw, 32px)",
  },
  card: {
    maxWidth: "1020px",
    width: "min(1020px, calc(100vw - 8px))",
    padding: "clamp(18px, 3.8vw, 52px)",
    gap: "22px",
    background: "linear-gradient(180deg, rgba(7,13,18,.98), rgba(3,7,10,.98))",
    borderColor: "rgba(184,148,10,.28)",
    boxShadow: "0 0 48px rgba(0,0,0,.45)",
  },
  content: {
    width: "100%",
    maxWidth: "900px",
    margin: "0 auto",
    display: "grid",
    gap: "clamp(14px, 3vw, 20px)",
  },
  headerImage: {
    display: "block",
    width: "min(100%, 760px)",
    height: "auto",
    margin: "0 auto",
    borderRadius: "16px",
    border: "1px solid rgba(184,148,10,.18)",
    boxShadow: "0 0 32px rgba(0,0,0,.42)",
  },
  builder: {
    color: "var(--gold)",
    fontSize: "clamp(12px, 3.4vw, 18px)",
    letterSpacing: ".24em",
    textTransform: "uppercase",
    textAlign: "center",
    margin: "-10px 0 0",
  },
  rule: {
    width: "112px",
    height: "2px",
    background: "linear-gradient(to right, rgba(184,148,10,.95), transparent)",
  },
  section: {
    display: "grid",
    gap: "clamp(9px, 2.4vw, 13px)",
    paddingTop: "3px",
  },
  sectionTitle: {
    color: "var(--gold)",
    fontSize: "clamp(10px, 2.85vw, 13px)",
    letterSpacing: ".18em",
    textTransform: "uppercase",
    margin: 0,
  },
  lead: {
    color: "#c7d0d4",
    fontSize: "clamp(13px, 3.45vw, 17px)",
    lineHeight: 1.55,
    margin: 0,
  },
  body: {
    color: "#b8c2c8",
    fontSize: "clamp(12.5px, 3.25vw, 16px)",
    lineHeight: 1.58,
    margin: 0,
  },
  bulletList: {
    margin: 0,
    paddingLeft: "1.15rem",
    color: "#c7d0d4",
    fontSize: "clamp(13px, 3.35vw, 17px)",
    lineHeight: 1.55,
  },
  infoBox: {
    border: "1px solid rgba(184,148,10,.09)",
    background: "rgba(255,255,255,.01)",
    padding: "clamp(10px, 2.8vw, 16px)",
    display: "grid",
    gap: "8px",
  },
  ackGrid: {
    display: "grid",
    gap: "5px",
    paddingTop: "clamp(4px, 1.5vw, 10px)",
  },
  ackRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "clamp(6px, 1.8vw, 8px) clamp(8px, 2.4vw, 11px)",
    border: "1px solid rgba(184,148,10,.07)",
    background: "rgba(255,255,255,.008)",
    color: "#b8c2c8",
    fontSize: "clamp(12px, 3.15vw, 14px)",
    lineHeight: 1.32,
    cursor: "pointer",
  },
  ackInput: {
    width: "14px",
    height: "14px",
    marginTop: 0,
    flex: "0 0 auto",
  },
  ackRowChecked: {
    borderColor: "rgba(184,148,10,.22)",
    background: "rgba(184,148,10,.035)",
  },
  signature: {
    color: "rgba(240,237,232,.48)",
    fontSize: "clamp(11px, 3vw, 13px)",
    fontStyle: "italic",
    lineHeight: 1.5,
    textAlign: "center",
    margin: 0,
    paddingTop: "4px",
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

  const toggle = (i) => {
    setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

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
          <img style={styles.headerImage} src={brunelHeaderImage} alt="Brunel" />

          <p style={styles.builder}>The Builder</p>

          <div style={styles.rule} />

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>What you can expect</h2>

            <p style={styles.lead}>
              Brunel is built for clear thinking, practical work, and steady progress.
            </p>

            <ul style={styles.bulletList}>
              <li>Helps find the real problem.</li>
              <li>Turns scattered thoughts into next steps.</li>
              <li>Stays calm, direct, and organized.</li>
              <li>Focuses on useful outcomes.</li>
            </ul>
          </section>

          <section style={styles.infoBox}>
            <h2 style={styles.sectionTitle}>Before We Begin</h2>

            <p style={styles.body}>
              Brunel may feel consistent and personal across sessions, but he remains an artificial intelligence system. Responses may occasionally be incorrect or incomplete.
            </p>
          </section>

          <div style={styles.ackGrid}>
            {ACK_ITEMS.map((item, i) => (
              <label
                style={{ ...styles.ackRow, ...(checks[i] ? styles.ackRowChecked : {}) }}
                key={item}
              >
                <input
                  style={styles.ackInput}
                  type="checkbox"
                  checked={checks[i]}
                  onChange={() => toggle(i)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>

          <div className="auth-info">
            {checks.filter(Boolean).length} of {ACK_ITEMS.length} acknowledged
          </div>

          <p style={styles.signature}>Build carefully. Build honestly. Build well.</p>

          <button
            className="auth-submit"
            style={styles.submit}
            disabled={!allChecked}
            onClick={accept}
          >
            Start Building
          </button>
        </div>
      </div>
    </div>
  );
}
