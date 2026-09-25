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

// onOpenContract(id) switches this view to another contract (the original,
// or one of its addenda). onAddAddendum(parent) starts the wizard for a new
// addendum to this contract. Both are optional — if a parent screen doesn't
// pass them, those buttons simply don't show.
export default function ContractDetailView({ contractId, onBack, onOpenContract, onAddAddendum }) {
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

    // "Link to original" panel — only for addenda that already went out
    // without being attached to their original contract.
    const [linkOpen, setLinkOpen] = useState(false)
    const [linkOptions, setLinkOptions] = useState([])
    const [linkOptionsStatus, setLinkOptionsStatus] = useState('idle') // idle | loading | ready | error
    const [linkChoice, setLinkChoice] = useState(null)
    const [linkStatus, setLinkStatus] = useState('idle') // idle | saving | error
    const [linkError, setLinkError] = useState('')

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
        // Moving between an original and its addenda reuses this screen,
        // so reset anything that was open on the previous contract.
        setSigningRole(null)
        setVoidConfirming(false)
        setLinkOpen(false)
        setLinkChoice(null)
        setLinkStatus('idle')
        setLinkError('')
    }, [contractId])

    function openLinkPanel() {
        setLinkOpen(true)
        setLinkChoice(null)
        setLinkStatus('idle')
        setLinkError('')
        setLinkOptionsStatus('loading')
        fetch(`/api/contracts?customerId=${encodeURIComponent(contract.customerId)}`)
            .then((res) => res.json())
            .then((data) => {
                // Same rules the API enforces: originals only, not voided, not this one.
                setLinkOptions(
                    (data.contracts || []).filter(
                        (c) => !c.isAddendum && c.status !== 'voided' && c._id !== contractId
                    )
                )
                setLinkOptionsStatus('ready')
            })
            .catch(() => setLinkOptionsStatus('error'))
    }

    async function handleLink(parentId) {
        setLinkStatus('saving')
        setLinkError('')
        try {
            const res = await fetch('/api/contracts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: contractId, action: 'link', parentId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed')
            setLinkStatus('idle')
            setLinkOpen(false)
            setLinkChoice(null)
            setToast(parentId ? 'Linked to original contract' : 'Link removed')
            load()
        } catch (err) {
            console.error(err)
            setLinkError(err.message && err.message !== 'Failed' ? err.message : '')
            setLinkStatus('error')
        }
    }

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

    const hasRealParent = !!contract.parentContractDocId
    const hasLinkedParent = !!contract.linkedParentContractDocId
    const addenda = contract.addenda || []
    // An addendum-template contract that hasn't been linked yet is still an
    // addendum, so it doesn't get its own "Add Addendum" button.
    const isOriginal = !hasRealParent && !hasLinkedParent && !contract.templateIsAddendum
    // Linking is only for contracts that already went out (drafts get
    // recreated from the original instead) and that aren't originals with
    // addenda of their own.
    const canLink = !hasRealParent && addenda.length === 0 && contract.status !== 'draft'
    // Addendum-template contracts (and ones already linked) get the full
    // button. Anything else gets a small text link, in case an addendum was
    // made from a regular template — without cluttering normal contracts.
    const linkIsPrimary = contract.templateIsAddendum || hasLinkedParent

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

                {(hasRealParent || hasLinkedParent) && (
                    <div className="bg-blue/20 border border-blue/40 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-white text-sm">
                                Addendum to{' '}
                                <span className="font-semibold">
                                    {hasRealParent ? contract.parentContractId : contract.linkedParentContractId}
                                </span>
                            </p>
                            {hasLinkedParent && (
                                <p className="text-white/40 text-xs mt-0.5">Linked after it was sent — the signed document itself wasn't changed.</p>
                            )}
                        </div>
                        {onOpenContract && (
                            <button
                                onClick={() => onOpenContract(hasRealParent ? contract.parentContractDocId : contract.linkedParentContractDocId)}
                                className="shrink-0 text-white text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors"
                            >
                                Open Original
                            </button>
                        )}
                    </div>
                )}

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

                        {isOriginal && (addenda.length > 0 || (onAddAddendum && contract.status !== 'voided')) && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
                                <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Addenda</p>
                                {addenda.length === 0 && <p className="text-white/40 text-sm mb-3">No addenda yet.</p>}
                                {addenda.length > 0 && (
                                    <div className="flex flex-col gap-2 mb-3">
                                        {addenda.map((a) => (
                                            <button
                                                key={a._id}
                                                onClick={() => onOpenContract && onOpenContract(a._id)}
                                                disabled={!onOpenContract}
                                                className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="text-white text-sm font-semibold">{a.contractId}</p>
                                                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_BADGE[a.status] || 'bg-white/10 text-white/60'}`}>
                                                        {a.status === 'partiallySigned' ? 'Partially Signed' : a.status}
                                                    </span>
                                                </div>
                                                {a.isLinkedOnly && <p className="text-white/40 text-xs mt-0.5">Linked after sending</p>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {onAddAddendum && contract.status !== 'voided' && (
                                    <button
                                        onClick={() =>
                                            onAddAddendum({
                                                _id: contract._id,
                                                customerId: contract.customerId,
                                                contractId: contract.contractId,
                                                propertyId: contract.propertyId,
                                                invoiceId: contract.invoiceId,
                                            })
                                        }
                                        className="w-full bg-blue hover:bg-blue-light text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                                    >
                                        + Add Addendum
                                    </button>
                                )}
                            </div>
                        )}

                        {canLink && !linkOpen && (
                            <div className="flex flex-col gap-2 mb-4">
                                {linkIsPrimary ? (
                                    <button
                                        onClick={openLinkPanel}
                                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                                    >
                                        {hasLinkedParent ? 'Change Linked Original' : 'Link to Original Contract'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={openLinkPanel}
                                        className="w-full text-white/40 hover:text-white/70 text-xs py-1 transition-colors"
                                    >
                                        Is this actually an addendum? Link it to its original
                                    </button>
                                )}
                                {hasLinkedParent && (
                                    <button
                                        onClick={() => handleLink(null)}
                                        disabled={linkStatus === 'saving'}
                                        className="w-full text-white/40 hover:text-white/70 text-xs py-1 transition-colors"
                                    >
                                        {linkStatus === 'saving' ? 'Removing...' : 'Remove Link'}
                                    </button>
                                )}
                                {linkStatus === 'error' && !linkOpen && (
                                    <p className="text-red-400 text-xs text-center">{linkError || 'Something went wrong — try again.'}</p>
                                )}
                            </div>
                        )}

                        {canLink && linkOpen && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
                                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Link to Original Contract</p>
                                <p className="text-white/50 text-xs mb-4">
                                    Files this under the original so they show together. The contract number, wording, and signatures stay exactly as they are, and the link is recorded in the audit trail.
                                </p>
                                {linkOptionsStatus === 'loading' && <p className="text-white/40 text-sm text-center py-4">Loading...</p>}
                                {linkOptionsStatus === 'error' && <p className="text-red-400 text-sm text-center py-4">Couldn't load this customer's contracts.</p>}
                                {linkOptionsStatus === 'ready' && linkOptions.length === 0 && (
                                    <p className="text-white/40 text-sm text-center py-4">No other original contracts for this customer.</p>
                                )}
                                {linkOptionsStatus === 'ready' && linkOptions.length > 0 && (
                                    <div className="flex flex-col gap-2 mb-4">
                                        {linkOptions.map((c) => (
                                            <button
                                                key={c._id}
                                                onClick={() => setLinkChoice(c)}
                                                className={`text-left px-4 py-3 rounded-xl text-sm transition-colors border ${linkChoice?._id === c._id
                                                    ? 'bg-blue text-white border-blue'
                                                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                <span className="font-semibold">{c.contractId}</span>
                                                <span className="text-xs opacity-70"> — {c.templateName}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {linkStatus === 'error' && <p className="text-red-400 text-xs text-center mb-2">{linkError || 'Something went wrong — try again.'}</p>}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleLink(linkChoice._id)}
                                        disabled={!linkChoice || linkStatus === 'saving'}
                                        className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                                    >
                                        {linkStatus === 'saving' ? 'Linking...' : linkChoice ? `Link to ${linkChoice.contractId}` : 'Pick a contract'}
                                    </button>
                                    <button
                                        onClick={() => setLinkOpen(false)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
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
