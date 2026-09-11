import { createClient } from '@sanity/client'

const readClient = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_READ_TOKEN,
    useCdn: false,
})

const writeClient = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
})

// Company-wide default hourly rates by job type. An employee entering a
// different rate at clock-in doesn't change these — it just flags that
// specific entry for Michael to review in the admin view.
const DEFAULT_RATES = { Plumbing: 25, Contracting: 20 }

function cleanText(value, maxLength = 1000) {
    if (typeof value !== 'string') return ''
    return value.slice(0, maxLength)
}

function randomKey() {
    return Math.random().toString(36).slice(2, 10)
}

function computeTotals(clockIn, clockOut, breaks) {
    const clockInMs = new Date(clockIn).getTime()
    const clockOutMs = new Date(clockOut).getTime()
    let breakMs = 0
    for (const b of breaks || []) {
        const startMs = new Date(b.breakStart).getTime()
        const endMs = b.breakEnd ? new Date(b.breakEnd).getTime() : clockOutMs
        breakMs += Math.max(endMs - startMs, 0)
    }
    const totalMs = Math.max(clockOutMs - clockInMs - breakMs, 0)
    return Math.round((totalMs / 1000 / 60 / 60) * 100) / 100
}

async function verifyEmployeePin(employeeId, pin) {
    const employee = await readClient.fetch(
        `*[_type == "employee" && _id == $employeeId && active == true][0]{ _id, firstName, lastName, pin }`,
        { employeeId }
    )
    if (!employee) return { ok: false, error: 'Employee not found', status: 404 }
    if (String(employee.pin) !== String(pin)) return { ok: false, error: 'Incorrect PIN', status: 401 }
    return { ok: true, employee }
}

