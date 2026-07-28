import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import './styles.css';
import ArcheHomepage from './ArcheHomepage.jsx';
import InfoPage from './InfoPage.jsx';
import VHoldPage from './VHoldPage.jsx';
import PreAlphaPage from './PreAlphaPage.jsx';

const INVESTOR_DECK_URL = 'https://control-tower-lru30ht.gamma.site/';

function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ArcheHomepage />} />
        <Route path="/deck" element={<ExternalRedirect to={INVESTOR_DECK_URL} />} />
        <Route path="/creations" element={<PreAlphaPage />} />
        <Route path="/consequence" element={<ExternalRedirect to="https://control-tower-mobile.vercel.app/" />} />
        <Route path="/oversight" element={<Navigate to="/consequence" replace />} />
        <Route path="/archengine" element={<InfoPage page="archengine" />} />
        <Route path="/about" element={<InfoPage page="about" />} />
        <Route path="/contact" element={<InfoPage page="contact" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
