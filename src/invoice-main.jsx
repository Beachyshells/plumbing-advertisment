import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import IntakeWizard from './IntakeWizard.jsx'
import PinGate from './PinGate.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <PinGate>
                <IntakeWizard />
            </PinGate>
        </ErrorBoundary>
    </StrictMode>,
)