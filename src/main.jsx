import React from 'react';
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

        <section className="basement-panel">
          <div>
            <p className="basement-kicker">Founders Basement / Goblins Only</p>
            <h2>A polished surface. A strange machine underneath.</h2>
            <p>
              ArchePersona is serious infrastructure with the hatch left slightly open. There is a real builder
              under this machine, and the machine remembers pressure.
            </p>
          </div>

          <div className="terminal-card" aria-label="Machine room terminal status">
            <span>/boot/RKe/status?/run</span>
            <strong>INITIALIZATION INCOMPLETE</strong>
            <span>RUNTIME UNSTABLE</span>
            <span>CURRENT API CREDITS: -$4.38</span>
            <span>PLEASE INSERT BITCOIN TO CONTINUE</span>
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
