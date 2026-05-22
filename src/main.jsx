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

function LandingPage() {
  return (
    <main className="site-shell">
      <section className="hero-section" id="top">
        <div className="nav-bar">
          <a className="brand-mark" href="#top">ArchePersona</a>
          <a href="/brunel/disclaimer" className="status-pill">Launch Brunel</a>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Behavioral Operating System</p>
            <div className="arche-wordmark">ARCHE</div>
            <p className="subline">Artificial Social Intelligence.</p>

            <h1>AI is horsepower. ARCHE is traction control.</h1>

            <p className="lede">
              Behavioral governance infrastructure for persistent, human-compatible AI systems.
            </p>

            <p className="signature">
              Built to last. Built to matter. Unforgettably. Yours.
            </p>

            <div className="hero-actions">
              <a href="/brunel/disclaimer" className="primary-button">
                Launch Brunel
              </a>
            </div>
          </div>

          <div className="machine-card" aria-label="ARCHE positioning panel">
            <div className="machine-topline">
              <span>ARCHE / runtime</span>
              <span className="live-dot">online</span>
            </div>

            <div className="signal-stack">
              <div><strong>AI</strong><span>horsepower</span></div>
              <div><strong>ARCHE</strong><span>traction control</span></div>
              <div><strong>BRUNEL</strong><span>live proof</span></div>
            </div>
          </div>
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
