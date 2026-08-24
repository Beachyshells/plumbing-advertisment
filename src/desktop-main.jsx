import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Desktop from './Desktop.jsx'
import PinGate from './PinGate.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <PinGate>
                <Desktop />
            </PinGate>
        </ErrorBoundary>
    </StrictMode>,
)