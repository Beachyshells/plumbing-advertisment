import { useState, useEffect } from 'react'
import MoneyInput from './MoneyInput.jsx'

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

function todayIso() {
    return new Date().toISOString().slice(0, 10)
}

// Same rule the API uses: a template is an addendum template if its Type
// says so, or (for older templates) if its wording refers to the original
// contract's number.
function isAddendumTemplate(template) {
    return template?.templateType === 'addendum' || (template?.bodyText || '').includes('{{parentContractId}}')
}

const KIND_OPTIONS = [
    { value: 'part', label: 'Part' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'labor', label: 'Labor' },
    { value: 'other', label: 'Other' },
]

const PRICE_BASIS_LABEL = { total: 'Total', perVisit: 'Per visit', perYear: 'Per year' }

let rowCounter = 0
function newRow(fields = {}) {
    rowCounter += 1
    return { rowId: `row-${rowCounter}`, name: '', quantity: 1, kind: 'part', make: '', model: '', changeType: 'add', ...fields }
}

// Which sections a contract type uses. Mirrors what the API accepts, so the
// wizard never asks for something the contract won't show.
function sectionsFor(templateType, isAddendum) {
    if (isAddendum) {
        return { items: true, changeTypes: true, deposit: false, completion: false, frequency: false, priceRequired: true }
    }
    switch (templateType) {
        case 'recurring':
            return { items: true, changeTypes: false, deposit: false, completion: false, frequency: true, priceRequired: true }
        case 'liabilityWaiver':
            return { items: false, changeTypes: false, deposit: false, completion: false, frequency: false, priceRequired: false }
        default: // oneTime, installation
            return { items: true, changeTypes: false, deposit: true, completion: true, frequency: false, priceRequired: true }
    }
}

function startDateLabel(templateType, isAddendum) {
    if (isAddendum) return 'Effective Date'
    if (templateType === 'recurring') return 'Agreement Start Date'
    if (templateType === 'liabilityWaiver') return 'Date of Work'
    return 'Start Date'
}

