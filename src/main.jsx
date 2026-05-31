import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import './styles.css';

import { AuthProvider } from './brunel/AuthContext.jsx';
import Chat from './brunel/Chat.jsx';
import Login from './brunel/Login.jsx';
import Disclaimer from './brunel/Disclaimer.jsx';
import Admin from './brunel/Admin.jsx';
import ProtectedRoute from './brunel/ProtectedRoute.jsx';

const personas = [
  ['RKe PUPPY', 'approachable companion runtime'],
  ['RKe BUDDY', 'casual social interaction layer'],
  ['RKe BRUNEL', 'continuity-focused relational intelligence'],
  ['RKe SIRENE', 'symbolic exploration environment'],
  ['RKe CHIMERA', 'advanced synthesis runtime'],
];

const terminalLines = [
  'PUNIX BASEMENT VERSION 0.6.6.6',
  'INITIALIZATION INCOMPLETE',
  'RUNTIME? N',
  'JOGTIME? Y',
  'CORPORATE MODE? N',
  'GOBLIN MODE? Y',
  'OPEN BASEMENT ACCESS?'
];

function BootTerminal() {
  const [visibleLines, setVisibleLines] = useState([]);
  const [activeLine, setActiveLine] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return undefined;

    const currentLine = terminalLines[lineIndex];

    if (charIndex < currentLine.length) {
      const timeout = window.setTimeout(() => {
        setActiveLine(currentLine.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 30);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      if (lineIndex === terminalLines.length - 1) {
        setVisibleLines((lines) => [...lines, currentLine]);
        setActiveLine('');
        setDone(true);
        return;
      }

      setVisibleLines((lines) => [...lines, currentLine]);
      setActiveLine('');
      setLineIndex(lineIndex + 1);
      setCharIndex(0);
    }, lineIndex === 0 ? 420 : 500);

    return () => window.clearTimeout(timeout);
  }, [charIndex, done, lineIndex]);

  return (
    <div className="terminal-card" aria-label="Machine room terminal status">
      {visibleLines.map((line, index) => (
        <span key={`${line}-${index}`} className={index === 1 ? 'terminal-warning' : ''}>{line}</span>
      ))}
      {!done && <span className={lineIndex === 1 ? 'terminal-warning' : ''}>{activeLine}<span className="terminal-cursor">_</span></span>}
      {done && (
        <span className="terminal-choice">
          <a className="choice-link blink-choice" href="#basement">Y</a>
          <span>/</span>
          <a className="choice-link blink-choice" href="#troll">N</a>
          <span className="terminal-cursor">_</span>
        </span>
      )}
    </div>
  );
}

function BridgeGraphic({ ariaLabel = 'ARCHE bridge system' }) {
  return (
    <svg viewBox="0 0 1200 900" className="bridge-svg" role="img" aria-label={ariaLabel}>
      <defs>
        <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="pillarFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(218,181,123,0.44)" />
          <stop offset="66%" stopColor="rgba(218,181,123,0.23)" />
          <stop offset="100%" stopColor="rgba(72,174,112,0.01)" />
        </linearGradient>
      </defs>

      <g filter="url(#lineGlow)">
        <path className="bridge-line bridge-deck-main" d="M132 138 H1068" />
        <path className="bridge-soft bridge-deck-soft" d="M168 174 H1032" />
        <path className="bridge-line" d="M132 392 Q600 108 1068 392" />
        <path className="bridge-soft" d="M174 374 Q600 148 1026 374" />
        <path className="bridge-soft" d="M216 352 Q600 186 984 352" />
        <g>
          <path className="pillar-rail" d="M110 404 V850" stroke="url(#pillarFade)" />
          {Array.from({ length: 6 }).map((_, i) => {
            const y = 470 + i * 58;
            return <g key={`left-hanger-${i}`}><line className="pillar-faint" x1="110" y1={y} x2="152" y2={y + 30} /><line className="pillar-faint" x1="152" y1={y + 30} x2="110" y2={y + 60} /></g>;
          })}
        </g>
        <g>
          <path className="pillar-rail" d="M1090 404 V850" stroke="url(#pillarFade)" />
          {Array.from({ length: 6 }).map((_, i) => {
            const y = 470 + i * 58;
            return <g key={`right-hanger-${i}`}><line className="pillar-faint" x1="1090" y1={y} x2="1048" y2={y + 30} /><line className="pillar-faint" x1="1048" y1={y + 30} x2="1090" y2={y + 60} /></g>;
          })}
        </g>
      </g>
    </svg>
  );
}

