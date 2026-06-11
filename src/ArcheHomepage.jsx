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

const pages = {
  about: {
    kicker: 'About',
    title: 'ArchePersona',
    lead: 'Behavioral infrastructure for character and consequence.',
    sections: [
      {
        heading: 'Who are we?',
        body: [
          'ArchePersona exists because behavior is an engineering problem.',
          'Intelligence alone does not create trust. Capability alone does not create identity.',
          'We believe the future of artificial beings will be shaped not only by what they can do, but by who they become and what they answer to.',
        ],
      },
      {
        heading: 'Why do we exist?',
        body: [
          'Modern artificial intelligence has made extraordinary progress in capability. Yet intelligence and behavior are not the same thing.',
          'The question of capability asks: What can it do?',
          'The question of behavior asks: Who is acting? And what are the consequences?',
        ],
      },
      {
        heading: 'What do we build?',
        body: [
          'Without character, there is nothing to love, and without consequence, character becomes fantasy.',
          'Without consequence, there is nothing to trust, and without character, consequence becomes machinery.',
          'We build both.',
        ],
      },
    ],
  },
  archengine: {
    kicker: 'ARCHEngine',
    title: 'Behavioral Runtime',
    lead: 'Adaptive Relational Cognitive Human Emulator.',
    sections: [
      {
        heading: 'Powered by ARCHEngine',
        body: [
          'ARCHEngine is the behavioral runtime behind everything we build.',
          'Its purpose is not merely to produce responses. Its purpose is to cultivate behavior.',
          'Experience creates meaning. Meaning shapes character. Character influences identity. Consequence governs action.',
        ],
      },
      {
        heading: 'Behavior before output',
        body: [
          'Most systems are designed around intelligence. ARCHEngine is designed around behavior.',
          'Intelligence determines what is possible. Character determines who is acting. Consequence determines what follows.',
        ],
      },
      {
        heading: 'The principle',
        body: [
          'Trustworthy artificial beings will not arise from intelligence alone.',
          'They will emerge from the union of character and consequence.',
          'Behavior is an engineering problem.',
        ],
      },
    ],
  },
  contact: {
    kicker: 'Contact',
    title: 'Start a Conversation',
    lead: 'Reach out to ArchePersona for questions, demos, or collaboration.',
    sections: [
      {
        heading: 'Email',
        body: [{ text: 'therollingwrenchnc@gmail.com', href: 'mailto:therollingwrenchnc@gmail.com' }],
      },
      {
        heading: 'GitHub',
        body: [{ text: 'ArchePersona', href: 'https://github.com/ArchePersona' }],
      },
      {
        heading: 'ArchePersona',
        body: [
          'Behavioral infrastructure for character and consequence.',
          'Powered by ARCHEngine.',
        ],
      },
    ],
  },
};

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
        <p>Without character, there is nothing to love, and without consequence, character becomes fantasy.</p>
        <p>Without consequence, there is nothing to trust, and without character, consequence becomes machinery.</p>
        <p>We build both.</p>
      </section>

      <div className="ap-bottom">
        <nav className="ap-nav" aria-label="ArchePersona navigation">
          <a href="/about">ABOUT</a>
          <span className="ap-nav-separator" aria-hidden="true">|</span>
          <a href="/archengine">ARCHEngine</a>
          <span className="ap-nav-separator" aria-hidden="true">|</span>
          <a href="/contact">CONTACT</a>
        </nav>

        <footer className="ap-footer">Powered by ARCHEngine</footer>
      </div>
    </main>
  );
}

function renderContentItem(item) {
  if (typeof item === 'string') return <p key={item}>{item}</p>;

  return (
    <p key={item.text}>
      <a className="ap-contact-link" href={item.href}>{item.text}</a>
    </p>
  );
}

function DestinationPage({ kicker, title, lead, copy, sections, items }) {
  return (
    <main className="ap-home ap-subpage">
      <a className="ap-back" href="/">ArchePersona</a>
      <section className="ap-panel">
        <div className="ap-kicker">{kicker}</div>
        <h1>{title}</h1>
        {(lead || copy) && <p className="ap-lead">{lead || copy}</p>}
        {sections && (
          <div className="ap-content-stack">
            {sections.map(({ heading, body }) => (
              <section className="ap-content-section" key={heading}>
                <h2>{heading}</h2>
                {body.map(renderContentItem)}
              </section>
            ))}
          </div>
        )}
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
    return <DestinationPage {...pages.archengine} />;
  }

  if (path === '/about') {
    return <DestinationPage {...pages.about} />;
  }

  if (path === '/contact') {
    return <DestinationPage {...pages.contact} />;
  }

  return <HomeView />;
}
