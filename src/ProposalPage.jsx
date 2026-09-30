import { useState, useEffect } from 'react'

// The customer's proposal page — reached from the link in the proposal
// email. Shows the work, the items (by name and quantity, one total), and
// lets them accept or decline.

function formatMoney(amount) {
    return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '')
    if (!match) return ''
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`
}

function formatAddress(address) {
    if (!address) return ''
    const cityStateZip = [[address.city, address.state].filter(Boolean).join(', '), address.zip].filter(Boolean).join(' ')
    return [address.street, cityStateZip].filter(Boolean).join(', ')
}

export default function ProposalPage() {
    const id = new URLSearchParams(window.location.search).get('id')
    const [proposal, setProposal] = useState(null)
    const [status, setStatus] = useState(id ? 'loading' : 'not-found') // loading | ready | not-found | error

    const [mode, setMode] = useState('choose') // choose | accept | decline | done
    const [name, setName] = useState('')
    const [agreed, setAgreed] = useState(false)
    const [reason, setReason] = useState('')
    const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | error
    const [saveError, setSaveError] = useState('')
    const [result, setResult] = useState(null) // 'accepted' | 'declined'

    useEffect(() => {
        if (!id) return
        fetch(`/api/proposals?id=${encodeURIComponent(id)}&public=true`)
            .then((res) => {
                if (res.status === 404) throw new Error('not-found')
                if (!res.ok) throw new Error('error')
                return res.json()
            })
            .then((data) => {
                setProposal(data.proposal)
                setStatus('ready')
                fetch('/api/proposals', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, action: 'view' }),
                }).catch(() => { })
            })
            .catch((err) => setStatus(err.message === 'not-found' ? 'not-found' : 'error'))
    }, [id])

    async function submit(action) {
        setSaveStatus('saving')
        setSaveError('')
        try {
            const res = await fetch('/api/proposals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action === 'accept' ? { id, action, acceptedName: name, agreed } : { id, action, reason }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed')
            setResult(action === 'accept' ? 'accepted' : 'declined')
            setMode('done')
            setSaveStatus('idle')
        } catch (err) {
            setSaveError(err.message && err.message !== 'Failed' ? err.message : 'Something went wrong — please try again.')
            setSaveStatus('error')
        }
    }

    if (status === 'loading') {
        return <div className="min-h-screen bg-navy flex items-center justify-center text-white/40 text-sm">Loading...</div>
    }
    if (status !== 'ready') {
        return (
            <div className="min-h-screen bg-navy flex items-center justify-center px-4 text-center">
                <p className="text-white/60 text-sm">
                    {status === 'not-found' ? 'This proposal link isn\'t valid. Please contact us for a new one.' : 'Something went wrong loading this proposal. Please try again.'}
                </p>
            </div>
        )
    }

    const today = new Date().toISOString().slice(0, 10)
    const expired = proposal.validUntil && proposal.validUntil < today
    const answered = ['accepted', 'declined', 'withdrawn'].includes(proposal.status)
    const customerName = [proposal.customerFirstName, proposal.customerLastName].filter(Boolean).join(' ')
    const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl text-white text-base py-3 px-4 outline-none focus:border-blue'

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <div className="text-center mb-6">
                    <h1 className="font-serif text-2xl text-white">Adirondack Advanced Water Solutions</h1>
                    <p className="text-white/40 text-xs mt-1">Proposal {proposal.proposalId}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-5 mb-6">
                    <section>
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Prepared For</p>
                        <p className="text-white text-sm">{customerName}</p>
                        <p className="text-white/60 text-sm">{formatAddress(proposal.propertyAddress)}</p>
                    </section>

                    {proposal.workDescription && (
                        <section>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Description of Work</p>
                            <p className="text-white text-sm whitespace-pre-wrap">{proposal.workDescription}</p>
                        </section>
                    )}

                    {(proposal.lineItems || []).length > 0 && (
                        <section>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Materials &amp; Equipment</p>
                            <ul className="text-white text-sm flex flex-col gap-1">
                                {proposal.lineItems.map((li, i) => (
                                    <li key={i} className="flex gap-2">
                                        <span className="text-white/50 w-8 shrink-0">{li.quantity || 1} ×</span>
                                        <span>{li.name}</span>
                                    </li>
                                ))}
                                {Number(proposal.laborCost) > 0 && (
                                    <li className="flex gap-2">
                                        <span className="text-white/50 w-8 shrink-0">•</span>
                                        <span>Labor</span>
                                    </li>
                                )}
                            </ul>
                        </section>
                    )}

                    <section className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
                        <p className="text-white text-sm font-semibold">Total</p>
                        <p className="text-white text-2xl font-serif">{formatMoney(proposal.totalPrice)}</p>
                    </section>

                    {(proposal.estimatedStartDate || proposal.validUntil) && (
                        <section className="text-white/60 text-xs flex flex-col gap-1">
                            {proposal.estimatedStartDate && <p>Estimated start: {formatDate(proposal.estimatedStartDate)}</p>}
                            {proposal.validUntil && <p>This proposal is good until {formatDate(proposal.validUntil)}.</p>}
                        </section>
                    )}

                    {proposal.notes && (
                        <section>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Notes</p>
                            <p className="text-white/70 text-sm whitespace-pre-wrap">{proposal.notes}</p>
                        </section>
                    )}
                </div>

                {/* ---- Answer ---- */}
                {mode === 'done' || answered ? (
                    <div className={`rounded-2xl p-5 text-center border ${(result || proposal.status) === 'accepted' ? 'bg-brand-green/15 border-brand-green/40' : 'bg-white/5 border-white/10'}`}>
                        {(result || proposal.status) === 'accepted' && (
                            <>
                                <p className="text-brand-green text-lg font-semibold mb-1">✓ Thank You — Proposal Accepted</p>
                                <p className="text-white/60 text-sm">We'll be in touch shortly to schedule the work and send your contract.</p>
                            </>
                        )}
                        {(result || proposal.status) === 'declined' && (
                            <p className="text-white/70 text-sm">You declined this proposal. Thank you for considering us — reach out anytime if anything changes.</p>
                        )}
                        {proposal.status === 'withdrawn' && !result && (
                            <p className="text-white/70 text-sm">This proposal is no longer available. Please contact us for an updated quote.</p>
                        )}
                    </div>
                ) : expired ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                        <p className="text-white/70 text-sm">This proposal expired on {formatDate(proposal.validUntil)}. Please contact us for an updated quote.</p>
                    </div>
                ) : mode === 'choose' ? (
                    <div className="flex flex-col gap-3">
                        <button onClick={() => setMode('accept')} className="w-full bg-brand-green hover:opacity-90 text-white text-lg font-semibold py-4 rounded-xl transition-opacity">
                            Accept Proposal
                        </button>
                        <button onClick={() => setMode('decline')} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-semibold py-3 rounded-xl transition-colors">
                            Decline
                        </button>
                    </div>
                ) : mode === 'accept' ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                        <div>
                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Your Full Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                        </div>
                        <label className="flex items-start gap-2 text-white/80 text-sm">
                            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
                            I accept this proposal for {formatMoney(proposal.totalPrice)}. I understand a contract with the full terms will follow before work begins.
                        </label>
                        {saveStatus === 'error' && <p className="text-red-400 text-sm text-center">{saveError}</p>}
                        <button
                            onClick={() => submit('accept')}
                            disabled={!name.trim() || !agreed || saveStatus === 'saving'}
                            className="w-full bg-brand-green hover:opacity-90 disabled:opacity-40 text-white text-lg font-semibold py-4 rounded-xl transition-opacity"
                        >
                            {saveStatus === 'saving' ? 'Accepting...' : 'Accept'}
                        </button>
                        <button onClick={() => setMode('choose')} className="text-white/40 text-sm">Back</button>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                        <div>
                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Anything we should know? (optional)</label>
                            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} h-24 resize-none`} />
                        </div>
                        {saveStatus === 'error' && <p className="text-red-400 text-sm text-center">{saveError}</p>}
                        <button
                            onClick={() => submit('decline')}
                            disabled={saveStatus === 'saving'}
                            className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-base font-semibold py-3 rounded-xl transition-colors"
                        >
                            {saveStatus === 'saving' ? 'Sending...' : 'Decline Proposal'}
                        </button>
                        <button onClick={() => setMode('choose')} className="text-white/40 text-sm">Back</button>
                    </div>
                )}

                <p className="text-white/30 text-xs text-center mt-8">Questions? Call (518) 534-9949 or email contact@adkadvancedwatersolutions.com</p>
            </div>
        </div>
    )
}
