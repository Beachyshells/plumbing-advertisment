import { useState, useEffect } from 'react'
import emailjs from '@emailjs/browser'
import CustomerInvoiceWizard from './CustomerInvoiceWizard.jsx'
import { generateInvoicePdf } from './invoicePdf.js'
import { queuePendingEmail, syncPendingEmails } from './offlineQueue.js'
import EmployeesAdmin from './EmployeesAdmin.jsx'


function formatAddress(address) {
    if (!address || typeof address !== 'object') return ''
    const cityStateZip = [address.city, address.state].filter(Boolean).join(', ')
    return [address.street, [cityStateZip, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

export default function Desktop() {
    const [view, setView] = useState('hub') // hub | customers | service-call | invoices
    const [invoiceCustomer, setInvoiceCustomer] = useState(null) // pre-selected customer when "Add Job" is used

    const [viewCustomerId, setViewCustomerId] = useState(null)

    useEffect(() => {
        if (navigator.onLine) syncPendingEmails()
        const params = new URLSearchParams(window.location.search)
        const addJobFor = params.get('addJobFor')
        const viewCustomer = params.get('viewCustomer')

        if (addJobFor) {
            fetch(`/api/customers?id=${encodeURIComponent(addJobFor)}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    if (data?.customer) {
                        const fullName = `${data.customer.firstName || ''} ${data.customer.lastName || ''}`.trim()
                        setInvoiceCustomer({ id: data.customer._id, name: fullName, propertyId: data.customer.property?._id })
                        setView('service-call')
                    }
                })
                .catch(() => { })
        }

        if (viewCustomer) {
            setViewCustomerId(viewCustomer)
            setView('customers')
        }
    }, [])

    function goToAddJob(customer) {
        const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
        setInvoiceCustomer({ id: customer._id, name: fullName, propertyId: customer.property?._id })
        setView('service-call')
    }

    function backToHub() {
        setInvoiceCustomer(null)
        setView('hub')
    }

    if (view === 'customers') {
        return <CustomersView onBack={backToHub} onAddJob={goToAddJob} initialSelectedId={viewCustomerId} />
    }

    if (view === 'service-call') {
        return <CustomerInvoiceWizard onBack={backToHub} preselectedCustomer={invoiceCustomer} />
    }

    if (view === 'invoices') {
        return <InvoicesView onBack={backToHub} />
    }

    if (view === 'employees') {
        return <EmployeesAdmin onBack={backToHub} />
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="font-serif text-2xl text-white">Desktop</h1>
                    <p className="text-white/40 text-xs mt-1">Adirondack Advanced Water Solutions</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Tile
                        title="Customers"
                        subtitle="View and search all profiles"
                        onClick={() => setView('customers')}
                    />
                    <Tile
                        title="Service Call"
                        subtitle="Start a new job / invoice"
                        onClick={() => setView('service-call')}
                    />
                    <Tile
                        title="Invoices"
                        subtitle="Browse all invoices"
                        onClick={() => setView('invoices')}
                    />
                    <Tile
                        title="Employees"
                        subtitle="Roster, timecards, pay"
                        onClick={() => setView('employees')}
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

function CustomersView({ onBack, onAddJob, initialSelectedId }) {
    const [customers, setCustomers] = useState([])
    const [properties, setProperties] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState(initialSelectedId || null)
    const [selected, setSelected] = useState(null)
    const [selectedProperty, setSelectedProperty] = useState(null)
    const [searchMode, setSearchMode] = useState('name') // name | address

    useEffect(() => {
        if (!selectedId) {
            setSelected(null)
            return
        }
        fetch(`/api/customers?id=${encodeURIComponent(selectedId)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setSelected(data?.customer || null))
            .catch(() => setSelected(null))
    }, [selectedId])

    useEffect(() => {
        fetch('/api/customers')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load')
                return res.json()
            })
            .then((data) => {
                setCustomers(data.customers || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))

        fetch('/api/properties')
            .then((res) => (res.ok ? res.json() : { properties: [] }))
            .then((data) => setProperties(data.properties || []))
            .catch(() => { })
    }, [])

    const filtered = customers.filter((c) => {
        const q = search.trim().toLowerCase()
        if (!q) return true
        const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase()
        return fullName.includes(q) || formatAddress(c.property?.address).toLowerCase().includes(q)
    })

    const propertyMatches = properties.filter((p) => {
        const q = search.trim().toLowerCase()
        if (!q) return false
        return formatAddress(p.address).toLowerCase().includes(q)
    })

    if (selectedId) {
        if (!selected) {
            return (
                <div className="min-h-screen bg-navy flex items-center justify-center">
                    <p className="text-white/50 text-lg">Loading...</p>
                </div>
            )
        }
        return <CustomerCard customer={selected} onBack={() => setSelectedId(null)} onAddJob={onAddJob} />
    }

    if (selectedProperty) {
        return (
            <PropertyDetail
                property={selectedProperty}
                onBack={() => setSelectedProperty(null)}
                onViewCustomer={(id) => {
                    setSelectedProperty(null)
                    setSelectedId(id)
                }}
            />
        )
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

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="font-serif text-2xl text-white">Customers</h1>
                        <p className="text-white/40 text-xs mt-1">
                            {status === 'ready' ? `${customers.length} profile${customers.length === 1 ? '' : 's'}` : ''}
                        </p>
                    </div>
                    <a
                        href="/invoice"
                        className="bg-blue hover:bg-blue-light text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors active:scale-[0.98]"
                    >
                        + New Customer
                    </a>
                </div>

                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setSearchMode('name')}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${searchMode === 'name' ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'
                            }`}
                    >
                        By Name
                    </button>
                    <button
                        onClick={() => setSearchMode('address')}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${searchMode === 'address' ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'
                            }`}
                    >
                        By Address
                    </button>
                </div>

                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchMode === 'name' ? 'Search by name or phone...' : 'Search by address...'}
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

                {searchMode === 'name' && (
                    <div className="flex flex-col gap-3">
                        {filtered.map((c) => (
                            <button
                                key={c._id}
                                onClick={() => setSelectedId(c._id)}
                                className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-colors active:scale-[0.98]"
                            >
                                <p className="text-white text-lg font-serif">{c.firstName || c.lastName ? `${c.firstName} ${c.lastName}` : 'No name'}</p>
                                <p className="text-white/50 text-sm mt-1">{formatAddress(c.property?.address) || '—'}</p>
                                <p className="text-white/30 text-xs mt-1">{c.bestPhone || ''}</p>
                            </button>
                        ))}
                    </div>
                )}

                {searchMode === 'address' && (
                    <div className="flex flex-col gap-3">
                        {propertyMatches.map((p) => (
                            <button
                                key={p._id}
                                onClick={() => setSelectedProperty(p)}
                                className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-colors active:scale-[0.98]"
                            >
                                <p className="text-white text-lg font-serif">{formatAddress(p.address)}</p>
                                <p className="text-white/30 text-xs mt-1">Tap to see full history at this address</p>
                            </button>
                        ))}
                        {propertyMatches.length === 0 && search.trim() && (
                            <p className="text-white/40 text-sm text-center py-10">No matching address.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

const TABS = ['Overview', 'Site Access', 'Equipment', 'Service History', 'Contracts']

function CustomerCard({ customer, onBack, onAddJob }) {
    const [tab, setTab] = useState('Overview')
    const [invoices, setInvoices] = useState([])
    const [invoiceStatus, setInvoiceStatus] = useState('idle') // idle | loading | ready | error
    const [selectedInvoice, setSelectedInvoice] = useState(null)

    const [equipmentGroups, setEquipmentGroups] = useState([]) // [{ propertyId, address, equipment }]
    const [equipmentAggStatus, setEquipmentAggStatus] = useState('idle') // idle | loading | ready | error

    function fetchInvoices() {
        setInvoiceStatus('loading')
        fetch(`/api/invoices?customerId=${encodeURIComponent(customer._id)}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load')
                return res.json()
            })
            .then((data) => {
                setInvoices(data.invoices || [])
                setInvoiceStatus('ready')
            })
            .catch(() => setInvoiceStatus('error'))
    }

    useEffect(() => {
        if ((tab !== 'Service History' && tab !== 'Equipment') || invoiceStatus !== 'idle') return
        fetchInvoices()
    }, [tab])

    // Equipment belongs to the property, not the person — so once we know
    // every distinct property this customer has ever had a job at (from
    // their invoice history), we look up each one's equipment separately,
    // grouped by address, so a past house's equipment doesn't disappear
    // just because they moved.
    useEffect(() => {
        if (tab !== 'Equipment' || invoiceStatus !== 'ready' || equipmentAggStatus !== 'idle') return
        const distinctProperties = []
        const seen = new Set()
        invoices.forEach((inv) => {
            if (inv.propertyId && !seen.has(inv.propertyId)) {
                seen.add(inv.propertyId)
                distinctProperties.push({ propertyId: inv.propertyId, address: inv.propertyAddress })
            }
        })
        if (distinctProperties.length === 0) {
            setEquipmentGroups([])
            setEquipmentAggStatus('ready')
            return
        }
        setEquipmentAggStatus('loading')
        Promise.all(
            distinctProperties.map((p) =>
                fetch(`/api/properties?id=${encodeURIComponent(p.propertyId)}`)
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data) => ({ ...p, equipment: data?.property?.equipment || [] }))
                    .catch(() => ({ ...p, equipment: [] }))
            )
        ).then((groups) => {
            setEquipmentGroups(groups.filter((g) => g.equipment.length > 0))
            setEquipmentAggStatus('ready')
        })
    }, [tab, invoiceStatus])

    if (selectedInvoice) {
        return (
            <InvoiceDetail
                invoice={selectedInvoice}
                onBack={() => {
                    setSelectedInvoice(null)
                    fetchInvoices()
                }}
            />
        )
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button
                    onClick={onBack}
                    className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
                >
                    ← Customers
                </button>

                <div className="flex items-start justify-between mb-6 gap-3">
                    <div>
                        <h1 className="font-serif text-2xl text-white">{customer.firstName || customer.lastName ? `${customer.firstName} ${customer.lastName}` : 'No name'}</h1>
                        <p className="text-white/40 text-sm mt-1">{formatAddress(customer.property?.address) || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href={`/invoice?edit=${customer._id}`}
                            title="Edit profile"
                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-lg"
                        >
                            ✎
                        </a>
                        <button
                            onClick={() => onAddJob(customer)}
                            className="bg-blue hover:bg-blue-light text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors active:scale-[0.98] whitespace-nowrap"
                        >
                            + Add Job
                        </button>
                    </div>
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
                            <Field label="Service Address" value={formatAddress(customer.property?.address)} />
                            <Field label="Billing Address" value={formatAddress(customer.billingAddress)} />
                            <Field label="Well / Municipal" value={customer.property?.wellOrMunicipal} />
                            {Number(customer.creditBalance) > 0 && (
                                <div>
                                    <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Account Credit</p>
                                    <p className="text-brand-green text-lg">{formatMoney(customer.creditBalance)}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'Site Access' && (
                        <div className="flex flex-col gap-4">
                            <Field label="Gate Code / Key / Entry" value={customer.property?.gateCodeKeyEntry} />
                            <Field label="Dog?" value={customer.dog} />
                            <Field label="Main Shutoff Location" value={customer.property?.mainShutoffLocation} />
                            <Field label="Notes" value={customer.notes} />
                        </div>
                    )}

                    {tab === 'Service History' && (
                        <div className="flex flex-col gap-3">
                            {invoiceStatus === 'loading' && (
                                <p className="text-white/40 text-sm text-center py-6">Loading...</p>
                            )}
                            {invoiceStatus === 'error' && (
                                <p className="text-red-400 text-sm text-center py-6">Couldn't load service history.</p>
                            )}
                            {invoiceStatus === 'ready' && invoices.length === 0 && (
                                <p className="text-white/40 text-sm text-center py-6">No jobs yet — tap "+ Add Job" to start one.</p>
                            )}
                            {invoices.map((inv) => (
                                <button
                                    key={inv._id}
                                    onClick={() => setSelectedInvoice(inv)}
                                    className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-white text-sm">
                                            {inv.invoiceNumber ? `#${inv.invoiceNumber}` : 'Invoice'} — {inv.serviceDate || 'No date'}
                                        </p>
                                        <p className="text-white/50 text-sm">{inv.totalAmount != null ? formatMoney(inv.totalAmount) : ''}</p>
                                    </div>
                                    <p className="text-white/40 text-xs mt-1">{inv.workPerformed || 'No description'}</p>
                                    <p className="text-white/30 text-xs mt-1 capitalize">{inv.paymentStatus}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {tab === 'Equipment' && (
                        <div className="flex flex-col gap-5">
                            {equipmentAggStatus === 'loading' && (
                                <p className="text-white/40 text-sm text-center py-6">Loading...</p>
                            )}
                            {equipmentAggStatus === 'ready' && equipmentGroups.length === 0 && (
                                <p className="text-white/40 text-sm text-center py-6">No equipment on file for this customer's properties yet.</p>
                            )}
                            {equipmentGroups.map((group) => (
                                <div key={group.propertyId}>
                                    <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{formatAddress(group.address)}</p>
                                    <div className="flex flex-col gap-2">
                                        {group.equipment.map((item) => (
                                            <div key={item._key} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                                <p className="text-white text-base font-serif">
                                                    {[item.equipmentType, item.make, item.model].filter(Boolean).join(' — ') || 'Untitled unit'}
                                                </p>
                                                <p className="text-white/40 text-xs mt-0.5">
                                                    {[item.serialNumber ? `S/N ${item.serialNumber}` : null, item.installDate ? `Installed ${item.installDate}` : null]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </p>
                                                {item.warrantyExpires && <p className="text-white/40 text-xs">Warranty until {item.warrantyExpires}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'Contracts' && (
                        <p className="text-white/40 text-sm text-center py-10">
                            Nothing here yet — coming in a future update.
                        </p>
                    )}
                </div>
            </div>
        </div >
    )
}

function PropertyDetail({ property: initialProperty, onBack, onViewCustomer }) {
    const [property, setProperty] = useState(initialProperty)
    const [invoices, setInvoices] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState({
        street: property.address?.street || '',
        city: property.address?.city || '',
        state: property.address?.state || '',
        zip: property.address?.zip || '',
        wellOrMunicipal: property.wellOrMunicipal || '',
        gateCodeKeyEntry: property.gateCodeKeyEntry || '',
        mainShutoffLocation: property.mainShutoffLocation || '',
    })
    const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | error

    const [linkedCustomers, setLinkedCustomers] = useState([])

    const EMPTY_EQUIPMENT = {
        equipmentType: '', make: '', model: '', serialNumber: '',
        installDate: '', installedBy: '', warrantyExpires: '',
        filterPartNumber: '', filterSize: '', replaceEvery: '', lastChanged: '', notes: '',
    }
    const [equipmentEditing, setEquipmentEditing] = useState(null) // null | 'new' | <key of item being edited>
    const [equipmentDraft, setEquipmentDraft] = useState(EMPTY_EQUIPMENT)
    const [equipmentStatus, setEquipmentStatus] = useState('idle') // idle | saving | error

    function refreshProperty() {
        fetch(`/api/properties?id=${encodeURIComponent(property._id)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.property) setProperty(data.property)
            })
            .catch(() => { })
    }

    function fetchLinkedCustomers() {
        fetch(`/api/customers?propertyId=${encodeURIComponent(property._id)}`)
            .then((res) => (res.ok ? res.json() : { customers: [] }))
            .then((data) => setLinkedCustomers(data.customers || []))
            .catch(() => { })
    }

    function openNewEquipmentForm() {
        setEquipmentDraft(EMPTY_EQUIPMENT)
        setEquipmentEditing('new')
    }

    function openEditEquipmentForm(item) {
        setEquipmentDraft({
            equipmentType: item.equipmentType || '',
            make: item.make || '',
            model: item.model || '',
            serialNumber: item.serialNumber || '',
            installDate: item.installDate || '',
            installedBy: item.installedBy || '',
            warrantyExpires: item.warrantyExpires || '',
            filterPartNumber: item.filterPartNumber || '',
            filterSize: item.filterSize || '',
            replaceEvery: item.replaceEvery || '',
            lastChanged: item.lastChanged || '',
            notes: item.notes || '',
        })
        setEquipmentEditing(item._key)
    }

    async function handleSaveEquipment() {
        setEquipmentStatus('saving')
        try {
            const isNew = equipmentEditing === 'new'
            const res = await fetch('/api/properties', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    propertyId: property._id,
                    action: isNew ? 'addEquipment' : 'updateEquipment',
                    equipmentKey: isNew ? undefined : equipmentEditing,
                    equipment: equipmentDraft,
                }),
            })
            if (!res.ok) throw new Error('Failed')
            refreshProperty()
            setEquipmentEditing(null)
            setEquipmentStatus('idle')
        } catch (err) {
            console.error(err)
            setEquipmentStatus('error')
        }
    }

    async function handleDeleteEquipment(key) {
        try {
            await fetch('/api/properties', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ propertyId: property._id, action: 'deleteEquipment', equipmentKey: key }),
            })
            refreshProperty()
        } catch (err) {
            console.error(err)
        }
    }

    async function handleSaveEdit() {
        if (!draft.street.trim() || !draft.city.trim() || !draft.state.trim()) {
            setSaveStatus('error')
            return
        }
        setSaveStatus('saving')
        try {
            const res = await fetch('/api/properties', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    propertyId: property._id,
                    address: { street: draft.street, city: draft.city, state: draft.state, zip: draft.zip },
                    wellOrMunicipal: draft.wellOrMunicipal,
                    gateCodeKeyEntry: draft.gateCodeKeyEntry,
                    mainShutoffLocation: draft.mainShutoffLocation,
                }),
            })
            if (!res.ok) throw new Error('Failed')
            setProperty((prev) => ({
                ...prev,
                address: { street: draft.street, city: draft.city, state: draft.state, zip: draft.zip },
                wellOrMunicipal: draft.wellOrMunicipal,
                gateCodeKeyEntry: draft.gateCodeKeyEntry,
                mainShutoffLocation: draft.mainShutoffLocation,
            }))
            setEditing(false)
            setSaveStatus('idle')
            setToast('Property updated')
        } catch (err) {
            console.error(err)
            setSaveStatus('error')
        }
    }

    function fetchInvoices() {
        setStatus('loading')
        fetch(`/api/invoices?propertyId=${encodeURIComponent(property._id)}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load')
                return res.json()
            })
            .then((data) => {
                setInvoices(data.invoices || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        fetchInvoices()
        refreshProperty()
        fetchLinkedCustomers()
    }, [])

    if (selectedInvoice) {
        return (
            <InvoiceDetail
                invoice={selectedInvoice}
                onBack={() => {
                    setSelectedInvoice(null)
                    fetchInvoices()
                }}
            />
        )
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <Toast message={toast} onDone={() => setToast(null)} />
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Customers
                </button>

                <div className="flex items-start justify-between mb-6 gap-3">
                    <div>
                        <h1 className="font-serif text-2xl text-white">{formatAddress(property.address)}</h1>
                        <p className="text-white/40 text-sm mt-1">Property history — every job at this address, any owner</p>
                    </div>
                    {!editing && (
                        <button
                            onClick={() => setEditing(true)}
                            title="Edit property"
                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-lg shrink-0"
                        >
                            ✎
                        </button>
                    )}
                </div>
                <div className="mb-6">
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Customers at this address</p>
                    <div className="flex flex-wrap gap-2">
                        {linkedCustomers.length === 0 && (
                            <p className="text-white/40 text-sm">None found — this property may be unlinked.</p>
                        )}
                        {linkedCustomers.map((c) => (
                            <button
                                key={c._id}
                                onClick={() => onViewCustomer(c._id)}
                                className="bg-white/5 hover:bg-blue border border-white/10 hover:border-blue text-white text-sm px-4 py-2 rounded-full transition-colors"
                            >
                                {c.firstName} {c.lastName}
                            </button>
                        ))}
                    </div>
                </div>

                {editing ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 mb-6">
                        <input
                            type="text" placeholder="Street" value={draft.street}
                            onChange={(e) => setDraft((d) => ({ ...d, street: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="text" placeholder="City" value={draft.city}
                                onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="text" placeholder="State" value={draft.state}
                                onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                        </div>
                        <input
                            type="text" placeholder="ZIP" value={draft.zip}
                            onChange={(e) => setDraft((d) => ({ ...d, zip: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                        />
                        <div className="flex gap-2">
                            {['Well', 'Municipal', 'Not sure'].map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setDraft((d) => ({ ...d, wellOrMunicipal: opt }))}
                                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${draft.wellOrMunicipal === opt ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text" placeholder="Gate code / key / entry instructions" value={draft.gateCodeKeyEntry}
                            onChange={(e) => setDraft((d) => ({ ...d, gateCodeKeyEntry: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                        />

                        <input
                            type="text" placeholder="Main shutoff location" value={draft.mainShutoffLocation}
                            onChange={(e) => setDraft((d) => ({ ...d, mainShutoffLocation: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                        />
                        {saveStatus === 'error' && (
                            <p className="text-red-400 text-sm">Street, city, and state are required, or something went wrong saving.</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveEdit}
                                disabled={saveStatus === 'saving'}
                                className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                onClick={() => setEditing(false)}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 mb-6">
                        <Field label="Well / Municipal" value={property.wellOrMunicipal} />
                        <Field label="Gate Code / Key / Entry" value={property.gateCodeKeyEntry} />
                        <Field label="Main Shutoff Location" value={property.mainShutoffLocation} />
                        <p className="text-white/30 text-xs italic">Dog on site is tracked per-customer, not per-property — check the customer's profile.</p>
                    </div>
                )}
                <p className="text-white text-lg font-serif mb-4">Equipment</p>
                <div className="flex flex-col gap-3 mb-8">
                    {(property.equipment || []).map((item) => (
                        <div key={item._key} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                    <p className="text-white text-base font-serif">
                                        {[item.equipmentType, item.make, item.model].filter(Boolean).join(' — ') || 'Untitled unit'}
                                    </p>
                                    <p className="text-white/40 text-xs mt-0.5">
                                        {[item.serialNumber ? `S/N ${item.serialNumber}` : null, item.installDate ? `Installed ${item.installDate}` : null]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => openEditEquipmentForm(item)} className="text-white/40 hover:text-white text-sm">✎</button>
                                    <button onClick={() => handleDeleteEquipment(item._key)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/50">
                                {item.installedBy && <p>By: {item.installedBy}</p>}
                                {item.warrantyExpires && <p>Warranty until: {item.warrantyExpires}</p>}
                                {item.filterPartNumber && <p>Filter part: {item.filterPartNumber}</p>}
                                {item.filterSize && <p>Filter size: {item.filterSize}</p>}
                                {item.replaceEvery && <p>Replace every: {item.replaceEvery}</p>}
                                {item.lastChanged && <p>Last changed: {item.lastChanged}</p>}
                            </div>
                            {item.notes && <p className="text-white/40 text-xs mt-2 italic">{item.notes}</p>}
                        </div>
                    ))}
                    {(!property.equipment || property.equipment.length === 0) && equipmentEditing !== 'new' && (
                        <p className="text-white/40 text-sm">No equipment recorded yet.</p>
                    )}
                </div>

                {equipmentEditing ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 mb-8">
                        <p className="text-white text-lg font-serif mb-1">{equipmentEditing === 'new' ? 'Add Equipment' : 'Edit Equipment'}</p>
                        <input type="text" placeholder="Equipment type (e.g. Well pump)" value={equipmentDraft.equipmentType}
                            onChange={(e) => setEquipmentDraft((d) => ({ ...d, equipmentType: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Make" value={equipmentDraft.make}
                                onChange={(e) => setEquipmentDraft((d) => ({ ...d, make: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                            <input type="text" placeholder="Model" value={equipmentDraft.model}
                                onChange={(e) => setEquipmentDraft((d) => ({ ...d, model: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        </div>
                        <input type="text" placeholder="Serial number" value={equipmentDraft.serialNumber}
                            onChange={(e) => setEquipmentDraft((d) => ({ ...d, serialNumber: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-white/40 text-xs mb-1">Install date</p>
                                <input type="date" value={equipmentDraft.installDate}
                                    onChange={(e) => setEquipmentDraft((d) => ({ ...d, installDate: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                            </div>
                            <div>
                                <p className="text-white/40 text-xs mb-1">Warranty expires</p>
                                <input type="date" value={equipmentDraft.warrantyExpires}
                                    onChange={(e) => setEquipmentDraft((d) => ({ ...d, warrantyExpires: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                            </div>
                        </div>
                        <input type="text" placeholder="Installed by" value={equipmentDraft.installedBy}
                            onChange={(e) => setEquipmentDraft((d) => ({ ...d, installedBy: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Filter/cartridge part no." value={equipmentDraft.filterPartNumber}
                                onChange={(e) => setEquipmentDraft((d) => ({ ...d, filterPartNumber: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                            <input type="text" placeholder="Filter size" value={equipmentDraft.filterSize}
                                onChange={(e) => setEquipmentDraft((d) => ({ ...d, filterSize: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Replace every (e.g. 6 months)" value={equipmentDraft.replaceEvery}
                                onChange={(e) => setEquipmentDraft((d) => ({ ...d, replaceEvery: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                            <div>
                                <p className="text-white/40 text-xs mb-1">Last changed</p>
                                <input type="date" value={equipmentDraft.lastChanged}
                                    onChange={(e) => setEquipmentDraft((d) => ({ ...d, lastChanged: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                            </div>
                        </div>
                        <textarea placeholder="Notes" value={equipmentDraft.notes}
                            onChange={(e) => setEquipmentDraft((d) => ({ ...d, notes: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-20 resize-none" />
                        {equipmentStatus === 'error' && <p className="text-red-400 text-sm">Something went wrong saving.</p>}
                        <div className="flex gap-2">
                            <button onClick={handleSaveEquipment} disabled={equipmentStatus === 'saving'}
                                className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                {equipmentStatus === 'saving' ? 'Saving...' : 'Save Equipment'}
                            </button>
                            <button onClick={() => setEquipmentEditing(null)}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button onClick={openNewEquipmentForm}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl transition-colors mb-8">
                        + Add Equipment
                    </button>
                )}

                <p className="text-white text-lg font-serif mb-4">Service History</p>

                {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load history.</p>}
                {status === 'ready' && invoices.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-10">No jobs recorded at this address yet.</p>
                )}

                <div className="flex flex-col gap-3">
                    {invoices.map((inv) => (
                        <button
                            key={inv._id}
                            onClick={() => setSelectedInvoice(inv)}
                            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-colors active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-white text-sm">
                                    {inv.invoiceNumber ? `#${inv.invoiceNumber}` : 'Invoice'} — {inv.serviceDate || 'No date'}
                                </p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue/20 text-accent whitespace-nowrap">
                                    {inv.customerName || 'Unknown'}
                                </span>
                            </div>
                            <p className="text-white/40 text-xs mt-1">{inv.workPerformed || 'No description'}</p>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-white/30 text-xs">{formatMoney(inv.totalAmount)}</p>
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full capitalize ${inv.paymentStatus === 'paid'
                                        ? 'bg-brand-green/20 text-brand-green'
                                        : 'bg-accent/20 text-accent'
                                        }`}
                                >
                                    {inv.paymentStatus}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

function Field({ label, value }) {
    return (
        <div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{label}</p>
            <p className="text-white text-base">{value && value.trim && value.trim() ? value : '—'}</p>
        </div>
    )
}


// ---- Invoices: browsable list + unpaid/partial summary + detail view ----
function InvoicesView({ onBack }) {
    const [invoices, setInvoices] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState(null)

    function fetchInvoices() {
        fetch('/api/invoices')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load')
                return res.json()
            })
            .then((data) => {
                setInvoices(data.invoices || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        fetchInvoices()
    }, [])

    const outstandingTotal = invoices
        .filter((inv) => inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial')
        .reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0)

    const outstandingCount = invoices.filter((inv) => inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial').length

    const filtered = invoices.filter((inv) => {
        const q = search.trim().toLowerCase()
        if (!q) return true
        return (
            (inv.customerName || '').toLowerCase().includes(q) ||
            formatAddress(inv.propertyAddress).toLowerCase().includes(q) ||
            (inv.invoiceNumber || '').toLowerCase().includes(q)
        )
    })

    if (selected) {
        return (
            <InvoiceDetail
                invoice={selected}
                onBack={() => {
                    setSelected(null)
                    fetchInvoices()
                }}
            />
        )
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

                <div className="mb-6">
                    <h1 className="font-serif text-2xl text-white">Invoices</h1>
                    <p className="text-white/40 text-xs mt-1">
                        {status === 'ready' ? `${invoices.length} invoice${invoices.length === 1 ? '' : 's'}` : ''}
                    </p>
                </div>

                {status === 'ready' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Outstanding (unpaid + partial)</p>
                        <p className="text-white text-2xl font-serif">{formatMoney(outstandingTotal)}</p>
                        <p className="text-white/40 text-xs mt-1">
                            {outstandingCount} invoice{outstandingCount === 1 ? '' : 's'} not fully paid
                        </p>
                    </div>
                )}

                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, address, or invoice #..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-base py-3 px-4 outline-none focus:border-blue mb-6"
                />

                {status === 'loading' && (
                    <p className="text-white/40 text-sm text-center py-10">Loading...</p>
                )}

                {status === 'error' && (
                    <p className="text-red-400 text-sm text-center py-10">Couldn't load invoices — check your connection.</p>
                )}

                {status === 'ready' && filtered.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-10">
                        {invoices.length === 0 ? 'No invoices yet.' : 'No matches for that search.'}
                    </p>
                )}

                <div className="flex flex-col gap-3">
                    {filtered.map((inv) => (
                        <button
                            key={inv._id}
                            onClick={() => setSelected(inv)}
                            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-colors active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-white text-lg font-serif">
                                    {inv.invoiceNumber ? `#${inv.invoiceNumber}` : 'Invoice'} — {inv.customerName || 'No customer'}
                                </p>
                                <p className="text-white/70 text-sm">{formatMoney(inv.totalAmount)}</p>
                            </div>
                            <p className="text-white/50 text-sm mt-1">{formatAddress(inv.propertyAddress) || '—'}</p>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-white/30 text-xs">{inv.serviceDate || 'No date'}</p>
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full capitalize ${inv.paymentStatus === 'paid'
                                        ? 'bg-brand-green/20 text-brand-green'
                                        : 'bg-accent/20 text-accent'
                                        }`}
                                >
                                    {inv.paymentStatus}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

// View-only for now — editing a saved invoice (with the paid/partial "type
// edit to confirm" safeguard) is a planned follow-up, not built yet.
function InvoiceDetail({ invoice: initialInvoice, onBack }) {
    const [invoice, setInvoice] = useState(initialInvoice)
    const [toast, setToast] = useState(null)
    const [jobStatusUpdating, setJobStatusUpdating] = useState(false)
    const [customerCredit, setCustomerCredit] = useState(Number(initialInvoice.customerCredit) || 0)
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState('cash')
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [note, setNote] = useState('')
    const [checkNumber, setCheckNumber] = useState('')
    const [signee, setSignee] = useState('')
    const [status, setStatus] = useState('idle') // idle | saving | error
    const [emailStatus, setEmailStatus] = useState('idle') // idle | sending | sent | queued | no-email | error
    const [editGate, setEditGate] = useState('none') // none | confirming | editing
    const [confirmText, setConfirmText] = useState('')
    const [editData, setEditData] = useState(null)
    const [inventory, setInventory] = useState([])
    const [catalogSearchTerm, setCatalogSearchTerm] = useState('')
    const [miscDraft, setMiscDraft] = useState({ miscName: '', miscSellPrice: '', miscNote: '' })
    const [editStatus, setEditStatus] = useState('idle') // idle | loading | saving | error

    const payments = invoice.payments || []
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const balanceRemaining = (Number(invoice.totalAmount) || 0) - totalPaid

    async function handleApplyCredit() {
        setStatus('saving')
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'credit', invoiceId: invoice._id }),
            })
            if (!res.ok) throw new Error('Failed')
            const data = await res.json()
            setInvoice((prev) => ({
                ...prev,
                payments: [...(prev.payments || []), { amount: data.amountApplied, method: 'credit', date: new Date().toISOString().slice(0, 10), note: 'Applied from account credit' }],
                paymentStatus: data.paymentStatus,
            }))
            setCustomerCredit((prev) => prev - data.amountApplied)
            setStatus('idle')
            setToast('Credit applied')
        } catch (err) {
            console.error(err)
            setStatus('error')
        }
    }

    async function startEditing() {
        setEditStatus('loading')
        try {
            const [invoiceRes, inventoryRes] = await Promise.all([
                fetch(`/api/invoices?id=${invoice._id}`),
                fetch('/api/inventory'),
            ])
            const { invoice: fullInvoice } = await invoiceRes.json()
            const { items } = await inventoryRes.json()
            setInventory(items || [])
            setEditData({
                serviceDate: fullInvoice.serviceDate || '',
                workPerformed: fullInvoice.workPerformed || '',
                technician: fullInvoice.technician || '',
                laborCost: fullInvoice.laborCost || 0,
                notes: fullInvoice.notes || '',
                lineItems: (fullInvoice.lineItems || []).map((li, i) =>
                    li.itemType === 'misc'
                        ? { key: `existing-${i}`, itemType: 'misc', miscName: li.miscName, miscSellPrice: li.miscSellPrice, miscNote: li.miscNote }
                        : {
                            key: `existing-${i}`,
                            itemType: 'catalog',
                            inventoryItemId: li.inventoryItemId,
                            name: li.inventoryItemName,
                            unitPrice: li.inventoryItemPrice,
                            quantity: li.quantity,
                        }
                ),
            })
            setEditGate('editing')
            setEditStatus('idle')
        } catch (err) {
            console.error(err)
            setEditStatus('error')
        }
    }

    function handleEditClick() {
        if (invoice.paymentStatus === 'unpaid') {
            startEditing()
        } else {
            setEditGate('confirming')
        }
    }

    function confirmEdit() {
        if (confirmText.trim().toLowerCase() !== 'edit') return
        setConfirmText('')
        startEditing()
    }

    function addEditCatalogItem(item) {
        setEditData((prev) => ({
            ...prev,
            lineItems: [
                ...prev.lineItems,
                { key: `${item._id}-${Date.now()}`, itemType: 'catalog', inventoryItemId: item._id, name: item.name, unitPrice: item.sellPrice, quantity: 1 },
            ],
        }))
        setCatalogSearchTerm('')
    }

    function addEditMiscItem() {
        if (!miscDraft.miscName.trim()) return
        setEditData((prev) => ({
            ...prev,
            lineItems: [
                ...prev.lineItems,
                { key: `misc-${Date.now()}`, itemType: 'misc', miscName: miscDraft.miscName.trim(), miscSellPrice: Number(miscDraft.miscSellPrice) || 0, miscNote: miscDraft.miscNote.trim() },
            ],
        }))
        setMiscDraft({ miscName: '', miscSellPrice: '', miscNote: '' })
    }

    function removeEditLineItem(key) {
        setEditData((prev) => ({ ...prev, lineItems: prev.lineItems.filter((li) => li.key !== key) }))
    }

    function updateEditQuantity(key, quantity) {
        setEditData((prev) => ({
            ...prev,
            lineItems: prev.lineItems.map((li) => (li.key === key ? { ...li, quantity: Number(quantity) || 1 } : li)),
        }))
    }

    const editLineItemsTotal = editData
        ? editData.lineItems.reduce((sum, li) => (li.itemType === 'misc' ? sum + li.miscSellPrice : sum + li.unitPrice * (li.quantity || 1)), 0)
        : 0
    const editTotalAmount = editLineItemsTotal + (Number(editData?.laborCost) || 0)

    const filteredEditInventory = inventory.filter((item) => {
        const term = catalogSearchTerm.trim().toLowerCase()
        if (!term) return false
        return item.name?.toLowerCase().includes(term)
    })

    async function handleSaveEdit() {
        setEditStatus('saving')
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    invoiceId: invoice._id,
                    serviceDate: editData.serviceDate,
                    workPerformed: editData.workPerformed,
                    technician: editData.technician,
                    laborCost: Number(editData.laborCost) || 0,
                    notes: editData.notes,
                    lineItems: editData.lineItems.map((li) =>
                        li.itemType === 'misc'
                            ? { itemType: 'misc', miscName: li.miscName, miscSellPrice: li.miscSellPrice, miscNote: li.miscNote }
                            : { itemType: 'catalog', inventoryItemId: li.inventoryItemId, quantity: li.quantity }
                    ),
                }),
            })
            if (!res.ok) throw new Error('Failed')
            const data = await res.json()
            setInvoice((prev) => ({
                ...prev,
                serviceDate: editData.serviceDate,
                workPerformed: editData.workPerformed,
                totalAmount: data.totalAmount,
                paymentStatus: data.paymentStatus,
            }))
            setEditGate('none')
            setEditData(null)
            setEditStatus('idle')
            setToast('Invoice updated')
        } catch (err) {
            console.error(err)
            setEditStatus('error')
        }
    }

    async function handleEmailInvoice() {
        setEmailStatus('sending')
        try {
            const res = await fetch(`/api/invoices?id=${invoice._id}`)
            const { invoice: fullInvoice } = await res.json()

            if (!fullInvoice.customerEmail) {
                setEmailStatus('no-email')
                return
            }

            const items = fullInvoice.lineItems || []
            const partsTotal = items.reduce((sum, item) => {
                const price = item.itemType === 'misc' ? item.miscSellPrice : (item.inventoryItemPrice || 0) * (item.quantity || 1)
                return sum + (Number(price) || 0)
            }, 0)
            const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

            const templateParams = {
                email: fullInvoice.customerEmail,
                invoice_id: fullInvoice.invoiceNumber || '',
                orders: items.map((item) => ({
                    name: item.itemType === 'misc' ? item.miscName : item.inventoryItemName,
                    units: item.itemType === 'misc' ? 1 : item.quantity || 1,
                    price: (item.itemType === 'misc' ? item.miscSellPrice : (item.inventoryItemPrice || 0) * (item.quantity || 1)).toFixed(2),
                })),
                cost: {
                    labor: (Number(fullInvoice.laborCost) || 0).toFixed(2),
                    parts: partsTotal.toFixed(2),
                    total: (Number(fullInvoice.totalAmount) || 0).toFixed(2),
                    paid: totalPaid.toFixed(2),
                    balance: Math.max((Number(fullInvoice.totalAmount) || 0) - totalPaid, 0).toFixed(2),
                },
            }

            if (navigator.onLine) {
                await emailjs.send('ADK_SERVICES', 'template_7w7ntzo', templateParams, '7derGOKaoYJKZFxce')
                setEmailStatus('sent')
            } else {
                await queuePendingEmail(templateParams)
                setEmailStatus('queued')
            }
        } catch (err) {
            console.error(err)
            setEmailStatus('error')
        }
    }

    async function handleSetJobStatus(newStatus) {
        setJobStatusUpdating(true)
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setJobStatus', invoiceId: invoice._id, jobStatus: newStatus }),
            })
            if (!res.ok) throw new Error('Failed')
            setInvoice((prev) => ({ ...prev, jobStatus: newStatus }))
            setToast(newStatus === 'ongoing' ? 'Job started' : 'Job marked complete')
        } catch (err) {
            console.error(err)
        } finally {
            setJobStatusUpdating(false)
        }
    }

    async function handlePrintInvoice() {
        try {
            const res = await fetch(`/api/invoices?id=${invoice._id}`)
            const { invoice: fullInvoice } = await res.json()
            generateInvoicePdf({ ...invoice, ...fullInvoice })
        } catch (err) {
            console.error(err)
        }
    }

    async function handleRecordPayment() {
        const numericAmount = Number(amount)
        if (!numericAmount || numericAmount <= 0) return

        if (numericAmount > balanceRemaining) {
            const overage = numericAmount - balanceRemaining
            const confirmed = window.confirm(
                `This payment (${formatMoney(numericAmount)}) is more than what's owed (${formatMoney(balanceRemaining)}). ${formatMoney(overage)} will be added to this customer's account credit for future jobs. Continue?`
            )
            if (!confirmed) return
        }
        setStatus('saving')
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'payment', invoiceId: invoice._id, amount: numericAmount, method, date, note, checkNumber, signee }),
            })
            if (!res.ok) throw new Error('Failed')
            const data = await res.json()
            setInvoice((prev) => ({
                ...prev,
                payments: [...(prev.payments || []), { amount: numericAmount, method, date, note, checkNumber, signee }],
                paymentStatus: data.paymentStatus,
            }))
            if (data.creditAdded > 0) {
                setCustomerCredit((prev) => prev + data.creditAdded)
            }
            setAmount('')
            setNote('')
            setCheckNumber('')
            setSignee('')
            setStatus('idle')
            setToast(`${method === 'cash' ? 'Cash' : 'Check'} payment recorded`)
        } catch (err) {
            console.error(err)
            setStatus('error')
        }
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <Toast message={toast} onDone={() => setToast(null)} />
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Back
                </button>

                <div className="flex items-start justify-between mb-6 gap-3">
                    <div>
                        <h1 className="font-serif text-2xl text-white">
                            {invoice.invoiceNumber ? `Invoice #${invoice.invoiceNumber}` : 'Invoice'}
                        </h1>
                        <p className="text-white/40 text-sm mt-1">{invoice.customerName || 'No customer'}</p>
                    </div>
                    {editGate === 'none' && (
                        <button
                            onClick={handleEditClick}
                            title="Edit invoice"
                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-lg shrink-0"
                        >
                            ✎
                        </button>
                    )}
                </div>

                {editGate === 'confirming' && (
                    <div className="bg-white/5 border border-accent/40 rounded-2xl p-6 mb-6">
                        <p className="text-accent text-sm font-semibold mb-2 capitalize">
                            This invoice is marked {invoice.paymentStatus}.
                        </p>
                        <p className="text-white/60 text-sm mb-4">
                            Type "edit" below to confirm you want to change a {invoice.paymentStatus} invoice.
                        </p>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder='Type "edit"'
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-3"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={confirmEdit}
                                disabled={confirmText.trim().toLowerCase() !== 'edit'}
                                className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Continue
                            </button>
                            <button
                                onClick={() => { setEditGate('none'); setConfirmText('') }}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {editGate === 'editing' && editStatus === 'loading' && (
                    <p className="text-white/40 text-sm text-center py-6">Loading...</p>
                )}

                {editGate === 'editing' && editData && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                        <p className="text-white text-lg font-serif mb-4">Edit Invoice</p>
                        <div className="flex flex-col gap-3 mb-5">
                            <input
                                type="date"
                                value={editData.serviceDate}
                                onChange={(e) => setEditData((d) => ({ ...d, serviceDate: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <textarea
                                placeholder="Work performed"
                                value={editData.workPerformed}
                                onChange={(e) => setEditData((d) => ({ ...d, workPerformed: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-24 resize-none"
                            />
                            <input
                                type="text"
                                placeholder="Technician"
                                value={editData.technician}
                                onChange={(e) => setEditData((d) => ({ ...d, technician: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="number"
                                placeholder="Labor cost"
                                value={editData.laborCost}
                                onChange={(e) => setEditData((d) => ({ ...d, laborCost: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <textarea
                                placeholder="Notes"
                                value={editData.notes}
                                onChange={(e) => setEditData((d) => ({ ...d, notes: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-20 resize-none"
                            />
                        </div>

                        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Line items</p>
                        <div className="flex flex-col gap-2 mb-4">
                            {editData.lineItems.map((li) => (
                                <div key={li.key} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                                    <div className="flex-1">
                                        <p className="text-white text-sm">{li.itemType === 'misc' ? li.miscName : li.name}</p>
                                        {li.itemType === 'misc' ? (
                                            <p className="text-white/40 text-xs">{li.miscNote || 'One-off item'} · {formatMoney(li.miscSellPrice)}</p>
                                        ) : (
                                            <div className="flex items-center gap-2 mt-1">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={li.quantity}
                                                    onChange={(e) => updateEditQuantity(li.key, e.target.value)}
                                                    className="w-16 bg-white/10 border border-white/10 rounded-lg text-white text-sm py-1 px-2"
                                                />
                                                <p className="text-white/40 text-xs">× {formatMoney(li.unitPrice)}</p>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => removeEditLineItem(li.key)} className="text-red-400 text-sm">
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>

                        <input
                            type="text"
                            value={catalogSearchTerm}
                            onChange={(e) => setCatalogSearchTerm(e.target.value)}
                            placeholder="Search parts to add..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-2"
                        />
                        <div className="flex flex-col gap-2 mb-4">
                            {filteredEditInventory.map((item) => (
                                <button
                                    key={item._id}
                                    onClick={() => addEditCatalogItem(item)}
                                    className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                >
                                    <p className="text-white text-sm">{item.name}</p>
                                    <p className="text-white/40 text-xs">{formatMoney(item.sellPrice)}</p>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 mb-5">
                            <input
                                type="text"
                                placeholder="One-off item name"
                                value={miscDraft.miscName}
                                onChange={(e) => setMiscDraft((p) => ({ ...p, miscName: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="number"
                                placeholder="Sell price"
                                value={miscDraft.miscSellPrice}
                                onChange={(e) => setMiscDraft((p) => ({ ...p, miscSellPrice: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <button
                                onClick={addEditMiscItem}
                                className="w-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                            >
                                + Add one-off item
                            </button>
                        </div>

                        <p className="text-white text-right mb-4">New total: {formatMoney(editTotalAmount)}</p>

                        {editStatus === 'error' && <p className="text-red-400 text-sm text-center mb-3">Something went wrong — try again.</p>}

                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveEdit}
                                disabled={editStatus === 'saving'}
                                className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                {editStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                onClick={() => { setEditGate('none'); setEditData(null) }}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-white/40 text-xs uppercase tracking-widest">Job Status</p>
                        <p className={`text-sm font-semibold ${invoice.jobStatus === 'ongoing' ? 'text-brand-green' : invoice.jobStatus === 'complete' ? 'text-white/50' : 'text-accent'
                            }`}>
                            {invoice.jobStatus === 'ongoing' ? 'Ongoing' : invoice.jobStatus === 'complete' ? 'Complete' : 'Not Started'}
                        </p>
                    </div>
                    {invoice.jobStatus !== 'complete' && (
                        <button
                            onClick={() => handleSetJobStatus(invoice.jobStatus === 'ongoing' ? 'complete' : 'ongoing')}
                            disabled={jobStatusUpdating}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${invoice.jobStatus === 'ongoing' ? 'bg-blue hover:bg-blue-light text-white' : 'bg-brand-green hover:opacity-90 text-white'
                                }`}
                        >
                            {jobStatusUpdating ? 'Updating...' : invoice.jobStatus === 'ongoing' ? 'Complete Job' : 'Start Job'}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                        onClick={handlePrintInvoice}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                    >
                        Print Invoice (PDF)
                    </button>
                    <button
                        onClick={handleEmailInvoice}
                        disabled={emailStatus === 'sending'}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
                    >
                        {emailStatus === 'sending' ? 'Sending...' : 'Email Invoice'}
                    </button>
                </div>
                {emailStatus === 'sent' && <p className="text-brand-green text-xs text-center mb-6">Emailed to customer.</p>}
                {emailStatus === 'queued' && <p className="text-accent text-xs text-center mb-6">Offline — will send once you're back online.</p>}
                {emailStatus === 'no-email' && <p className="text-red-400 text-xs text-center mb-6">This customer has no email on file.</p>}
                {emailStatus === 'error' && <p className="text-red-400 text-xs text-center mb-6">Something went wrong sending.</p>}
                {!['sent', 'queued', 'no-email', 'error'].includes(emailStatus) && <div className="mb-6" />}

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 mb-6">
                    <Field label="Property Address" value={formatAddress(invoice.propertyAddress)} />
                    <Field label="Service Date" value={invoice.serviceDate} />
                    <Field label="Work Performed" value={invoice.workPerformed} />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Total</p>
                            <p className="text-white text-lg">{formatMoney(invoice.totalAmount)}</p>
                        </div>
                        <div>
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
                                {balanceRemaining < 0 ? 'Credit' : 'Balance Owed'}
                            </p>
                            <p className={`text-lg ${balanceRemaining > 0 ? 'text-accent' : 'text-brand-green'}`}>
                                {formatMoney(Math.abs(balanceRemaining))}
                            </p>
                        </div>
                    </div>
                    <div>
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Status</p>
                        <span
                            className={`inline-block text-sm px-3 py-1 rounded-full capitalize ${invoice.paymentStatus === 'paid'
                                ? 'bg-brand-green/20 text-brand-green'
                                : 'bg-accent/20 text-accent'
                                }`}
                        >
                            {invoice.paymentStatus}
                        </span>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                    <p className="text-white text-lg font-serif mb-4">Payment History</p>
                    {payments.length === 0 && (
                        <p className="text-white/40 text-sm text-center py-4">No payments recorded yet.</p>
                    )}
                    <div className="flex flex-col gap-2">
                        {payments.map((p, i) => (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-white text-sm capitalize">{p.method} — {formatMoney(p.amount)}</p>
                                    <p className="text-white/40 text-xs mt-0.5">{p.date}{p.note ? ` · ${p.note}` : ''}</p>
                                </div>
                                {p.photo && <span className="text-white/40 text-xs">📷</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {balanceRemaining > 0 && customerCredit > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                        <p className="text-white text-lg font-serif mb-1">Account Credit Available</p>
                        <p className="text-brand-green text-2xl font-serif mb-4">{formatMoney(customerCredit)}</p>
                        <button
                            onClick={handleApplyCredit}
                            disabled={status === 'saving'}
                            className="w-full bg-brand-green/20 hover:bg-brand-green/30 text-brand-green text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            Apply {formatMoney(Math.min(customerCredit, balanceRemaining))} Credit
                        </button>
                    </div>
                )}

                {balanceRemaining > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-lg font-serif mb-4">Record a Payment</p>
                        <div className="flex flex-col gap-3">
                            <input
                                type="number"
                                placeholder={`Amount (up to ${formatMoney(balanceRemaining)})`}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <div className="flex gap-2">
                                {['cash', 'check'].map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => setMethod(opt)}
                                        className={`flex-1 py-3 rounded-xl text-sm font-semibold capitalize transition-colors ${method === opt ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'
                                            }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            {method === 'check' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Check number"
                                        value={checkNumber}
                                        onChange={(e) => setCheckNumber(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Name on check"
                                        value={signee}
                                        onChange={(e) => setSignee(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                    />
                                </>
                            )}
                            <input
                                type="text"
                                placeholder="Note (optional)"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            {status === 'error' && <p className="text-red-400 text-sm text-center">Something went wrong — try again.</p>}
                            {status === 'error' && <p className="text-red-400 text-sm text-center">Something went wrong — try again.</p>}
                            <button
                                onClick={handleRecordPayment}
                                disabled={status === 'saving' || !amount}
                                className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                {status === 'saving' ? 'Saving...' : 'Record Payment'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}