import { Component } from 'react'

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        // Check if we already tried reloading once (stored in the URL)
        const alreadyReloaded = new URLSearchParams(window.location.search).has('recovered')
        this.state = { hasError: false, alreadyReloaded }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, info) {
        console.error('App crashed:', error, info)
    }

    handleReload = () => {
        const url = new URL(window.location.href)
        url.searchParams.set('recovered', '1')
        window.location.href = url.toString()
    }

    render() {
        if (!this.state.hasError) return this.props.children

        return (
            <div style={{
                minHeight: '100vh',
                background: '#0a1628',
                color: '#e0e7f1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '24px',
                fontFamily: 'system-ui, sans-serif',
            }}>
                <div style={{ maxWidth: '440px' }}>
                    <h1 style={{
                        fontFamily: "'DM Serif Display', Georgia, serif",
                        fontSize: '32px',
                        fontWeight: 400,
                        color: '#fff',
                        marginBottom: '4px',
                    }}>
                        Adirondack Advanced
                    </h1>
                    <p style={{
                        fontSize: '12px',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#6daee0',
                        marginBottom: '32px',
                    }}>
                        Water Solutions
                    </p>

                    {this.state.alreadyReloaded ? (
                        <>
                            <p style={{ fontSize: '16px', color: 'rgba(224,231,241,0.8)', marginBottom: '8px' }}>
                                Something's still not working.
                            </p>
                            <p style={{ fontSize: '14px', color: 'rgba(224,231,241,0.55)', marginBottom: '28px', lineHeight: 1.6 }}>
                                Sorry about that. Please give us a call and we'll take care of you directly.
                            </p>
                            <a href="tel:+15185349949" style={{
                                display: 'inline-block',
                                background: '#176cc8',
                                color: '#fff',
                                padding: '14px 28px',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: 600,
                                textDecoration: 'none',
                            }}>
                                Call (518) 534-9949
                            </a>
                        </>
                    ) : (
                        <>
                            <p style={{ fontSize: '16px', color: 'rgba(224,231,241,0.8)', marginBottom: '8px' }}>
                                Something went wrong.
                            </p>
                            <p style={{ fontSize: '14px', color: 'rgba(224,231,241,0.55)', marginBottom: '28px', lineHeight: 1.6 }}>
                                Let's try reloading the page.
                            </p>
                            <button onClick={this.handleReload} style={{
                                background: '#176cc8',
                                color: '#fff',
                                padding: '14px 28px',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                marginBottom: '16px',
                            }}>
                                Reload page
                            </button>
                            <p style={{ fontSize: '13px', color: 'rgba(224,231,241,0.45)' }}>
                                Or call us anytime at{' '}
                                <a href="tel:+15185349949" style={{ color: '#6daee0', textDecoration: 'none' }}>
                                    (518) 534-9949
                                </a>
                            </p>
                        </>
                    )}
                </div>
            </div>
        )
    }
}