import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ProposalPage from './ProposalPage.jsx'
import InternalErrorBoundary from './ErrorBoundary.jsx'

// No PinGate — like the contract signing page, this is reached only through
// the private link emailed to one customer.
createRoot(document.getElementById('root')).render(
    <StrictMode>
        <InternalErrorBoundary>
            <ProposalPage />
        </InternalErrorBoundary>
    </StrictMode>,
)
