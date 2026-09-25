import { useState, useEffect } from 'react'
import ContractWizard from './ContractWizard.jsx'
import ContractDetailView from './ContractDetailView.jsx'

function formatAddress(address) {
    if (!address || typeof address !== 'object') return ''
    const cityStateZip = [address.city, address.state].filter(Boolean).join(', ')
    return [address.street, [cityStateZip, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

function fullName(first, last) {
    return [first, last].filter(Boolean).join(' ')
}

// Same colors as the customer profile's Contracts tab, so a status looks
// the same everywhere.
const STATUS_BADGE = {
    draft: 'bg-white/10 text-white/60',
    sent: 'bg-accent/20 text-accent',
    viewed: 'bg-accent/20 text-accent',
    partiallySigned: 'bg-accent/20 text-accent',
    signed: 'bg-brand-green/20 text-brand-green',
    voided: 'bg-red-500/20 text-red-400 line-through',
}

const STATUS_LABEL = {
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    partiallySigned: 'Partially Signed',
    signed: 'Signed',
    voided: 'Voided',
}

// "Open" is everything still in progress — the list Michael actually needs
// to act on. It's the default so finished contracts don't bury new ones.
const FILTERS = [
    { key: 'open', label: 'Open', statuses: ['draft', 'sent', 'viewed', 'partiallySigned'] },
    { key: 'signed', label: 'Signed', statuses: ['signed'] },
    { key: 'voided', label: 'Voided', statuses: ['voided'] },
    { key: 'all', label: 'All', statuses: null },
]

function StatusPill({ status }) {
    return (
        <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[status] || 'bg-white/10 text-white/60'}`}>
            {STATUS_LABEL[status] || status}
        </span>
    )
}

export default function ContractsView({ onBack }) {
    const [contracts, setContracts] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [filter, setFilter] = useState('open')
    const [search, setSearch] = useState('')

    const [selectedContractId, setSelectedContractId] = useState(null)
    // Holds { _id, contractId, propertyId, invoiceId, customerId } of the
    // original when "+ Add Addendum" is pressed on a contract's page.
    const [addendumParent, setAddendumParent] = useState(null)
    const [creatingNew, setCreatingNew] = useState(false)

    function loadContracts() {
        return fetch('/api/contracts?all=true')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load')
                return res.json()
            })
            .then((data) => {
                setContracts(data.contracts || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    // Refreshes after coming back from a contract, so status changes
    // (signed, voided, linked) show up right away.
    function fetchContracts() {
        setStatus('loading')
        loadContracts()
    }

    // First load — status already starts as 'loading'.
    useEffect(() => {
        loadContracts()
    }, [])

    if (creatingNew) {
        return (
            <NewContractPicker
                onBack={() => setCreatingNew(false)}
                onCreated={(id) => {
                    setCreatingNew(false)
                    setSelectedContractId(id)
                    fetchContracts()
                }}
            />
        )
    }

    if (addendumParent) {
        return (
            <ContractWizard
                customerId={addendumParent.customerId}
                propertyId={addendumParent.propertyId}
                parentContract={addendumParent}
                onBack={() => setAddendumParent(null)}
                onCreated={(id) => {
                    setAddendumParent(null)
                    setSelectedContractId(id)
                    fetchContracts()
                }}
            />
        )
    }

    if (selectedContractId) {
        return (
            <ContractDetailView
                contractId={selectedContractId}
                onBack={() => {
                    setSelectedContractId(null)
                    fetchContracts()
                }}
                onOpenContract={(id) => setSelectedContractId(id)}
                onAddAddendum={(parent) => setAddendumParent(parent)}
            />
        )
    }

    // ---- Filtering, searching, and nesting ----
    const activeFilter = FILTERS.find((f) => f.key === filter)
    const q = search.trim().toLowerCase()

    function matchesSearch(c) {
        if (!q) return true
        return (
            fullName(c.customerFirstName, c.customerLastName).toLowerCase().includes(q) ||
            formatAddress(c.propertyAddress).toLowerCase().includes(q) ||
            (c.contractId || '').toLowerCase().includes(q)
        )
    }

    function matchesFilter(c) {
        return !activeFilter.statuses || activeFilter.statuses.includes(c.status)
    }

    const byId = new Map(contracts.map((c) => [c._id, c]))
    const childrenOf = (parentId) =>
        contracts
            .filter((a) => a.isAddendum && a.parentDocId === parentId)
            .sort((x, y) => (x.createdAt || '').localeCompare(y.createdAt || ''))

    // A group (an original plus its addenda) shows if the original OR any
    // addendum matches — so an open addendum on a signed original still
    // appears under "Open", with its original shown for context.
    const groups = contracts
        .filter((c) => !c.isAddendum || !byId.has(c.parentDocId))
        .map((c) => ({ ...c, children: childrenOf(c._id) }))
        .filter((g) => {
            const members = [g, ...g.children]
            return members.some(matchesFilter) && members.some(matchesSearch)
        })

    const counts = Object.fromEntries(
        FILTERS.map((f) => [f.key, f.statuses ? contracts.filter((c) => f.statuses.includes(c.status)).length : contracts.length])
    )

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Desktop
                </button>

                <div className="flex items-center justify-between mb-6 gap-3">
                    <h1 className="font-serif text-2xl text-white">Contracts</h1>
                    <button
                        onClick={() => setCreatingNew(true)}
                        className="bg-blue hover:bg-blue-light text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                    >
                        + New Contract
                    </button>
                </div>

                <div className="flex gap-2 mb-4 overflow-x-auto">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filter === f.key ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                                }`}
                        >
                            {f.label} ({counts[f.key]})
                        </button>
                    ))}
                </div>

                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, address, or contract number..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm py-3 px-4 outline-none focus:border-blue mb-4"
                />

                {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load contracts.</p>}
                {status === 'ready' && groups.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-10">
                        {contracts.length === 0 ? 'No contracts yet.' : 'No contracts match.'}
                    </p>
                )}

                {status === 'ready' && (
                    <div className="flex flex-col gap-3">
                        {groups.map((g) => (
                            <div key={g._id} className="flex flex-col gap-2">
                                <button
                                    onClick={() => setSelectedContractId(g._id)}
                                    className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-white text-sm font-semibold">
                                            {g.contractId}{g.isAddendum ? ' (Addendum)' : ''}
                                        </p>
                                        <StatusPill status={g.status} />
                                    </div>
                                    <p className="text-white/70 text-sm mt-1">{fullName(g.customerFirstName, g.customerLastName) || 'No customer'}</p>
                                    <p className="text-white/40 text-xs mt-0.5">
                                        {[g.templateName, formatAddress(g.propertyAddress), g.totalPrice != null ? formatMoney(g.totalPrice) : null]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </button>
                                {g.children.map((a) => (
                                    <button
                                        key={a._id}
                                        onClick={() => setSelectedContractId(a._id)}
                                        className="ml-6 text-left bg-white/5 hover:bg-white/10 border border-white/10 border-l-2 border-l-blue rounded-xl px-4 py-2.5 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-white text-sm font-semibold">↳ {a.contractId} (Addendum)</p>
                                            <StatusPill status={a.status} />
                                        </div>
                                        <p className="text-white/40 text-xs mt-0.5">
                                            {[a.templateName, a.totalPrice != null ? formatMoney(a.totalPrice) : null].filter(Boolean).join(' · ')}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// Starting a contract from the hub: pick the customer, then the specific
// job it's for. The job decides the property, and the contract is linked to
// that job's invoice — no guessing from the most recent job.
function NewContractPicker({ onBack, onCreated }) {
    const [stage, setStage] = useState('customer') // customer | job | wizard
    const [customers, setCustomers] = useState([])
    const [customersStatus, setCustomersStatus] = useState('loading') // loading | ready | error
    const [search, setSearch] = useState('')
    const [customer, setCustomer] = useState(null)

    const [jobs, setJobs] = useState([])
    const [jobsStatus, setJobsStatus] = useState('idle') // idle | loading | ready | error
    const [job, setJob] = useState(null)

    useEffect(() => {
        fetch('/api/customers')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load')
                return res.json()
            })
            .then((data) => {
                setCustomers(data.customers || [])
                setCustomersStatus('ready')
            })
            .catch(() => setCustomersStatus('error'))
    }, [])

    function pickCustomer(c) {
        setCustomer(c)
        setJob(null)
        setStage('job')
        setJobsStatus('loading')
        fetch(`/api/invoices?customerId=${encodeURIComponent(c._id)}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load')
                return res.json()
            })
            .then((data) => {
                setJobs(data.invoices || [])
                setJobsStatus('ready')
            })
            .catch(() => setJobsStatus('error'))
    }

    function pickJob(j) {
        setJob(j)
        setStage('wizard')
    }

    if (stage === 'wizard' && customer && job) {
        return (
            <ContractWizard
                customerId={customer._id}
                propertyId={job.propertyId}
                invoiceId={job._id}
                onBack={() => setStage('job')}
                onCreated={onCreated}
            />
        )
    }

    const q = search.trim().toLowerCase()
    const filteredCustomers = customers.filter((c) => {
        if (!q) return true
        return (
            fullName(c.firstName, c.lastName).toLowerCase().includes(q) ||
            fullName(c.additionalContactFirstName, c.additionalContactLastName).toLowerCase().includes(q) ||
            formatAddress(c.property?.address).toLowerCase().includes(q)
        )
    })

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button
                    onClick={() => (stage === 'job' ? setStage('customer') : onBack())}
                    className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
                >
                    ← Back
                </button>

                <h1 className="font-serif text-2xl text-white mb-6">New Contract</h1>

                {stage === 'customer' && (
                    <>
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Who is this contract for?</p>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or address..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm py-3 px-4 outline-none focus:border-blue mb-4"
                        />
                        {customersStatus === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                        {customersStatus === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load customers.</p>}
                        {customersStatus === 'ready' && filteredCustomers.length === 0 && (
                            <p className="text-white/40 text-sm text-center py-10">No customers match.</p>
                        )}
                        {customersStatus === 'ready' && (
                            <div className="flex flex-col gap-2">
                                {filteredCustomers.map((c) => (
                                    <button
                                        key={c._id}
                                        onClick={() => pickCustomer(c)}
                                        className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                    >
                                        <p className="text-white text-sm font-semibold">{fullName(c.firstName, c.lastName) || 'No name'}</p>
                                        <p className="text-white/40 text-xs mt-0.5">{formatAddress(c.property?.address) || '—'}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {stage === 'job' && customer && (
                    <>
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Which job is this contract for?</p>
                        <p className="text-white/70 text-sm mb-4">{fullName(customer.firstName, customer.lastName)}</p>
                        {jobsStatus === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                        {jobsStatus === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load this customer's jobs.</p>}
                        {jobsStatus === 'ready' && jobs.length === 0 && (
                            <p className="text-white/40 text-sm text-center py-10">
                                This customer has no jobs yet. Add a job from their profile (or Service Call) first — a contract needs a job so it knows which house it's for.
                            </p>
                        )}
                        {jobsStatus === 'ready' && jobs.length > 0 && (
                            <div className="flex flex-col gap-2">
                                {jobs.map((j) => (
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
                                        <p className="text-white/40 text-xs mt-0.5">{formatAddress(j.propertyAddress) || '—'}</p>
                                        {j.workPerformed && <p className="text-white/40 text-xs mt-0.5 line-clamp-1">{j.workPerformed}</p>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
