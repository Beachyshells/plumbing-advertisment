import { useState, useEffect } from 'react'
import MoneyInput from './MoneyInput.jsx'
import CatalogPicker from './CatalogPicker.jsx'
import Toast from './Toast.jsx'

// Desktop → Proposals. Build a quote, email it, and once the customer
// accepts, turn it into a job (invoice) with the same items.

function formatMoney(amount) {
    return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatAddress(address) {
    if (!address) return ''
    const cityStateZip = [[address.city, address.state].filter(Boolean).join(', '), address.zip].filter(Boolean).join(' ')
    return [address.street, cityStateZip].filter(Boolean).join(', ')
}

function fullName(first, last) {
    return [first, last].filter(Boolean).join(' ')
}

function todayIso() {
    return new Date().toISOString().slice(0, 10)
}

function daysFromToday(days) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
}

// "Expired" isn't stored — a sent proposal past its good-until date is
// shown as expired.
function displayStatus(p) {
    if (['sent', 'viewed'].includes(p.status) && p.validUntil && p.validUntil < todayIso()) return 'expired'
    if (p.status === 'accepted' && p.invoiceNumber) return 'converted'
    return p.status
}

const STATUS_LABEL = {
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    accepted: 'Accepted',
    converted: 'Job Created',
    declined: 'Declined',
    withdrawn: 'Withdrawn',
    expired: 'Expired',
}

const STATUS_BADGE = {
    draft: 'bg-white/10 text-white/60',
    sent: 'bg-accent/20 text-accent',
    viewed: 'bg-accent/20 text-accent',
    accepted: 'bg-brand-green/20 text-brand-green',
    converted: 'bg-blue/30 text-white',
    declined: 'bg-red-500/20 text-red-400',
    withdrawn: 'bg-white/10 text-white/40 line-through',
    expired: 'bg-white/10 text-white/40',
}

