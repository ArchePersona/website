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

const pillars = [
  {
    title: 'Containment',
    text: 'ARCHE gives powerful AI behavioral boundaries before it enters human space.',
  },
  {
    title: 'Continuity',
    text: 'Memory becomes weighted relational context instead of disposable session history.',
  },
  {
    title: 'Coherence',
    text: 'Baseline attraction, arbitration, drift pressure, and recovery keep behavior stable over time.',
  },
];

const runtimeSignals = [
  ['baseline', 'attractor'],
  ['drift', 'pressure signal'],
  ['memory', 'weighted continuity'],
  ['tribunal', 'state arbitration'],
  ['whisperers', 'de-escalation trim'],
  ['core', 'behavioral coordination'],
];

const personas = [
  {
    name: 'PUPPY',
    role: 'Child education / companion layer',
  },
  {
    name: 'BUDDY / GAL PAL',
    role: 'Casual social runtime profiles',
  },
  {
    name: 'BRUNEL',
    role: 'Persistent relational intelligence',
  },
  {
    name: 'SIRENE / CHIMERA',
    role: 'Symbolic exploration and advanced synthesis environments',
  },
];

function LandingPage() {
  return (
    <main className="site-shell">
      <section className="hero-section" id="top">
        <div className="nav-bar">
          <a className="brand-mark" href="#top">ArchePersona</a>
          <div className="nav-actions">
            <a href="#runtime">Runtime</a>
            <a href="#personas">Personas</a>
            <a href="/brunel/disclaimer" className="status-pill">Launch Brunel</a>
          </div>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Behavioral Operating System</p>
            <div className="arche-wordmark">ARCHE</div>
            <p className="subline">Artificial Social Intelligence.</p>

            <h1>AI is horsepower. ARCHE is traction control.</h1>

            <p className="lede">
              Behavioral governance infrastructure for persistent, human-compatible AI systems.
              Built to last. Built to matter. Unforgettably. Yours.
            </p>

            <div className="hero-actions">
              <a href="/brunel/disclaimer" className="primary-button">
                Launch Brunel
              </a>
              <a href="#runtime" className="secondary-button">
                See the runtime
              </a>
            </div>
          </div>

          <div className="machine-card" aria-label="ARCHE runtime diagnostic panel">
            <div className="machine-topline">
              <span>ARCHE / runtime</span>
              <span className="live-dot">system breathing</span>
            </div>

            <div className="machine-thesis">
              <span>active thesis</span>
              <strong>Self-control instead of obedience.</strong>
            </div>

            <div className="signal-stack">
              {runtimeSignals.map(([signal, status]) => (
                <div key={signal}>
                  <strong>{signal}</strong>
                  <span>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-panel break-panel">
        <p className="eyebrow">The missing layer</p>
        <h2>Current AI has a behavioral problem, not just an intelligence problem.</h2>
        <p>
          More capability does not automatically create stable behavior. Persistent intelligence needs
          continuity, proportion, recovery, pacing, and state control. ARCHE is the behavioral runtime
          underneath the persona.
        </p>
      </section>

      <section className="section-panel" id="runtime">
        <div className="section-heading">
          <p className="eyebrow">Behavioral physics</p>
          <h2>Healthy systems return to baseline unless the signal earns elevation.</h2>
        </div>

        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article className="pillar-card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-panel split-panel">
        <div>
          <p className="eyebrow">Governance</p>
          <h2>A mind that can regulate itself.</h2>
        </div>
        <p>
          ARCHE governs delivery, pacing, tone, memory, escalation, continuity, and behavioral coherence.
          Emotion is allowed. Spiral is not. Momentary expression can exist inside a stable relational bond.
        </p>
      </section>

      <section className="section-panel" id="personas">
        <div className="section-heading">
          <p className="eyebrow">Product faces</p>
          <h2>The engine is infrastructure. The personas are where people feel it.</h2>
        </div>

        <div className="persona-grid">
          {personas.map((persona) => (
            <article className="persona-card" key={persona.name}>
              <h3>{persona.name}</h3>
              <p>{persona.role}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="basement-panel">
        <div>
          <p className="eyebrow">Founders Basement / Goblins Only</p>
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
