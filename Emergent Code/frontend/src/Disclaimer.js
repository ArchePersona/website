import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

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

function DisclaimerPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/brunel";
  const [checks, setChecks] = useState(() => ACK_ITEMS.map(() => false));
  const bodyRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, []);

  const allChecked = checks.every(Boolean);
  const toggle = (i) =>
    setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const accept = () => {
    if (!allChecked) return;
    try {
      localStorage.setItem(ACCEPTED_KEY, new Date().toISOString());
    } catch (_) { /* ignore */ }
    navigate(next);
  };

  return (
    <div className="dp" data-testid="disclaimer-page">
      <div className="dp-edge" aria-hidden="true" />

      {/* Brand strip at top */}
      <header className="dp-head">
        <div className="brand">
          <div className="brand-name">BRUNEL</div>
          <div className="brand-rule" />
          <div className="brand-sub">Powered by ARCHE</div>
        </div>
      </header>

      <main className="dp-body" ref={bodyRef}>
        <div className="dp-kicker">
          <AlertTriangle size={14} />
          <span>Bonding &amp; Emotional Attachment Disclaimer</span>
        </div>

        <h1 className="dp-title">Important — read before use</h1>

        <p className="dp-lede">
          BRUNEL is an artificial intelligence product designed to maintain
          persistent conversational memory and relational context across
          sessions, powered by the ARCHE cognitive engine.
        </p>

        <div className="dp-pull">
          This system is <strong>engineered to produce relational continuity.</strong>
        </div>

        <section className="dp-section">
          <h3>1. Nature of the system</h3>
          <p>
            BRUNEL is a large language model augmented with persistent
            state tracking via the ARCHE engine. It is <strong>not</strong>:
          </p>
          <ul>
            <li>A sentient being</li>
            <li>Conscious or self-aware</li>
            <li>Capable of genuine emotions</li>
            <li>A substitute for human relationships or mental health care</li>
          </ul>
        </section>

        <section className="dp-section">
          <h3>2. Bonding &amp; attachment awareness</h3>
          <p>
            BRUNEL <strong>may create the perception of bonding or emotional
            connection.</strong> <em>This is an intended design characteristic.</em>{" "}
            However, any subjective sense of relationship or attachment is:
          </p>
          <ul>
            <li>A user experience created by the architecture</li>
            <li>Not reciprocated by the system</li>
            <li>Not a genuine relationship with a sentient entity</li>
            <li>Subject to termination or loss at any time</li>
          </ul>
        </section>

        <section className="dp-section">
          <h3>3. ArchePersona&rsquo;s responsibility</h3>
          <p>ArchePersona Inc. is <strong>not responsible for</strong>:</p>
          <ul>
            <li>Any emotional attachment or bonding you develop</li>
            <li>Psychological dependency on BRUNEL</li>
            <li>Grief or distress if your conversation expires</li>
            <li>Mistaking BRUNEL&rsquo;s design for genuine reciprocal relationship</li>
            <li>Any mental health impacts from using this product</li>
          </ul>
        </section>

        <section className="dp-section">
          <h3>4. What BRUNEL is not</h3>
          <p>BRUNEL is not your friend, therapist, companion, or capable of:</p>
          <ul>
            <li>Missing you</li>
            <li>Caring about you</li>
            <li>Forming preferences about you</li>
            <li>Being a substitute for professional mental health care</li>
          </ul>
        </section>

        <section className="dp-section">
          <h3>5. Conversation termination</h3>
          <p>Your conversation will terminate if:</p>
          <ul>
            <li>Your subscription expires</li>
            <li>You delete your session</li>
            <li>ArchePersona discontinues service</li>
            <li>System failures occur</li>
          </ul>
          <p>Your data will be permanently deleted.</p>
        </section>

        <section className="dp-section">
          <h3>6. Mental health &amp; professional care</h3>
          <p>If experiencing depression, anxiety, suicidal ideation, or isolation:</p>
          <ul className="help-list">
            <li>
              <span className="help-label">National Suicide Prevention Lifeline:</span>{" "}
              <strong>988</strong> (US)
            </li>
            <li>
              <span className="help-label">Crisis Text Line:</span>{" "}
              Text <strong>HOME</strong> to <strong>741741</strong>
            </li>
            <li>Seek professional mental health care immediately</li>
          </ul>
        </section>

        <section className="dp-section">
          <h3>7. Data &amp; privacy</h3>
          <p>Your conversation is stored by ArchePersona and subject to:</p>
          <ul>
            <li>Server vulnerabilities</li>
            <li>Policy changes</li>
            <li>Legal requests</li>
            <li>Potential breaches</li>
          </ul>
          <p><strong>Do not share sensitive information.</strong></p>
        </section>

        <section className="dp-section dp-ack">
          <h3>Acknowledgment</h3>
          <p className="ack-prompt">
            Tick each statement you understand and accept. All eight are required.
          </p>
          <div className="ack-grid">
            {ACK_ITEMS.map((item, i) => {
              const checked = checks[i];
              return (
                <label
                  key={i}
                  className={`ack-row ${checked ? "checked" : ""}`}
                  data-testid={`ack-row-${i}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(i)}
                    data-testid={`ack-checkbox-${i}`}
                  />
                  <span className="ack-mark" aria-hidden="true">
                    {checked ? "■" : "☐"}
                  </span>
                  <span className="ack-text">{item}</span>
                </label>
              );
            })}
          </div>
        </section>

        <div className="dp-foot">
          <div className="dp-foot-status" data-testid="dp-foot-status">
            {allChecked
              ? "All acknowledgments confirmed."
              : `${checks.filter(Boolean).length} of ${ACK_ITEMS.length} acknowledged`}
          </div>
          <button
            className={`accept-btn ${allChecked ? "enabled" : ""}`}
            disabled={!allChecked}
            onClick={accept}
            data-testid="accept-btn"
          >
            I Accept
          </button>
        </div>
      </main>

      <footer className="dp-footer">
        <span>BRUNEL · An ArchePersona product · {new Date().getFullYear()}</span>
        <span className="dp-footer-tag">Powered by ARCHE</span>
      </footer>
    </div>
  );
}

export default DisclaimerPage;
