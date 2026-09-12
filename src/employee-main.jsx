import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Employee from './Employee.jsx'
import InternalErrorBoundary from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <InternalErrorBoundary>
            <Employee />
        </InternalErrorBoundary>
    </StrictMode>,
)