import { useState, useEffect, useRef } from 'react'

const EMPTY_INTAKE = { firstName: '', lastName: '', phone: '', email: '', startDate: new Date().toISOString().slice(0, 10), pin: '', confirmPin: '' }

function formatAddress(address) {
    if (!address || (!address.street && !address.city && !address.state && !address.zip)) return ''
    const cityStateZip = [address.city, address.state].filter(Boolean).join(', ')
    return [address.street, [cityStateZip, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

function formatDuration(ms) {
    const totalMinutes = Math.max(Math.floor(ms / 1000 / 60), 0)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h ${minutes}m`
}

export default function Employee() {
    const [view, setView] = useState('landing') // landing | intake | intake-review | pin-verify | portal
    const [employees, setEmployees] = useState([])
    const [searchTerm, setSearchTerm] = useState('')

    const [selectedEmployee, setSelectedEmployee] = useState(null) // { id, firstName }
    const [verifiedPin, setVerifiedPin] = useState('')

    const [intake, setIntake] = useState(EMPTY_INTAKE)
    const [intakeError, setIntakeError] = useState('')
    const [intakeStatus, setIntakeStatus] = useState('idle')

    const [pinInput, setPinInput] = useState('')
    const [pinAttempts, setPinAttempts] = useState(0)
    const [pinStatus, setPinStatus] = useState('idle') // idle | checking | error | locked

    const [tab, setTab] = useState('Timeclock')

    useEffect(() => {
        fetch('/api/timeclock')
            .then((res) => (res.ok ? res.json() : { employees: [] }))
            .then((data) => setEmployees(data.employees || []))
            .catch(() => { })
    }, [])

    function backToLanding() {
        setView('landing')
        setSelectedEmployee(null)
        setVerifiedPin('')
        setPinInput('')
        setPinAttempts(0)
        setPinStatus('idle')
        setIntake(EMPTY_INTAKE)
        setIntakeError('')
    }

    const filteredEmployees = employees.filter((e) => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return true
        return `${e.firstName} ${e.lastName}`.toLowerCase().includes(term)
    })

    function goToPinVerify(employee) {
        setSelectedEmployee(employee)
        setPinInput('')
        setPinAttempts(0)
        setPinStatus('idle')
        setView('pin-verify')
    }

    // ---- intake ----
    function updateIntake(field, value) {
        setIntake((prev) => ({ ...prev, [field]: value }))
    }

    function submitIntake() {
        const { firstName, lastName, pin, confirmPin } = intake
        if (!firstName.trim() || !lastName.trim()) {
            setIntakeError('First and last name are required.')
            return
        }
        if (!/^\d{4}$/.test(pin)) {
            setIntakeError('PIN must be exactly 4 digits.')
            return
        }
        if (pin !== confirmPin) {
            setIntakeError("PINs don't match — try again.")
            return
        }
        setIntakeError('')
        setView('intake-review')
    }

    async function confirmIntake() {
        setIntakeStatus('saving')
        try {
            const res = await fetch('/api/timeclock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'createEmployee', ...intake }),
            })
            if (!res.ok) throw new Error('Failed')
            const data = await res.json()
            setIntakeStatus('idle')
            goToPinVerify({ _id: data.id, firstName: intake.firstName })
        } catch (err) {
            console.error(err)
            setIntakeStatus('error')
        }
    }

    // ---- pin verify ----
    async function submitPin() {
        if (pinStatus === 'locked') return
        setPinStatus('checking')
        try {
            const res = await fetch('/api/timeclock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verifyPin', employeeId: selectedEmployee._id, pin: pinInput }),
            })
            if (!res.ok) {
                const nextAttempts = pinAttempts + 1
                setPinAttempts(nextAttempts)
                setPinInput('')
                setPinStatus(nextAttempts >= 3 ? 'locked' : 'error')
                return
            }
            setVerifiedPin(pinInput)
            setPinStatus('idle')
            setView('portal')
            setTab('Timeclock')
        } catch (err) {
            console.error(err)
            setPinStatus('error')
        }
    }

    if (view === 'landing') {
        return (
            <div className="min-h-screen bg-navy px-4 py-10">
                <div className="w-full max-w-lg mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="font-serif text-2xl text-white">Employee Portal</h1>
                        <p className="text-white/40 text-xs mt-1">Adirondack Advanced Water Solutions</p>
                    </div>

                    <button
                        onClick={() => { setIntake(EMPTY_INTAKE); setIntakeError(''); setView('intake') }}
                        className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-6"
                    >
                        + New Employee
                    </button>

                    <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Or find your name</p>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search your name..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-4"
                    />
                    <div className="flex flex-col gap-2">
                        {filteredEmployees.map((e) => (
                            <button
                                key={e._id}
                                onClick={() => goToPinVerify(e)}
                                className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                            >
                                <p className="text-white text-base">{e.firstName} {e.lastName}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (view === 'intake') {
        return (
            <div className="min-h-screen bg-navy px-4 py-10">
                <div className="w-full max-w-lg mx-auto">
                    <button onClick={backToLanding} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                        ← Back
                    </button>
                    <div className="text-center mb-8">
                        <h1 className="font-serif text-2xl text-white">Welcome!</h1>
                        <p className="text-white/40 text-xs mt-1">Let's get you set up.</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3">
                        <input type="text" placeholder="First name" value={intake.firstName}
                            onChange={(e) => updateIntake('firstName', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <input type="text" placeholder="Last name" value={intake.lastName}
                            onChange={(e) => updateIntake('lastName', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <input type="tel" placeholder="Phone" value={intake.phone}
                            onChange={(e) => updateIntake('phone', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <input type="email" placeholder="Email" value={intake.email}
                            onChange={(e) => updateIntake('email', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <div>
                            <p className="text-white/40 text-xs mb-1">Start date</p>
                            <input type="date" value={intake.startDate}
                                onChange={(e) => updateIntake('startDate', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        </div>
                        <p className="text-white/40 text-xs uppercase tracking-widest mt-2">Choose a 4-digit PIN</p>
                        <p className="text-white/30 text-xs">You'll use this every time you clock in — pick something you'll remember, don't share it.</p>
                        <input type="password" inputMode="numeric" maxLength={4} placeholder="PIN" value={intake.pin}
                            onChange={(e) => updateIntake('pin', e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue text-center tracking-[0.5em]" />
                        <input type="password" inputMode="numeric" maxLength={4} placeholder="Confirm PIN" value={intake.confirmPin}
                            onChange={(e) => updateIntake('confirmPin', e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue text-center tracking-[0.5em]" />
                        {intakeError && <p className="text-red-400 text-sm">{intakeError}</p>}
                        <button onClick={submitIntake}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mt-2">
                            Review
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (view === 'intake-review') {
        return (
            <div className="min-h-screen bg-navy px-4 py-10">
                <div className="w-full max-w-lg mx-auto">
                    <button onClick={() => setView('intake')} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                        ← Back to edit
                    </button>
                    <div className="text-center mb-8">
                        <h1 className="font-serif text-2xl text-white">Review before saving</h1>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 mb-6">
                        <ReviewRow label="Name" value={`${intake.firstName} ${intake.lastName}`} />
                        <ReviewRow label="Phone" value={intake.phone} />
                        <ReviewRow label="Email" value={intake.email} />
                        <ReviewRow label="Start Date" value={intake.startDate} />
                        <ReviewRow label="PIN" value="••••" />
                    </div>
                    {intakeStatus === 'error' && <p className="text-red-400 text-sm text-center mb-4">Something went wrong — try again.</p>}
                    <button onClick={confirmIntake} disabled={intakeStatus === 'saving'}
                        className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                        {intakeStatus === 'saving' ? 'Saving...' : 'Confirm & Continue'}
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'pin-verify') {
        return (
            <div className="min-h-screen bg-navy flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-sm mx-auto text-center">
                    <button onClick={backToLanding} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                        ← Back
                    </button>
                    <p className="text-white text-xl font-serif mb-1">Hi, {selectedEmployee?.firstName}</p>
                    <p className="text-white/40 text-sm mb-6">Enter your PIN</p>

                    {pinStatus === 'locked' ? (
                        <div className="bg-white/5 border border-red-400/40 rounded-2xl p-6">
                            <p className="text-red-400 text-sm mb-2">Too many incorrect tries.</p>
                            <p className="text-white/50 text-xs">Ask Michael to check or reset your PIN. Leaving and coming back to this page will let you try again.</p>
                        </div>
                    ) : (
                        <>
                            <input
                                type="password" inputMode="numeric" maxLength={4} value={pinInput}
                                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-2xl py-4 px-4 outline-none focus:border-blue text-center tracking-[0.5em] mb-3"
                                autoFocus
                            />
                            {pinStatus === 'error' && <p className="text-red-400 text-sm mb-3">Incorrect PIN — {3 - pinAttempts} tries left.</p>}
                            <button
                                onClick={submitPin}
                                disabled={pinStatus === 'checking' || pinInput.length !== 4}
                                className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                {pinStatus === 'checking' ? 'Checking...' : 'Enter'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // ---- portal: Profile / Timeclock ----
    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-lg mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="font-serif text-2xl text-white">{selectedEmployee?.firstName}</h1>
                        <p className="text-white/40 text-xs mt-1">Adirondack Advanced Water Solutions</p>
                    </div>
                    <button onClick={backToLanding} className="text-white/40 hover:text-white/70 text-sm transition-colors">
                        Sign out
                    </button>
                </div>

                <div className="flex gap-2 mb-6">
                    {['Timeclock', 'Profile'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${tab === t ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {tab === 'Timeclock' && <TimeclockTab employeeId={selectedEmployee._id} pin={verifiedPin} />}
                {tab === 'Profile' && <ProfileTab employeeId={selectedEmployee._id} pin={verifiedPin} />}
            </div>
        </div>
    )
}

function ReviewRow({ label, value }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <p className="text-white/40 text-[11px] uppercase tracking-widest">{label}</p>
            <p className="text-white text-sm mt-0.5">{value?.trim?.() ? value : <span className="text-white/30 italic">—</span>}</p>
        </div>
    )
}

function TimeclockTab({ employeeId, pin }) {
    const [status, setStatus] = useState('loading') // loading | not-clocked-in | clocked-in | clocking-out
    const [entry, setEntry] = useState(null)
    const [onBreak, setOnBreak] = useState(false)
    const [now, setNow] = useState(Date.now())

    const [properties, setProperties] = useState([])
    const [propertySearch, setPropertySearch] = useState('')
    const [selectedPropertyId, setSelectedPropertyId] = useState(null)
    const [selectedPropertyLabel, setSelectedPropertyLabel] = useState('')
    const [jobType, setJobType] = useState('Plumbing')
    const [rateOverride, setRateOverride] = useState('')
    const [actionStatus, setActionStatus] = useState('idle') // idle | working | error
    const [actionError, setActionError] = useState('')

    const [jobsAccomplished, setJobsAccomplished] = useState('')
    const [dayNotes, setDayNotes] = useState('')
    const [daySummary, setDaySummary] = useState(null) // { totalHours, totalPay }

    function fetchStatus() {
        fetch(`/api/timeclock?action=status&employeeId=${employeeId}&pin=${pin}`)
            .then((res) => res.json())
            .then((data) => {
                setEntry(data.entry)
                setOnBreak(data.onBreak)
                setStatus(data.clockedIn ? 'clocked-in' : 'not-clocked-in')
            })
            .catch(() => setStatus('not-clocked-in'))
    }

    useEffect(() => {
        fetchStatus()
        fetch('/api/properties?activeOnly=true')
            .then((res) => (res.ok ? res.json() : { properties: [] }))
            .then((data) => setProperties(data.properties || []))
            .catch(() => { })
    }, [])

    useEffect(() => {
        if (status !== 'clocked-in' || onBreak) return
        const interval = setInterval(() => setNow(Date.now()), 15000)
        return () => clearInterval(interval)
    }, [status, onBreak])

    const filteredProperties = properties.filter((p) => {
        const term = propertySearch.trim().toLowerCase()
        if (!term) return true
        return formatAddress(p.address).toLowerCase().includes(term)
    })

    async function handleClockIn() {
        if (!selectedPropertyId) {
            setActionError('Pick which property you\'re working at first.')
            return
        }
        setActionStatus('working')
        setActionError('')
        try {
            const res = await fetch('/api/timeclock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'clockIn', employeeId, pin, propertyId: selectedPropertyId, jobType,
                    payRate: rateOverride ? Number(rateOverride) : undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')
            setActionStatus('idle')
            fetchStatus()
        } catch (err) {
            setActionStatus('error')
            setActionError(err.message)
        }
    }

    async function handleBreak(action) {
        setActionStatus('working')
        try {
            const res = await fetch('/api/timeclock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, employeeId, pin }),
            })
            if (!res.ok) throw new Error('Failed')
            setActionStatus('idle')
            fetchStatus()
        } catch (err) {
            setActionStatus('error')
        }
    }

    async function handleClockOut() {
        setActionStatus('working')
        try {
            const res = await fetch('/api/timeclock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clockOut', employeeId, pin, jobsAccomplished, notes: dayNotes }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')
            setDaySummary({ totalHours: data.totalHours, totalPay: data.totalPay })
            setActionStatus('idle')
        } catch (err) {
            setActionStatus('error')
        }
    }

    function startOverAfterDay() {
        setDaySummary(null)
        setJobsAccomplished('')
        setDayNotes('')
        setSelectedPropertyId(null)
        setSelectedPropertyLabel('')
        setPropertySearch('')
        setRateOverride('')
        fetchStatus()
    }

    if (status === 'loading') {
        return <p className="text-white/40 text-sm text-center py-10">Loading...</p>
    }

    if (daySummary) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-brand-green text-4xl mb-4">✓</p>
                <p className="text-white text-xl font-serif mb-2">Clocked out</p>
                <p className="text-white/60 text-sm mb-1">{formatDuration(daySummary.totalHours * 60 * 60 * 1000)} today</p>
                <p className="text-white text-lg mb-6">{formatMoney(daySummary.totalPay)} earned</p>
                <button onClick={startOverAfterDay} className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                    Done
                </button>
            </div>
        )
    }

    if (status === 'not-clocked-in') {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <p className="text-white text-xl font-serif mb-4">Ready to start?</p>

                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Job type</p>
                <div className="flex gap-2 mb-4">
                    {['Plumbing', 'Contracting'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setJobType(t)}
                            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${jobType === t ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Property</p>
                {selectedPropertyId ? (
                    <div className="bg-white/5 border border-blue rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                        <p className="text-white text-sm">{selectedPropertyLabel}</p>
                        <button onClick={() => { setSelectedPropertyId(null); setSelectedPropertyLabel('') }} className="text-white/40 text-xs">Change</button>
                    </div>
                ) : (
                    <>
                        <input
                            type="text" value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)}
                            placeholder="Search address..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-2"
                        />
                        {properties.length === 0 ? (
                            <p className="text-white/40 text-sm mb-4">
                                No jobs currently marked as started. Ask Michael to hit "Start Job" on the invoice first.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2 mb-4">
                                {filteredProperties.map((p) => (
                                    <button key={p._id}
                                        onClick={() => { setSelectedPropertyId(p._id); setSelectedPropertyLabel(formatAddress(p.address)) }}
                                        className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors">
                                        <p className="text-white text-sm">{formatAddress(p.address)}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
                    Pay rate — leave blank for standard {jobType} rate
                </p>
                <input
                    type="number" value={rateOverride} onChange={(e) => setRateOverride(e.target.value)}
                    placeholder="e.g. 22.50"
                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-4"
                />

                {actionError && <p className="text-red-400 text-sm mb-3">{actionError}</p>}
                <button onClick={handleClockIn} disabled={actionStatus === 'working'}
                    className="w-full bg-brand-green hover:opacity-90 disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                    {actionStatus === 'working' ? 'Clocking in...' : 'Clock In'}
                </button>
            </div>
        )
    }

    // clocked-in
    const clockInMs = new Date(entry.clockIn).getTime()
    const completedBreakMs = (entry.breaks || []).reduce((sum, b) => {
        if (!b.breakEnd) return sum
        return sum + (new Date(b.breakEnd).getTime() - new Date(b.breakStart).getTime())
    }, 0)
    const currentBreakMs = onBreak ? now - new Date(entry.breaks[entry.breaks.length - 1].breakStart).getTime() : 0
    const elapsedMs = onBreak ? clockInMs : now - clockInMs - completedBreakMs

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{entry.propertyAddress ? formatAddress(entry.propertyAddress) : ''}</p>
            <p className="text-white/40 text-xs mb-4">{entry.jobType}</p>

            {onBreak ? (
                <>
                    <p className="text-accent text-4xl font-serif mb-1">On Break</p>
                    <p className="text-white/40 text-sm mb-6">{formatDuration(currentBreakMs)} so far</p>
                </>
            ) : (
                <>
                    <p className="text-white text-4xl font-serif mb-1">{formatDuration(now - clockInMs - completedBreakMs)}</p>
                    <p className="text-white/40 text-sm mb-6">worked today</p>
                </>
            )}

            <div className="flex gap-2 mb-3">
                <button
                    onClick={() => handleBreak(onBreak ? 'breakEnd' : 'breakStart')}
                    disabled={actionStatus === 'working'}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                >
                    {onBreak ? 'End Break' : 'Start Break'}
                </button>
            </div>

            {!onBreak && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left mb-3">
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Wrapping up for the day?</p>
                    <textarea placeholder="Jobs accomplished..." value={jobsAccomplished} onChange={(e) => setJobsAccomplished(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm py-2 px-3 outline-none focus:border-blue h-16 resize-none mb-2" />
                    <textarea placeholder="Notes for tomorrow..." value={dayNotes} onChange={(e) => setDayNotes(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm py-2 px-3 outline-none focus:border-blue h-16 resize-none mb-3" />
                    <button onClick={handleClockOut} disabled={actionStatus === 'working'}
                        className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                        {actionStatus === 'working' ? 'Clocking out...' : 'Clock Out'}
                    </button>
                </div>
            )}
        </div>
    )
}

function ProfileTab({ employeeId, pin }) {
    const [data, setData] = useState(null)
    const [status, setStatus] = useState('loading') // loading | ready | error

    function fetchHistory() {
        setStatus('loading')
        fetch(`/api/timeclock?action=history&employeeId=${employeeId}&pin=${pin}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed')
                return res.json()
            })
            .then((d) => {
                setData(d)
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        fetchHistory()
    }, [])

    async function markEntryRead(entryId) {
        await fetch('/api/timeclock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'markRead', entryId }),
        })
        fetchHistory()
    }

    async function markPaymentRead(paymentKey) {
        await fetch('/api/timeclock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'markRead', employeeId, paymentKey }),
        })
        fetchHistory()
    }

    if (status === 'loading') return <p className="text-white/40 text-sm text-center py-10">Loading...</p>
    if (status === 'error') return <p className="text-red-400 text-sm text-center py-10">Couldn't load your profile.</p>

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Total Earned</p>
                    <p className="text-white text-xl font-serif">{formatMoney(data.totalEarned)}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Balance Owed</p>
                    <p className={`text-xl font-serif ${data.balance > 0 ? 'text-accent' : 'text-brand-green'}`}>{formatMoney(data.balance)}</p>
                </div>
            </div>

            <div>
                <p className="text-white text-lg font-serif mb-3">Payments Received</p>
                <div className="flex flex-col gap-2">
                    {data.payments.length === 0 && <p className="text-white/40 text-sm">None yet.</p>}
                    {[...data.payments].reverse().map((p) => (
                        <button
                            key={p._key}
                            onClick={() => p.unread && markPaymentRead(p._key)}
                            className={`text-left rounded-xl px-4 py-3 border transition-colors ${p.unread ? 'bg-brand-green/10 border-brand-green/40' : 'bg-white/5 border-white/10'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-white text-sm">{formatMoney(p.amount)}</p>
                                {p.unread && <span className="text-brand-green text-xs font-semibold">NEW</span>}
                            </div>
                            <p className="text-white/40 text-xs mt-0.5">{p.date}{p.note ? ` · ${p.note}` : ''}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-white text-lg font-serif mb-3">Work History</p>
                <div className="flex flex-col gap-2">
                    {data.entries.length === 0 && <p className="text-white/40 text-sm">No completed days yet.</p>}
                    {data.entries.map((e) => (
                        <button
                            key={e._id}
                            onClick={() => e.editedByMichael && markEntryRead(e._id)}
                            className={`text-left rounded-xl px-4 py-3 border transition-colors ${e.editedByMichael ? 'bg-accent/10 border-accent/40' : 'bg-white/5 border-white/10'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-white text-sm">{new Date(e.clockIn).toLocaleDateString()} · {e.jobType}</p>
                                {e.editedByMichael && <span className="text-accent text-xs font-semibold">UPDATED</span>}
                            </div>
                            <p className="text-white/40 text-xs mt-0.5">{formatAddress(e.propertyAddress)}</p>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-white/40 text-xs">{e.totalHours} hrs</p>
                                <p className="text-white/70 text-sm">{formatMoney(e.totalPay)}</p>
                            </div>
                            {e.jobsAccomplished && <p className="text-white/40 text-xs mt-2 italic">{e.jobsAccomplished}</p>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}