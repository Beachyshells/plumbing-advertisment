import { useState, useEffect } from 'react'
import Toast from './Toast.jsx'

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

// Today as YYYY-MM-DD in the phone's own time zone (not UTC, which would
// roll over to tomorrow in the evening).
function localToday() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgo(dateString) {
    const [y, m, d] = dateString.split('-').map(Number)
    const then = new Date(y, m - 1, d)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Math.round((today - then) / 86400000)
}

function shortDate(dateString) {
    const [y, m, d] = dateString.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Jobs from earlier days that still aren't finished, in a fold-down card at
// the top. Light card with dark text so it's easy to read on a phone.
function OpenJobs({ jobs, onOpen }) {
    const [open, setOpen] = useState(false)
    if (jobs.length === 0) return null
    return (
        <div className="bg-white rounded-2xl shadow-lg mb-6 overflow-hidden">
            <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left active:bg-gray-100"
            >
                <span className="flex items-center gap-3">
                    <span className="min-w-8 h-8 px-2 flex items-center justify-center rounded-full bg-orange-600 text-white text-base font-bold">
                        {jobs.length}
                    </span>
                    <span className="text-navy text-lg font-semibold">
                        Open job{jobs.length === 1 ? '' : 's'} from earlier days
                    </span>
                </span>
                <span className="text-navy text-xl font-bold" aria-hidden="true">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="border-t border-gray-200 flex flex-col">
                    {jobs.map((job) => {
                        const ago = daysAgo(job.serviceDate)
                        return (
                            <button
                                key={job._id}
                                onClick={() => onOpen(job)}
                                className="text-left px-5 py-4 border-b border-gray-200 last:border-b-0 active:bg-gray-100 hover:bg-gray-50"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-navy text-base font-semibold">{job.customerName || 'No customer'}</p>
                                    <span
                                        className={`shrink-0 text-sm font-bold px-2.5 py-0.5 rounded-full ${job.jobStatus === 'ongoing' ? 'bg-green-700 text-white' : 'bg-sky-700 text-white'}`}
                                    >
                                        {job.jobStatus === 'ongoing' ? 'Ongoing' : 'Not Started'}
                                    </span>
                                </div>
                                <p className="text-gray-800 text-base mt-1">{formatAddress(job.propertyAddress) || 'No address'}</p>
                                {job.workPerformed && <p className="text-gray-700 text-sm mt-1">{job.workPerformed}</p>}
                                <p className="text-gray-700 text-sm mt-1 font-medium">
                                    Scheduled {shortDate(job.serviceDate)} · {ago === 1 ? '1 day ago' : `${ago} days ago`}
                                    {job.invoiceNumber ? ` · Job #${job.invoiceNumber}` : ''}
                                </p>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// Jobs that were moved to a new day — shown at the top like cancelations
// until Michael taps "Got it", so a date change never slips by him.
// Light card with dark text so it's easy to read on a phone.
function RescheduleAlert({ jobs, confirmingId, onConfirm, onOpen }) {
    if (jobs.length === 0) return null
    return (
        <div className="bg-white border-2 border-blue rounded-2xl p-5 shadow-lg mb-6">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xl" aria-hidden="true">📅</span>
                <p className="text-navy font-serif text-lg font-semibold">
                    {jobs.length} Rescheduled Job{jobs.length === 1 ? '' : 's'}
                </p>
            </div>
            <div className="flex flex-col gap-3">
                {jobs.map((job) => (
                    <div key={job._id} className="bg-sky-50 border border-sky-300 rounded-xl p-4">
                        <p className="text-navy text-base font-semibold">{job.customerName || 'No customer'}</p>
                        <p className="text-gray-800 text-sm mt-0.5">{formatAddress(job.propertyAddress) || 'No address'}</p>
                        {job.lastMove && (
                            <p className="text-navy text-base mt-2">
                                {job.lastMove.fromDate && <span className="line-through text-gray-600">{shortDate(job.lastMove.fromDate)}</span>}
                                {job.lastMove.fromDate && ' → '}
                                <span className="font-bold">{shortDate(job.lastMove.toDate || job.serviceDate)}</span>
                            </p>
                        )}
                        {job.lastMove?.reason && <p className="text-gray-800 text-sm mt-1">Why: {job.lastMove.reason}</p>}
                        {job.invoiceNumber && <p className="text-gray-700 text-sm mt-1">Job #{job.invoiceNumber}</p>}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => onOpen(job)}
                                className="flex-1 bg-white border-2 border-navy text-navy text-base font-semibold py-2.5 rounded-lg active:scale-[0.98]"
                            >
                                Open Job
                            </button>
                            <button
                                onClick={() => onConfirm(job._id)}
                                disabled={confirmingId === job._id}
                                className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-base font-semibold py-2.5 rounded-lg transition-colors active:scale-[0.98]"
                            >
                                {confirmingId === job._id ? 'Saving...' : 'Got it'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
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
    const [toast, setToast] = useState(null)
    const [openJobs, setOpenJobs] = useState([])
    const [reschedules, setReschedules] = useState([])
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
            setToast('Cancelation confirmed')
        } catch (err) {
            console.error(err)
            setToast("Couldn't confirm — try again")
        } finally {
            setConfirmingId(null)
        }
    }

    async function handleConfirmReschedule(id) {
        setConfirmingId(id)
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'acknowledgeReschedule', invoiceId: id }),
            })
            if (!res.ok) throw new Error('Failed')
            setReschedules((prev) => prev.filter((j) => j._id !== id))
            setToast('Got it')
        } catch (err) {
            console.error(err)
            setToast("Couldn't save — try again")
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
    // Same for unfinished jobs from earlier days.
    useEffect(() => {
        fetchCancelations()
        fetch(`/api/invoices?openBefore=${localToday()}`)
            .then((res) => (res.ok ? res.json() : { invoices: [] }))
            .then((data) => setOpenJobs(data.invoices || []))
            .catch(() => { }) // non-critical — the card just doesn't show if this fails
        fetch('/api/invoices?unconfirmedReschedules=true')
            .then((res) => (res.ok ? res.json() : { invoices: [] }))
            .then((data) => setReschedules(data.invoices || []))
            .catch(() => { }) // non-critical — the card just doesn't show if this fails
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
            <Toast message={toast} onDone={() => setToast(null)} />
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

                <RescheduleAlert
                    jobs={reschedules}
                    confirmingId={confirmingId}
                    onConfirm={handleConfirmReschedule}
                    onOpen={onOpenInvoice}
                />

                <OpenJobs jobs={openJobs} onOpen={onOpenInvoice} />

                {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load the calendar.</p>}

                {status === 'ready' && (
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
                        {/* ---- left: calendar grid ---- */}
                        <div className="bg-white/10 border border-white/10 rounded-2xl p-6">
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
                                    <p key={i} className="text-white/70 text-xs text-center uppercase tracking-widest py-1">{d}</p>
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
                                                    {inv.movedFrom && (
                                                        <p className="mt-2 inline-block bg-white text-navy text-xs font-bold px-2 py-0.5 rounded-full">
                                                            📅 Moved from {shortDate(inv.movedFrom)}
                                                        </p>
                                                    )}
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