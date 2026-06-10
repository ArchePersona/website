import './arche-home.css';
import heroImage from './images/file_000000004274720c9ccd5c5a01ca599a.png';
import logoImage from './images/file_00000000f5f0720c904985f294fd517d.png';

const creations = [
  ['Brunel', 'The Builder', '/brunel/disclaimer', false],
  ['Psyrene', 'The Alluring Dance', 'https://github.com/ArchePersona/psyrene', false],
  ['GalBud', 'The Home Base', 'https://github.com/ArchePersona/galbud', false],
  ['CHIMERA', 'Character constructor', 'https://github.com/ArchePersona/chimera', false],
];

const oversight = [
  ['V-Hold', 'Always On Guard', 'https://centurion-oversight.onrender.com', false],
  ['Sentinel', 'Future Release', null, true],
  ['Watchman', 'Future Release', null, true],
  ['Steward', 'Future Release', null, true],
];

function HomeView() {
  return (
    <main className="ap-home" id="top">
      <section className="ap-hero" aria-label="ArchePersona hero">
        <img className="ap-hero-image" src={heroImage} alt="Chimera and tower at sunset" />
        <img className="ap-hero-logo" src={logoImage} alt="ArchePersona" />
        <a className="ap-zone ap-zone-left" href="/brunel/disclaimer" aria-label="Character" />
        <a className="ap-zone ap-zone-right" href="/oversight" aria-label="Consequence" />
      </section>

      <section className="ap-statement" aria-label="ArchePersona statement">
        <div className="ap-statement-line">Behavioral infrastructure</div>
        <div className="ap-statement-for">for</div>
        <div className="ap-duality">
          <a href="/brunel/disclaimer">CHARACTER</a>
          <span>&amp;</span>
          <a href="/oversight">CONSEQUENCE</a>
        </div>
      </section>

      <section className="ap-doctrine" aria-label="ArchePersona doctrine">
        <p>Without character, there is nothing to love.</p>
        <p>Without consequence, there is nothing to trust.</p>
        <p>ArchePersona builds both.</p>
      </section>

      <nav className="ap-nav" aria-label="ArchePersona navigation">
        <a href="/about">ABOUT</a>
        <a href="/archengine">ARCHEngine</a>
        <a href="/contact">CONTACT</a>
      </nav>

      <footer className="ap-footer">Powered by ARCHEngine.</footer>
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
