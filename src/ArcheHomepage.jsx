import './arche-home.css';
import heroImage from './images/file_00000000820471f5b7072848b02c50d8.png';

const destinationCards = [
  ['CREATIONS', 'Personalities and lives.', '/creations'],
  ['ABOUT', 'The company and mission.', '/about'],
  ['ARCHEngine', 'The behavioral runtime.', '/archengine'],
  ['CONTACT', 'Reach out.', '/contact'],
  ['OVERSIGHT', 'Authority and V-Hold.', '/oversight'],
];

export default function ArcheHomepage() {
  return (
    <main className="ap-home" id="top">
      <section className="ap-hero" aria-label="ArchePersona hero">
        <img className="ap-hero-image" src={heroImage} alt="ArchePersona hero" />
        <a className="ap-zone ap-zone-left" href="/creations" aria-label="Open Creations" />
        <a className="ap-zone ap-zone-right" href="/oversight" aria-label="Open Oversight" />
      </section>

      <section className="ap-axis" aria-label="ArchePersona spine">
        <a href="/creations"><span>CHARACTER</span><small>Who are you?</small></a>
        <a href="/archengine"><span>ARCHEngine</span><small>The behavioral runtime.</small></a>
        <a href="/oversight"><span>CONSEQUENCE</span><small>Who do you answer to?</small></a>
      </section>

      <section className="ap-cards" aria-label="ArchePersona destinations">
        {destinationCards.map(([title, copy, href]) => (
          <a className="ap-card" href={href} key={title}>
            <span>{title}</span>
            <p>{copy}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
