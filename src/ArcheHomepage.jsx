import './arche-home.css';
import heroImage from './images/file_00000000820471f5b7072848b02c50d8.png';

const destinationCards = [
  ['CREATIONS', 'Personalities and lives.', '/creations'],
  ['ABOUT', 'The company and mission.', '/about'],
  ['ARCHEngine', 'The behavioral runtime.', '/archengine'],
  ['CONTACT', 'Reach out.', '/contact'],
  ['OVERSIGHT', 'Authority and V-Hold.', '/oversight'],
];

const creations = [
  ['Brunel', 'The Builder', '/brunel/disclaimer', false],
  ['Psyrene', 'The Alluring Dance', 'https://github.com/ArchePersona/psyrene', false],
  ['GalBud', 'The Home Base', 'https://github.com/ArchePersona/galbud', false],
  ['CHIMERA', 'Character constructor', 'https://github.com/ArchePersona/chimera', false],
];

const oversight = [
  ['V-Hold', 'Always On Guard', 'https://github.com/ArchePersona/behold', false],
  ['Sentinel', 'Future Release', null, true],
  ['Watchman', 'Future Release', null, true],
  ['Steward', 'Future Release', null, true],
];

function HomeView() {
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

function DestinationPage({ kicker, title, copy, items }) {
  return (
    <main className="ap-home ap-subpage">
      <a className="ap-back" href="/">ArchePersona</a>
      <section className="ap-panel">
        <div className="ap-kicker">{kicker}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
        {items && (
          <div className="ap-product-grid">
            {items.map(([name, detail, href, future]) => {
              const content = <><span>{name}</span><small>{detail}</small></>;
              if (future) return <div className="ap-product future" key={name}>{content}</div>;
              return <a className="ap-product" href={href} key={name}>{content}</a>;
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default function ArcheHomepage() {
  const path = window.location.pathname;

  if (path === '/creations') {
    return <DestinationPage kicker="Creations" title="RK Persona Studios" copy="Character is who an agent is. These are the lives and personalities brought into the world." items={creations} />;
  }

  if (path === '/oversight') {
    return <DestinationPage kicker="Oversight" title="Centurion Oversight" copy="Consequence is what an agent answers to. V-Hold is the first public instrument of that work." items={oversight} />;
  }

  if (path === '/archengine') {
    return <DestinationPage kicker="ARCHEngine" title="Behavioral Runtime" copy="Powered by ARCHEngine, our proprietary behavioral runtime." />;
  }

  if (path === '/about') {
    return <DestinationPage kicker="About" title="ArchePersona" copy="Behavioral infrastructure for character and consequence." />;
  }

  if (path === '/contact') {
    return <DestinationPage kicker="Contact" title="Start a Conversation" copy="Reach out to ArchePersona for demos, questions, or collaboration." />;
  }

  return <HomeView />;
}
