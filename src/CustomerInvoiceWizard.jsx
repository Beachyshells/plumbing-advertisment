import { useState, useEffect, useRef } from 'react'
import {
    cacheCustomers,
    getCachedCustomers,
    cacheInventory,
    getCachedInventory,
    queuePendingInvoice,
    syncPendingData,
    countPendingItems,
} from './offlineQueue'
import { generateInvoicePdf } from './invoicePdf.js'
import Toast from './Toast.jsx'

const EMPTY_NEW_CUSTOMER = { firstName: '', lastName: '', bestPhone: '' }

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

function formatAddress(address) {
    if (!address || (!address.street && !address.city && !address.state && !address.zip)) return ''
    const cityStateZip = [address.city, address.state].filter(Boolean).join(', ')
    return [address.street, [cityStateZip, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

export default function CustomerInvoiceWizard({ onBack, preselectedCustomer }) {
    const [stage, setStage] = useState(preselectedCustomer ? 'job-details' : 'customer-search')
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [pendingCount, setPendingCount] = useState(0)

    const [customers, setCustomers] = useState([])
    const [inventory, setInventory] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState(
        preselectedCustomer
            ? { id: preselectedCustomer.id, name: preselectedCustomer.name, propertyId: preselectedCustomer.propertyId, isLocal: false }
            : null
    ) // { id, name, propertyId, isLocal }
    const [newCustomer, setNewCustomer] = useState(EMPTY_NEW_CUSTOMER)
    const [properties, setProperties] = useState([])
    const [propertySearchTerm, setPropertySearchTerm] = useState('')
    const [newPropertyDraft, setNewPropertyDraft] = useState({ street: '', city: '', state: '', zip: '' })
    const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [workPerformed, setWorkPerformed] = useState('')
    const [technician, setTechnician] = useState('')
    const [laborCost, setLaborCost] = useState('')
    const [paymentStatus, setPaymentStatus] = useState('unpaid')
    const [notes, setNotes] = useState('')

    const [lineItems, setLineItems] = useState([])
    const [toast, setToast] = useState(null)
    const [catalogSearchTerm, setCatalogSearchTerm] = useState('')
    const [catalogOpen, setCatalogOpen] = useState(false)
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [miscDraft, setMiscDraft] = useState({ miscName: '', miscSellPrice: '', miscNote: '' })

    const [receipts, setReceipts] = useState([]) // array of base64 data URLs
    const fileInputRef = useRef(null)

    const [saveMessage, setSaveMessage] = useState('')
    const [status, setStatus] = useState('idle') // idle | saving | error
    const [savedInvoiceId, setSavedInvoiceId] = useState(null)
    const [savedInvoiceNumber, setSavedInvoiceNumber] = useState(null)
    const [equipmentPrompts, setEquipmentPrompts] = useState([]) // [{ name, inventoryItemId }]
    const [equipmentPromptIndex, setEquipmentPromptIndex] = useState(0)
    const [equipmentLogDraft, setEquipmentLogDraft] = useState({ equipmentType: '', serialNumber: '', installDate: '', warrantyExpires: '', notes: '' })
    const [equipmentLogStatus, setEquipmentLogStatus] = useState('idle') // idle | saving | error
    // Load cached data immediately (works offline), then refresh from the
    // server whenever we're online, and try to flush anything queued.
    useEffect(() => {
        getCachedCustomers().then(setCustomers).catch(() => { })
        getCachedInventory().then(setInventory).catch(() => { })
        refreshFromServerAndSync()

        const handleOnline = () => {
            setIsOnline(true)
            refreshFromServerAndSync()
        }
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    async function refreshFromServerAndSync() {
        if (!navigator.onLine) return
        try {
            await syncPendingData()
            const [customersRes, inventoryRes, propertiesRes] = await Promise.all([
                fetch('/api/customers'), fetch('/api/inventory'), fetch('/api/properties'),
            ])
            if (customersRes.ok) {
                const { customers: freshCustomers } = await customersRes.json()
                await cacheCustomers(freshCustomers)
                setCustomers(freshCustomers)
            }
            if (inventoryRes.ok) {
                const { items } = await inventoryRes.json()
                await cacheInventory(items)
                setInventory(items)
            }
            if (propertiesRes.ok) {
                const { properties: freshProperties } = await propertiesRes.json()
                setProperties(freshProperties || [])
            }
        } catch (err) {
            console.error('Refresh/sync failed:', err)
        } finally {
            countPendingItems().then(setPendingCount).catch(() => { })
        }
    }

    const filteredCustomers = customers.filter((c) => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return false
        const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase()
        const additionalFirst = (c.additionalContactFirstName || '').toLowerCase()
        const additionalLast = (c.additionalContactLastName || '').toLowerCase()
        return fullName.includes(term) || additionalFirst.includes(term) || additionalLast.includes(term) || c.bestPhone?.includes(term)
    })


    const CATEGORY_PILLS = ['All', 'Equipment', 'Plumbing', 'Electrical', 'Heating', 'Other']

    const filteredInventory = inventory
        .filter((item) => {
            if (categoryFilter === 'all') return true
            if (categoryFilter === 'Equipment') return item.isEquipment
            return item.category === categoryFilter
        })
        .filter((item) => {
            const term = catalogSearchTerm.trim().toLowerCase()
            if (!term) return true
            return item.name?.toLowerCase().includes(term)
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    function selectExistingCustomer(customer) {
        const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
        setSelectedCustomer({ id: customer._id, name: fullName, propertyId: customer.property?._id, isLocal: false })
        setStage('job-details')
    }

    const [existingCustomerMatches, setExistingCustomerMatches] = useState([])

    async function checkForExistingCustomer() {
        const { firstName, lastName, bestPhone } = newCustomer
        if (!firstName.trim() || !lastName.trim() || !bestPhone.trim()) {
            setSaveMessage('First name, last name, and phone are all needed to continue.')
            return
        }
        setSaveMessage('')
        try {
            const res = await fetch(`/api/customers?search=${encodeURIComponent(lastName.trim())}`)
            const data = await res.json()
            setExistingCustomerMatches(data.customers || [])
        } catch (err) {
            setExistingCustomerMatches([])
        }
        setStage('new-customer-check')
    }

    function useExistingCustomer(customer) {
        const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
        setSelectedCustomer({ id: customer._id, name: fullName, propertyId: customer.property?._id, isLocal: false })
        setStage('job-details')
    }

    async function createCustomerWithProperty(propertyId) {
        setSaveMessage('')
        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: newCustomer.firstName.trim(),
                    lastName: newCustomer.lastName.trim(),
                    bestPhone: newCustomer.bestPhone.trim(),
                    propertyId,
                    status: 'incomplete',
                }),
            })
            if (!res.ok) throw new Error('Customer save failed')
            const { id } = await res.json()
            const fullName = `${newCustomer.firstName.trim()} ${newCustomer.lastName.trim()}`
            setSelectedCustomer({ id, name: fullName, propertyId, isLocal: false })
            setStage('job-details')
        } catch (err) {
            console.error(err)
            setSaveMessage('Could not save — check your connection and try again.')
        }
    }

    function startNewPropertyForCustomer() {
        setNewPropertyDraft((prev) => ({ ...prev, street: propertySearchTerm }))
        setStage('new-customer-property-new')
    }

    async function submitNewPropertyAndCreateCustomer() {
        const { street, city, state } = newPropertyDraft
        if (!street.trim() || !city.trim() || !state.trim()) {
            setSaveMessage('Street, city, and state are needed to continue.')
            return
        }
        setSaveMessage('')
        try {
            const propRes = await fetch('/api/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: { street: street.trim(), city: city.trim(), state: state.trim(), zip: newPropertyDraft.zip.trim() },
                }),
            })
            if (!propRes.ok) throw new Error('Property save failed')
            const { id: propertyId } = await propRes.json()
            await createCustomerWithProperty(propertyId)
        } catch (err) {
            console.error(err)
            setSaveMessage('Could not save — check your connection and try again.')
        }
    }

    const propertyMatchesForNewCustomer = properties.filter((p) => {
        const term = propertySearchTerm.trim().toLowerCase()
        if (!term) return false
        return formatAddress(p.address).toLowerCase().includes(term)
    })

    function addCatalogLineItem(item) {
        setLineItems((prev) => [
            ...prev,
            { key: `${item._id}-${Date.now()}`, itemType: 'catalog', inventoryItemId: item._id, name: item.name, unitPrice: item.sellPrice, quantity: 1 },
        ])
        setCatalogSearchTerm('')
        setToast(`${item.name} added`)
    }

    function addMiscLineItem() {
        if (!miscDraft.miscName.trim()) return
        setLineItems((prev) => [
            ...prev,
            {
                key: `misc-${Date.now()}`,
                itemType: 'misc',
                miscName: miscDraft.miscName.trim(),
                miscSellPrice: Number(miscDraft.miscSellPrice) || 0,
                miscNote: miscDraft.miscNote.trim(),
            },
        ])
        setToast(`${miscDraft.miscName.trim()} added`)
        setMiscDraft({ miscName: '', miscSellPrice: '', miscNote: '' })
    }

    function removeLineItem(key) {
        setLineItems((prev) => prev.filter((li) => li.key !== key))
    }

    function updateLineItemQuantity(key, quantity) {
        setLineItems((prev) => prev.map((li) => (li.key === key ? { ...li, quantity: Number(quantity) || 1 } : li)))
    }

    const lineItemsTotal = lineItems.reduce((sum, li) => {
        if (li.itemType === 'misc') return sum + li.miscSellPrice
        return sum + li.unitPrice * (li.quantity || 1)
    }, 0)
    const totalAmount = lineItemsTotal + (Number(laborCost) || 0)

    function handleReceiptFiles(fileList) {
        Array.from(fileList).forEach((file) => {
            const reader = new FileReader()
            reader.onloadend = () => setReceipts((prev) => [...prev, reader.result])
            reader.readAsDataURL(file)
        })
    }

    function removeReceipt(index) {
        setReceipts((prev) => prev.filter((_, i) => i !== index))
    }

    async function handleSaveInvoice(startNow) {
        setStatus('saving')
        setSaveMessage('')

        const payload = {
            customerId: selectedCustomer.id,
            propertyId: selectedCustomer.propertyId,
            serviceDate,
            workPerformed,
            technician,
            lineItems: lineItems.map((li) =>
                li.itemType === 'misc'
                    ? { itemType: 'misc', miscName: li.miscName, miscSellPrice: li.miscSellPrice, miscNote: li.miscNote }
                    : { itemType: 'catalog', inventoryItemId: li.inventoryItemId, quantity: li.quantity }
            ),
            laborCost: Number(laborCost) || 0,
            paymentStatus,
            startNow,
            notes,
            receipts,
        }

        const canSaveLive = navigator.onLine && !selectedCustomer.isLocal

        if (canSaveLive) {
            try {
                const res = await fetch('/api/invoices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error('Save failed')
                const savedData = await res.json()
                setSavedInvoiceId(savedData.id)
                setSavedInvoiceNumber(savedData.invoiceNumber)
                setStatus('idle')
                setSaveMessage('Invoice saved.')

                // If any catalog line item is flagged as trackable equipment,
                // walk through a quick prompt to log its serial number and
                // warranty before finishing — instead of requiring a separate
                // trip to Property Detail afterward.
                const flagged = lineItems
                    .filter((li) => li.itemType === 'catalog')
                    .map((li) => {
                        const invItem = inventory.find((i) => i._id === li.inventoryItemId)
                        return invItem?.isEquipment ? { name: invItem.name, inventoryItemId: invItem._id } : null
                    })
                    .filter(Boolean)

                if (flagged.length > 0) {
                    setEquipmentPrompts(flagged)
                    setEquipmentPromptIndex(0)
                    setEquipmentLogDraft({ equipmentType: flagged[0].name, serialNumber: '', installDate: serviceDate, warrantyExpires: '', notes: '' })
                    setStage('equipment-prompt')
                } else {
                    setStage('done')
                }
                return
            } catch (err) {
                console.error(err)
                // fall through to offline queueing below
            }
        }

        // Offline, or attached to a customer that hasn't synced yet — queue
        // the invoice locally and let it sync automatically later.
        await queuePendingInvoice(payload)
        countPendingItems().then(setPendingCount).catch(() => { })
        setStatus('idle')
        setStage('done')
        setSaveMessage("Saved locally — will upload once you're back online.")
    }

    async function handleLogEquipment(skip) {
        if (!skip) {
            setEquipmentLogStatus('saving')
            try {
                const res = await fetch('/api/properties', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        propertyId: selectedCustomer.propertyId,
                        action: 'addEquipment',
                        equipment: equipmentLogDraft,
                    }),
                })
                if (!res.ok) throw new Error('Failed')
            } catch (err) {
                console.error(err)
                setEquipmentLogStatus('error')
                return
            }
        }

        const nextIndex = equipmentPromptIndex + 1
        if (nextIndex < equipmentPrompts.length) {
            setEquipmentPromptIndex(nextIndex)
            setEquipmentLogDraft({ equipmentType: equipmentPrompts[nextIndex].name, serialNumber: '', installDate: serviceDate, warrantyExpires: '', notes: '' })
            setEquipmentLogStatus('idle')
        } else {
            setEquipmentLogStatus('idle')
            setStage('done')
        }
    }

    function startOver() {
        setStage('customer-search')
        setSearchTerm('')
        setSelectedCustomer(null)
        setNewCustomer(EMPTY_NEW_CUSTOMER)
        setServiceDate(new Date().toISOString().slice(0, 10))
        setWorkPerformed('')
        setTechnician('')
        setLaborCost('')
        setPaymentStatus('unpaid')
        setNotes('')
        setLineItems([])
        setReceipts([])
        setSaveMessage('')
    }

    return (
        <div className="min-h-screen bg-navy flex flex-col items-center px-4 py-10">
            <Toast message={toast} onDone={() => setToast(null)} />
            <div className="w-full max-w-lg">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
                    >
                        ← Desktop
                    </button>
                )}
                <div className="text-center mb-6">
                    <h1 className="font-serif text-2xl text-white">New Job / Invoice</h1>
                    <p className="text-white/40 text-xs mt-1">Adirondack Advanced Water Solutions</p>
                </div>

                {!isOnline && (
                    <p className="text-accent text-xs text-center mb-4 bg-white/5 border border-white/10 rounded-lg py-2">
                        Offline — anything you save now will upload automatically once you're back online.
                    </p>
                )}
                {isOnline && pendingCount > 0 && (
                    <p className="text-accent text-xs text-center mb-4 bg-white/5 border border-white/10 rounded-lg py-2">
                        Syncing {pendingCount} item{pendingCount === 1 ? '' : 's'} saved while offline...
                    </p>
                )}

                {/* ---- Customer search ---- */}
                {stage === 'customer-search' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-4">Who's this job for?</p>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name or phone..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-3"
                        />
                        <div className="flex flex-col gap-2 mb-4">
                            {filteredCustomers.map((c) => (
                                <button
                                    key={c._id}
                                    onClick={() => selectExistingCustomer(c)}
                                    className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                >
                                    <p className="text-white text-sm">{c.firstName} {c.lastName}</p>
                                    <p className="text-white/40 text-xs">{c.bestPhone}</p>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setStage('new-customer')}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            + New Customer
                        </button>
                    </div>
                )}

                {/* ---- New customer (minimal required fields) ---- */}
                {stage === 'new-customer' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-1">New customer</p>
                        <p className="text-white/40 text-xs mb-4">
                            Just enough to start the job — the rest of the profile can be filled in later.
                        </p>
                        <div className="flex flex-col gap-3">
                            <input
                                type="text"
                                placeholder="First name"
                                value={newCustomer.firstName}
                                onChange={(e) => setNewCustomer((prev) => ({ ...prev, firstName: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && checkForExistingCustomer()}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="text"
                                placeholder="Last name"
                                value={newCustomer.lastName}
                                onChange={(e) => setNewCustomer((prev) => ({ ...prev, lastName: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && checkForExistingCustomer()}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="tel"
                                placeholder="Best phone"
                                value={newCustomer.bestPhone}
                                onChange={(e) => setNewCustomer((prev) => ({ ...prev, bestPhone: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && checkForExistingCustomer()}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            {saveMessage && <p className="text-red-400 text-sm">{saveMessage}</p>}
                            <button
                                onClick={checkForExistingCustomer}
                                className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Continue
                            </button>
                            <button
                                onClick={() => setStage('customer-search')}
                                className="w-full text-white/40 hover:text-white/70 text-sm py-2 transition-colors"
                            >
                                ← Back to search
                            </button>
                        </div>
                    </div>
                )}
                {/* ---- new customer: check for existing match ---- */}
                {stage === 'new-customer-check' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        {existingCustomerMatches.length > 0 ? (
                            <>
                                <p className="text-white text-xl font-serif mb-2">Is this one of these people?</p>
                                <p className="text-white/40 text-xs mb-4">
                                    We found existing customers with a similar last name — tap the right one, or confirm this is someone new.
                                </p>
                                <div className="flex flex-col gap-2 mb-4">
                                    {existingCustomerMatches.map((c) => (
                                        <button
                                            key={c._id}
                                            onClick={() => useExistingCustomer(c)}
                                            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                        >
                                            <p className="text-white text-sm">{c.firstName} {c.lastName}</p>
                                            <p className="text-white/40 text-xs">{c.bestPhone}</p>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setStage('new-customer-property-search')}
                                    className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                                >
                                    None of these — this is a new customer
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-white text-xl font-serif mb-4">No existing match found</p>
                                <button
                                    onClick={() => setStage('new-customer-property-search')}
                                    className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                                >
                                    Continue as a new customer
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setStage('new-customer')}
                            className="w-full text-white/40 hover:text-white/70 text-sm mt-4 py-2 transition-colors"
                        >
                            ← Back
                        </button>
                    </div>
                )}

                {/* ---- new customer: property search ---- */}
                {stage === 'new-customer-property-search' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-2">Where's the service address?</p>
                        <p className="text-white/40 text-xs mb-4">
                            We check first in case this house has been serviced before, so we don't create a duplicate.
                        </p>
                        <input
                            type="text"
                            value={propertySearchTerm}
                            onChange={(e) => setPropertySearchTerm(e.target.value)}
                            placeholder="Start typing the address..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-3"
                        />
                        <div className="flex flex-col gap-2 mb-4">
                            {propertyMatchesForNewCustomer.map((p) => (
                                <button
                                    key={p._id}
                                    onClick={() => createCustomerWithProperty(p._id)}
                                    className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                >
                                    <p className="text-white text-sm">{formatAddress(p.address)}</p>
                                    <p className="text-white/40 text-xs">Existing property — link to it</p>
                                </button>
                            ))}
                        </div>
                        {saveMessage && <p className="text-red-400 text-sm mb-3">{saveMessage}</p>}
                        <button
                            onClick={startNewPropertyForCustomer}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            + This is a new address
                        </button>
                        <button
                            onClick={() => setStage('new-customer')}
                            className="w-full text-white/40 hover:text-white/70 text-sm mt-4 py-2 transition-colors"
                        >
                            ← Back
                        </button>
                    </div>
                )}

                {/* ---- new customer: new property details ---- */}
                {stage === 'new-customer-property-new' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-4">New property details</p>
                        <div className="flex flex-col gap-3">
                            <input
                                type="text"
                                placeholder="Street"
                                value={newPropertyDraft.street}
                                onChange={(e) => setNewPropertyDraft((prev) => ({ ...prev, street: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && submitNewPropertyAndCreateCustomer()}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="City"
                                    value={newPropertyDraft.city}
                                    onChange={(e) => setNewPropertyDraft((prev) => ({ ...prev, city: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && submitNewPropertyAndCreateCustomer()}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                />
                                <input
                                    type="text"
                                    placeholder="State"
                                    value={newPropertyDraft.state}
                                    onChange={(e) => setNewPropertyDraft((prev) => ({ ...prev, state: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && submitNewPropertyAndCreateCustomer()}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="ZIP (optional)"
                                value={newPropertyDraft.zip}
                                onChange={(e) => setNewPropertyDraft((prev) => ({ ...prev, zip: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && submitNewPropertyAndCreateCustomer()}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            {saveMessage && <p className="text-red-400 text-sm">{saveMessage}</p>}
                            <button
                                onClick={submitNewPropertyAndCreateCustomer}
                                className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Continue
                            </button>
                            <button
                                onClick={() => setStage('new-customer-property-search')}
                                className="w-full text-white/40 hover:text-white/70 text-sm py-2 transition-colors"
                            >
                                ← Back to address search
                            </button>
                        </div>
                    </div>
                )}

                {/* ---- Job details ---- */}
                {stage === 'job-details' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-1">Job details</p>
                        <p className="text-white/40 text-xs mb-4">For {selectedCustomer?.name}</p>
                        <div className="flex flex-col gap-3">
                            <input
                                type="date"
                                value={serviceDate}
                                onChange={(e) => setServiceDate(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <textarea
                                placeholder="Work performed"
                                value={workPerformed}
                                onChange={(e) => setWorkPerformed(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-24 resize-none"
                            />
                            <input
                                type="text"
                                placeholder="Technician"
                                value={technician}
                                onChange={(e) => setTechnician(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && setStage('line-items')}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="number"
                                placeholder="Labor cost"
                                value={laborCost}
                                onChange={(e) => setLaborCost(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && setStage('line-items')}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />

                            <textarea
                                placeholder="Notes (optional)"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-20 resize-none"
                            />
                            <button
                                onClick={() => setStage('line-items')}
                                className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Next: Parts & Materials
                            </button>
                            <button onClick={() => setStage('customer-search')} className="w-full text-white/40 hover:text-white/70 text-sm py-2 transition-colors">
                                ← Back
                            </button>
                        </div>
                    </div>
                )}

                {/* ---- Line items ---- */}
                {stage === 'line-items' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-4">Parts & materials</p>

                        <div className="flex flex-col gap-2 mb-5">
                            {lineItems.map((li) => (
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
                                                    onChange={(e) => updateLineItemQuantity(li.key, e.target.value)}
                                                    className="w-16 bg-white/10 border border-white/10 rounded-lg text-white text-sm py-1 px-2"
                                                />
                                                <p className="text-white/40 text-xs">× {formatMoney(li.unitPrice)}</p>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => removeLineItem(li.key)} className="text-red-400 text-sm">
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setCatalogOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 mb-2 transition-colors"
                        >
                            <p className="text-white/60 text-xs uppercase tracking-widest">Add from catalog</p>
                            <span className="text-white/40 text-sm">{catalogOpen ? '▾' : '▸'}</span>
                        </button>
                        {catalogOpen && (
                            <>
                                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                                    {CATEGORY_PILLS.map((pill) => (
                                        <button
                                            key={pill}
                                            onClick={() => setCategoryFilter(pill === 'All' ? 'all' : pill)}
                                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${(pill === 'All' && categoryFilter === 'all') || categoryFilter === pill
                                                ? 'bg-blue text-white'
                                                : 'bg-white/5 text-white/50 border border-white/10'
                                                }`}
                                        >
                                            {pill}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={catalogSearchTerm}
                                    onChange={(e) => setCatalogSearchTerm(e.target.value)}
                                    placeholder="Search parts..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-2"
                                />
                                <div className="flex flex-col gap-2 mb-5 max-h-64 overflow-y-auto no-scrollbar border border-white/10 rounded-xl p-2">
                                    {filteredInventory.map((item) => (
                                        <button
                                            key={item._id}
                                            onClick={() => addCatalogLineItem(item)}
                                            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                        >
                                            <p className="text-white text-sm">{item.name}</p>
                                            <p className="text-white/40 text-xs">{formatMoney(item.sellPrice)}</p>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Or add a one-off / reused part</p>
                        <div className="flex flex-col gap-2 mb-5">
                            <input
                                type="text"
                                placeholder="Item name"
                                value={miscDraft.miscName}
                                onChange={(e) => setMiscDraft((prev) => ({ ...prev, miscName: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && addMiscLineItem()}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="number"
                                placeholder="Sell price (final, no markup)"
                                value={miscDraft.miscSellPrice}
                                onChange={(e) => setMiscDraft((prev) => ({ ...prev, miscSellPrice: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && addMiscLineItem()}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="text"
                                placeholder="Note (e.g. customer's old part, reused)"
                                value={miscDraft.miscNote}
                                onChange={(e) => setMiscDraft((prev) => ({ ...prev, miscNote: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && addMiscLineItem()}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <button
                                onClick={addMiscLineItem}
                                className="w-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                            >
                                + Add one-off item
                            </button>
                        </div>

                        <p className="text-white text-right mb-4">Total so far: {formatMoney(totalAmount)}</p>

                        <button
                            onClick={() => setStage('receipts')}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            Next: Receipts
                        </button>
                        <button onClick={() => setStage('job-details')} className="w-full text-white/40 hover:text-white/70 text-sm mt-2 py-2 transition-colors">
                            ← Back
                        </button>
                    </div>
                )}

                {/* ---- Receipts ---- */}
                {stage === 'receipts' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-4">Receipts</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            onChange={(e) => handleReceiptFiles(e.target.files)}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-white/10 hover:bg-white/20 text-white text-lg font-semibold py-4 rounded-xl transition-colors mb-4"
                        >
                            + Take Photo / Upload Receipt
                        </button>
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {receipts.map((src, i) => (
                                <div key={i} className="relative">
                                    <img src={src} alt="Receipt" className="w-full h-24 object-cover rounded-lg" />
                                    <button
                                        onClick={() => removeReceipt(i)}
                                        className="absolute top-1 right-1 bg-navy/80 text-red-400 text-xs rounded-full w-6 h-6"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setStage('review')}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            Next: Review
                        </button>
                        <button onClick={() => setStage('line-items')} className="w-full text-white/40 hover:text-white/70 text-sm mt-2 py-2 transition-colors">
                            ← Back
                        </button>
                    </div>
                )}

                {/* ---- Review ---- */}
                {stage === 'review' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-4">Review before saving</p>
                        <div className="text-white/80 text-sm flex flex-col gap-2 mb-6">
                            <p><span className="text-white/40">Customer:</span> {selectedCustomer?.name}</p>
                            <p><span className="text-white/40">Date:</span> {serviceDate}</p>
                            <p><span className="text-white/40">Items:</span> {lineItems.length}</p>
                            <p><span className="text-white/40">Labor:</span> {formatMoney(laborCost)}</p>
                            <p><span className="text-white/40">Receipts:</span> {receipts.length}</p>
                            <p className="text-white text-lg mt-2">Total: {formatMoney(totalAmount)}</p>
                        </div>
                        {saveMessage && status === 'error' && <p className="text-red-400 text-sm mb-4 text-center">{saveMessage}</p>}
                        <button
                            onClick={() => handleSaveInvoice(true)}
                            disabled={status === 'saving'}
                            className="w-full bg-brand-green hover:opacity-90 disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-2"
                        >
                            {status === 'saving' ? 'Saving...' : 'Save & Start Job'}
                        </button>
                        <button
                            onClick={() => handleSaveInvoice(false)}
                            disabled={status === 'saving'}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            {status === 'saving' ? 'Saving...' : "Save Only — I'll Start It Later"}
                        </button>
                        <button onClick={() => setStage('receipts')} className="w-full text-white/40 hover:text-white/70 text-sm mt-2 py-2 transition-colors">
                            ← Back
                        </button>
                    </div>
                )}

                {/* ---- equipment logging prompt ---- */}
                {stage === 'equipment-prompt' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-1">
                            This job included: {equipmentPrompts[equipmentPromptIndex]?.name}
                        </p>
                        <p className="text-white/40 text-xs mb-4">
                            Log its serial number and warranty now? ({equipmentPromptIndex + 1} of {equipmentPrompts.length})
                        </p>
                        <div className="flex flex-col gap-3">
                            <input
                                type="text" placeholder="Serial number" value={equipmentLogDraft.serialNumber}
                                onChange={(e) => setEquipmentLogDraft((d) => ({ ...d, serialNumber: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleLogEquipment(false)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <div>
                                <p className="text-white/40 text-xs mb-1">Install date</p>
                                <input
                                    type="date" value={equipmentLogDraft.installDate}
                                    onChange={(e) => setEquipmentLogDraft((d) => ({ ...d, installDate: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                />
                            </div>
                            <div>
                                <p className="text-white/40 text-xs mb-1">Warranty expires</p>
                                <input
                                    type="date" value={equipmentLogDraft.warrantyExpires}
                                    onChange={(e) => setEquipmentLogDraft((d) => ({ ...d, warrantyExpires: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                />
                            </div>
                            <textarea
                                placeholder="Notes (optional)" value={equipmentLogDraft.notes}
                                onChange={(e) => setEquipmentLogDraft((d) => ({ ...d, notes: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-20 resize-none"
                            />
                            {equipmentLogStatus === 'error' && <p className="text-red-400 text-sm">Something went wrong — try again.</p>}
                            <button
                                onClick={() => handleLogEquipment(false)}
                                disabled={equipmentLogStatus === 'saving'}
                                className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                {equipmentLogStatus === 'saving' ? 'Saving...' : 'Save & Continue'}
                            </button>
                            <button
                                onClick={() => handleLogEquipment(true)}
                                className="w-full text-white/40 hover:text-white/70 text-sm py-2 transition-colors"
                            >
                                Skip this one
                            </button>
                        </div>
                    </div>
                )}

                {/* ---- Done ---- */}
                {stage === 'done' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                        <p className="text-brand-green text-4xl mb-4">✓</p>
                        <p className="text-white text-xl font-serif mb-2">Invoice saved</p>
                        <p className="text-white/50 text-sm mb-6">{saveMessage}</p>
                        {(
                            <button
                                onClick={async () => {
                                    await generateInvoicePdf({
                                        invoiceNumber: savedInvoiceNumber,
                                        serviceDate,
                                        customerName: selectedCustomer?.name,
                                        workPerformed,
                                        totalAmount,
                                        laborCost: Number(laborCost) || 0,
                                        payments: [],
                                        lineItems: lineItems.map((li) =>
                                            li.itemType === 'misc'
                                                ? { itemType: 'misc', miscName: li.miscName, miscSellPrice: li.miscSellPrice }
                                                : { itemType: 'catalog', inventoryItemName: li.name, inventoryItemPrice: li.unitPrice, quantity: li.quantity }
                                        ),
                                    })
                                }}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-3"
                            >
                                Print Invoice (PDF)
                            </button>
                        )}
                        <button
                            onClick={startOver}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            + New Job / Invoice
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}