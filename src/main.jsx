import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import './styles.css';
import ArcheHomepage from './ArcheHomepage.jsx';
import InfoPage from './InfoPage.jsx';
import VHoldPage from './VHoldPage.jsx';

import { AuthProvider } from './brunel/AuthContext.jsx';
import Chat from './brunel/Chat.jsx';
import Login from './brunel/Login.jsx';
import Disclaimer from './brunel/Disclaimer.jsx';
import Admin from './brunel/Admin.jsx';
import ProtectedRoute from './brunel/ProtectedRoute.jsx';

const INVESTOR_DECK_URL = 'https://archepersona.github.io/pitch-deck/downloads/AI-Agents-Control-Tower-compressed.pdf';

function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<ArcheHomepage />} />
          <Route path="/deck" element={<ExternalRedirect to={INVESTOR_DECK_URL} />} />
          <Route path="/creations" element={<Navigate to="/brunel/disclaimer" replace />} />
          <Route path="/consequence" element={<ExternalRedirect to="https://control-tower-mobile.vercel.app/" />} />
          <Route path="/oversight" element={<Navigate to="/consequence" replace />} />
          <Route path="/archengine" element={<InfoPage page="archengine" />} />
          <Route path="/about" element={<InfoPage page="about" />} />
          <Route path="/contact" element={<InfoPage page="contact" />} />
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