const FILTERS = [
    { key: 'open', label: 'Open', statuses: ['draft', 'sent', 'viewed'] },
    { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
    { key: 'done', label: 'Job Created', statuses: ['converted'] },
    { key: 'closed', label: 'Declined / Expired', statuses: ['declined', 'withdrawn', 'expired'] },
    { key: 'all', label: 'All', statuses: null },
]

function StatusPill({ status }) {
    return (
        <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[status] || 'bg-white/10 text-white/60'}`}>
            {STATUS_LABEL[status] || status}
        </span>
    )
}

export default function ProposalsView({ onBack }) {
    const [proposals, setProposals] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [filter, setFilter] = useState('open')
    const [search, setSearch] = useState('')
    const [screen, setScreen] = useState({ name: 'list' }) // list | new | edit(id) | detail(id)

    function loadProposals() {
        return fetch('/api/proposals')
            .then((res) => {
                if (!res.ok) throw new Error('Failed')
                return res.json()
            })
            .then((data) => {
                setProposals(data.proposals || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        loadProposals()
    }, [])

    function backToList() {
        setScreen({ name: 'list' })
        setStatus('loading')
        loadProposals()
    }

    if (screen.name === 'new' || screen.name === 'edit') {
        return (
            <ProposalBuilder
                editId={screen.name === 'edit' ? screen.id : null}
                onBack={() => (screen.name === 'edit' ? setScreen({ name: 'detail', id: screen.id }) : backToList())}
                onSaved={(id) => setScreen({ name: 'detail', id })}
            />
        )
    }

    if (screen.name === 'detail') {
        return <ProposalDetail id={screen.id} onBack={backToList} onEdit={() => setScreen({ name: 'edit', id: screen.id })} />
    }

    const active = FILTERS.find((f) => f.key === filter)
    const q = search.trim().toLowerCase()
    const shown = proposals.filter((p) => {
        if (active.statuses && !active.statuses.includes(displayStatus(p))) return false
        if (!q) return true
        return (
            fullName(p.customerFirstName, p.customerLastName).toLowerCase().includes(q) ||
            formatAddress(p.propertyAddress).toLowerCase().includes(q) ||
            (p.proposalId || '').toLowerCase().includes(q)
        )
    })
    const counts = Object.fromEntries(
        FILTERS.map((f) => [f.key, f.statuses ? proposals.filter((p) => f.statuses.includes(displayStatus(p))).length : proposals.length])
    )

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Desktop
                </button>
                <div className="flex items-center justify-between mb-6 gap-3">
                    <h1 className="font-serif text-2xl text-white">Proposals</h1>
                    <button
                        onClick={() => setScreen({ name: 'new' })}
                        className="bg-blue hover:bg-blue-light text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                    >
                        + New Proposal
                    </button>
                </div>

                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filter === f.key ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'}`}
                        >
                            {f.label} ({counts[f.key]})
                        </button>
                    ))}
                </div>

                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, address, or proposal number..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm py-3 px-4 outline-none focus:border-blue mb-4"
                />

                {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load proposals.</p>}
                {status === 'ready' && shown.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-10">{proposals.length === 0 ? 'No proposals yet.' : 'No proposals match.'}</p>
                )}
                {status === 'ready' && (
                    <div className="flex flex-col gap-2">
                        {shown.map((p) => (
                            <button
                                key={p._id}
                                onClick={() => setScreen({ name: 'detail', id: p._id })}
                                className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-white text-sm font-semibold">{p.proposalId}</p>
                                    <StatusPill status={displayStatus(p)} />
                                </div>
                                <p className="text-white/70 text-sm mt-1">{fullName(p.customerFirstName, p.customerLastName) || 'No customer'}</p>
                                <p className="text-white/40 text-xs mt-0.5">
                                    {[formatAddress(p.propertyAddress), formatMoney(p.totalPrice), p.invoiceNumber ? `Job #${p.invoiceNumber}` : null].filter(Boolean).join(' · ')}
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Build a new proposal, or change a draft.
// ---------------------------------------------------------------------------
let rowCounter = 0
function newRowKey() {
    rowCounter += 1
    return `row-${rowCounter}`
}

function ProposalBuilder({ editId, onBack, onSaved }) {
    const [stage, setStage] = useState(editId ? 'loading' : 'customer') // loading | customer | details
    const [customers, setCustomers] = useState([])
    const [customersStatus, setCustomersStatus] = useState(editId ? 'idle' : 'loading')
    const [customerSearch, setCustomerSearch] = useState('')
    const [customer, setCustomer] = useState(null) // { _id, name, propertyId, address }
    const [inventory, setInventory] = useState([])

    const [rows, setRows] = useState([]) // { key, itemType, inventoryItemId, name, quantity, unitPrice }
    const [laborCost, setLaborCost] = useState('')
    const [workDescription, setWorkDescription] = useState('')
    const [estimatedStartDate, setEstimatedStartDate] = useState('')
    const [validUntil, setValidUntil] = useState(daysFromToday(30))
    const [notes, setNotes] = useState('')
    const [miscDraft, setMiscDraft] = useState({ name: '', quantity: 1, unitPrice: '' })

    const [saveStatus, setSaveStatus] = useState('idle')
    const [saveError, setSaveError] = useState('')
    const [toast, setToast] = useState(null)

    useEffect(() => {
        fetch('/api/inventory')
            .then((res) => (res.ok ? res.json() : { items: [] }))
            .then((data) => setInventory(data.items || []))
            .catch(() => { })

        if (editId) {
            fetch(`/api/proposals?id=${encodeURIComponent(editId)}`)
                .then((res) => res.json())
                .then(({ proposal }) => {
                    setCustomer({
                        _id: proposal.customerId,
                        name: fullName(proposal.customerFirstName, proposal.customerLastName),
                        propertyId: proposal.propertyId,
                        address: proposal.propertyAddress,
                    })
                    setRows((proposal.lineItems || []).map((li) => ({ ...li, key: newRowKey() })))
                    setLaborCost(proposal.laborCost ? String(proposal.laborCost) : '')
                    setWorkDescription(proposal.workDescription || '')
                    setEstimatedStartDate(proposal.estimatedStartDate || '')
                    setValidUntil(proposal.validUntil || daysFromToday(30))
                    setNotes(proposal.notes || '')
                    setStage('details')
                })
                .catch(() => setSaveError('Couldn\'t load this proposal.'))
        } else {
            fetch('/api/customers')
                .then((res) => (res.ok ? res.json() : Promise.reject()))
                .then((data) => {
                    setCustomers(data.customers || [])
                    setCustomersStatus('ready')
                })
                .catch(() => setCustomersStatus('error'))
        }
    }, [editId])

    function pickCustomer(c) {
        setCustomer({
            _id: c._id,
            name: fullName(c.firstName, c.lastName),
            propertyId: c.property?._id,
            address: c.property?.address,
        })
        setStage('details')
    }

    function addCatalog(item) {
        setRows((prev) => {
            const existing = prev.find((r) => r.itemType === 'catalog' && r.inventoryItemId === item._id)
            if (existing) return prev.map((r) => (r === existing ? { ...r, quantity: (Number(r.quantity) || 1) + 1 } : r))
            return [...prev, { key: newRowKey(), itemType: 'catalog', inventoryItemId: item._id, name: item.name, quantity: 1, unitPrice: Number(item.sellPrice) || 0 }]
        })
        setToast(`${item.name} added`)
    }

    function addMisc() {
        if (!miscDraft.name.trim()) return
        setRows((prev) => [...prev, { key: newRowKey(), itemType: 'misc', name: miscDraft.name.trim(), quantity: Number(miscDraft.quantity) || 1, unitPrice: Number(miscDraft.unitPrice) || 0 }])
        setMiscDraft({ name: '', quantity: 1, unitPrice: '' })
    }

    function updateRow(key, changes) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)))
    }

    const partsTotal = rows.reduce((sum, r) => sum + (Number(r.unitPrice) || 0) * (Number(r.quantity) || 1), 0)
    const total = partsTotal + (Number(laborCost) || 0)

    async function save() {
        setSaveStatus('saving')
        setSaveError('')
        try {
            const payload = {
                customerId: customer._id,
                propertyId: customer.propertyId,
                workDescription,
                lineItems: rows.map((r) => ({
                    itemType: r.itemType,
                    inventoryItemId: r.inventoryItemId,
                    name: r.name,
                    quantity: Number(r.quantity) || 1,
                    unitPrice: Number(r.unitPrice) || 0,
                })),
                laborCost: Number(laborCost) || 0,
                estimatedStartDate: estimatedStartDate || undefined,
                validUntil: validUntil || undefined,
                notes,
            }
            const res = await fetch('/api/proposals', {
                method: editId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editId ? { ...payload, id: editId, action: 'edit' } : payload),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed')
            onSaved(editId || data.id)
        } catch (err) {
            setSaveError(err.message && err.message !== 'Failed' ? err.message : 'Something went wrong — try again.')
            setSaveStatus('error')
        }
    }

    const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm py-3 px-4 outline-none focus:border-blue'
    const labelClass = 'text-white/40 text-xs uppercase tracking-widest mb-1 block'
    const q = customerSearch.trim().toLowerCase()
    const filteredCustomers = customers.filter((c) => !q || fullName(c.firstName, c.lastName).toLowerCase().includes(q) || formatAddress(c.property?.address).toLowerCase().includes(q))

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <Toast message={toast} onDone={() => setToast(null)} />
            <div className="w-full max-w-2xl mx-auto">
                <button
                    onClick={() => (stage === 'details' && !editId ? setStage('customer') : onBack())}
                    className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
                >
                    ← Back
                </button>
                <h1 className="font-serif text-2xl text-white mb-6">{editId ? 'Edit Proposal' : 'New Proposal'}</h1>

                {stage === 'loading' && <p className="text-white/40 text-sm text-center py-10">{saveError || 'Loading...'}</p>}

                {stage === 'customer' && (
                    <>
                        <p className={labelClass}>Who is this proposal for?</p>
                        <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            placeholder="Search by name or address..."
                            className={`${inputClass} mb-3`}
                        />
                        <p className="text-white/30 text-xs mb-3">New customer? Add them first with the Intake wizard, then come back.</p>
                        {customersStatus === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                        {customersStatus === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load customers.</p>}
                        <div className="flex flex-col gap-2">
                            {filteredCustomers.map((c) => (
                                <button
                                    key={c._id}
                                    onClick={() => pickCustomer(c)}
                                    disabled={!c.property?._id}
                                    className="text-left bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                >
                                    <p className="text-white text-sm font-semibold">{fullName(c.firstName, c.lastName) || 'No name'}</p>
                                    <p className="text-white/40 text-xs mt-0.5">{formatAddress(c.property?.address) || 'No address on file — add one to their profile first'}</p>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {stage === 'details' && customer && (
                    <div className="flex flex-col gap-6">
                        <div className="bg-blue/20 border border-blue/40 rounded-xl px-4 py-3">
                            <p className="text-white text-sm font-semibold">{customer.name}</p>
                            <p className="text-white/60 text-xs">{formatAddress(customer.address)}</p>
                        </div>

                        <div>
                            <label className={labelClass}>Description of Work</label>
                            <textarea value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} placeholder="e.g. Replace well pump and pressure tank" className={`${inputClass} h-20 resize-none`} />
                        </div>

                        <div>
                            <label className={labelClass}>Items</label>
                            <p className="text-white/30 text-xs mb-2">The customer sees each item by name and quantity, with one total — no individual prices.</p>
                            <div className="flex flex-col gap-2 mb-3">
                                {rows.map((r) => (
                                    <div key={r.key} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm truncate">{r.name}</p>
                                            <p className="text-white/40 text-xs">{formatMoney(r.unitPrice)} each{r.itemType === 'misc' ? ' · one-off' : ''}</p>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            value={r.quantity}
                                            onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                                            aria-label="Quantity"
                                            className="w-16 bg-white/10 border border-white/10 rounded-lg text-white text-sm py-1 px-2 text-center"
                                        />
                                        <button onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="text-red-400 text-xs">
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                {rows.length === 0 && <p className="text-white/30 text-sm">No items yet.</p>}
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3">
                                <p className={labelClass}>Add From Catalog</p>
                                <CatalogPicker inventory={inventory} onPick={addCatalog} formatPrice={formatMoney} />
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
                                <p className={labelClass}>Or a one-off item</p>
                                <input type="text" value={miscDraft.name} onChange={(e) => setMiscDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Item name" className={inputClass} />
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        value={miscDraft.quantity}
                                        onChange={(e) => setMiscDraft((d) => ({ ...d, quantity: e.target.value }))}
                                        aria-label="Quantity"
                                        className="w-20 bg-white/5 border border-white/10 rounded-xl text-white text-sm py-3 px-3 text-center"
                                    />
                                    <div className="flex-1">
                                        <MoneyInput placeholder="Price each" value={miscDraft.unitPrice} onChange={(val) => setMiscDraft((d) => ({ ...d, unitPrice: val }))} />
                                    </div>
                                </div>
                                <button onClick={addMisc} className="w-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                                    + Add one-off item
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Labor</label>
                            <MoneyInput value={laborCost} onChange={setLaborCost} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Estimated Start (optional)</label>
                                <input type="date" value={estimatedStartDate} onChange={(e) => setEstimatedStartDate(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Good Until</label>
                                <input type="date" value={validUntil} min={todayIso()} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Notes to Customer (optional)</label>
                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-20 resize-none`} />
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-1">
                            <div className="flex justify-between text-white/60 text-sm"><span>Parts &amp; equipment</span><span>{formatMoney(partsTotal)}</span></div>
                            <div className="flex justify-between text-white/60 text-sm"><span>Labor</span><span>{formatMoney(laborCost)}</span></div>
                            <div className="flex justify-between text-white text-lg font-serif mt-1"><span>Total</span><span>{formatMoney(total)}</span></div>
                        </div>

                        {saveStatus === 'error' && <p className="text-red-400 text-sm text-center">{saveError}</p>}
                        <button
                            onClick={save}
                            disabled={saveStatus === 'saving' || (rows.length === 0 && !(Number(laborCost) > 0))}
                            className="w-full bg-blue hover:bg-blue-light disabled:opacity-40 text-white text-lg font-semibold py-4 rounded-xl transition-colors"
                        >
                            {saveStatus === 'saving' ? 'Saving...' : editId ? 'Save Changes' : 'Save Proposal'}
                        </button>
                        <p className="text-white/30 text-xs text-center">Saving keeps it as a draft — you'll send it to the customer from the next screen.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// One proposal: send it, and turn it into a job once accepted.
// ---------------------------------------------------------------------------
function ProposalDetail({ id, onBack, onEdit }) {
    const [proposal, setProposal] = useState(null)
    const [status, setStatus] = useState('loading')
    const [busy, setBusy] = useState(null) // 'send' | 'convert' | 'withdraw' | null
    const [error, setError] = useState('')
    const [toast, setToast] = useState(null)
    const [confirmConvert, setConfirmConvert] = useState(false)
    const [confirmWithdraw, setConfirmWithdraw] = useState(false)

    function load() {
        return fetch(`/api/proposals?id=${encodeURIComponent(id)}`)
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => {
                setProposal(data.proposal)
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        load()
    }, [id])

    async function patch(action, extra = {}) {
        const res = await fetch('/api/proposals', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action, ...extra }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed')
        return data
    }

    async function handleSend() {
        setBusy('send')
        setError('')
        try {
            const data = await patch('send')
            setToast(`Proposal emailed to ${data.emailedTo}`)
            await load()
        } catch (err) {
            setError(err.message)
        }
        setBusy(null)
    }

    async function handleWithdraw() {
        setBusy('withdraw')
        setError('')
        try {
            await patch('withdraw')
            setConfirmWithdraw(false)
            await load()
        } catch (err) {
            setError(err.message)
        }
        setBusy(null)
    }

    // Creates the job with the proposal's items, then links it back.
    async function handleConvert() {
        setBusy('convert')
        setError('')
        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: proposal.customerId,
                    propertyId: proposal.propertyId,
                    serviceDate: proposal.estimatedStartDate || todayIso(),
                    workPerformed: proposal.workDescription || '',
                    laborCost: Number(proposal.laborCost) || 0,
                    notes: `Created from accepted proposal ${proposal.proposalId}.`,
                    lineItems: (proposal.lineItems || []).map((li) =>
                        li.itemType === 'catalog' && li.inventoryItemId
                            ? { itemType: 'catalog', inventoryItemId: li.inventoryItemId, quantity: Number(li.quantity) || 1 }
                            : {
                                itemType: 'misc',
                                miscName: Number(li.quantity) > 1 ? `${li.quantity} × ${li.name}` : li.name,
                                miscSellPrice: (Number(li.unitPrice) || 0) * (Number(li.quantity) || 1),
                            }
                    ),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Couldn\'t create the job')
            await patch('linkInvoice', { invoiceId: data.id })
            setConfirmConvert(false)
            setToast(`Job #${data.invoiceNumber} created`)
            await load()
        } catch (err) {
            setError(err.message)
        }
        setBusy(null)
    }

    if (status === 'loading') return <div className="min-h-screen bg-navy flex items-center justify-center text-white/40 text-sm">Loading...</div>
    if (status === 'error') {
        return (
            <div className="min-h-screen bg-navy px-4 py-10 text-center">
                <p className="text-red-400 text-sm mb-4">Couldn't load this proposal.</p>
                <button onClick={onBack} className="text-white/60 text-sm">← Back</button>
            </div>
        )
    }

    const shown = displayStatus(proposal)
    const customerName = fullName(proposal.customerFirstName, proposal.customerLastName)
    // Catalog prices can change between the quote and the job.
    const priceChanges = (proposal.lineItems || []).filter(
        (li) => li.itemType === 'catalog' && li.currentPrice != null && Number(li.currentPrice) !== Number(li.unitPrice)
    )
    const canSend = ['draft', 'sent', 'viewed'].includes(proposal.status) && shown !== 'expired'
    const customerLink = `${window.location.origin}/proposal?id=${encodeURIComponent(proposal._id)}`

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <Toast message={toast} onDone={() => setToast(null)} />
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Proposals
                </button>

                <div className="flex items-start justify-between gap-3 mb-1">
                    <h1 className="font-serif text-2xl text-white">{proposal.proposalId}</h1>
                    <StatusPill status={shown} />
                </div>
                <p className="text-white/60 text-sm">{customerName}</p>
                <p className="text-white/40 text-xs mb-6">{formatAddress(proposal.propertyAddress)}</p>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4 flex flex-col gap-4">
                    {proposal.workDescription && <p className="text-white text-sm whitespace-pre-wrap">{proposal.workDescription}</p>}
                    <div className="flex flex-col gap-1">
                        {(proposal.lineItems || []).map((li) => (
                            <div key={li._key} className="flex justify-between gap-3 text-sm">
                                <span className="text-white">{li.quantity} × {li.name}</span>
                                <span className="text-white/50">{formatMoney((Number(li.unitPrice) || 0) * (Number(li.quantity) || 1))}</span>
                            </div>
                        ))}
                        {Number(proposal.laborCost) > 0 && (
                            <div className="flex justify-between gap-3 text-sm">
                                <span className="text-white">Labor</span>
                                <span className="text-white/50">{formatMoney(proposal.laborCost)}</span>
                            </div>
                        )}
                        <div className="flex justify-between gap-3 text-white text-lg font-serif border-t border-white/10 pt-2 mt-1">
                            <span>Total</span>
                            <span>{formatMoney(proposal.totalPrice)}</span>
                        </div>
                    </div>
                    <p className="text-white/40 text-xs">
                        {[proposal.estimatedStartDate ? `Estimated start ${proposal.estimatedStartDate}` : null, proposal.validUntil ? `Good until ${proposal.validUntil}` : null].filter(Boolean).join(' · ')}
                    </p>
                    {proposal.notes && <p className="text-white/60 text-xs italic whitespace-pre-wrap">{proposal.notes}</p>}
                </div>

                {proposal.status === 'accepted' && (
                    <div className="bg-brand-green/15 border border-brand-green/40 rounded-2xl p-5 mb-4">
                        <p className="text-brand-green text-sm font-semibold">
                            Accepted by {proposal.acceptedName} on {new Date(proposal.acceptedAt).toLocaleString()}
                        </p>
                        {proposal.invoiceNumber ? (
                            <p className="text-white/70 text-sm mt-2">Job #{proposal.invoiceNumber} was created from this proposal — find it under Invoices.</p>
                        ) : confirmConvert ? (
                            <div className="mt-3 flex flex-col gap-2">
                                <p className="text-white/70 text-sm">
                                    Creates a Not Started job for {customerName} with these items and labor, scheduled {proposal.estimatedStartDate || 'today'}.
                                </p>
                                {priceChanges.length > 0 && (
                                    <p className="text-accent text-xs">
                                        Catalog prices changed since this was quoted ({priceChanges.map((li) => `${li.name}: ${formatMoney(li.unitPrice)} → ${formatMoney(li.currentPrice)}`).join('; ')}). The job uses today's catalog prices — edit the job afterward if you're honoring the quote.
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={handleConvert} disabled={busy === 'convert'} className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl">
                                        {busy === 'convert' ? 'Creating...' : 'Create Job'}
                                    </button>
                                    <button onClick={() => setConfirmConvert(false)} className="flex-1 bg-white/5 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmConvert(true)} className="w-full mt-3 bg-blue hover:bg-blue-light text-white text-sm font-semibold py-3 rounded-xl">
                                Create Job from Proposal
                            </button>
                        )}
                    </div>
                )}

                {proposal.status === 'declined' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-4">
                        <p className="text-red-400 text-sm font-semibold">Declined {proposal.declinedAt ? new Date(proposal.declinedAt).toLocaleDateString() : ''}</p>
                        {proposal.declineReason && <p className="text-white/70 text-sm mt-1">"{proposal.declineReason}"</p>}
                    </div>
                )}

                {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

                <div className="flex flex-col gap-2">
                    {proposal.status === 'draft' && (
                        <button onClick={onEdit} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl">
                            Edit Draft
                        </button>
                    )}
                    {canSend && (
                        proposal.customerEmail ? (
                            <button onClick={handleSend} disabled={busy === 'send'} className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl">
                                {busy === 'send' ? 'Sending...' : `${proposal.status === 'draft' ? 'Email' : 'Resend'} to ${proposal.customerEmail}`}
                            </button>
                        ) : (
                            <p className="text-white/40 text-xs text-center">No email on file for this customer — add one to their profile to send this.</p>
                        )
                    )}
                    {proposal.status !== 'draft' && canSend && (
                        <p className="text-white/30 text-xs text-center break-all">Customer link: {customerLink}</p>
                    )}
                    {['draft', 'sent', 'viewed'].includes(proposal.status) && (
                        confirmWithdraw ? (
                            <div className="flex gap-2">
                                <button onClick={handleWithdraw} disabled={busy === 'withdraw'} className="flex-1 bg-red-500/80 text-white text-sm font-semibold py-2.5 rounded-xl">
                                    {busy === 'withdraw' ? 'Withdrawing...' : 'Yes, withdraw'}
                                </button>
                                <button onClick={() => setConfirmWithdraw(false)} className="flex-1 bg-white/5 border border-white/10 text-white text-sm py-2.5 rounded-xl">Keep it</button>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmWithdraw(true)} className="text-white/40 hover:text-white/70 text-xs py-2">
                                Withdraw proposal
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
