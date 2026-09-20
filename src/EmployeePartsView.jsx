import { useState, useEffect } from 'react'

const DISCOUNT_REASONS = [
    { value: 'veteran', label: 'Veteran' },
    { value: 'senior', label: 'Senior' },
    { value: 'loyalCustomer', label: 'Loyal Customer' },
    { value: 'employeeFamily', label: 'Employee / Family' },
    { value: 'referral', label: 'Referral' },
    { value: 'damageCredit', label: 'Damage / Complaint Credit' },
    { value: 'other', label: 'Other' },
]

const EMPTY_DISCOUNT = { discountType: 'none', discountValue: '', discountReason: '', discountReasonNote: '' }

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

function applyDiscountClient(amount, discountType, discountValue) {
    if (!discountType || discountType === 'none') return amount
    const value = Number(discountValue) || 0
    if (discountType === 'percent') return Math.max(amount * (1 - value / 100), 0)
    if (discountType === 'flat') return Math.max(amount - value, 0)
    return amount
}

function DiscountControls({ discount, onChange, appliedBy }) {
    return (
        <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
                {[
                    { value: 'none', label: 'No Discount' },
                    { value: 'percent', label: '% Off' },
                    { value: 'flat', label: '$ Off' },
                ].map((t) => (
                    <button
                        key={t.value}
                        onClick={() => onChange({ ...discount, discountType: t.value })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${discount.discountType === t.value ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {discount.discountType !== 'none' && (
                <div className="flex flex-col gap-2">
                    <input
                        type="number"
                        placeholder={discount.discountType === 'percent' ? 'Percent (e.g. 20)' : 'Dollar amount (e.g. 15)'}
                        value={discount.discountValue}
                        onChange={(e) => onChange({ ...discount, discountValue: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm py-2 px-3 outline-none focus:border-blue"
                    />
                    <select
                        value={discount.discountReason}
                        onChange={(e) => onChange({ ...discount, discountReason: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm py-2 px-3 outline-none focus:border-blue"
                    >
                        <option value="" disabled>Reason...</option>
                        {DISCOUNT_REASONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                    {discount.discountReason === 'other' && (
                        <input
                            type="text"
                            placeholder="Reason details"
                            value={discount.discountReasonNote}
                            onChange={(e) => onChange({ ...discount, discountReasonNote: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm py-2 px-3 outline-none focus:border-blue"
                        />
                    )}
                    {appliedBy && <p className="text-white/30 text-xs">Applied by {appliedBy}</p>}
                </div>
            )}
        </div>
    )
}

export default function EmployeePartsView({ propertyId, employeeId, pin, onBack }) {
    const [status, setStatus] = useState('loading') // loading | ready | none | error
    const [invoiceId, setInvoiceId] = useState(null)
    const [lineItems, setLineItems] = useState([])
    const [invoiceDiscount, setInvoiceDiscount] = useState(EMPTY_DISCOUNT)
    const [invoiceDiscountAppliedBy, setInvoiceDiscountAppliedBy] = useState('')
    const [inventory, setInventory] = useState([])
    const [catalogSearchTerm, setCatalogSearchTerm] = useState('')
    const [miscDraft, setMiscDraft] = useState({ miscName: '', miscSellPrice: '', miscNote: '' })
    const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error

    function toDraftDiscount(li) {
        return {
            discountType: li.discountType || 'none',
            discountValue: li.discountValue ?? '',
            discountReason: li.discountReason || '',
            discountReasonNote: li.discountReasonNote || '',
        }
    }

    function load() {
        setStatus('loading')
        Promise.all([
            fetch(`/api/invoices?propertyId=${propertyId}`).then((res) => res.json()),
            fetch('/api/inventory').then((res) => res.json()),
        ])
            .then(([invoicesData, inventoryData]) => {
                setInventory(inventoryData.items || [])
                const ongoing = (invoicesData.invoices || []).find((inv) => inv.jobStatus === 'ongoing')
                if (!ongoing) {
                    setStatus('none')
                    return
                }
                return fetch(`/api/invoices?id=${ongoing._id}`)
                    .then((res) => res.json())
                    .then(({ invoice: full }) => {
                        setInvoiceId(full._id)
                        setLineItems(
                            (full.lineItems || []).map((li, i) => ({
                                key: li._key || `existing-${i}`,
                                _key: li._key,
                                ...toDraftDiscount(li),
                                discountAppliedBy: li.discountAppliedBy || '',
                                ...(li.itemType === 'misc'
                                    ? { itemType: 'misc', miscName: li.miscName, miscSellPrice: li.miscSellPrice, miscNote: li.miscNote }
                                    : { itemType: 'catalog', inventoryItemId: li.inventoryItemId, name: li.inventoryItemName, unitPrice: li.inventoryItemPrice, quantity: li.quantity }),
                            }))
                        )
                        setInvoiceDiscount(toDraftDiscount(full))
                        setInvoiceDiscountAppliedBy(full.discountAppliedBy || '')
                        setStatus('ready')
                    })
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        load()
    }, [propertyId])

    function addCatalogItem(item) {
        setLineItems((prev) => [
            ...prev,
            { key: `${item._id}-${Date.now()}`, _key: null, itemType: 'catalog', inventoryItemId: item._id, name: item.name, unitPrice: item.sellPrice, quantity: 1, ...EMPTY_DISCOUNT, discountAppliedBy: '' },
        ])
        setCatalogSearchTerm('')
        setSaveStatus('idle')
    }

    function addMiscItem() {
        if (!miscDraft.miscName.trim()) return
        setLineItems((prev) => [
            ...prev,
            { key: `misc-${Date.now()}`, _key: null, itemType: 'misc', miscName: miscDraft.miscName.trim(), miscSellPrice: Number(miscDraft.miscSellPrice) || 0, miscNote: miscDraft.miscNote.trim(), ...EMPTY_DISCOUNT, discountAppliedBy: '' },
        ])
        setMiscDraft({ miscName: '', miscSellPrice: '', miscNote: '' })
        setSaveStatus('idle')
    }

    function removeLineItem(key) {
        setLineItems((prev) => prev.filter((li) => li.key !== key))
        setSaveStatus('idle')
    }

    function updateQuantity(key, quantity) {
        setLineItems((prev) => prev.map((li) => (li.key === key ? { ...li, quantity: Number(quantity) || 1 } : li)))
        setSaveStatus('idle')
    }

    function updateMiscPrice(key, price) {
        setLineItems((prev) => prev.map((li) => (li.key === key ? { ...li, miscSellPrice: Number(price) || 0 } : li)))
        setSaveStatus('idle')
    }

    function updateMiscNote(key, note) {
        setLineItems((prev) => prev.map((li) => (li.key === key ? { ...li, miscNote: note } : li)))
        setSaveStatus('idle')
    }

    function updateItemDiscount(key, discount) {
        setLineItems((prev) => prev.map((li) => (li.key === key ? { ...li, ...discount } : li)))
        setSaveStatus('idle')
    }

    async function handleSave() {
        setSaveStatus('saving')
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'employeeUpdateLineItems',
                    invoiceId,
                    employeeId,
                    pin,
                    lineItems: lineItems.map((li) => ({
                        _key: li._key || undefined,
                        discountType: li.discountType,
                        discountValue: li.discountValue,
                        discountReason: li.discountReason,
                        discountReasonNote: li.discountReasonNote,
                        ...(li.itemType === 'misc'
                            ? { itemType: 'misc', miscName: li.miscName, miscSellPrice: li.miscSellPrice, miscNote: li.miscNote }
                            : { itemType: 'catalog', inventoryItemId: li.inventoryItemId, quantity: li.quantity }),
                    })),
                    discountType: invoiceDiscount.discountType,
                    discountValue: invoiceDiscount.discountValue,
                    discountReason: invoiceDiscount.discountReason,
                    discountReasonNote: invoiceDiscount.discountReasonNote,
                }),
            })
            if (!res.ok) throw new Error('Failed')
            setSaveStatus('saved')
            load()
        } catch (err) {
            console.error(err)
            setSaveStatus('error')
        }
    }

    const subtotal = lineItems.reduce((sum, li) => {
        const base = li.itemType === 'misc' ? li.miscSellPrice : li.unitPrice * (li.quantity || 1)
        return sum + applyDiscountClient(base, li.discountType, li.discountValue)
    }, 0)
    const total = applyDiscountClient(subtotal, invoiceDiscount.discountType, invoiceDiscount.discountValue)

    const filteredInventory = inventory.filter((item) => {
        const term = catalogSearchTerm.trim().toLowerCase()
        if (!term) return false
        return item.name?.toLowerCase().includes(term)
    })

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-lg mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Back
                </button>

                <h1 className="font-serif text-2xl text-white mb-6">Parts & Equipment</h1>

                {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load this job.</p>}
                {status === 'none' && <p className="text-white/40 text-sm text-center py-10">No active job found for this property.</p>}

                {status === 'ready' && (
                    <>
                        <div className="flex flex-col gap-2 mb-6">
                            {lineItems.length === 0 && <p className="text-white/40 text-sm">Nothing added yet.</p>}
                            {lineItems.map((li) => (
                                <div key={li.key} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    {li.itemType === 'misc' ? (
                                        <>
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                                <p className="text-white text-sm font-semibold">{li.miscName}</p>
                                                <button onClick={() => removeLineItem(li.key)} className="text-red-400 text-xs shrink-0">Remove</button>
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-white/40 text-sm">$</span>
                                                <input
                                                    type="number"
                                                    value={li.miscSellPrice}
                                                    onChange={(e) => updateMiscPrice(li.key, e.target.value)}
                                                    className="w-24 bg-white/5 border border-white/10 rounded-lg text-white text-sm py-2 px-3 outline-none focus:border-blue"
                                                />
                                                <span className="text-white/30 text-xs">(0 for free)</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Note (e.g. gave customer old part)"
                                                value={li.miscNote || ''}
                                                onChange={(e) => updateMiscNote(li.key, e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-xs py-2 px-3 outline-none focus:border-blue"
                                            />
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-white text-sm font-semibold">{li.name}</p>
                                                <p className="text-white/40 text-xs mt-0.5">{formatMoney(li.unitPrice)} each</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <input
                                                    type="number"
                                                    value={li.quantity}
                                                    onChange={(e) => updateQuantity(li.key, e.target.value)}
                                                    className="w-16 bg-white/5 border border-white/10 rounded-lg text-white text-sm py-2 px-2 text-center outline-none focus:border-blue"
                                                />
                                                <button onClick={() => removeLineItem(li.key)} className="text-red-400 text-xs">Remove</button>
                                            </div>
                                        </div>
                                    )}
                                    <DiscountControls
                                        discount={{ discountType: li.discountType, discountValue: li.discountValue, discountReason: li.discountReason, discountReasonNote: li.discountReasonNote }}
                                        onChange={(d) => updateItemDiscount(li.key, d)}
                                        appliedBy={li.discountAppliedBy}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Whole Invoice Discount</p>
                            <DiscountControls
                                discount={invoiceDiscount}
                                onChange={(d) => { setInvoiceDiscount(d); setSaveStatus('idle') }}
                                appliedBy={invoiceDiscountAppliedBy}
                            />
                        </div>

                        <div className="flex flex-col gap-1 mb-6">
                            {total !== subtotal && (
                                <div className="flex items-center justify-between">
                                    <p className="text-white/40 text-sm">Subtotal</p>
                                    <p className="text-white/40 text-sm">{formatMoney(subtotal)}</p>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <p className="text-white/40 text-sm">Total</p>
                                <p className="text-white text-lg font-serif">{formatMoney(total)}</p>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Add From Catalog</p>
                            <input
                                type="text"
                                value={catalogSearchTerm}
                                onChange={(e) => setCatalogSearchTerm(e.target.value)}
                                placeholder="Search parts..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-base py-3 px-4 outline-none focus:border-blue mb-2"
                            />
                            {filteredInventory.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {filteredInventory.map((item) => (
                                        <button
                                            key={item._id}
                                            onClick={() => addCatalogItem(item)}
                                            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors flex items-center justify-between"
                                        >
                                            <p className="text-white text-sm">{item.name}</p>
                                            <p className="text-white/40 text-xs">{formatMoney(item.sellPrice)}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Add Custom / Free Item</p>
                            <input
                                type="text"
                                placeholder="Item name"
                                value={miscDraft.miscName}
                                onChange={(e) => setMiscDraft((d) => ({ ...d, miscName: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-base py-3 px-4 outline-none focus:border-blue mb-2"
                            />
                            <input
                                type="number"
                                placeholder="Price (0 for free)"
                                value={miscDraft.miscSellPrice}
                                onChange={(e) => setMiscDraft((d) => ({ ...d, miscSellPrice: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-base py-3 px-4 outline-none focus:border-blue mb-2"
                            />
                            <input
                                type="text"
                                placeholder="Note (optional)"
                                value={miscDraft.miscNote}
                                onChange={(e) => setMiscDraft((d) => ({ ...d, miscNote: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-base py-3 px-4 outline-none focus:border-blue mb-3"
                            />
                            <button
                                onClick={addMiscItem}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                            >
                                + Add Item
                            </button>
                        </div>

                        {saveStatus === 'saved' && <p className="text-brand-green text-sm text-center mb-3">Saved.</p>}
                        {saveStatus === 'error' && <p className="text-red-400 text-sm text-center mb-3">Something went wrong — try again.</p>}
                        <button
                            onClick={handleSave}
                            disabled={saveStatus === 'saving'}
                            className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}