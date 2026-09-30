import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Employee from './Employee.jsx'
import InternalErrorBoundary from './ErrorBoundary.jsx'
import { installApiAuth } from './apiAuth.js'

// Adds the employee's login token to every /api call on this page.
installApiAuth('employee')

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <InternalErrorBoundary>
            <Employee />
        </InternalErrorBoundary>
    </StrictMode>,
)