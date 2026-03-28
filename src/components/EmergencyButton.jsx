import { DotLottiePlayer } from '@dotlottie/react-player';

 function EmergencyButton() {
  return (
    <button style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      padding: '12px 25px',
      background: 'linear-gradient(145deg, #001a33 0%, #000000 100%)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '20px',
      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
      cursor: 'pointer',
      margin: '0 auto', 
      width: '90%',
      
      maxWidth: '360px',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'scale(1.02)';
      e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.8)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'scale(1)';
      e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.6)';
    }}>
      {/* The Animated Icon */}
      <div style={{ width: '65px', height: '65px', flexShrink: 0 }}>
        <DotLottiePlayer
          src="https://lottie.host/deb7182e-0db2-44ba-801c-656e178124dd/Ms8bJjnxl4.lottie"
          background="transparent"
          speed={1.5}
          loop
          autoplay
        />
      </div>

      {/* The Text */}
      <div style={{ textAlign: 'left', color: 'white' }}>
  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ff453a', letterSpacing: '1px' }}>
    NO WATER?
  </div>
  <div style={{ fontSize: '1.3rem', fontWeight: '800', textTransform: 'uppercase' }}>
    Contact Us
  </div>
</div>
      <div style={{ 
      fontSize: '0.75rem', 
      fontWeight: '600',
      opacity: 0.9, /* Increased opacity for better legibility */
      letterSpacing: '1px',
      marginTop: '2px',
      color: 'white'
    }}>
      24/7 SUPPORT
    </div>
    </button>
  );
}

export default EmergencyButton;