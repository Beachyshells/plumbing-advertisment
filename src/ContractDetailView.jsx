import { useState, useEffect, useRef } from 'react'
import Toast from './Toast.jsx'
import { generateContractPdf } from './contractPdf.js'

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

const STATUS_COLORS = {
    draft: 'text-white/50',
    sent: 'text-accent',
    viewed: 'text-accent',
    signed: 'text-brand-green',
    voided: 'text-red-400',
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

export default function ContractDetailView({ contractId, onBack }) {
    const [contract, setContract] = useState(null)
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [signing, setSigning] = useState(false)
    const [consentGiven, setConsentGiven] = useState(false)
    const [signerName, setSignerName] = useState('')
    const [signatureDataUrl, setSignatureDataUrl] = useState(null)
    const [signStatus, setSignStatus] = useState('idle') // idle | saving | error
    const [toast, setToast] = useState(null)

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

    async function handleSign() {
        if (!consentGiven || !signerName.trim() || !signatureDataUrl) return
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
                }),
            })
            if (!res.ok) throw new Error('Failed')
            setSignStatus('idle')
            setSigning(false)
            setToast('Contract signed')
            load()
        } catch (err) {
            console.error(err)
            setSignStatus('error')
        }
    }

    if (status === 'loading') {
        return <div className="min-h-screen bg-navy px-4 py-10"><p className="text-white/40 text-sm text-center py-10">Loading...</p></div>
    }
    if (status === 'error' || !contract) {
        return <div className="min-h-screen bg-navy px-4 py-10"><p className="text-red-400 text-sm text-center py-10">Couldn't load this contract.</p></div>
    }

    const customerName = [contract.customerFirstName, contract.customerLastName].filter(Boolean).join(' ')

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <Toast message={toast} onDone={() => setToast(null)} />
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Back
                </button>

                <div className="flex items-center justify-between mb-1">
                    <h1 className="font-serif text-2xl text-white">{contract.contractId}</h1>
                    <span className={`text-sm font-semibold uppercase ${STATUS_COLORS[contract.status] || 'text-white/50'}`}>
                        {contract.status}
                    </span>
                </div>
                <p className="text-white/40 text-xs mb-6">{contract.templateName} — {customerName}</p>

                {!signing && (
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
                            {contract.status === 'signed' ? 'Print Contract (PDF)' : 'Print Blank Contract for Signature'}
                        </button>

                        {contract.status === 'signed' ? (
                            <div className="bg-white/5 border border-brand-green/40 rounded-2xl p-5">
                                <p className="text-brand-green text-sm font-semibold mb-1">Signed</p>
                                <p className="text-white text-sm">{contract.signerName}</p>
                                <p className="text-white/40 text-xs mt-1">{contract.signedAt}</p>
                                <p className="text-white/30 text-xs">IP: {contract.signerIp}</p>
                                {contract.signatureImageUrl && (
                                    <img src={contract.signatureImageUrl} alt="Signature" className="bg-white rounded-lg mt-3 p-2 h-20" />
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setSigning(true)}
                                className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Sign Now
                            </button>
                        )}
                    </>
                )}

                {signing && (
                    <div className="flex flex-col gap-5">
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
                                onClick={() => setSigning(false)}
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