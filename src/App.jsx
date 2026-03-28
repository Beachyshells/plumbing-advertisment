import React from 'react';
import logoImage from './assets/water-tap.png';
import Button from './components/Button';
import EmergencyButton from './components/EmergencyButton';
import heroImage from './assets/hero-image.png';
import './App.css';

function App() {
  return (
    <div className="mobile-app">
      {/* THE MOUNTAIN BACKGROUND */}
      <div className='fixed-background' style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="bg-overlay"></div>
      </div>

      <header className="app-header">
        <div className="header-content">
          <img src={logoImage} alt="Logo" className="logo-img" />
          <div className="header-text">
            <h2>Adirondack Advanced</h2>
            <p>Water Systems</p>
          </div>
        </div>
        <button className="menu-btn" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="white">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
      </header>

      <section className="app-hero">
        <h1>Pure Adirondack Water</h1>
        <span className="hero-subtitle">Protected at the Source.</span>
        
        <div className="sentence-fader">
          <p className="fading-sentence">Imagine water as clear as a wilderness window...</p>
          <p className="fading-sentence">Feel the quiet confidence of your well pump...</p>
          <p className="fading-sentence">Every drop is as honest as the peaks against the sky.</p>
        </div>

        <div className="action-panel">
          
          <EmergencyButton />
          <p className="service-text">Owner-Operated • Serving the Adirondacks</p>
          
          <div className="split-buttons">
            <Button className="btn-outline">Text</Button>
            <Button className="btn-outline">Call</Button>
          </div>
        </div>
      </section>
{/* Add this after your <section className="app-hero"> */}
<section className="services-grid">
  <div className="service-card">
    <div className="service-icon">🚰</div>
    <h3>Well & Pump Service</h3>
    <p>Professional pump installation, well sanitization, and expert plumbing repairs to restore your water flow fast.</p>
  </div>

  <div className="service-card">
    <div className="service-icon">🔍</div>
    <h3>Camera Inspection</h3>
    <p>High-tech diagnostic imaging to find underground blockages or casing issues without digging up your yard.</p>
  </div>

  <div className="service-card">
    <div className="service-icon">💎</div>
    <h3>Water Filtration</h3>
    <p>Custom-built systems for sulfur, iron, and sediment. We proudly install <strong>[Insert Brand Name]</strong> for maximum reliability.</p>
  </div>

  <div className="service-card">
    <div className="service-icon">☀️</div>
    <h3>UV Light Systems</h3>
    <p>Advanced ultraviolet filtration to eliminate 99.9% of bacteria and viruses, ensuring your family's safety.</p>
  </div>
</section>
      <footer className="app-footer">
  <div className="footer-line"></div>
  
  <div className="footer-branding">
    <h3>Adirondack Advanced</h3>
    <p>Water Systems</p>
  </div>

  <div className="footer-info">
    <p>📍 Serving Lake Placid, Saranac Lake, Tupper Lake & Surrounding Peaks</p>
    <p>📞 Emergency Service Available 24/7</p>
  </div>

  <div className="footer-copyright">
    <p>© 2026 Adirondack Advanced Water Systems</p>
    <p>Owner-Operated • Fully Insured</p>
  </div>
</footer>
    </div>
  );
}

export default App;