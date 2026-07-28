import { Link } from 'react-router-dom';
import './arche-home.css';
import './pre-alpha.css';

const ARCHEngine_URL = 'https://archengine.onrender.com/';

export default function PreAlphaPage() {
  return (
    <main className="ap-home ap-subpage prealpha-page">
      <Link className="ap-back" to="/">ArchePersona</Link>

      <section className="ap-panel prealpha-panel" aria-labelledby="prealpha-title">
        <div className="ap-kicker">Built in public</div>
        <div className="prealpha-badge">PRE-ALPHA</div>

        <h1 id="prealpha-title">BRUNEL</h1>
        <p className="ap-lead">
          An experimental persona running on ARCHEngine.
        </p>

        <div className="prealpha-copy">
          <p>The chat works.</p>
          <p>The full persona, rule, state, memory, and control systems do not.</p>
          <p>Different parts of the system are at different stages of development.</p>
          <p>What you are about to see is an early working surface, not a finished product.</p>
        </div>

        <div className="prealpha-status" aria-label="Current development status">
          <div><span>CHAT</span><strong>WORKING</strong></div>
          <div><span>PERSONA RULES</span><strong>IN PROGRESS</strong></div>
          <div><span>STATE SYSTEM</span><strong>PARTIAL</strong></div>
          <div><span>MEMORY</span><strong>LIMITED</strong></div>
          <div><span>CONTROL LAYER</span><strong>IN DEVELOPMENT</strong></div>
        </div>

        <p className="prealpha-warning">
          Expect rough edges, missing behaviors, incomplete safeguards, and frequent changes.
        </p>

        <a className="prealpha-enter" href={ARCHEngine_URL}>
          Enter the pre-alpha
        </a>
      </section>
    </main>
  );
}