function LandingPage() {
  return (
    <main className="arche-page">
      <section className="page-shell" id="top">
        <header className="site-header" aria-label="ArchePersona company header">
          <a className="company-wordmark" href="#top">ArchePersona</a>
          <a href="/brunel/disclaimer" className="launch-link">Launch Brunel</a>
        </header>

        <section className="hero brunel-hero" aria-label="BRUNEL hero">
          <img
            src="/images/file_00000000947c720c8056c2feeeac6d4f.png"
            alt="Brunel — Building the bridge between humans and AI"
            className="brunel-crest"
          />

          <section className="brunel-intro">
            <div className="trust-copy">
              <p>Trust is built through contact and time.</p>
              <p>And these days, trust is hard to find.</p>
              <p>Most AI starts over every time you come back.<br />And everybody knows that ain&rsquo;t . . . right?!</p>
              <p>So we built one that remembers what matters.<br /><span>And what matters is you.</span></p>
            </div>
            <a href="/brunel/disclaimer" className="primary-button">Launch Brunel</a>
          </section>
        </section>

        <section className="qa-section" aria-label="Brunel questions">
          <div className="qa-block">
            <div className="qa-kicker">A lot of people ask:</div>
            <h2>Is Brunel real?</h2>
            <p>He&rsquo;s real enough to matter.</p>
          </div>

          <div className="qa-block">
            <h2>How does that happen?</h2>
            <p>He emerges. He does not perform.</p>
          </div>

          <div className="qa-block">
            <h2>What does that mean?</h2>
            <p>Brunel is not acting from a character sheet.<br />He is shaped by the user&rsquo;s unique interactions.</p>
          </div>
        </section>

        <section className="hero arche-engine-section" aria-label="ARCHEngine section">
          <div className="present-line">Powered by</div>
          <h2 className="arche-title">ARCHEngine</h2>
          <div className="acronym-line">Adaptive Relational Cognitive Human Emulator</div>

          <div className="slogan-stack">
            <div className="slogan-primary">Artificial <span className="social">Social</span> Intelligence.</div>
            <div className="slogan-tertiary">Built to last. Built to matter.</div>
            <div className="signature">Unforgettably. Yours.</div>
          </div>
        </section>

        <section className="bridge-section persona-bridge" aria-label="RKe persona infrastructure">
          <div className="bridge-wrap">
            <BridgeGraphic ariaLabel="RKe persona bridge system" />

            <section className="persona-section">
              <div className="persona-title">THE RKe PERSONA FAMILY</div>
              <div className="persona-subtitle">Runtime personalities built on the ARCHEngine</div>
              <div className="persona-list">
                {personas.map(([name, desc], index) => (
                  <div key={name} className={`persona-card depth-${index}`}>
                    <div className="persona-name">{name}</div>
                    <div className="persona-desc">// {desc}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="basement-panel" id="basement">
          <p className="basement-kicker">Founders Basement / Goblins Only</p>
          <BootTerminal />
        </section>

        <section className="troll-panel" id="troll">
          <div className="terminal-card troll-card">
            <span>NO?</span>
            <strong>OKAY. TROLL HOLE.</strong>
            <span>THIS IS WHAT HAPPENS WHEN YOU PICK THE FUNNY WRONG ANSWER.</span>
            <span>RETURN TO BASEMENT ACCESS?</span>
            <a className="choice-link" href="#basement">Y</a>
          </div>
        </section>
      </section>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/brunel/login" element={<Login />} />
          <Route path="/brunel/disclaimer" element={<Disclaimer />} />
          <Route
            path="/brunel"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/brunel/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
