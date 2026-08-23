import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import IntakeWizard from './IntakeWizard.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <IntakeWizard />
        </ErrorBoundary>
    </StrictMode>,
)