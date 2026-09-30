import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Desktop from './Desktop.jsx'
import PinGate from './PinGate.jsx'
import InternalErrorBoundary from './ErrorBoundary.jsx'
import { installApiAuth } from './apiAuth.js'

// Adds the login token to every /api call on this page.
installApiAuth('admin')

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <InternalErrorBoundary>
            <PinGate>
                <Desktop />
            </PinGate>
        </InternalErrorBoundary>
    </StrictMode>,
)