import './arche-home.css';
import heroImage from './images/file_000000004274720c9ccd5c5a01ca599a.png';
import logoImage from './images/file_00000000f5f0720c904985f294fd517d.png';

const BRUNEL_DISCLAIMER_URL = 'https://www.archepersona.online/brunel/disclaimer';
const CONTROL_TOWER_URL = 'https://control-tower-mobile.vercel.app/';

export default function ArcheHomepage() {
  return (
    <main className="ap-home" id="top">
      <section className="ap-hero" aria-label="ArchePersona hero">
        <img className="ap-hero-image" src={heroImage} alt="Chimera and tower at sunset" />
        <img className="ap-hero-logo" src={logoImage} alt="ArchePersona" />
        <a className="ap-zone ap-zone-left" href={BRUNEL_DISCLAIMER_URL} aria-label="Character" />
        <a className="ap-zone ap-zone-right" href={CONTROL_TOWER_URL} aria-label="Consequence" />
      </section>

      <section className="ap-statement" aria-label="ArchePersona statement">
        <div className="ap-statement-line">Behavioral infrastructure</div>
        <div className="ap-statement-for">for</div>
        <div className="ap-duality">
          <a href={BRUNEL_DISCLAIMER_URL}>CHARACTER</a>
          <span>&amp;</span>
          <a href={CONTROL_TOWER_URL}>CONSEQUENCE</a>
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
          <span className="ap-nav-separator" aria-hidden="true">|</span>
          <a href="/deck">INVESTOR DECK</a>
        </nav>

        <footer className="ap-footer">Powered by ARCHEngine</footer>
      </div>
    </main>
  );
}