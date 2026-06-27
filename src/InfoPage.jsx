import { useState } from 'react';
import { Link } from 'react-router-dom';
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
    title: 'Human-Emulative AI',
    lead: 'Adaptive Relational Cognitive Human Emulator.',
    sections: [
      {
        heading: 'Part A — The Vision',
        body: [
          'Why ARCHE matters before every product built on it.',
          { text: 'Open Part A', href: 'https://arche-engine-zx5ccum.gamma.site/' },
        ],
      },
      {
        heading: 'Part B — The Platform',
        body: [
          'How the ARCHE vision becomes a company, a platform, and a product ecosystem.',
          { text: 'Open Part B', href: 'https://gamma.app/docs/The-Vision-Becomes-a-Platform-xxlddt3yxd1mwwc' },
        ],
      },
      {
        heading: 'The principle',
        body: [
          'ARCHE is not a chatbot. Not a wrapper. Not a trust layer branded as a product.',
          'ARCHE is the engine: the human emulator and infrastructure beneath persistent intelligence.',
        ],
      },
    ],
  },
  contact: {
    kicker: 'Contact',
    title: 'Start a Conversation',
    lead: 'Use the form below for questions, demos, or collaboration.',
    sections: [
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

function ContactForm() {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('sending');
    setMessage('');

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Message failed');
      }

      form.reset();
      setStatus('sent');
      setMessage('Message sent. Thank you.');
    } catch (error) {
      setStatus('error');
      setMessage('Message could not be sent. Please try again later.');
    }
  }

  return (
    <section className="ap-content-section" aria-label="Contact form">
      <h2>Message</h2>
      <form className="ap-contact-form" onSubmit={handleSubmit}>
        <input type="text" name="company" tabIndex="-1" autoComplete="off" aria-hidden="true" className="ap-honeypot" />

        <label>
          <span>Name</span>
          <input name="name" type="text" autoComplete="name" required />
        </label>

        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label>
          <span>Message</span>
          <textarea name="message" rows="5" required />
        </label>

        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending...' : 'Send Message'}
        </button>

        {message && <p className="ap-form-status">{message}</p>}
      </form>
    </section>
  );
}

export default function InfoPage({ page }) {
  const content = pageContent[page] || pageContent.about;

  return (
    <main className="ap-home ap-subpage">
      <Link className="ap-back" to="/">ArchePersona</Link>
      <section className="ap-panel">
        <div className="ap-kicker">{content.kicker}</div>
        <h1>{content.title}</h1>
        <p className="ap-lead">{content.lead}</p>
        <div className="ap-content-stack">
          {page === 'contact' && <ContactForm />}
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
