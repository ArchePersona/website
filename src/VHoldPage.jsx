import { Link } from 'react-router-dom';
import './vhold-page.css';

const proofPoints = [
  ['See', 'Operators can see what agents are attempting before execution.'],
  ['Approve', 'Risky actions can be approved, blocked, or escalated.'],
  ['Record', 'Every decision becomes an audit trail and operating precedent.'],
  ['Control', 'Authority stays with people before actions reach the business.'],
];

export default function VHoldPage() {
  return (
    <main className="vh-page">
      <Link className="vh-back" to="/">ArchePersona</Link>

      <section className="vh-card" aria-labelledby="control-tower-title">
        <div className="vh-kicker">Consequence</div>
        <h1 id="control-tower-title">Control Tower</h1>
        <p className="vh-tagline">Trust-based autonomy for autonomous AI agents.</p>
        <p className="vh-subtagline">Powered by V-HOLD.</p>

        <a
          className="vh-demo-link"
          href="https://v-hold-1.onrender.com/dashboard"
          target="_blank"
          rel="noreferrer"
        >
          Open Control Tower Demo
        </a>

        <div className="vh-grid">
          {proofPoints.map(([title, body]) => (
            <article className="vh-point" key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>

        <p className="vh-rule">Control before consequence.</p>
      </section>
    </main>
  );
}
