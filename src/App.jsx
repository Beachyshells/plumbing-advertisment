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

      
    </div>
  );
}

export default App;