// parentContract is optional — pass { _id, contractId, propertyId, invoiceId }
// when starting from an original contract's "+ Add Addendum" button.
// invoiceId is optional — pass it when the job is already known (the
// Contracts hub asks for it first). If it isn't passed, the wizard asks
// which job the contract is for, so it can fill in the details from it.
export default function ContractWizard({ customerId, propertyId, invoiceId: presetInvoiceId, parentContract: presetParent, onBack, onCreated }) {
    const [stage, setStage] = useState('template') // template | parent | job | details | review
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [templates, setTemplates] = useState([])
    const [selectedTemplate, setSelectedTemplate] = useState(null)

    // ---- Original contract (addenda) ----
    const [chosenParent, setChosenParent] = useState(presetParent || null)
    const [parentOptions, setParentOptions] = useState([])
    const [parentOptionsStatus, setParentOptionsStatus] = useState('idle') // idle | loading | ready | error

    // ---- Job ----
    const [chosenJob, setChosenJob] = useState(presetInvoiceId ? { _id: presetInvoiceId, propertyId } : null)
    const [jobOptions, setJobOptions] = useState([])
    const [jobOptionsStatus, setJobOptionsStatus] = useState('idle') // idle | loading | ready | error

    // ---- Details ----
    const [workDescription, setWorkDescription] = useState('')
    const [rows, setRows] = useState([])
    const [extraScope, setExtraScope] = useState([])
    const [customScopeItem, setCustomScopeItem] = useState('')
    const [totalPrice, setTotalPrice] = useState('')
    const [priceDirection, setPriceDirection] = useState('add') // addenda: add | lower
    const [priceBasis, setPriceBasis] = useState('total')
    const [depositAmount, setDepositAmount] = useState('')
    const [startDate, setStartDate] = useState(todayIso)
    const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('')
    const [visitFrequency, setVisitFrequency] = useState('')
    const [priceNotes, setPriceNotes] = useState('')

    const [prefillStatus, setPrefillStatus] = useState('idle') // idle | loading | done | error
    const [formError, setFormError] = useState('')

    const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | error
    const [saveError, setSaveError] = useState('')

    const isAddendumMode = !!presetParent
    const visibleTemplates = isAddendumMode ? templates.filter(isAddendumTemplate) : templates
    const templateIsAddendum = isAddendumTemplate(selectedTemplate)
    const isAddendum = isAddendumMode || templateIsAddendum
    const templateType = selectedTemplate?.templateType || 'oneTime'
    const sections = sectionsFor(templateType, isAddendum)

    useEffect(() => {
        fetch('/api/contracts?templates=true')
            .then((res) => res.json())
            .then((data) => {
                setTemplates(data.templates || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }, [])

    function resetDetails() {
        setWorkDescription('')
        setRows([])
        setExtraScope([])
        setCustomScopeItem('')
        setTotalPrice('')
        setPriceDirection('add')
        setPriceBasis('total')
        setDepositAmount('')
        setStartDate(todayIso())
        setEstimatedCompletionDate('')
        setVisitFrequency('')
        setPriceNotes('')
        setPrefillStatus('idle')
        setFormError('')
    }

    // ---- Stage navigation ----
    function pickTemplate(template) {
        setSelectedTemplate(template)
        resetDetails()
        const addendum = isAddendumMode || isAddendumTemplate(template)
        if (addendum && !presetParent) {
            setChosenParent(null)
            loadParentOptions()
            setStage('parent')
            return
        }
        if (!addendum) setChosenParent(null)
        goToJobOrDetails(template, addendum)
    }

    function goToJobOrDetails(template, addendum) {
        // Addenda cover new work on the original's job, so they start blank
        // and don't need a job picked.
        if (addendum) {
            setStage('details')
            return
        }
        if (chosenJob) {
            loadPrefill(chosenJob._id)
            setStage('details')
            return
        }
        loadJobOptions()
        setStage('job')
    }

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

    function loadJobOptions() {
        setJobOptionsStatus('loading')
        fetch(`/api/invoices?customerId=${encodeURIComponent(customerId)}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed')
                return res.json()
            })
            .then((data) => {
                setJobOptions(data.invoices || [])
                setJobOptionsStatus('ready')
            })
            .catch(() => setJobOptionsStatus('error'))
    }

    function pickJob(job) {
        setChosenJob(job)
        loadPrefill(job._id)
        setStage('details')
    }

    // Fills the details from the job. Only called right after a template or
    // job is picked — moving between Details and Review never re-runs it,
    // so Michael's edits aren't overwritten.
    function loadPrefill(jobId) {
        if (!jobId) return
        setPrefillStatus('loading')
        fetch(`/api/contracts?prefillInvoice=${encodeURIComponent(jobId)}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed')
                return res.json()
            })
            .then(({ prefill }) => {
                setWorkDescription(prefill.workDescription || '')
                setRows((prefill.lineItems || []).map((li) => newRow(li)))
                setTotalPrice(prefill.totalPrice != null ? String(prefill.totalPrice) : '')
                if (prefill.startDate) setStartDate(prefill.startDate)
                setPrefillStatus('done')
            })
            .catch(() => setPrefillStatus('error'))
    }

    function goBack() {
        if (stage === 'template') return onBack()
        if (stage === 'parent' || stage === 'job') return setStage('template')
        if (stage === 'details') {
            if (isAddendum && !presetParent) return setStage('parent')
            if (!isAddendum && !presetInvoiceId) return setStage('job')
            return setStage('template')
        }
        if (stage === 'review') return setStage('details')
    }

    // ---- Item rows ----
    function updateRow(rowId, changes) {
        setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...changes } : r)))
    }
    function removeRow(rowId) {
        setRows((prev) => prev.filter((r) => r.rowId !== rowId))
    }
    function moveRow(rowId, direction) {
        setRows((prev) => {
            const index = prev.findIndex((r) => r.rowId === rowId)
            const target = index + direction
            if (index < 0 || target < 0 || target >= prev.length) return prev
            const next = [...prev]
            ;[next[index], next[target]] = [next[target], next[index]]
            return next
        })
    }

    // ---- Extra scope lines (template's tap-to-select options) ----
    function toggleScopeOption(option) {
        setExtraScope((prev) => (prev.includes(option) ? prev.filter((s) => s !== option) : [...prev, option]))
    }
    function addCustomScopeItem() {
        const item = customScopeItem.trim()
        if (!item || extraScope.includes(item)) return
        setExtraScope((prev) => [...prev, item])
        setCustomScopeItem('')
    }

    // ---- Validation + review ----
    const namedRows = rows.filter((r) => r.name.trim())
    const priceNumber = Number(totalPrice) || 0
    const signedPrice = isAddendum && priceDirection === 'lower' ? -priceNumber : priceNumber

    function goToReview() {
        if (sections.items && namedRows.length === 0 && extraScope.length === 0) {
            return setFormError('Add at least one item or scope line.')
        }
        if (!sections.items && !workDescription.trim()) {
            return setFormError('Describe the purpose of this waiver.')
        }
        if (sections.priceRequired && !(priceNumber > 0)) {
            return setFormError(isAddendum ? 'Enter the price change amount.' : 'Enter the price.')
        }
        if (sections.deposit && Number(depositAmount) > priceNumber) {
            return setFormError('The deposit can\'t be more than the total price.')
        }
        if (sections.completion && estimatedCompletionDate && startDate && estimatedCompletionDate < startDate) {
            return setFormError('Estimated completion can\'t be before the start date.')
        }
        if (sections.frequency && !visitFrequency.trim()) {
            return setFormError('Enter how often visits happen (e.g. "Every 6 months").')
        }
        setFormError('')
        setStage('review')
    }

    const effectiveParent = isAddendum ? chosenParent : null
    // An addendum is for the same house and job as its original.
    const effectivePropertyId = effectiveParent?.propertyId || chosenJob?.propertyId || propertyId
    const effectiveInvoiceId = effectiveParent?.invoiceId || chosenJob?._id || undefined

    async function handleCreate() {
        setSaveStatus('saving')
        setSaveError('')
        try {
            const res = await fetch('/api/contracts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    layoutVersion: 2,
                    templateId: selectedTemplate._id,
                    customerId,
                    propertyId: effectivePropertyId,
                    invoiceId: effectiveInvoiceId,
                    parentContractDocId: effectiveParent?._id || undefined,
                    workDescription,
                    lineItems: sections.items
                        ? namedRows.map((r) => ({
                            name: r.name.trim(),
                            quantity: Number(r.quantity) || 1,
                            kind: r.kind,
                            make: r.kind === 'equipment' ? r.make : undefined,
                            model: r.kind === 'equipment' ? r.model : undefined,
                            changeType: sections.changeTypes ? r.changeType : undefined,
                        }))
                        : [],
                    scopeOfWork: sections.items ? extraScope : [],
                    totalPrice: sections.priceRequired || priceNumber > 0 ? signedPrice : undefined,
                    priceBasis: sections.frequency ? priceBasis : 'total',
                    depositAmount: sections.deposit && Number(depositAmount) > 0 ? Number(depositAmount) : undefined,
                    startDate: startDate || undefined,
                    estimatedCompletionDate: sections.completion ? estimatedCompletionDate || undefined : undefined,
                    visitFrequency: sections.frequency ? visitFrequency : undefined,
                    priceNotes,
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

    const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm py-3 px-4 outline-none focus:border-blue'
    const labelClass = 'text-white/40 text-xs uppercase tracking-widest mb-1 block'

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={goBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Back
                </button>

                <h1 className="font-serif text-2xl text-white mb-6">{isAddendum ? 'New Addendum' : 'New Contract'}</h1>

                {chosenParent && isAddendum && (
                    <div className="bg-blue/20 border border-blue/40 rounded-xl px-4 py-3 mb-6">
                        <p className="text-white text-sm">Addendum to <span className="font-semibold">{chosenParent.contractId}</span></p>
                    </div>
                )}

                {/* ---- Template ---- */}
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
                                            ? 'No addendum templates found. Set a template\'s Type to "Addendum" in Sanity Studio first.'
                                            : 'No templates yet — add one in Sanity Studio first.'}
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ---- Original contract (addenda) ---- */}
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

                {/* ---- Job ---- */}
                {stage === 'job' && (
                    <>
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Which job is this contract for?</p>
                        {jobOptionsStatus === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                        {jobOptionsStatus === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load this customer's jobs.</p>}
                        {jobOptionsStatus === 'ready' && jobOptions.length === 0 && (
                            <p className="text-white/40 text-sm text-center py-10">
                                This customer has no jobs yet. Add a job first — a contract needs a job so it knows which house it's for.
                            </p>
                        )}
                        {jobOptionsStatus === 'ready' && (
                            <div className="flex flex-col gap-2">
                                {jobOptions.map((j) => (
                                    <button
                                        key={j._id}
                                        onClick={() => pickJob(j)}
                                        className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-white text-sm font-semibold">
                                                {j.invoiceNumber || 'Job'}{j.serviceDate ? ` — ${j.serviceDate}` : ''}
                                            </p>
                                            {j.totalAmount != null && <p className="text-white/50 text-xs">{formatMoney(j.totalAmount)}</p>}
                                        </div>
                                        {j.workPerformed && <p className="text-white/40 text-xs mt-0.5 line-clamp-1">{j.workPerformed}</p>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ---- Details ---- */}
                {stage === 'details' && selectedTemplate && (
                    <div className="flex flex-col gap-6">
                        <p className="text-white/40 text-xs uppercase tracking-widest">{selectedTemplate.name}</p>

                        {prefillStatus === 'loading' && <p className="text-white/40 text-sm">Filling in from the job...</p>}
                        {prefillStatus === 'done' && (
                            <p className="text-white/50 text-xs bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                Filled in from the job — change anything that should read differently on the contract.
                            </p>
                        )}
                        {prefillStatus === 'error' && (
                            <p className="text-red-400 text-xs">Couldn't fill in from the job — you can still enter the details by hand.</p>
                        )}

                        <div>
                            <label className={labelClass}>{sections.items ? 'Description of Work' : 'Purpose'}</label>
                            <textarea
                                value={workDescription}
                                onChange={(e) => setWorkDescription(e.target.value)}
                                placeholder={sections.items ? 'e.g. Replace pressure tank and repipe well line' : 'e.g. Inspect and repair corroded well line in crawl space'}
                                className={`${inputClass} h-20 resize-none`}
                            />
                        </div>

                        {sections.items && (
                            <div>
                                <label className={labelClass}>{isAddendum ? 'Changes' : 'Scope of Work — Items'}</label>
                                <p className="text-white/30 text-xs mb-3">Shown on the contract by name and quantity — no individual prices.</p>
                                <div className="flex flex-col gap-3">
                                    {rows.map((r, index) => (
                                        <div key={r.rowId} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={r.name}
                                                    onChange={(e) => updateRow(r.rowId, { name: e.target.value })}
                                                    placeholder="Item name"
                                                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg text-white text-sm py-2 px-3 outline-none focus:border-blue"
                                                />
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={r.quantity}
                                                    onChange={(e) => updateRow(r.rowId, { quantity: e.target.value })}
                                                    aria-label="Quantity"
                                                    className="w-16 bg-white/5 border border-white/10 rounded-lg text-white text-sm py-2 px-2 text-center outline-none focus:border-blue"
                                                />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <select
                                                    value={r.kind}
                                                    onChange={(e) => updateRow(r.rowId, { kind: e.target.value })}
                                                    className="bg-white/5 border border-white/10 rounded-lg text-white text-xs py-1.5 px-2 outline-none focus:border-blue"
                                                >
                                                    {KIND_OPTIONS.map((k) => (
                                                        <option key={k.value} value={k.value} style={{ color: '#111', backgroundColor: '#fff' }}>{k.label}</option>
                                                    ))}
                                                </select>
                                                {sections.changeTypes && (
                                                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                                                        {['add', 'remove'].map((ct) => (
                                                            <button
                                                                key={ct}
                                                                onClick={() => updateRow(r.rowId, { changeType: ct })}
                                                                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${r.changeType === ct ? 'bg-blue text-white' : 'bg-white/5 text-white/50'}`}
                                                            >
                                                                {ct === 'add' ? '+ Add' : '− Remove'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="ml-auto flex items-center gap-1">
                                                    <button
                                                        onClick={() => moveRow(r.rowId, -1)}
                                                        disabled={index === 0}
                                                        aria-label="Move up"
                                                        className="text-white/40 hover:text-white disabled:opacity-20 text-xs px-2 py-1"
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        onClick={() => moveRow(r.rowId, 1)}
                                                        disabled={index === rows.length - 1}
                                                        aria-label="Move down"
                                                        className="text-white/40 hover:text-white disabled:opacity-20 text-xs px-2 py-1"
                                                    >
                                                        ↓
                                                    </button>
                                                    <button onClick={() => removeRow(r.rowId)} className="text-red-400 text-xs px-2 py-1">
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                            {r.kind === 'equipment' && (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={r.make}
                                                        onChange={(e) => updateRow(r.rowId, { make: e.target.value })}
                                                        placeholder="Make (optional)"
                                                        className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg text-white text-xs py-2 px-3 outline-none focus:border-blue"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={r.model}
                                                        onChange={(e) => updateRow(r.rowId, { model: e.target.value })}
                                                        placeholder="Model (optional)"
                                                        className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg text-white text-xs py-2 px-3 outline-none focus:border-blue"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setRows((prev) => [...prev, newRow()])}
                                    className="w-full mt-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-white/70 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                                >
                                    + Add Item
                                </button>
                            </div>
                        )}

                        {sections.items && (
                            <div>
                                <label className={labelClass}>Extra Scope Lines (optional)</label>
                                {(selectedTemplate.scopeOptions || []).length > 0 && (
                                    <div className="flex flex-col gap-2 mb-2">
                                        {(selectedTemplate.scopeOptions || []).map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => toggleScopeOption(option)}
                                                className={`text-left px-4 py-2.5 rounded-xl text-sm transition-colors border ${extraScope.includes(option)
                                                    ? 'bg-blue text-white border-blue'
                                                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                {extraScope.includes(option) ? '✓ ' : ''}{option}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customScopeItem}
                                        onChange={(e) => setCustomScopeItem(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addCustomScopeItem()}
                                        placeholder="e.g. Test system and check for leaks"
                                        className={`flex-1 ${inputClass}`}
                                    />
                                    <button
                                        onClick={addCustomScopeItem}
                                        className="px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold rounded-xl transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                                {extraScope.filter((s) => !(selectedTemplate.scopeOptions || []).includes(s)).length > 0 && (
                                    <div className="flex flex-col gap-2 mt-2">
                                        {extraScope
                                            .filter((s) => !(selectedTemplate.scopeOptions || []).includes(s))
                                            .map((item) => (
                                                <div key={item} className="flex items-center justify-between bg-blue/20 border border-blue/40 rounded-xl px-4 py-2">
                                                    <p className="text-white text-sm">{item}</p>
                                                    <button onClick={() => toggleScopeOption(item)} className="text-red-400 text-xs">Remove</button>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {sections.frequency && (
                            <div>
                                <label className={labelClass}>Visit Frequency</label>
                                <input
                                    type="text"
                                    value={visitFrequency}
                                    onChange={(e) => setVisitFrequency(e.target.value)}
                                    placeholder='e.g. "Every 6 months"'
                                    className={inputClass}
                                />
                            </div>
                        )}

                        <div>
                            <label className={labelClass}>
                                {isAddendum ? 'Price Change' : sections.priceRequired ? 'Price' : 'Price (optional)'}
                            </label>
                            {isAddendum && (
                                <div className="flex rounded-xl overflow-hidden border border-white/10 mb-2">
                                    {[
                                        { value: 'add', label: 'Adds to the price' },
                                        { value: 'lower', label: 'Lowers the price' },
                                    ].map((d) => (
                                        <button
                                            key={d.value}
                                            onClick={() => setPriceDirection(d.value)}
                                            className={`flex-1 py-2 text-xs font-semibold transition-colors ${priceDirection === d.value ? 'bg-blue text-white' : 'bg-white/5 text-white/50'}`}
                                        >
                                            {d.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {sections.frequency && (
                                <div className="flex rounded-xl overflow-hidden border border-white/10 mb-2">
                                    {['perVisit', 'perYear', 'total'].map((b) => (
                                        <button
                                            key={b}
                                            onClick={() => setPriceBasis(b)}
                                            className={`flex-1 py-2 text-xs font-semibold transition-colors ${priceBasis === b ? 'bg-blue text-white' : 'bg-white/5 text-white/50'}`}
                                        >
                                            {PRICE_BASIS_LABEL[b]}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <MoneyInput value={totalPrice} onChange={setTotalPrice} />
                        </div>

                        {sections.deposit && (
                            <div>
                                <label className={labelClass}>Deposit (optional)</label>
                                <p className="text-white/30 text-xs mb-2">Leave empty for no deposit — the default until the deposit rules are checked.</p>
                                <MoneyInput value={depositAmount} onChange={setDepositAmount} />
                            </div>
                        )}

                        <div className={`grid gap-4 ${sections.completion ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                            <div>
                                <label className={labelClass}>{startDateLabel(templateType, isAddendum)}</label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
                            </div>
                            {sections.completion && (
                                <div>
                                    <label className={labelClass}>Estimated Completion</label>
                                    <input
                                        type="date"
                                        value={estimatedCompletionDate}
                                        min={startDate || undefined}
                                        onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={labelClass}>Price Notes (optional)</label>
                            <textarea
                                value={priceNotes}
                                onChange={(e) => setPriceNotes(e.target.value)}
                                placeholder="Anything else about the price or payment..."
                                className={`${inputClass} h-20 resize-none`}
                            />
                        </div>

                        {formError && <p className="text-red-400 text-sm text-center">{formError}</p>}

                        <button
                            onClick={goToReview}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            Review {isAddendum ? 'Addendum' : 'Contract'}
                        </button>
                    </div>
                )}

                {/* ---- Review: laid out the way the contract will read ---- */}
                {stage === 'review' && selectedTemplate && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
                            <p className="text-white/40 text-xs uppercase tracking-widest">{selectedTemplate.name}</p>

                            {workDescription.trim() && (
                                <div>
                                    <p className={labelClass}>{sections.items ? 'Description of Work' : 'Purpose'}</p>
                                    <p className="text-white text-sm whitespace-pre-wrap">{workDescription.trim()}</p>
                                </div>
                            )}

                            {sections.items && (namedRows.length > 0 || extraScope.length > 0) && (
                                <div>
                                    <p className={labelClass}>{isAddendum ? 'Changes' : 'Scope of Work'}</p>
                                    <ul className="text-white text-sm flex flex-col gap-1">
                                        {namedRows.map((r) => (
                                            <li key={r.rowId} className="flex gap-2">
                                                {sections.changeTypes && (
                                                    <span className={r.changeType === 'remove' ? 'text-red-400' : 'text-brand-green'}>
                                                        {r.changeType === 'remove' ? '−' : '+'}
                                                    </span>
                                                )}
                                                <span className="text-white/50 w-8 shrink-0">{Number(r.quantity) || 1} ×</span>
                                                <span>
                                                    {r.name.trim()}
                                                    {r.kind === 'equipment' && (r.make || r.model) && (
                                                        <span className="text-white/50"> — {[r.make, r.model].filter(Boolean).join(' ')}</span>
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                        {extraScope.map((s) => (
                                            <li key={s} className="flex gap-2">
                                                <span className="text-white/50 w-8 shrink-0">•</span>
                                                <span>{s}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {sections.frequency && (
                                <div>
                                    <p className={labelClass}>Visit Frequency</p>
                                    <p className="text-white text-sm">{visitFrequency}</p>
                                </div>
                            )}

                            {(sections.priceRequired || priceNumber > 0) && (
                                <div>
                                    <p className={labelClass}>{isAddendum ? 'Price Change' : 'Price and Payment'}</p>
                                    <p className="text-white text-lg font-serif">
                                        {isAddendum ? `${signedPrice < 0 ? '−' : '+'}${formatMoney(Math.abs(signedPrice))}` : formatMoney(priceNumber)}
                                        {sections.frequency && priceBasis !== 'total' && (
                                            <span className="text-white/50 text-sm"> {PRICE_BASIS_LABEL[priceBasis].toLowerCase()}</span>
                                        )}
                                    </p>
                                    {sections.deposit && Number(depositAmount) > 0 && (
                                        <p className="text-white/70 text-sm mt-1">
                                            Deposit due at signing: {formatMoney(depositAmount)} · Balance due at completion: {formatMoney(priceNumber - Number(depositAmount))}
                                        </p>
                                    )}
                                    {sections.deposit && !(Number(depositAmount) > 0) && (
                                        <p className="text-white/50 text-xs mt-1">No deposit — due upon completion.</p>
                                    )}
                                    {isAddendum && (
                                        <p className="text-white/50 text-xs mt-1">The new contract total is calculated from the original when this is created.</p>
                                    )}
                                    {priceNotes.trim() && <p className="text-white/50 text-xs mt-2 italic">{priceNotes.trim()}</p>}
                                </div>
                            )}

                            <div>
                                <p className={labelClass}>Schedule</p>
                                <p className="text-white text-sm">
                                    {startDateLabel(templateType, isAddendum)}: {startDate || '—'}
                                    {sections.completion && ` · Estimated completion: ${estimatedCompletionDate || '—'}`}
                                </p>
                            </div>
                        </div>

                        <p className="text-white/30 text-xs text-center">The template's Terms and Conditions follow these sections on the contract.</p>

                        {saveStatus === 'error' && (
                            <p className="text-red-400 text-sm text-center">{saveError || 'Something went wrong — try again.'}</p>
                        )}

                        <button
                            onClick={handleCreate}
                            disabled={saveStatus === 'saving'}
                            className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            {saveStatus === 'saving' ? 'Creating...' : isAddendum ? 'Create Addendum' : 'Create Contract'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
