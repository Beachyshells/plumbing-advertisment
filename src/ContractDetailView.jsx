import { useState, useEffect, useRef } from 'react'
import Toast from './Toast.jsx'
import { generateContractPdf } from './contractPdf.js'

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

// A real colored pill for every status, not just plain text — voided in
// particular gets a strong red badge with strikethrough, so a canceled
// contract is unmistakable at a glance, not something you have to read
// carefully to notice.
const STATUS_BADGE = {
    draft: 'bg-white/10 text-white/60',
    sent: 'bg-accent/20 text-accent',
    viewed: 'bg-accent/20 text-accent',
    partiallySigned: 'bg-accent/20 text-accent',
    signed: 'bg-brand-green/20 text-brand-green',
    voided: 'bg-red-500/20 text-red-400 line-through',
}

function SignaturePad({ onChange }) {
    const canvasRef = useRef(null)
    const drawingRef = useRef(false)

    function getPos(e, canvas) {
        const rect = canvas.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function handlePointerDown(e) {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const { x, y } = getPos(e, canvas)
        drawingRef.current = true
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    function handlePointerMove(e) {
        if (!drawingRef.current) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const { x, y } = getPos(e, canvas)
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.strokeStyle = '#13355E'
        ctx.lineTo(x, y)
        ctx.stroke()
    }

    function handlePointerUp() {
        if (!drawingRef.current) return
        drawingRef.current = false
        onChange(canvasRef.current.toDataURL('image/png'))
    }

    function clear() {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        onChange(null)
    }

    return (
        <div>
            <canvas
                ref={canvasRef}
                width={500}
                height={180}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-full bg-white rounded-xl touch-none"
                style={{ height: '180px' }}
            />
            <button onClick={clear} className="text-white/40 hover:text-white/70 text-xs mt-2 transition-colors">
                Clear signature
            </button>
        </div>
    )
}

function SignatureCard({ label, signerName, signedAt, signerIp, signatureImageUrl, onSignClick }) {
    const isSigned = !!signedAt
    return (
        <div className={`bg-white/5 border rounded-2xl p-5 ${isSigned ? 'border-brand-green/40' : 'border-white/10'}`}>
            <p className={`text-sm font-semibold mb-1 ${isSigned ? 'text-brand-green' : 'text-white/40'}`}>
                {label}{isSigned ? ' — Signed' : ' — Not Yet Signed'}
            </p>
            {isSigned ? (
                <>
                    <p className="text-white text-sm">{signerName}</p>
                    <p className="text-white/40 text-xs mt-1">{signedAt}</p>
                    <p className="text-white/30 text-xs">IP: {signerIp}</p>
                    {signatureImageUrl && (
                        <img src={signatureImageUrl} alt="Signature" className="bg-white rounded-lg mt-3 p-2 h-20" />
                    )}
                </>
            ) : (
                <button
                    onClick={onSignClick}
                    className="w-full bg-blue hover:bg-blue-light text-white text-sm font-semibold py-3 rounded-xl transition-colors active:scale-[0.98] mt-2"
                >
                    Sign as {label}
                </button>
            )}
        </div>
    )
}

export default function ContractDetailView({ contractId, onBack }) {
    const [contract, setContract] = useState(null)
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [signingRole, setSigningRole] = useState(null) // null | 'customer' | 'company'
    const [consentGiven, setConsentGiven] = useState(false)
    const [signerName, setSignerName] = useState('')
    const [signatureDataUrl, setSignatureDataUrl] = useState(null)
    const [signStatus, setSignStatus] = useState('idle') // idle | saving | error
    const [toast, setToast] = useState(null)
    const [sendStatus, setSendStatus] = useState('idle') // idle | sending | error
    const [voidConfirming, setVoidConfirming] = useState(false)
    const [voidStatus, setVoidStatus] = useState('idle') // idle | saving | error
    function load() {
        setStatus('loading')
        fetch(`/api/contracts?id=${contractId}`)
            .then((res) => res.json())
            .then((data) => {
                if (!data.contract) throw new Error('Not found')
                setContract(data.contract)
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        load()
    }, [contractId])

    function startSigning(role) {
        setSigningRole(role)
        setConsentGiven(false)
        setSignerName('')
        setSignatureDataUrl(null)
        setSignStatus('idle')
    }

    async function handleSign() {
        if (!consentGiven || !signerName.trim() || !signatureDataUrl || !signingRole) return
        setSignStatus('saving')
        try {
            const res = await fetch('/api/contracts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: contractId,
                    action: 'sign',
                    consentGiven: true,
                    signerName: signerName.trim(),
                    signatureDataUrl,
                    signerRole: signingRole,
                }),
            })
            if (!res.ok) throw new Error('Failed')
            setSignStatus('idle')
            setSigningRole(null)
            setToast(signingRole === 'customer' ? 'Customer signature captured' : 'Company signature captured')
            load()
        } catch (err) {
            console.error(err)
            setSignStatus('error')
        }
    }

    async function handleSendToCustomer() {
        if (!contract.customerEmail) return
        setSendStatus('sending')
        try {
            const sendRes = await fetch('/api/send-contract-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: contract.customerEmail,
                    customerName,
                    contractDocId: contractId,
                    contractLabel: contract.contractId,
                }),
            })
            if (!sendRes.ok) throw new Error('Failed')

            await fetch('/api/contracts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: contractId, action: 'send' }),
            })

            setSendStatus('idle')
            setToast('Emailed to customer')
            load()
        } catch (err) {
            console.error(err)
            setSendStatus('error')
        }
    }

    async function handleVoid() {
        setVoidStatus('saving')
        try {
            const res = await fetch('/api/contracts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: contractId, action: 'void' }),
            })
            if (!res.ok) throw new Error('Failed')
            setVoidStatus('idle')
            setVoidConfirming(false)
            setToast('Contract voided')
            load()
        } catch (err) {
            console.error(err)
            setVoidStatus('error')
        }
    }

    if (status === 'loading') {
        return <div className="min-h-screen bg-navy px-4 py-10"><p className="text-white/40 text-sm text-center py-10">Loading...</p></div>
    }
    if (status === 'error' || !contract) {
        return <div className="min-h-screen bg-navy px-4 py-10"><p className="text-red-400 text-sm text-center py-10">Couldn't load this contract.</p></div>
    }

    const customerName = [contract.customerFirstName, contract.customerLastName].filter(Boolean).join(' ')
    const anySigned = contract.status === 'signed' || contract.status === 'partiallySigned'

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <Toast message={toast} onDone={() => setToast(null)} />
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Back
                </button>

                <div className="flex items-center justify-between mb-1">
                    <h1 className="font-serif text-2xl text-white">{contract.contractId}</h1>
                    <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${STATUS_BADGE[contract.status] || 'bg-white/10 text-white/60'}`}>
                        {contract.status === 'partiallySigned' ? 'Partially Signed' : contract.status}
                    </span>
                </div>
                <p className="text-white/40 text-xs mb-6">{contract.templateName} — {customerName}</p>

                {contract.status === 'voided' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-center">
                        <p className="text-red-400 text-sm font-semibold">This contract has been voided.</p>
                    </div>
                )}

                {!signingRole && contract.status !== 'signed' && contract.status !== 'voided' && (
                    contract.customerEmail ? (
                        <button
                            onClick={handleSendToCustomer}
                            disabled={sendStatus === 'sending'}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors mb-4"
                        >
                            {sendStatus === 'sending' ? 'Sending...' : `Email to ${contract.customerEmail} to Sign`}
                        </button>
                    ) : (
                        <p className="text-white/30 text-xs text-center mb-4">No email on file for this customer — can't send a signing link.</p>
                    )
                )}
                {sendStatus === 'error' && <p className="text-red-400 text-xs text-center mb-4">Couldn't send — try again.</p>}

                {!signingRole && (
                    <>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Scope of Work</p>
                            <ul className="text-white text-sm mb-4 flex flex-col gap-1">
                                {(contract.scopeOfWork || []).map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Total Price</p>
                            <p className="text-white text-lg font-serif">{formatMoney(contract.totalPrice)}</p>
                            {contract.priceNotes && <p className="text-white/40 text-xs mt-2 italic">{contract.priceNotes}</p>}
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Full Contract Text</p>
                            <p className="text-white/70 text-xs whitespace-pre-wrap leading-relaxed">{contract.termsText}</p>
                        </div>

                        <button
                            onClick={() => generateContractPdf(contract)}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl transition-colors mb-4"
                        >
                            {anySigned ? 'Print Contract (PDF)' : 'Print Blank Contract for Signature'}
                        </button>

                        {contract.status !== 'voided' && (
                            <div className="flex flex-col gap-3 mb-4">
                                <SignatureCard
                                    label="Customer"
                                    signerName={contract.signerName}
                                    signedAt={contract.signedAt}
                                    signerIp={contract.signerIp}
                                    signatureImageUrl={contract.signatureImageUrl}
                                    onSignClick={() => startSigning('customer')}
                                />
                                <SignatureCard
                                    label="Company Representative"
                                    signerName={contract.companySignerName}
                                    signedAt={contract.companySignedAt}
                                    signerIp={contract.companySignerIp}
                                    signatureImageUrl={contract.companySignatureImageUrl}
                                    onSignClick={() => startSigning('company')}
                                />
                            </div>
                        )}

                        {contract.status !== 'voided' && (
                            voidConfirming ? (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    <p className="text-white text-sm mb-3">Void this contract? This can't be undone.</p>
                                    {voidStatus === 'error' && <p className="text-red-400 text-xs mb-2">Something went wrong — try again.</p>}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleVoid}
                                            disabled={voidStatus === 'saving'}
                                            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                                        >
                                            {voidStatus === 'saving' ? 'Voiding...' : 'Yes, Void It'}
                                        </button>
                                        <button
                                            onClick={() => setVoidConfirming(false)}
                                            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setVoidConfirming(true)}
                                    className="w-full text-red-400/70 hover:text-red-400 text-xs py-2 transition-colors"
                                >
                                    Void This Contract
                                </button>
                            )
                        )}
                    </>
                )}

                {signingRole && (
                    <div className="flex flex-col gap-5">
                        <p className="text-white/40 text-xs uppercase tracking-widest">
                            Signing as {signingRole === 'customer' ? 'Customer' : 'Company Representative'}
                        </p>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <p className="text-white/70 text-xs whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{contract.termsText}</p>
                        </div>

                        <label className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                            <input
                                type="checkbox"
                                checked={consentGiven}
                                onChange={(e) => setConsentGiven(e.target.checked)}
                                className="mt-1"
                            />
                            <span className="text-white text-sm">
                                I agree to sign this document electronically and understand it has the same legal effect as a handwritten signature.
                            </span>
                        </label>

                        <div>
                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Type Your Full Name</label>
                            <input
                                type="text"
                                value={signerName}
                                onChange={(e) => setSignerName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                        </div>

                        <div>
                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Draw Your Signature</label>
                            <SignaturePad onChange={setSignatureDataUrl} />
                        </div>

                        {signStatus === 'error' && <p className="text-red-400 text-sm text-center">Something went wrong — try again.</p>}

                        <div className="flex gap-2">
                            <button
                                onClick={handleSign}
                                disabled={!consentGiven || !signerName.trim() || !signatureDataUrl || signStatus === 'saving'}
                                className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-40 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                {signStatus === 'saving' ? 'Signing...' : 'I Agree and Sign'}
                            </button>
                            <button
                                onClick={() => setSigningRole(null)}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
