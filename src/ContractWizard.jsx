import { useState, useEffect } from 'react'

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

// Same rule the API uses: an addendum template is one whose wording refers
// to the original contract's number.
function isAddendumTemplate(template) {
    return (template?.bodyText || '').includes('{{parentContractId}}')
}

// parentContract is optional — pass { _id, contractId, propertyId, invoiceId }
// when starting from an original contract's "+ Add Addendum" button. When it's
// not passed and an addendum template is picked, the wizard asks which
// original contract it amends before going on.
export default function ContractWizard({ customerId, propertyId, parentContract: presetParent, onBack, onCreated }) {
    const [stage, setStage] = useState('template') // template | parent | details | review
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [templates, setTemplates] = useState([])
    const [selectedTemplate, setSelectedTemplate] = useState(null)

    const [selectedScope, setSelectedScope] = useState([])
    const [customScopeItem, setCustomScopeItem] = useState('')
    const [totalPrice, setTotalPrice] = useState('')
    const [priceNotes, setPriceNotes] = useState('')
    const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10))

    const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | error
    const [saveError, setSaveError] = useState('')

    const [chosenParent, setChosenParent] = useState(presetParent || null)
    const [parentOptions, setParentOptions] = useState([])
    const [parentOptionsStatus, setParentOptionsStatus] = useState('idle') // idle | loading | ready | error

    const isAddendumMode = !!presetParent
    const visibleTemplates = isAddendumMode ? templates.filter(isAddendumTemplate) : templates

    useEffect(() => {
        fetch('/api/contracts?templates=true')
            .then((res) => res.json())
            .then((data) => {
                setTemplates(data.templates || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }, [])

    function pickTemplate(template) {
        setSelectedTemplate(template)
        setSelectedScope([])
        if (isAddendumTemplate(template) && !presetParent) {
            setChosenParent(null)
            loadParentOptions()
            setStage('parent')
        } else {
            if (!isAddendumTemplate(template)) setChosenParent(presetParent || null)
            setStage('details')
        }
    }

    // Only original contracts for this customer that aren't voided — the
    // same rules the API checks, so nothing offered here gets rejected.
    function loadParentOptions() {
        setParentOptionsStatus('loading')
        fetch(`/api/contracts?customerId=${encodeURIComponent(customerId)}`)
            .then((res) => res.json())
            .then((data) => {
                setParentOptions((data.contracts || []).filter((c) => !c.isAddendum && c.status !== 'voided'))
                setParentOptionsStatus('ready')
            })
            .catch(() => setParentOptionsStatus('error'))
    }

    function pickParent(contract) {
        setChosenParent(contract)
        setStage('details')
    }

    function goBack() {
        if (stage === 'template') return onBack()
        if (stage === 'parent') return setStage('template')
        if (stage === 'details') {
            return setStage(isAddendumTemplate(selectedTemplate) && !presetParent ? 'parent' : 'template')
        }
        if (stage === 'review') return setStage('details')
    }

    function toggleScopeOption(option) {
        setSelectedScope((prev) => (prev.includes(option) ? prev.filter((s) => s !== option) : [...prev, option]))
    }

    function addCustomScopeItem() {
        if (!customScopeItem.trim()) return
        setSelectedScope((prev) => [...prev, customScopeItem.trim()])
        setCustomScopeItem('')
    }

    function removeScopeItem(item) {
        setSelectedScope((prev) => prev.filter((s) => s !== item))
    }

    // An addendum is for the same house and job as its original, so it
    // takes the original's property and invoice instead of the defaults.
    const effectiveParent = isAddendumTemplate(selectedTemplate) || isAddendumMode ? chosenParent : null
    const effectivePropertyId = effectiveParent?.propertyId || propertyId
    const effectiveInvoiceId = effectiveParent?.invoiceId || undefined

    async function handleCreate() {
        setSaveStatus('saving')
        setSaveError('')
        try {
            const res = await fetch('/api/contracts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: selectedTemplate._id,
                    customerId,
                    propertyId: effectivePropertyId,
                    invoiceId: effectiveInvoiceId,
                    parentContractDocId: effectiveParent?._id || undefined,
                    scopeOfWork: selectedScope,
                    totalPrice: totalPrice ? Number(totalPrice) : undefined,
                    priceNotes,
                    serviceDate,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')
            onCreated(data.id)
        } catch (err) {
            console.error(err)
            setSaveError(err.message && err.message !== 'Failed' ? err.message : '')
            setSaveStatus('error')
        }
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button
                    onClick={goBack}
                    className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
                >
                    ← Back
                </button>

                <h1 className="font-serif text-2xl text-white mb-6">{effectiveParent || isAddendumMode ? 'New Addendum' : 'New Contract'}</h1>

                {chosenParent && (isAddendumMode || isAddendumTemplate(selectedTemplate)) && (
                    <div className="bg-blue/20 border border-blue/40 rounded-xl px-4 py-3 mb-6">
                        <p className="text-white text-sm">Addendum to <span className="font-semibold">{chosenParent.contractId}</span></p>
                    </div>
                )}

                {stage === 'template' && (
                    <>
                        {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                        {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load templates.</p>}
                        {status === 'ready' && (
                            <div className="flex flex-col gap-3">
                                {visibleTemplates.map((t) => (
                                    <button
                                        key={t._id}
                                        onClick={() => pickTemplate(t)}
                                        className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-5 py-4 transition-colors"
                                    >
                                        <p className="text-white text-lg font-serif">{t.name}</p>
                                    </button>
                                ))}
                                {visibleTemplates.length === 0 && (
                                    <p className="text-white/40 text-sm text-center py-10">
                                        {isAddendumMode
                                            ? 'No addendum templates found. An addendum template\'s wording needs to include {{parentContractId}} — add that in Sanity Studio first.'
                                            : 'No templates yet — add one in Sanity Studio first.'}
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}

                {stage === 'parent' && (
                    <>
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Which contract is this an addendum to?</p>
                        {parentOptionsStatus === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                        {parentOptionsStatus === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load this customer's contracts.</p>}
                        {parentOptionsStatus === 'ready' && parentOptions.length === 0 && (
                            <p className="text-white/40 text-sm text-center py-10">This customer has no original contracts to add an addendum to.</p>
                        )}
                        {parentOptionsStatus === 'ready' && (
                            <div className="flex flex-col gap-3">
                                {parentOptions.map((c) => (
                                    <button
                                        key={c._id}
                                        onClick={() => pickParent(c)}
                                        className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-5 py-4 transition-colors"
                                    >
                                        <p className="text-white text-lg font-serif">{c.contractId}</p>
                                        <p className="text-white/40 text-xs mt-0.5">
                                            {c.templateName} — {c.status === 'partiallySigned' ? 'Partially Signed' : c.status}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {stage === 'details' && selectedTemplate && (
                    <div className="flex flex-col gap-5">
                        <div>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{selectedTemplate.name}</p>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Scope of Work</p>
                            <div className="flex flex-col gap-2">
                                {(selectedTemplate.scopeOptions || []).map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => toggleScopeOption(option)}
                                        className={`text-left px-4 py-3 rounded-xl text-sm transition-colors border ${selectedScope.includes(option)
                                            ? 'bg-blue text-white border-blue'
                                            : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        {selectedScope.includes(option) ? '✓ ' : ''}{option}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-3">
                                <input
                                    type="text"
                                    value={customScopeItem}
                                    onChange={(e) => setCustomScopeItem(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addCustomScopeItem()}
                                    placeholder="Add a custom item..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl text-white text-sm py-3 px-4 outline-none focus:border-blue"
                                />
                                <button
                                    onClick={addCustomScopeItem}
                                    className="px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                            {selectedScope.filter((s) => !(selectedTemplate.scopeOptions || []).includes(s)).length > 0 && (
                                <div className="flex flex-col gap-2 mt-2">
                                    {selectedScope
                                        .filter((s) => !(selectedTemplate.scopeOptions || []).includes(s))
                                        .map((item) => (
                                            <div key={item} className="flex items-center justify-between bg-blue/20 border border-blue/40 rounded-xl px-4 py-2">
                                                <p className="text-white text-sm">{item}</p>
                                                <button onClick={() => removeScopeItem(item)} className="text-red-400 text-xs">Remove</button>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Service Date</label>
                            <input
                                type="date"
                                value={serviceDate}
                                onChange={(e) => setServiceDate(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                        </div>

                        <div>
                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Total Price</label>
                            <input
                                type="number"
                                value={totalPrice}
                                onChange={(e) => setTotalPrice(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                        </div>

                        <div>
                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Price Notes (optional)</label>
                            <textarea
                                value={priceNotes}
                                onChange={(e) => setPriceNotes(e.target.value)}
                                placeholder="e.g. deposit already paid, payment schedule..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm py-3 px-4 outline-none focus:border-blue h-20 resize-none"
                            />
                        </div>

                        <button
                            onClick={() => setStage('review')}
                            disabled={selectedScope.length === 0}
                            className="w-full bg-blue hover:bg-blue-light disabled:opacity-40 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            Review Contract
                        </button>
                    </div>
                )}

                {stage === 'review' && selectedTemplate && (
                    <div className="flex flex-col gap-5">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">{selectedTemplate.name}</p>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Scope of Work</p>
                            <ul className="text-white text-sm mb-4 flex flex-col gap-1">
                                {selectedScope.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Service Date</p>
                            <p className="text-white text-sm mb-4">{serviceDate}</p>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Total Price</p>
                            <p className="text-white text-lg font-serif">{formatMoney(totalPrice)}</p>
                            {priceNotes && <p className="text-white/40 text-xs mt-2 italic">{priceNotes}</p>}
                        </div>

                        {saveStatus === 'error' && (
                            <p className="text-red-400 text-sm text-center">{saveError || 'Something went wrong — try again.'}</p>
                        )}

                        <button
                            onClick={handleCreate}
                            disabled={saveStatus === 'saving'}
                            className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            {saveStatus === 'saving' ? 'Creating...' : effectiveParent ? 'Create Addendum' : 'Create Contract'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}