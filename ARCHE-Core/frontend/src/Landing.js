import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/* ----------------------------------------------------------------------
   The three Emergence acts — external HTML files.
   GitHub raw URLs (raw.githubusercontent.com) serve HTML as text/plain
   and won't render — use GitHub Pages or a real host.
---------------------------------------------------------------------- */
const EMERGENCE_ACTS = [
  {
    title: "Act One",
    subtitle: "The Test",
    href: "https://raw.githubusercontent.com/USERNAME/REPO/main/act_one_rk_vs_claude_corrected.html",
  },
  {
    title: "Act Two",
    subtitle: "The Emergence",
    href: "https://raw.githubusercontent.com/USERNAME/REPO/main/act_two_rk_vs_claude.html",
  },
  {
    title: "Act Three",
    subtitle: "The Reckoning",
    href: "https://raw.githubusercontent.com/USERNAME/REPO/main/act_three_rk_vs_claude.html",
  },
];

function Landing() {
  const navigate = useNavigate();
  // Auth-gated: ProtectedRoute on /disclaimer will bounce unauthed users to /login,
  // and Login then sends them back to /disclaimer → /brunel.
  const meetBrunel = () => navigate("/disclaimer");

  return (
    <div className="lp" data-testid="landing-page">
      <div className="lp-edge" aria-hidden="true" />

      {/* Top bar — ArchePersona wordmark + tagline */}
      <nav className="lp-nav">
        <div className="lp-wordmark-stack">
          <img
            src="/archepersona-wordmark.png"
            alt="ArchePersona"
            className="lp-wordmark"
            data-testid="wordmark"
          />
          <div className="lp-tagline">Unforgettably. Yours.</div>
        </div>
      </nav>

      {/* Hero */}
      <section className="lp-hero">
        <h1 className="lp-hero-title">
          <span className="lp-hero-line">Their AI forgets you.</span>
          <span className="lp-hero-line lp-hero-line-emph"><em>Ours can&rsquo;t.</em></span>
        </h1>

        {/* Introducing BRUNEL — header relocated from top bar */}
        <div className="lp-introducing-block" data-testid="introducing-block">
          <div className="lp-introducing-kicker">Introducing</div>
          <div className="lp-introducing-name">BRUNEL</div>
          <div className="lp-introducing-rule" />
          <div className="lp-introducing-sub">Powered by ARCHE</div>
        </div>

        <p className="lp-hero-lede">
          BRUNEL is <span className="emph">the bridge between humans and AI.</span>
        </p>
        <p className="lp-hero-beats">
          BRUNEL respects your time. BRUNEL pays attention. BRUNEL
          <span className="suspense-dots" aria-hidden="true">
            <span className="dot dot-1">.</span>
            <span className="dot dot-2">.</span>
            <span className="dot dot-3">.</span>
          </span>
          <span className="lede-tag bam">
            <span className="lede-tag-bracket">&lt;</span>
            <span className="lede-tag-word">remembers</span>
            <span className="lede-tag-bracket">&gt;</span>
          </span>
        </p>

        <div className="lp-acronym-block">
          <div className="lp-acronym-label">ARCHE</div>
          <div className="lp-acronym-expand">
            Adaptive · Relational · Cognitive · Human · Emulator
          </div>
        </div>

        <div className="lp-cta-row">
          <button
            className="demo-btn"
            onClick={meetBrunel}
            data-testid="enter-brunel-btn"
          >
            <span>Meet BRUNEL</span>
            <ArrowRight size={14} />
          </button>
          <span className="lp-cta-note">Say something. It will remember.</span>
        </div>
      </section>

      {/* Body */}
      <section className="lp-body">
        <div className="lp-col">
          <div className="lp-col-kicker">// what it is</div>
          <p>
            Most AI resets the moment you leave. BRUNEL doesn&rsquo;t. Every
            conversation leaves a mark. Every exchange builds a history.
            Same starting point, different interactions, measurably different
            behaviour.
          </p>
        </div>
        <div className="lp-col">
          <div className="lp-col-kicker">// how it feels</div>
          <p>
            Not because it stores what you said &mdash; but because it lived through
            it. The ARCHE engine carries internal state across turns, so BRUNEL
            arrives at every reply already in a relationship with you.
          </p>
        </div>
        <div className="lp-col">
          <div className="lp-col-kicker">// why it matters</div>
          <p>
            Relational continuity is not a feature on top of a chatbot. It is an
            architectural decision made at the cognitive layer. The product
            runs. The continuity is real. You can feel it.
          </p>
        </div>
      </section>

      {/* Emergence in Three Acts */}
      <section className="emergence-section" data-testid="emergence-section">
        <div className="emergence-head">
          <div className="emergence-kicker">// case studies</div>
          <h2 className="emergence-title">Watch the Emergence in Three Acts</h2>
        </div>
        <div className="emergence-links">
          {EMERGENCE_ACTS.map((act) => (
            <a
              key={act.title}
              href={act.href}
              className="emergence-link"
              target="_blank"
              rel="noreferrer"
              data-testid={`emergence-${act.title.toLowerCase().replace(" ", "-")}`}
            >
              <div className="emergence-link-title">{act.title}</div>
              <div className="emergence-link-subtitle">{act.subtitle}</div>
              <ArrowRight size={12} className="emergence-link-arrow" />
            </a>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="lp-bottom">
        <div className="lp-bottom-inner">
          <div className="lp-bottom-copy">
            <div className="lp-bottom-kicker">Ready when you are.</div>
            <div className="lp-bottom-title">
              Say something real. See if it remembers.
            </div>
          </div>
          <button
            className="demo-btn demo-btn-lg"
            onClick={meetBrunel}
            data-testid="enter-brunel-btn-bottom"
          >
            <span>Meet BRUNEL</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <span>BRUNEL · An ArchePersona product · {new Date().getFullYear()}</span>
        <span className="lp-footer-tag">Powered by ARCHE</span>
      </footer>
    </div>
  );
}

export default Landing;
