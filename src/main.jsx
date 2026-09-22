import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ContractSignPage from './ContractSignPage.jsx'
import InternalErrorBoundary from './ErrorBoundary.jsx'

// Deliberately no PinGate here — this page is reached only via a private,
// unguessable link sent to a specific customer, not typed access like the
// rest of the app. The link itself (the contract's document ID) is what
// controls access.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InternalErrorBoundary>
      <ContractSignPage />
    </InternalErrorBoundary>
  </StrictMode>,
)