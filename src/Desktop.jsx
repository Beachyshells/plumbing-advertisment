import { useState, useEffect } from 'react'

export default function Desktop() {
    const [view, setView] = useState('hub') // hub | customers

    if (view === 'customers') {
        return <CustomersView onBack={() => setView('hub')} />
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="font-serif text-2xl text-white">Desktop</h1>
                    <p className="text-white/40 text-xs mt-1">Adirondack Advanced Water Solutions</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Tile
                        title="Customers"
                        subtitle="View and search all profiles"
                        onClick={() => setView('customers')}
                    />
                    <Tile
                        title="Invoices"
                        subtitle="Coming soon"
                        disabled
                    />
                    <Tile
                        title="Contracts"
                        subtitle="Coming soon"
                        disabled
                    />
                </div>
            </div>
        </div>
    )
}

function Tile({ title, subtitle, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`text-left rounded-2xl p-6 border transition-colors ${disabled
                ? 'bg-white/5 border-white/10 opacity-40 cursor-not-allowed'
                : 'bg-white/5 border-white/10 hover:bg-blue hover:border-blue cursor-pointer active:scale-[0.98]'
                }`}
        >
            <p className="text-white text-lg font-serif mb-1">{title}</p>
            <p className="text-white/40 text-xs">{subtitle}</p>
        </button>
    )
}

function CustomersView({ onBack }) {
    const [customers, setCustomers] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState(null)

    useEffect(() => {
        fetch('/api/get-customers')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load')
                return res.json()
            })
            .then((data) => {
                setCustomers(data.customers || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }, [])

    const filtered = customers.filter((c) => {
        const q = search.trim().toLowerCase()
        if (!q) return true
        return (
            (c.name || '').toLowerCase().includes(q) ||
            (c.serviceAddress || '').toLowerCase().includes(q)
        )
    })

    if (selected) {
        return <CustomerCard customer={selected} onBack={() => setSelected(null)} />
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button
                    onClick={onBack}
                    className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
                >
                    ← Desktop
                </button>

                <div className="mb-8">
                    <h1 className="font-serif text-2xl text-white">Customers</h1>
                    <p className="text-white/40 text-xs mt-1">
                        {status === 'ready' ? `${customers.length} profile${customers.length === 1 ? '' : 's'}` : ''}
                    </p>
                </div>

                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or town..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-base py-3 px-4 outline-none focus:border-blue mb-6"
                />

                {status === 'loading' && (
                    <p className="text-white/40 text-sm text-center py-10">Loading...</p>
                )}

                {status === 'error' && (
                    <p className="text-red-400 text-sm text-center py-10">Couldn't load customers — check your connection.</p>
                )}

                {status === 'ready' && filtered.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-10">
                        {customers.length === 0 ? 'No customers yet.' : 'No matches for that search.'}
                    </p>
                )}

                <div className="flex flex-col gap-3">
                    {filtered.map((c) => (
                        <button
                            key={c._id}
                            onClick={() => setSelected(c)}
                            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-colors active:scale-[0.98]"
                        >
                            <p className="text-white text-lg font-serif">{c.name || 'No name'}</p>
                            <p className="text-white/50 text-sm mt-1">{c.serviceAddress || '—'}</p>
                            <p className="text-white/30 text-xs mt-1">{c.bestPhone || ''}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

const TABS = ['Overview', 'Site Access', 'Equipment', 'Service History', 'Contracts']

function CustomerCard({ customer, onBack }) {
    const [tab, setTab] = useState('Overview')

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button
                    onClick={onBack}
                    className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
                >
                    ← Customers
                </button>

                <div className="mb-6">
                    <h1 className="font-serif text-2xl text-white">{customer.name || 'No name'}</h1>
                    <p className="text-white/40 text-sm mt-1">{customer.serviceAddress || '—'}</p>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                    {TABS.map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`shrink-0 px-4 py-2 rounded-full text-sm transition-colors ${tab === t
                                ? 'bg-blue text-white'
                                : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/10'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    {tab === 'Overview' && (
                        <div className="flex flex-col gap-4">
                            <Field label="Best Phone" value={customer.bestPhone} />
                            <Field label="Alt Phone" value={customer.altPhone} />
                            <Field label="Email" value={customer.email} />
                            <Field label="Service Address" value={customer.serviceAddress} />
                            <Field label="Billing Address" value={customer.billingAddress} />
                            <Field label="Well / Municipal" value={customer.wellOrMunicipal} />
                        </div>
                    )}

                    {tab === 'Site Access' && (
                        <div className="flex flex-col gap-4">
                            <Field label="Gate Code / Key / Entry" value={customer.gateCodeKeyEntry} />
                            <Field label="Dog?" value={customer.dog} />
                            <Field label="Main Shutoff Location" value={customer.mainShutoffLocation} />
                            <Field label="Notes" value={customer.notes} />
                        </div>
                    )}

                    {(tab === 'Equipment' || tab === 'Service History' || tab === 'Contracts') && (
                        <p className="text-white/40 text-sm text-center py-10">
                            Nothing here yet — coming in a future update.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

function Field({ label, value }) {
    return (
        <div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{label}</p>
            <p className="text-white text-base">{value && value.trim() ? value : '—'}</p>
        </div>
    )
}