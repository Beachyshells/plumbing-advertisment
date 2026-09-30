import { useState, useEffect } from 'react'
import Toast from './Toast.jsx'
function todayString() {
    return new Date().toISOString().slice(0, 10)
}

// Common filter change intervals, in months.
const INTERVALS = [1, 3, 6, 12]

// "1 month", "6 months"
function intervalLabel(months) {
    return `${months} month${months === 1 ? '' : 's'}`
}

// "2026-09-30" + 6 months -> "2027-03-30" (clamped to the month's last day).
function addMonths(isoDate, months) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '')
    if (!match || !months) return ''
    const y = Number(match[1])
    const m = Number(match[2]) - 1 + Number(months)
    const d = Number(match[3])
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const date = new Date(Date.UTC(y, m, Math.min(d, lastDay)))
    return date.toISOString().slice(0, 10)
}

// "6 months" -> 6. Anything else -> 0.
function monthsFrom(replaceEvery) {
    const match = /^(\d+)\s*month/i.exec(replaceEvery || '')
    return match ? Number(match[1]) : 0
}

export default function EquipmentLogView({ invoice, onBack }) {
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [propertyId, setPropertyId] = useState(null)
    const [equipmentLineItems, setEquipmentLineItems] = useState([]) // [{ name, inventoryItemId, isFilter }]
    const [customerId, setCustomerId] = useState(null)
    const [technician, setTechnician] = useState('')
    const [propertyEquipment, setPropertyEquipment] = useState([])
    const [openItemName, setOpenItemName] = useState(null)
    const [draft, setDraft] = useState(null)
    const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | error
    const [toast, setToast] = useState(null)
    function load() {
        setStatus('loading')
        fetch(`/api/invoices?id=${invoice._id}`)
            .then((res) => res.json())
            .then(({ invoice: full }) => {
                const equip = (full.lineItems || [])
                    .filter((li) => li.itemType === 'catalog' && li.isEquipment)
                    .map((li) => ({
                        name: li.inventoryItemName,
                        inventoryItemId: li.inventoryItemId,
                        isFilter: li.category === 'Filters',
                    }))
                setEquipmentLineItems(equip)
                setPropertyId(full.propertyId || null)
                setCustomerId(full.customerId || null)
                setTechnician(full.technician || '')

                if (!full.propertyId) {
                    setPropertyEquipment([])
                    setStatus('ready')
                    return
                }

                return fetch(`/api/equipment?propertyId=${full.propertyId}`)
                    .then((res) => res.json())
                    .then((data) => {
                        setPropertyEquipment(data.equipment || [])
                        setStatus('ready')
                    })
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        load()
    }, [invoice._id])

    function openAdd(item) {
        setOpenItemName(item.name)
        setDraft({
            equipmentType: item.name,
            serialNumber: '',
            installDate: todayString(),
            warrantyExpires: '',
            notes: '',
            isFilter: !!item.isFilter,
            intervalMonths: item.isFilter ? 6 : 0,
            nextChange: item.isFilter ? addMonths(todayString(), 6) : '',
            scheduleNext: !!item.isFilter,
            _editingKey: null,
        })
        setSaveStatus('idle')
    }

    function openEdit(item, logged) {
        setOpenItemName(item.name)
        setDraft({
            equipmentType: logged.equipmentType || item.name,
            serialNumber: logged.serialNumber || '',
            installDate: logged.installDate || '',
            warrantyExpires: logged.warrantyExpires || '',
            notes: logged.notes || '',
            isFilter: !!item.isFilter,
            intervalMonths: monthsFrom(logged.replaceEvery) || (item.isFilter ? 6 : 0),
            nextChange: '',
            // The next change was already scheduled when this was first logged.
            scheduleNext: false,
            _editingKey: logged._id,
        })
        setSaveStatus('idle')
    }

    async function handleSave() {
        setSaveStatus('saving')
        try {
            const isNew = !draft._editingKey
            const res = await fetch('/api/equipment', {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    propertyId,
                    equipmentId: isNew ? undefined : draft._editingKey,
                    equipmentType: draft.equipmentType,
                    serialNumber: draft.serialNumber,
                    installDate: draft.installDate,
                    warrantyExpires: draft.warrantyExpires,
                    notes: draft.notes,
                    invoiceId: invoice._id,
                    // Whoever is on the job, when a unit is first logged.
                    ...(isNew && technician ? { installedBy: technician } : {}),
                    // Filters only: how often it's changed, and when it last was
                    // (installing a new one counts as changing it).
                    ...(draft.isFilter
                        ? { replaceEvery: draft.intervalMonths ? intervalLabel(draft.intervalMonths) : '', lastChanged: draft.installDate || undefined }
                        : {}),
                }),
            })
            if (!res.ok) throw new Error('Failed')

            // Put the next filter change on the calendar as its own job.
            let scheduled = false
            if (draft.isFilter && draft.scheduleNext && draft.nextChange && customerId && propertyId) {
                const jobRes = await fetch('/api/invoices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerId,
                        propertyId,
                        serviceDate: draft.nextChange,
                        workPerformed: `Filter change — ${draft.equipmentType}`,
                        notes: `Scheduled automatically when this filter was installed on job #${invoice.invoiceNumber || ''}.`,
                        lineItems: [],
                    }),
                })
                if (!jobRes.ok) {
                    setSaveStatus('idle')
                    setToast("Serial saved, but the next filter change couldn't be scheduled — add it as a job")
                    load()
                    return
                }
                scheduled = true
            }
            setOpenItemName(null)
            setDraft(null)
            setSaveStatus('idle')
            setToast(scheduled ? `Logged — next filter change scheduled for ${draft.nextChange}` : 'Equipment logged')
            load()
        } catch (err) {
            console.error(err)
            setSaveStatus('error')
            setToast("Couldn't save — try again")
        }
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <Toast message={toast} onDone={() => setToast(null)} />
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Invoice
                </button>

                <div className="mb-6">
                    <h1 className="font-serif text-2xl text-white">Equipment</h1>
                    <p className="text-white/40 text-xs mt-1">
                        {invoice.invoiceNumber ? `Invoice #${invoice.invoiceNumber}` : 'This job'} — {invoice.customerName || 'No customer'}
                    </p>
                </div>

                {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load equipment.</p>}

                {status === 'ready' && equipmentLineItems.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-10">No trackable equipment on this job.</p>
                )}

                {status === 'ready' && equipmentLineItems.map((item) => {
                    const logged = propertyEquipment.find((e) => e.invoiceId === invoice._id && e.equipmentType === item.name)
                    const isOpen = openItemName === item.name
                    return (
                        <div key={item.inventoryItemId} className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-white text-lg font-serif">{item.name}</p>
                                    {logged ? (
                                        <p className="text-brand-green text-xs mt-1">
                                            SN {logged.serialNumber || '—'}{logged.installDate ? ` · Installed ${logged.installDate}` : ''}
                                        </p>
                                    ) : (
                                        <p className="text-accent text-xs mt-1">No serial number logged yet</p>
                                    )}
                                </div>
                                {!isOpen && (
                                    <button
                                        onClick={() => (logged ? openEdit(item, logged) : openAdd(item))}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${logged
                                            ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                                            : 'bg-blue hover:bg-blue-light text-white'
                                            }`}
                                    >
                                        {logged ? 'Edit' : 'Log Serial'}
                                    </button>
                                )}
                            </div>

                            {isOpen && (
                                <div className="mt-4 flex flex-col gap-3">
                                    <div>
                                        <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Serial Number</label>
                                        <input
                                            type="text"
                                            value={draft.serialNumber}
                                            onChange={(e) => setDraft((d) => ({ ...d, serialNumber: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Install Date</label>
                                            <input
                                                type="date"
                                                value={draft.installDate}
                                                onChange={(e) =>
                                                    setDraft((d) => ({
                                                        ...d,
                                                        installDate: e.target.value,
                                                        nextChange: d.isFilter && d.intervalMonths ? addMonths(e.target.value, d.intervalMonths) : d.nextChange,
                                                    }))
                                                }
                                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Warranty Expires</label>
                                            <input
                                                type="date"
                                                value={draft.warrantyExpires}
                                                onChange={(e) => setDraft((d) => ({ ...d, warrantyExpires: e.target.value }))}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                            />
                                        </div>
                                    </div>
                                    {draft.isFilter && (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                                            <div>
                                                <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Replace Every</label>
                                                <div className="flex gap-2">
                                                    {INTERVALS.map((months) => (
                                                        <button
                                                            key={months}
                                                            onClick={() =>
                                                                setDraft((d) => ({
                                                                    ...d,
                                                                    intervalMonths: months,
                                                                    nextChange: addMonths(d.installDate || todayString(), months),
                                                                }))
                                                            }
                                                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${draft.intervalMonths === months ? 'bg-blue text-white' : 'bg-white/5 text-white/60 border border-white/10'}`}
                                                        >
                                                            {intervalLabel(months)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {!draft._editingKey && (
                                                <>
                                                    <label className="flex items-center gap-2 text-white text-sm">
                                                        <input
                                                            type="checkbox"
                                                            checked={draft.scheduleNext}
                                                            onChange={(e) => setDraft((d) => ({ ...d, scheduleNext: e.target.checked }))}
                                                        />
                                                        Put the next filter change on the calendar
                                                    </label>
                                                    {draft.scheduleNext && (
                                                        <div>
                                                            <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Next Filter Change</label>
                                                            <input
                                                                type="date"
                                                                value={draft.nextChange}
                                                                onChange={(e) => setDraft((d) => ({ ...d, nextChange: e.target.value }))}
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                                            />
                                                            <p className="text-white/40 text-xs mt-1">Creates a Not Started job on that date for this customer and house.</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-white/40 text-xs uppercase tracking-widest mb-1 block">Notes</label>
                                        <input
                                            type="text"
                                            value={draft.notes}
                                            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                        />
                                    </div>
                                    {saveStatus === 'error' && <p className="text-red-400 text-sm">Something went wrong — try again.</p>}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={saveStatus === 'saving'}
                                            className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]"
                                        >
                                            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            onClick={() => { setOpenItemName(null); setDraft(null) }}
                                            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}