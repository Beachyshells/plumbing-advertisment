import { useState, useEffect, useRef } from 'react'

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
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

export default function ContractSignPage() {
    const [contract, setContract] = useState(null)
    const [status, setStatus] = useState('loading') // loading | ready | not-found | error
    const [consentGiven, setConsentGiven] = useState(false)
    const [signerName, setSignerName] = useState('')
    const [signatureDataUrl, setSignatureDataUrl] = useState(null)
    const [signStatus, setSignStatus] = useState('idle') // idle | saving | done | error

    const contractDocId = new URLSearchParams(window.location.search).get('id')

    useEffect(() => {
        if (!contractDocId) {
            setStatus('not-found')
            return
        }
        fetch(`/api/contracts?id=${contractDocId}`)
            .then((res) => res.json())
            .then((data) => {
                if (!data.contract) {
                    setStatus('not-found')
                    return
                }
                setContract(data.contract)
                setStatus('ready')
                // Record that the customer actually opened this link.
                fetch('/api/contracts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: contractDocId, action: 'view' }),
                }).catch(() => { })
            })
            .catch(() => setStatus('error'))
    }, [contractDocId])

    async function handleSign() {
        if (!consentGiven || !signerName.trim() || !signatureDataUrl) return
        setSignStatus('saving')
        try {
            const res = await fetch('/api/contracts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: contractDocId,
                    action: 'sign',
                    consentGiven: true,
                    signerName: signerName.trim(),
                    signatureDataUrl,
                    signerRole: 'customer',
                }),
            })
            if (!res.ok) throw new Error('Failed')
            setSignStatus('done')
        } catch (err) {
            console.error(err)
            setSignStatus('error')
        }
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-navy flex items-center justify-center px-4">
                <p className="text-white/40 text-sm">Loading...</p>
            </div>
        )
    }

    if (status === 'not-found' || status === 'error') {
        return (
            <div className="min-h-screen bg-navy flex items-center justify-center px-4 text-center">
                <div>
                    <p className="text-white text-lg font-serif mb-2">Contract not found</p>
                    <p className="text-white/40 text-sm">This link may be incorrect — please contact Adirondack Advanced Water Solutions.</p>
                </div>
            </div>
        )
    }

    const alreadySigned = !!contract.signedAt
    const bothSigned = contract.status === 'signed'

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <div className="text-center mb-6">
                    <h1 className="font-serif text-2xl text-white">Adirondack Advanced Water Solutions</h1>
                    <p className="text-white/40 text-xs mt-1">Contract {contract.contractId}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Scope of Work</p>
                    <ul className="text-white text-sm mb-4 flex flex-col gap-1">
                        {(contract.scopeOfWork || []).map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Total Price</p>
                    <p className="text-white text-lg font-serif">{formatMoney(contract.totalPrice)}</p>
                    {contract.priceNotes && <p className="text-white/40 text-xs mt-2 italic">{contract.priceNotes}</p>}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Full Contract Text</p>
                    <p className="text-white/70 text-xs whitespace-pre-wrap leading-relaxed">{contract.termsText}</p>
                </div>

                {alreadySigned || signStatus === 'done' ? (
                    <div className="bg-white/5 border border-brand-green/40 rounded-2xl p-5 text-center">
                        <p className="text-brand-green text-lg font-semibold mb-1">✓ You've Signed This Contract</p>
                        <p className="text-white/50 text-sm">
                            {bothSigned
                                ? 'This contract is fully signed by both parties.'
                                : 'Adirondack Advanced Water Solutions will also sign to finalize this contract.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
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

                        <button
                            onClick={handleSign}
                            disabled={!consentGiven || !signerName.trim() || !signatureDataUrl || signStatus === 'saving'}
                            className="w-full bg-blue hover:bg-blue-light disabled:opacity-40 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            {signStatus === 'saving' ? 'Signing...' : 'I Agree and Sign'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}