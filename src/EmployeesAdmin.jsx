import { useState, useEffect } from 'react'

function formatAddress(address) {
    if (!address || (!address.street && !address.city && !address.state && !address.zip)) return ''
    const cityStateZip = [address.city, address.state].filter(Boolean).join(', ')
    return [address.street, [cityStateZip, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

function formatMoney(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
}

export default function EmployeesAdmin({ onBack }) {
    const [employees, setEmployees] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [selected, setSelected] = useState(null)

    function fetchRoster() {
        setStatus('loading')
        fetch('/api/timeclock?action=roster')
            .then((res) => {
                if (!res.ok) throw new Error('Failed')
                return res.json()
            })
            .then((data) => {
                setEmployees(data.employees || [])
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }

    useEffect(() => {
        fetchRoster()
    }, [])

    if (selected) {
        return (
            <EmployeeDetail
                employee={selected}
                onBack={() => {
                    setSelected(null)
                    fetchRoster()
                }}
            />
        )
    }

    const active = employees.filter((e) => e.active !== false)
    const inactive = employees.filter((e) => e.active === false)

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Desktop
                </button>

                <div className="mb-8">
                    <h1 className="font-serif text-2xl text-white">Employees</h1>
                    <p className="text-white/40 text-xs mt-1">{status === 'ready' ? `${active.length} active` : ''}</p>
                </div>

                {status === 'loading' && <p className="text-white/40 text-sm text-center py-10">Loading...</p>}
                {status === 'error' && <p className="text-red-400 text-sm text-center py-10">Couldn't load employees.</p>}

                {status === 'ready' && (
                    <>
                        <div className="flex flex-col gap-3 mb-6">
                            {active.map((e) => (
                                <EmployeeRow key={e._id} employee={e} onClick={() => setSelected(e)} />
                            ))}
                        </div>

                        {inactive.length > 0 && (
                            <>
                                <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Inactive</p>
                                <div className="flex flex-col gap-3">
                                    {inactive.map((e) => (
                                        <EmployeeRow key={e._id} employee={e} onClick={() => setSelected(e)} />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

function EmployeeRow({ employee, onClick }) {
    const totalPaid = (employee.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    return (
        <button
            onClick={onClick}
            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-colors active:scale-[0.98]"
        >
            <p className="text-white text-lg font-serif">{employee.firstName} {employee.lastName}</p>
            <p className="text-white/50 text-sm mt-1">{employee.phone || employee.email || '—'}</p>
            <p className="text-white/30 text-xs mt-1">Paid to date: {formatMoney(totalPaid)}</p>
        </button>
    )
}

function EmployeeDetail({ employee: initialEmployee, onBack }) {
    const [employee, setEmployee] = useState(initialEmployee)
    const [entries, setEntries] = useState([])
    const [entriesStatus, setEntriesStatus] = useState('loading') // loading | ready | error

    const [editingProfile, setEditingProfile] = useState(false)
    const [profileDraft, setProfileDraft] = useState({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        phone: employee.phone || '',
        email: employee.email || '',
        startDate: employee.startDate || '',
        leaveDate: employee.leaveDate || '',
        notes: employee.notes || '',
        active: employee.active !== false,
    })
    const [profileStatus, setProfileStatus] = useState('idle') // idle | saving | error

    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [paymentDraft, setPaymentDraft] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
    const [paymentStatus, setPaymentStatus] = useState('idle') // idle | saving | error

    const [editingEntry, setEditingEntry] = useState(null) // entry object being edited, or null
    const [entryStatus, setEntryStatus] = useState('idle') // idle | saving | error

    function fetchEntries() {
        setEntriesStatus('loading')
        fetch(`/api/timeclock?action=entries&employeeId=${employee._id}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed')
                return res.json()
            })
            .then((data) => {
                setEntries(data.entries || [])
                setEntriesStatus('ready')
            })
            .catch(() => setEntriesStatus('error'))
    }

    useEffect(() => {
        fetchEntries()
    }, [])

    const totalEarned = entries.reduce((sum, e) => sum + (Number(e.totalPay) || 0), 0)
    const totalPaid = (employee.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const balance = Math.round((totalEarned - totalPaid) * 100) / 100
    const flaggedEntries = entries.filter((e) => e.rateFlagged)

    async function saveProfile() {
        setProfileStatus('saving')
        try {
            const res = await fetch('/api/timeclock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateEmployee', employeeId: employee._id, ...profileDraft }),
            })
            if (!res.ok) throw new Error('Failed')
            setEmployee((prev) => ({ ...prev, ...profileDraft }))
            setEditingProfile(false)
            setProfileStatus('idle')
        } catch (err) {
            console.error(err)
            setProfileStatus('error')
        }
    }

    async function recordPayment() {
        if (!paymentDraft.amount || Number(paymentDraft.amount) <= 0) return
        setPaymentStatus('saving')
        try {
            const res = await fetch('/api/timeclock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'adminRecordPayment', employeeId: employee._id, ...paymentDraft }),
            })
            if (!res.ok) throw new Error('Failed')
            const newPayment = { _key: `local-${Date.now()}`, amount: Number(paymentDraft.amount), date: paymentDraft.date, note: paymentDraft.note, unread: true }
            setEmployee((prev) => ({ ...prev, payments: [...(prev.payments || []), newPayment] }))
            setShowPaymentForm(false)
            setPaymentDraft({ amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
            setPaymentStatus('idle')
        } catch (err) {
            console.error(err)
            setPaymentStatus('error')
        }
    }

    function openEditEntry(entry) {
        setEditingEntry({
            _id: entry._id,
            clockIn: entry.clockIn ? entry.clockIn.slice(0, 16) : '',
            clockOut: entry.clockOut ? entry.clockOut.slice(0, 16) : '',
            jobType: entry.jobType,
            payRate: entry.payRate,
            jobsAccomplished: entry.jobsAccomplished || '',
            notes: entry.notes || '',
        })
    }

    async function saveEntry() {
        setEntryStatus('saving')
        try {
            const res = await fetch('/api/timeclock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'adminEditEntry',
                    entryId: editingEntry._id,
                    clockIn: editingEntry.clockIn ? new Date(editingEntry.clockIn).toISOString() : undefined,
                    clockOut: editingEntry.clockOut ? new Date(editingEntry.clockOut).toISOString() : undefined,
                    jobType: editingEntry.jobType,
                    payRate: Number(editingEntry.payRate),
                    jobsAccomplished: editingEntry.jobsAccomplished,
                    notes: editingEntry.notes,
                    rateFlagged: false,
                }),
            })
            if (!res.ok) throw new Error('Failed')
            setEditingEntry(null)
            setEntryStatus('idle')
            fetchEntries()
        } catch (err) {
            console.error(err)
            setEntryStatus('error')
        }
    }

    return (
        <div className="min-h-screen bg-navy px-4 py-10">
            <div className="w-full max-w-2xl mx-auto">
                <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
                    ← Employees
                </button>

                <div className="flex items-start justify-between mb-6 gap-3">
                    <div>
                        <h1 className="font-serif text-2xl text-white">{employee.firstName} {employee.lastName}</h1>
                        <p className="text-white/40 text-sm mt-1">{employee.phone}{employee.phone && employee.email ? ' · ' : ''}{employee.email}</p>
                    </div>
                    {!editingProfile && (
                        <button onClick={() => setEditingProfile(true)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-lg shrink-0">
                            ✎
                        </button>
                    )}
                </div>

                {editingProfile ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 mb-6">
                        <input type="text" placeholder="First name" value={profileDraft.firstName}
                            onChange={(e) => setProfileDraft((d) => ({ ...d, firstName: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <input type="text" placeholder="Last name" value={profileDraft.lastName}
                            onChange={(e) => setProfileDraft((d) => ({ ...d, lastName: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <input type="tel" placeholder="Phone" value={profileDraft.phone}
                            onChange={(e) => setProfileDraft((d) => ({ ...d, phone: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <input type="email" placeholder="Email" value={profileDraft.email}
                            onChange={(e) => setProfileDraft((d) => ({ ...d, email: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-white/40 text-xs mb-1">Start date</p>
                                <input type="date" value={profileDraft.startDate}
                                    onChange={(e) => setProfileDraft((d) => ({ ...d, startDate: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                            </div>
                            <div>
                                <p className="text-white/40 text-xs mb-1">Leave date</p>
                                <input type="date" value={profileDraft.leaveDate}
                                    onChange={(e) => setProfileDraft((d) => ({ ...d, leaveDate: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                            </div>
                        </div>
                        <textarea placeholder="Notes (only you see these)" value={profileDraft.notes}
                            onChange={(e) => setProfileDraft((d) => ({ ...d, notes: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-24 resize-none" />
                        <button onClick={() => setProfileDraft((d) => ({ ...d, active: !d.active }))}
                            className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${profileDraft.active ? 'bg-brand-green/20 text-brand-green' : 'bg-white/5 text-white/50 border border-white/10'}`}>
                            {profileDraft.active ? 'Active' : 'Inactive — tap to reactivate'}
                        </button>
                        {profileStatus === 'error' && <p className="text-red-400 text-sm">Something went wrong.</p>}
                        <div className="flex gap-2">
                            <button onClick={saveProfile} disabled={profileStatus === 'saving'}
                                className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                {profileStatus === 'saving' ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => setEditingProfile(false)}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    employee.notes && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Notes (only you see this)</p>
                            <p className="text-white/70 text-sm">{employee.notes}</p>
                        </div>
                    )
                )}

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Total Earned</p>
                        <p className="text-white text-xl font-serif">{formatMoney(totalEarned)}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Balance Owed</p>
                        <p className={`text-xl font-serif ${balance > 0 ? 'text-accent' : 'text-brand-green'}`}>{formatMoney(balance)}</p>
                    </div>
                </div>

                {flaggedEntries.length > 0 && (
                    <div className="bg-accent/10 border border-accent/40 rounded-2xl p-4 mb-6">
                        <p className="text-accent text-sm font-semibold">{flaggedEntries.length} entr{flaggedEntries.length === 1 ? 'y needs' : 'ies need'} rate review</p>
                        <p className="text-white/50 text-xs mt-1">Pay rate differed from the standard for that job type — tap the entry below to review.</p>
                    </div>
                )}

                {showPaymentForm ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 mb-6">
                        <p className="text-white text-lg font-serif mb-1">Record Payment</p>
                        <input type="number" placeholder={`Amount (balance: ${formatMoney(balance)})`} value={paymentDraft.amount}
                            onChange={(e) => setPaymentDraft((d) => ({ ...d, amount: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <input type="date" value={paymentDraft.date}
                            onChange={(e) => setPaymentDraft((d) => ({ ...d, date: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <input type="text" placeholder="Note (optional)" value={paymentDraft.note}
                            onChange={(e) => setPaymentDraft((d) => ({ ...d, note: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        {paymentStatus === 'error' && <p className="text-red-400 text-sm">Something went wrong.</p>}
                        <div className="flex gap-2">
                            <button onClick={recordPayment} disabled={paymentStatus === 'saving'}
                                className="flex-1 bg-brand-green hover:opacity-90 disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                {paymentStatus === 'saving' ? 'Saving...' : 'Record Payment'}
                            </button>
                            <button onClick={() => setShowPaymentForm(false)}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setShowPaymentForm(true)}
                        className="w-full bg-brand-green hover:opacity-90 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-6">
                        + Record Payment
                    </button>
                )}

                {employee.payments && employee.payments.length > 0 && (
                    <div className="mb-6">
                        <p className="text-white text-lg font-serif mb-3">Payments</p>
                        <div className="flex flex-col gap-2">
                            {[...employee.payments].reverse().map((p) => (
                                <div key={p._key} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                    <p className="text-white text-sm">{formatMoney(p.amount)}</p>
                                    <p className="text-white/40 text-xs mt-0.5">{p.date}{p.note ? ` · ${p.note}` : ''}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="text-white text-lg font-serif mb-3">Timecards</p>
                {entriesStatus === 'loading' && <p className="text-white/40 text-sm text-center py-6">Loading...</p>}
                {entriesStatus === 'ready' && entries.length === 0 && <p className="text-white/40 text-sm text-center py-6">No timecards yet.</p>}
                <div className="flex flex-col gap-2">
                    {entries.map((e) => (
                        <button key={e._id} onClick={() => openEditEntry(e)}
                            className={`text-left rounded-xl px-4 py-3 border transition-colors ${e.rateFlagged ? 'bg-accent/10 border-accent/40' : 'bg-white/5 hover:bg-white/10 border-white/10'
                                }`}>
                            <div className="flex items-center justify-between">
                                <p className="text-white text-sm">{new Date(e.clockIn).toLocaleDateString()} · {e.jobType}</p>
                                {!e.clockOut && <span className="text-brand-green text-xs font-semibold">STILL CLOCKED IN</span>}
                            </div>
                            <p className="text-white/40 text-xs mt-0.5">{formatAddress(e.propertyAddress)}</p>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-white/40 text-xs">{e.totalHours != null ? `${e.totalHours} hrs` : '—'} · ${e.payRate}/hr</p>
                                <p className="text-white/70 text-sm">{e.totalPay != null ? formatMoney(e.totalPay) : '—'}</p>
                            </div>
                        </button>
                    ))}
                </div>

                {editingEntry && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 mt-6">
                        <p className="text-white text-lg font-serif mb-1">Edit Timecard</p>
                        <div>
                            <p className="text-white/40 text-xs mb-1">Clock In</p>
                            <input type="datetime-local" value={editingEntry.clockIn}
                                onChange={(e) => setEditingEntry((d) => ({ ...d, clockIn: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        </div>
                        <div>
                            <p className="text-white/40 text-xs mb-1">Clock Out (leave blank if still clocked in)</p>
                            <input type="datetime-local" value={editingEntry.clockOut}
                                onChange={(e) => setEditingEntry((d) => ({ ...d, clockOut: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        </div>
                        <div className="flex gap-2">
                            {['Plumbing', 'Contracting'].map((t) => (
                                <button key={t} onClick={() => setEditingEntry((d) => ({ ...d, jobType: t }))}
                                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${editingEntry.jobType === t ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                        <input type="number" placeholder="Pay rate" value={editingEntry.payRate}
                            onChange={(e) => setEditingEntry((d) => ({ ...d, payRate: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue" />
                        <textarea placeholder="Jobs accomplished" value={editingEntry.jobsAccomplished}
                            onChange={(e) => setEditingEntry((d) => ({ ...d, jobsAccomplished: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-20 resize-none" />
                        <textarea placeholder="Notes" value={editingEntry.notes}
                            onChange={(e) => setEditingEntry((d) => ({ ...d, notes: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-20 resize-none" />
                        {entryStatus === 'error' && <p className="text-red-400 text-sm">Something went wrong.</p>}
                        <div className="flex gap-2">
                            <button onClick={saveEntry} disabled={entryStatus === 'saving'}
                                className="flex-1 bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                {entryStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button onClick={() => setEditingEntry(null)}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}