export default async function handler(req, res) {
    // ============================== GET ==============================
    if (req.method === 'GET') {
        const { action, employeeId, pin } = req.query

        try {
            // ---- public: list active employees for the picker ----
            if (!action || action === 'employees') {
                const employees = await readClient.fetch(
                    `*[_type == "employee" && active == true] | order(firstName asc){ _id, firstName, lastName }`
                )
                return res.status(200).json({ employees })
            }

            // ---- employee-facing: current clock status ----
            if (action === 'status') {
                const check = await verifyEmployeePin(employeeId, pin)
                if (!check.ok) return res.status(check.status).json({ error: check.error })

                const openEntry = await readClient.fetch(
                    `*[_type == "timeEntry" && employee._ref == $employeeId && !defined(clockOut)] | order(clockIn desc)[0]{
                        _id, clockIn, jobType, payRate, breaks,
                        "propertyAddress": property->address,
                        "propertyId": property->_id
                    }`,
                    { employeeId }
                )
                const onBreak = openEntry?.breaks?.length > 0 && !openEntry.breaks[openEntry.breaks.length - 1].breakEnd
                return res.status(200).json({ clockedIn: !!openEntry, onBreak: !!onBreak, entry: openEntry || null })
            }

            // ---- employee-facing: their own history, totals, and balance ----
            if (action === 'history') {
                const check = await verifyEmployeePin(employeeId, pin)
                if (!check.ok) return res.status(check.status).json({ error: check.error })

                const [entries, employeeDoc] = await Promise.all([
                    readClient.fetch(
                        `*[_type == "timeEntry" && employee._ref == $employeeId && defined(clockOut)] | order(clockIn desc){
                            _id, clockIn, clockOut, jobType, payRate, totalHours, totalPay,
                            jobsAccomplished, notes, editedByMichael,
                            "propertyAddress": property->address
                        }`,
                        { employeeId }
                    ),
                    readClient.fetch(`*[_type == "employee" && _id == $employeeId][0]{ payments }`, { employeeId }),
                ])

                const totalEarned = entries.reduce((sum, e) => sum + (Number(e.totalPay) || 0), 0)
                const payments = employeeDoc?.payments || []
                const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

                return res.status(200).json({
                    entries,
                    payments,
                    totalEarned,
                    totalPaid,
                    balance: Math.round((totalEarned - totalPaid) * 100) / 100,
                })
            }

            // ---- admin (trusted via site PinGate): full roster ----
            if (action === 'roster') {
                const employees = await readClient.fetch(
                    `*[_type == "employee"] | order(active desc, firstName asc){
                        _id, firstName, lastName, phone, email, startDate, leaveDate, notes, active, payments
                    }`
                )
                return res.status(200).json({ employees })
            }

            // ---- admin: one employee's full entries + balance, for editing ----
            if (action === 'entries') {
                if (!employeeId) return res.status(400).json({ error: 'Missing employeeId' })
                const entries = await readClient.fetch(
                    `*[_type == "timeEntry" && employee._ref == $employeeId] | order(clockIn desc){
                        _id, clockIn, clockOut, jobType, payRate, rateFlagged, breaks, totalHours, totalPay,
                        jobsAccomplished, notes, editedByMichael,
                        "propertyAddress": property->address
                    }`,
                    { employeeId }
                )
                return res.status(200).json({ entries })
            }

            return res.status(400).json({ error: 'Unknown action' })
        } catch (err) {
            console.error('Timeclock GET failed:', err)
            return res.status(500).json({ error: 'Could not load timeclock data' })
        }
    }

    // ============================== POST ==============================
    if (req.method === 'POST') {
        const body = req.body || {}
        const action = body.action

        try {
            // ---- new employee intake ----
            if (action === 'createEmployee') {
                const firstName = cleanText(body.firstName, 100)
                const lastName = cleanText(body.lastName, 100)
                const pin = cleanText(body.pin, 10)
                if (!firstName || !lastName || !pin) {
                    return res.status(400).json({ error: 'First name, last name, and a PIN are required' })
                }
                const created = await writeClient.create({
                    _type: 'employee',
                    firstName,
                    lastName,
                    phone: cleanText(body.phone, 30),
                    email: cleanText(body.email, 200),
                    pin,
                    startDate: body.startDate || new Date().toISOString().slice(0, 10),
                    active: true,
                    createdAt: new Date().toISOString(),
                })
                return res.status(200).json({ success: true, id: created._id })
            }

            // ---- PIN check only, no side effects (used for the confirm-after-intake screen and returning-employee login) ----
            if (action === 'verifyPin') {
                const check = await verifyEmployeePin(body.employeeId, body.pin)
                if (!check.ok) return res.status(check.status).json({ error: check.error })
                return res.status(200).json({ success: true, firstName: check.employee.firstName })
            }

            // ---- clock in ----
            if (action === 'clockIn') {
                const check = await verifyEmployeePin(body.employeeId, body.pin)
                if (!check.ok) return res.status(check.status).json({ error: check.error })

                const { propertyId, jobType } = body
                if (!propertyId || !jobType) {
                    return res.status(400).json({ error: 'A property and job type are required' })
                }

                const alreadyOpen = await readClient.fetch(
                    `*[_type == "timeEntry" && employee._ref == $employeeId && !defined(clockOut)][0]{ _id }`,
                    { employeeId: body.employeeId }
                )
                if (alreadyOpen) {
                    return res.status(400).json({ error: `${check.employee.firstName} is already clocked in` })
                }

                const defaultRate = DEFAULT_RATES[jobType] || 0
                const payRate = body.payRate != null && body.payRate !== '' ? Number(body.payRate) : defaultRate
                const rateFlagged = payRate !== defaultRate

                const created = await writeClient.create({
                    _type: 'timeEntry',
                    employee: { _type: 'reference', _ref: body.employeeId },
                    property: { _type: 'reference', _ref: propertyId },
                    jobType,
                    payRate,
                    rateFlagged,
                    clockIn: new Date().toISOString(),
                    breaks: [],
                })
                return res.status(200).json({ success: true, id: created._id })
            }

            // ---- break start / break end ----
            if (action === 'breakStart' || action === 'breakEnd') {
                const check = await verifyEmployeePin(body.employeeId, body.pin)
                if (!check.ok) return res.status(check.status).json({ error: check.error })

                const openEntry = await readClient.fetch(
                    `*[_type == "timeEntry" && employee._ref == $employeeId && !defined(clockOut)][0]{ _id, breaks }`,
                    { employeeId: body.employeeId }
                )
                if (!openEntry) return res.status(400).json({ error: 'Not currently clocked in' })

                const breaks = openEntry.breaks || []
                const lastBreak = breaks[breaks.length - 1]
                const currentlyOnBreak = lastBreak && !lastBreak.breakEnd

                if (action === 'breakStart') {
                    if (currentlyOnBreak) return res.status(400).json({ error: 'Already on break' })
                    await writeClient
                        .patch(openEntry._id)
                        .setIfMissing({ breaks: [] })
                        .append('breaks', [{ _type: 'breakPeriod', _key: randomKey(), breakStart: new Date().toISOString() }])
                        .commit()
                    return res.status(200).json({ success: true })
                }

                // breakEnd
                if (!currentlyOnBreak) return res.status(400).json({ error: 'Not currently on break' })
                await writeClient
                    .patch(openEntry._id)
                    .set({ [`breaks[_key=="${lastBreak._key}"].breakEnd`]: new Date().toISOString() })
                    .commit()
                return res.status(200).json({ success: true })
            }

            // ---- clock out ----
            if (action === 'clockOut') {
                const check = await verifyEmployeePin(body.employeeId, body.pin)
                if (!check.ok) return res.status(check.status).json({ error: check.error })

                const openEntry = await readClient.fetch(
                    `*[_type == "timeEntry" && employee._ref == $employeeId && !defined(clockOut)][0]{ _id, clockIn, payRate, breaks }`,
                    { employeeId: body.employeeId }
                )
                if (!openEntry) return res.status(400).json({ error: 'Not currently clocked in' })

                const clockOut = new Date().toISOString()
                // close out any still-open break at the same moment, so the math is clean
                const breaks = (openEntry.breaks || []).map((b) => (b.breakEnd ? b : { ...b, breakEnd: clockOut }))
                const totalHours = computeTotals(openEntry.clockIn, clockOut, breaks)
                const totalPay = Math.round(totalHours * (Number(openEntry.payRate) || 0) * 100) / 100

                await writeClient
                    .patch(openEntry._id)
                    .set({
                        clockOut,
                        breaks,
                        totalHours,
                        totalPay,
                        jobsAccomplished: cleanText(body.jobsAccomplished, 2000),
                        notes: cleanText(body.notes, 2000),
                    })
                    .commit()

                return res.status(200).json({ success: true, totalHours, totalPay })
            }

            // ---- admin: edit an entry (trusted via site PinGate, no employee PIN) ----
            if (action === 'adminEditEntry') {
                const { entryId } = body
                if (!entryId) return res.status(400).json({ error: 'Missing entryId' })

                const existing = await readClient.fetch(`*[_type == "timeEntry" && _id == $id][0]{ clockIn, clockOut, breaks, payRate }`, { id: entryId })
                if (!existing) return res.status(404).json({ error: 'Entry not found' })

                const clockIn = body.clockIn || existing.clockIn
                const clockOut = body.clockOut !== undefined ? body.clockOut : existing.clockOut
                const breaks = body.breaks !== undefined ? body.breaks : existing.breaks
                const payRate = body.payRate !== undefined ? Number(body.payRate) : existing.payRate

                const update = {
                    clockIn,
                    payRate,
                    editedByMichael: true,
                }
                if (body.jobType !== undefined) update.jobType = body.jobType
                if (body.jobsAccomplished !== undefined) update.jobsAccomplished = cleanText(body.jobsAccomplished, 2000)
                if (body.notes !== undefined) update.notes = cleanText(body.notes, 2000)
                if (body.rateFlagged !== undefined) update.rateFlagged = !!body.rateFlagged
                if (breaks !== undefined) update.breaks = breaks
                if (clockOut) {
                    update.clockOut = clockOut
                    update.totalHours = computeTotals(clockIn, clockOut, breaks)
                    update.totalPay = Math.round(update.totalHours * payRate * 100) / 100
                }

                await writeClient.patch(entryId).set(update).commit()
                return res.status(200).json({ success: true })
            }

            // ---- admin: record a payment ----
            if (action === 'adminRecordPayment') {
                const { employeeId, amount, date, note } = body
                if (!employeeId || !amount || Number(amount) <= 0) {
                    return res.status(400).json({ error: 'A valid amount is required' })
                }
                const payment = {
                    _type: 'employeePayment',
                    _key: randomKey(),
                    amount: Number(amount),
                    date: date || new Date().toISOString().slice(0, 10),
                    note: cleanText(note, 300),
                    unread: true,
                }
                await writeClient.patch(employeeId).setIfMissing({ payments: [] }).append('payments', [payment]).commit()
                return res.status(200).json({ success: true })
            }

            // ---- clear a notification badge (employee viewing their profile) ----
            if (action === 'markRead') {
                if (body.entryId) {
                    await writeClient.patch(body.entryId).set({ editedByMichael: false }).commit()
                    return res.status(200).json({ success: true })
                }
                if (body.employeeId && body.paymentKey) {
                    await writeClient
                        .patch(body.employeeId)
                        .set({ [`payments[_key=="${body.paymentKey}"].unread`]: false })
                        .commit()
                    return res.status(200).json({ success: true })
                }
                return res.status(400).json({ error: 'Missing entryId or employeeId/paymentKey' })
            }

            // ---- admin: update employee profile fields (start/leave date, notes, active) ----
            if (action === 'updateEmployee') {
                const { employeeId } = body
                if (!employeeId) return res.status(400).json({ error: 'Missing employeeId' })
                const update = {}
                if (body.firstName !== undefined) update.firstName = cleanText(body.firstName, 100)
                if (body.lastName !== undefined) update.lastName = cleanText(body.lastName, 100)
                if (body.phone !== undefined) update.phone = cleanText(body.phone, 30)
                if (body.email !== undefined) update.email = cleanText(body.email, 200)
                if (body.startDate !== undefined) update.startDate = body.startDate
                if (body.leaveDate !== undefined) update.leaveDate = body.leaveDate
                if (body.notes !== undefined) update.notes = cleanText(body.notes, 3000)
                if (body.active !== undefined) update.active = !!body.active
                await writeClient.patch(employeeId).set(update).commit()
                return res.status(200).json({ success: true })
            }

            return res.status(400).json({ error: 'Unknown action' })
        } catch (err) {
            console.error('Timeclock POST failed:', err)
            return res.status(500).json({ error: 'Could not process request' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}