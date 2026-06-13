import './arche-home.css';

const pageContent = {
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
        heading: 'What do we build?',
        body: [
          'Without character, there is nothing to love, and without consequence, character becomes fantasy.',
          'Without consequence, there is nothing to trust, and without character, consequence becomes machinery.',
          'We build both.',
        ],
      },
      {
        heading: 'Founder',
        body: [
          'ArchePersona was founded by Darren Hall.',
          'ARCHEngine emerged from a simple conviction: Behavior is an engineering problem.',
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
          'ARCHEngine is the behavioral runtime behind everything ArchePersona builds.',
          'Its purpose is not merely to produce responses. Its purpose is to cultivate behavior.',
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
    ],
  },
};

function renderContentItem(item) {
  if (typeof item === 'string') return <p key={item}>{item}</p>;

  return (
    <p key={item.text}>
      <a className="ap-contact-link" href={item.href}>{item.text}</a>
    </p>
  );
}

export default function InfoPage({ page }) {
  const content = pageContent[page] || pageContent.about;

  return (
    <main className="ap-home ap-subpage">
      <a className="ap-back" href="/">ArchePersona</a>
      <section className="ap-panel">
        <div className="ap-kicker">{content.kicker}</div>
        <h1>{content.title}</h1>
        <p className="ap-lead">{content.lead}</p>
        <div className="ap-content-stack">
          {content.sections.map(({ heading, body }) => (
            <section className="ap-content-section" key={heading}>
              <h2>{heading}</h2>
              {body.map(renderContentItem)}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
