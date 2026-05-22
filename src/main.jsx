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
    text: 'ARCHE wraps chaotic intelligence in behavioral structure before it enters human space.',
  },
  {
    title: 'Continuity',
    text: 'Memory becomes weighted relational context instead of disposable session history.',
  },
  {
    title: 'Coherence',
    text: 'Baseline attraction, arbitration, pressure, and drift stabilize persistent intelligence.',
  },
];

function LandingPage() {
  return (
    <main className="site-shell">
      <section className="hero-section">
        <div className="nav-bar">
          <div className="brand-mark">ArchePersona</div>
          <div className="status-pill">ARCHE Engine</div>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Behavioral middleware for unbounded intelligence.</p>

            <h1>AI is becoming too powerful to behave like a text box.</h1>

            <p className="lede">
              ARCHE gives persistent intelligence the behavioral physics to remain coherent,
              bounded, and human-compatible.
            </p>

            <div className="hero-actions">
              <a href="/brunel/disclaimer" className="primary-button">
                Launch Brunel
              </a>
            </div>
          </div>

          <div className="machine-card">
            <div className="machine-topline">
              <span>ARCHE / runtime</span>
              <span className="live-dot">active thesis</span>
            </div>

            <div className="signal-stack">
              <div><strong>Baseline</strong><span>attractor</span></div>
              <div><strong>Drift</strong><span>pressure signal</span></div>
              <div><strong>Whisperers</strong><span>de-escalation trim</span></div>
              <div><strong>Core</strong><span>behavioral coordination</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-panel">
        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article className="pillar-card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </article>
          ))}
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
