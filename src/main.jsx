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

function LandingPage() {
  return (
    <main className="arche-page">
      <section className="page-shell" id="top">
        <header className="site-header" aria-label="ArchePersona company header">
          <a className="company-wordmark" href="#top">ArchePersona</a>
          <a href="/brunel/disclaimer" className="launch-link">Launch Brunel</a>
        </header>

        <section className="hero" aria-label="ARCHE hero">
          <div className="present-line">Proudly Presents</div>
          <h1 className="arche-title">ARCHE</h1>
          <div className="acronym-line">Adaptive Relational Cognitive Human Emulator</div>

          <div className="slogan-stack">
            <div className="slogan-primary">Artificial <span className="social">Social</span> Intelligence.</div>
            <div className="slogan-secondary">AI is horsepower. ARCHE is traction control.</div>
            <div className="slogan-tertiary">Built to last. Built to matter.</div>
            <div className="signature">Unforgettably. Yours.</div>
          </div>

          <a href="/brunel/disclaimer" className="primary-button">Launch Brunel</a>
        </section>

        <section className="bridge-section" aria-label="RKe persona infrastructure">
          <div className="bridge-wrap">
            <svg viewBox="0 0 1200 900" className="bridge-svg" role="img" aria-label="ARCHE bridge system">
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
                <path className="bridge-line" d="M120 96 H1080" />
                <path className="bridge-soft" d="M145 138 H1055" />
                <path className="bridge-line" d="M170 330 Q600 64 1030 330" />
                <path className="bridge-soft" d="M218 312 Q600 104 982 312" />
                <path className="bridge-soft" d="M276 288 Q600 144 924 288" />

                <g>
                  <path className="pillar-rail" d="M188 176 V850" stroke="url(#pillarFade)" />
                  <path className="pillar-rail" d="M246 176 V850" stroke="url(#pillarFade)" />
                  {Array.from({ length: 8 }).map((_, i) => {
                    const y = 244 + i * 70;
                    return <g key={`left-pillar-${i}`}><line className="pillar-faint" x1="188" y1={y} x2="246" y2={y + 32} /><line className="pillar-faint" x1="246" y1={y + 32} x2="188" y2={y + 64} /></g>;
                  })}
                </g>
                <g>
                  <path className="pillar-rail" d="M954 176 V850" stroke="url(#pillarFade)" />
                  <path className="pillar-rail" d="M1012 176 V850" stroke="url(#pillarFade)" />
                  {Array.from({ length: 8 }).map((_, i) => {
                    const y = 244 + i * 70;
                    return <g key={`right-pillar-${i}`}><line className="pillar-faint" x1="954" y1={y} x2="1012" y2={y + 32} /><line className="pillar-faint" x1="1012" y1={y + 32} x2="954" y2={y + 64} /></g>;
                  })}
                </g>
              </g>
            </svg>

            <section className="persona-section">
              <div className="persona-title">THE RKe PERSONA FAMILY</div>
              <div className="persona-subtitle">Runtime personalities built on the ARCHE engine</div>
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
