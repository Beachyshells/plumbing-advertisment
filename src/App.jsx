import React, { useState } from 'react'; // Add useState here
import logoImage from './assets/water-tap.png';
import Button from './components/Button';
import EmergencyButton from './components/EmergencyButton';
import heroImage from './assets/hero-image.png';
import './App.css';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="mobile-app">
      {/* --- 1. SIDE MENU DRAWER --- */}
      <nav className={`side-menu ${isMenuOpen ? 'open' : ''}`}>
        <button className="close-menu" onClick={toggleMenu}>✕</button>
        <div className="menu-links">
          <a href="#home" onClick={toggleMenu}>Home</a>
          <a href="#services" onClick={toggleMenu}>Services</a>
          <a href="#about" onClick={toggleMenu}>About Us</a>
          <a href="tel:5185555555" className="menu-cta">EMERGENCY CALL</a>
        </div>
      </nav>

      {/* --- 2. THE MOUNTAIN BACKGROUND --- */}
      <div className='fixed-background' style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="bg-overlay"></div>
      </div>

      {/* --- 3. HEADER (Now with Click Logic) --- */}
      <header className="app-header">
        <div className="header-content">
          <img src={logoImage} alt="Logo" className="logo-img" />
          <div className="header-text">
            <h2>Adirondack Advanced</h2>
            <p>Water Systems</p>
          </div>
        </div>
        {/* ADDED onClick HERE */}
        <button className="menu-btn" onClick={toggleMenu} aria-label="Menu">
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
  {/* SERVICE 1: WELL & PUMP */}
  <div className="service-card">
    <div className="service-header">
      <div className="service-icon">🚰</div>
      <h3>Well & Pump Specialist</h3>
    </div>
    <ul className="service-details">
      <li><strong>Emergency Pump Service:</strong> No water? We diagnose and replace failing pumps fast.</li>
      <li><strong>Pressure Tanks:</strong> Constant pressure solutions for consistent flow.</li>
      <li><strong>Well Sanitization:</strong> Professional treatments to eliminate bacteria and odors.</li>
    </ul>
  </div>

  {/* SERVICE 2: FILTRATION (The Proprietary Angle) */}
  <div className="service-card">
    <div className="service-header">
      <div className="service-icon">💎</div>
      <h3>Advanced Filtration</h3>
    </div>
    <ul className="service-details">
      <li><strong>Proprietary Systems:</strong> Custom-engineered filtration built specifically for the North Country's unique mineral profile.</li>
      <li><strong>UV Sterilization:</strong> Hospital-grade technology to eliminate 99.9% of waterborne pathogens.</li>
      <li><strong>Iron & Sulfur:</strong> Our signature solution for "rotten egg" smells and staining.</li>
    </ul>
  </div>

  {/* SERVICE 3: DRAINS & INSPECTION */}
  <div className="service-card">
    <div className="service-header">
      <div className="service-icon">🔍</div>
      <h3>Drains & Inspections</h3>
    </div>
    <ul className="service-details">
      <li><strong>Drain Cleaning:</strong> Professional snaking to clear stubborn clogs in sinks and main lines.</li>
      <li><strong>Camera Inspection:</strong> High-definition video to find pipe issues without the guesswork.</li>
      <li><strong>North Country Support:</strong> Full residential service for both mountain wells and city lines.</li>
    </ul>
  </div>
</section>

<footer className="app-footer">
  <div className="footer-line"></div>
  <div className="footer-branding">
    <h3>Adirondack Advanced</h3>
    <p>Water Systems</p>
  </div>
  <div className="footer-info">
    <p>📍 Serving Plattsburgh, Lake Placid, Saranac Lake & The High Peaks</p>
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