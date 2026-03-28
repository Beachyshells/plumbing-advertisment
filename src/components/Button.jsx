function Button({ children, className }) {
  return (
    <button 
      className={className} 
      style={{
        padding: '12px 24px',
        background: 'rgba(255, 255, 255, 0.15)', // Opaque Glass
        backdropFilter: 'blur(10px)',            // Frost Effect
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        color: 'white',
        fontWeight: '600',
        cursor: 'pointer',
        flex: 1
      }}
    >
      {children}
    </button>
  );
}

export default Button;