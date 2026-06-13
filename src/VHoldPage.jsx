import './vhold-page.css';

const proofPoints = [
  ['Propose', 'Agents request action before execution.'],
  ['Review', 'Humans approve, reject, escalate, or delegate.'],
  ['Record', 'Every decision becomes proof and precedent.'],
  ['Command', 'Authority stays with people. Always.'],
];

export default function VHoldPage() {
  return (
    <main className="vh-page">
      <a className="vh-back" href="/">ArchePersona</a>

      <section className="vh-card" aria-labelledby="vhold-title">
        <div className="vh-kicker">Consequence</div>
        <h1 id="vhold-title">V-Hold</h1>
        <p className="vh-tagline">Behavioral oversight for autonomous agent actions.</p>

        <div className="vh-grid">
          {proofPoints.map(([title, body]) => (
            <article className="vh-point" key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>

        <p className="vh-rule">Because consequences are king.</p>
      </section>
    </main>
  );
}
