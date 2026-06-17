import { Link } from 'react-router-dom';
import './arche-home.css';
import heroImage from './images/file_000000004274720c9ccd5c5a01ca599a.png';
import logoImage from './images/file_00000000f5f0720c904985f294fd517d.png';

export default function ArcheHomepage() {
  return (
    <main className="ap-home" id="top">
      <section className="ap-hero" aria-label="ArchePersona hero">
        <img className="ap-hero-image" src={heroImage} alt="Chimera and tower at sunset" />
        <img className="ap-hero-logo" src={logoImage} alt="ArchePersona" />
        <Link className="ap-zone ap-zone-left" to="/brunel/disclaimer" aria-label="Character" />
        <Link className="ap-zone ap-zone-right" to="/consequence" aria-label="Consequence" />
      </section>

      <section className="ap-statement" aria-label="ArchePersona statement">
        <div className="ap-statement-line">Behavioral infrastructure</div>
        <div className="ap-statement-for">for</div>
        <div className="ap-duality">
          <Link to="/brunel/disclaimer">CHARACTER</Link>
          <span>&amp;</span>
          <Link to="/consequence">CONSEQUENCE</Link>
        </div>
      </section>

      <section className="ap-doctrine" aria-label="ArchePersona doctrine">
        <p>Without character, there is nothing to love, and without consequence, character becomes fantasy.</p>
        <p>Without consequence, there is nothing to trust, and without character, consequence becomes machinery.</p>
        <p>We build both.</p>
      </section>

      <div className="ap-bottom">
        <nav className="ap-nav" aria-label="ArchePersona navigation">
          <Link to="/about">ABOUT</Link>
          <span className="ap-nav-separator" aria-hidden="true">|</span>
          <Link to="/archengine">ARCHEngine</Link>
          <span className="ap-nav-separator" aria-hidden="true">|</span>
          <Link to="/contact">CONTACT</Link>
          <span className="ap-nav-separator" aria-hidden="true">|</span>
          <Link to="/deck">INVESTOR DECK</Link>
        </nav>

        <footer className="ap-footer">Powered by ARCHEngine</footer>
      </div>
    </main>
  );
}
