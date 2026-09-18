import { useState, useEffect } from 'react'

function formatAddress(address) {
    if (!address || (!address.street && !address.city && !address.state)) return ''
    return [address.street, address.city].filter(Boolean).join(', ')
}

function toMonthString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate()
}

function CancelationAlert({ cancelations, confirmingId, onConfirm, className = '' }) {
    if (cancelations.length === 0) return null
    return (
        <div className={`bg-white border-2 border-red-500 rounded-2xl p-5 shadow-lg shadow-red-500/20 ${className}`}>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚠️</span>
                <p className="text-navy font-serif text-lg font-semibold">
                    {cancelations.length} Cancelation{cancelations.length === 1 ? '' : 's'} Need{cancelations.length === 1 ? 's' : ''} Review
                </p>
            </div>
            <div className="flex flex-col gap-3">
                {cancelations.map((c) => (
                    <div key={c._id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-navy text-sm font-semibold">{c.customerName || 'No customer'}</p>
                        <p className="text-navy/60 text-xs mt-0.5">{formatAddress(c.propertyAddress)}</p>
                        {c.cancelReason && <p className="text-navy/70 text-xs mt-2 italic">“{c.cancelReason}”</p>}
                        <p className="text-navy/40 text-xs mt-1">Canceled {c.canceledAt || '—'}</p>
                        <button
                            onClick={() => onConfirm(c._id)}
                            disabled={confirmingId === c._id}
                            className="mt-3 w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors active:scale-[0.98]"
                        >
                            {confirmingId === c._id ? 'Confirming...' : 'Confirm'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function CalendarView({ onBack, onOpenInvoice }) {
    const [cursor, setCursor] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [invoices, setInvoices] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [selectedDay, setSelectedDay] = useState(null) // 'YYYY-MM-DD' or null
    const [cancelations, setCancelations] = useState([])
    const [confirmingId, setConfirmingId] = useState(null)

    const monthString = toMonthString(cursor)
    const todayFull = new Date().toISOString().slice(0, 10)

    function fetchMonth() {
        setStatus('loading')
        fetch(`/api/invoices?calendarMonth=${monthString}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed')
                return res.json()
            })
            .then((data) => {
                setInvoices(data.invoices || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    function fetchCancelations() {
        fetch('/api/invoices?unconfirmedCancelations=true')
            .then((res) => {
                if (!res.ok) throw new Error('Failed')
                return res.json()
            })
            .then((data) => setCancelations(data.invoices || []))
            .catch(() => { }) // non-critical — the alert card just stays empty if this fails
    }

    async function handleConfirmCancelation(id) {
        setConfirmingId(id)
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'acknowledgeCancelation', invoiceId: id }),
            })
            if (!res.ok) throw new Error('Failed')
            setCancelations((prev) => prev.filter((c) => c._id !== id))
        } catch (err) {
            console.error(err)
        } finally {
            setConfirmingId(null)
        }
    }

    useEffect(() => {
        fetchMonth()
        setSelectedDay(null)
    }, [monthString])

    // Independent of month navigation on purpose — Michael shouldn't be able
    // to "page away" from an unconfirmed cancelation by changing months.
    useEffect(() => {
        fetchCancelations()
    }, [])

    const byDate = {}
    invoices.forEach((inv) => {
        if (!inv.serviceDate) return
        if (!byDate[inv.serviceDate]) byDate[inv.serviceDate] = []
        byDate[inv.serviceDate].push(inv)
    })

    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const totalDays = daysInMonth(year, month)
    const firstWeekday = new Date(year, month, 1).getDay()
    const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const cells = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(d)

    function dateString(day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    const selectedInvoices = selectedDay ? byDate[selectedDay] || [] : []

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-5xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Desktop
                </button>

                <CancelationAlert
                    cancelations={cancelations}
                    confirmingId={confirmingId}
                    onConfirm={handleConfirmCancelation}
                    className="mb-6 lg:hidden"
                />

                {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load the calendar.</p>}

                {status === 'ready' && (
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
                        {/* ---- left: calendar grid ---- */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-6">                                <button
                                onClick={() => setCursor(new Date(year, month - 1, 1))}
                                className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                            >
                                ←
                            </button>
                                <h1 className="font-serif text-2xl text-white">{monthLabel}</h1>
                                <button
                                    onClick={() => setCursor(new Date(year, month + 1, 1))}
                                    className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                                >
                                    →
                                </button>
                            </div>

                            <div className="flex items-center justify-center gap-4 mb-4">
                                <span className="flex items-center gap-1.5 text-white/40 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-brand-green" /> Ongoing
                                </span>
                                <span className="flex items-center gap-1.5 text-white/40 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-accent" /> Not Started
                                </span>
                            </div>

                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                    <p key={i} className="text-white/40 text-xs text-center uppercase tracking-widest py-1">{d}</p>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {cells.map((day, i) => {
                                    if (day === null) return <div key={i} />
                                    const ds = dateString(day)
                                    const dayJobs = byDate[ds] || []
                                    const hasJobs = dayJobs.length > 0
                                    const isToday = ds === todayFull
                                    const isSelected = ds === selectedDay
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDay(ds)}
                                            className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 p-1 transition-all border active:scale-95 ${isSelected
                                                ? 'bg-blue border-blue text-white shadow-lg shadow-blue/30'
                                                : hasJobs
                                                    ? 'bg-white border-white text-navy hover:bg-white/90'
                                                    : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:border-white/30'
                                                } ${isToday ? 'ring-2 ring-blue ring-offset-2 ring-offset-navy' : ''}`}
                                        >
                                            <p className={`text-sm font-semibold ${isSelected ? 'text-white' : hasJobs ? 'text-navy' : 'text-white/60'}`}>
                                                {day}
                                            </p>
                                            {hasJobs && (
                                                <div className="flex items-center gap-0.5">
                                                    {dayJobs.slice(0, 3).map((job, j) => (
                                                        <span
                                                            key={j}
                                                            className={`w-2 h-2 rounded-full ${job.jobStatus === 'ongoing' ? 'bg-brand-green' : 'bg-accent'
                                                                }`}
                                                        />
                                                    ))}
                                                    {dayJobs.length > 3 && (
                                                        <span className={`text-[9px] font-semibold ${isSelected ? 'text-white/80' : 'text-navy/50'}`}>
                                                            +{dayJobs.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ---- right: cancelation alerts + selected day's jobs ---- */}
                        <div className="flex flex-col gap-6 lg:sticky lg:top-10">
                            <CancelationAlert
                                cancelations={cancelations}
                                confirmingId={confirmingId}
                                onConfirm={handleConfirmCancelation}
                                className="hidden lg:block"
                            />
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                {!selectedDay && (
                                    <p className="text-white/40 text-sm text-center py-6">Tap a day to see what's scheduled.</p>
                                )}
                                {selectedDay && (
                                    <>
                                        <p className="text-white text-lg font-serif mb-4">
                                            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                        </p>
                                        {selectedInvoices.length === 0 && (
                                            <p className="text-white/40 text-sm">Nothing scheduled for this day.</p>
                                        )}
                                        <div className="flex flex-col gap-2">
                                            {selectedInvoices.map((inv) => (
                                                <button
                                                    key={inv._id}
                                                    onClick={() => onOpenInvoice(inv)}
                                                    className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-white text-sm">{inv.customerName || 'No customer'}</p>
                                                        <span className={`text-xs font-semibold ${inv.jobStatus === 'ongoing' ? 'text-brand-green' : 'text-accent'}`}>
                                                            {inv.jobStatus === 'ongoing' ? 'Ongoing' : 'Not Started'}
                                                        </span>
                                                    </div>
                                                    <p className="text-white/40 text-xs mt-0.5">{formatAddress(inv.propertyAddress)}</p>
                                                    {inv.workPerformed && <p className="text-white/40 text-xs mt-1 italic">{inv.workPerformed}</p>}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}