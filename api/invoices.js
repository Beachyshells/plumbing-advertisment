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

function cleanText(value, maxLength = 1000) {
    if (typeof value !== 'string') return ''
    return value.slice(0, maxLength)
}

function randomKey() {
    return Math.random().toString(36).slice(2, 10)
}

// Same PIN check used by the employee timeclock — kept here too rather
// than shared, matching how this file already duplicates its own small
// helpers. Also returns the employee's name, so discount attribution can
// come from the server's own lookup rather than anything the client sends.
async function verifyEmployeePin(employeeId, pin) {
    const employee = await readClient.fetch(
        `*[_type == "employee" && _id == $employeeId && active == true][0]{ _id, firstName, lastName, pin }`,
        { employeeId }
    )
    if (!employee) return { ok: false, error: 'Employee not found', status: 404 }
    if (String(employee.pin) !== String(pin)) return { ok: false, error: 'Incorrect PIN', status: 401 }
    return { ok: true, name: `${employee.firstName} ${employee.lastName}`.trim() }
}

function applyDiscount(amount, discountType, discountValue) {
    if (!discountType || discountType === 'none') return amount
    const value = Number(discountValue) || 0
    if (discountType === 'percent') return Math.max(amount * (1 - value / 100), 0)
    if (discountType === 'flat') return Math.max(amount - value, 0)
    return amount
}

// Strips a submitted discount down to just its meaningful fields (never
// trusts a client-supplied discountAppliedBy).
function normalizeDiscountInput(input) {
    const discountType = input?.discountType && input.discountType !== 'none' ? input.discountType : 'none'
    if (discountType === 'none') return { discountType: 'none' }
    return {
        discountType,
        discountValue: Number(input.discountValue) || 0,
        discountReason: input.discountReason || undefined,
        discountReasonNote: input.discountReason === 'other' ? cleanText(input.discountReasonNote, 300) : undefined,
    }
}

function discountsMatch(a, b) {
    if ((a?.discountType || 'none') !== (b?.discountType || 'none')) return false
    if ((a?.discountType || 'none') === 'none') return true
    return (
        Number(a?.discountValue) === Number(b?.discountValue) &&
        (a?.discountReason || '') === (b?.discountReason || '') &&
        (a?.discountReasonNote || '') === (b?.discountReasonNote || '')
    )
}

// If a discount is unchanged from what's already stored, keep whoever
// applied it originally — a resave for something unrelated shouldn't
// relabel history. If it's new or actually different, attribute it to
// whoever is saving right now.
function resolveDiscountAppliedBy(newDiscount, existing, actorName) {
    if (newDiscount.discountType === 'none') return undefined
    if (existing && discountsMatch(newDiscount, existing)) {
        return existing.discountAppliedBy || actorName
    }
    return actorName
}

// Turns an already-stored line item back into the shape resolveLineItems()
// expects as "submitted" input — used when an edit doesn't touch lineItems
// at all, so the existing items just pass through unchanged (and, via their
// _key, keep their existing discount attribution intact).
function toResolveInput(li) {
    const shared = {
        _key: li._key,
        discountType: li.discountType,
        discountValue: li.discountValue,
        discountReason: li.discountReason,
        discountReasonNote: li.discountReasonNote,
    }
    return li.itemType === 'misc'
        ? { ...shared, itemType: 'misc', miscName: li.miscName, miscSellPrice: li.miscSellPrice, miscNote: li.miscNote }
        : { ...shared, itemType: 'catalog', inventoryItemId: li.inventoryItemId, quantity: li.quantity }
}

// Resolves the invoice-level (whole-invoice) discount the same way a line
// item's discount resolves — falls back to whatever's already stored when
// the caller didn't submit a change, and only attributes to actorName when
// the discount is genuinely new or different from what's on file.
function resolveInvoiceDiscount(submittedDiscount, existing, actorName) {
    const input = submittedDiscount !== undefined
        ? submittedDiscount
        : {
            discountType: existing.discountType,
            discountValue: existing.discountValue,
            discountReason: existing.discountReason,
            discountReasonNote: existing.discountReasonNote,
        }
    const newDiscount = normalizeDiscountInput(input)
    if (newDiscount.discountType === 'none') {
        return { discountType: 'none', discountValue: undefined, discountReason: undefined, discountReasonNote: undefined, discountAppliedBy: undefined }
    }
    const existingDiscount = {
        discountType: existing.discountType,
        discountValue: existing.discountValue,
        discountReason: existing.discountReason,
        discountReasonNote: existing.discountReasonNote,
        discountAppliedBy: existing.discountAppliedBy,
    }
    return { ...newDiscount, discountAppliedBy: resolveDiscountAppliedBy(newDiscount, existingDiscount, actorName) }
}

async function uploadReceipt(base64Image) {
    const [header, data] = base64Image.split(',')
    const contentType = header.match(/data:(.*);base64/)?.[1] || 'image/jpeg'
    const buffer = Buffer.from(data, 'base64')
    const asset = await writeClient.assets.upload('image', buffer, { contentType })
    return { _type: 'image', _key: randomKey(), asset: { _type: 'reference', _ref: asset._id } }
}

async function nextInvoiceNumber() {
    const highest = await readClient.fetch(
        `*[_type == "customerInvoice" && defined(invoiceNumber)] | order(invoiceNumber desc)[0].invoiceNumber`
    )

    if (!highest) return '1001'

    const match = highest.match(/^([A-Z]?)(\d+)$/)
    if (!match) return '1001'

    const [, prefix, digits] = match
    const num = Number(digits)

    if (num < 9999) {
        return `${prefix}${num + 1}`
    }

    // Rolled past 9999 — bump to the next letter and restart at 1000
    // (e.g. 9999 -> A1000, A9999 -> B1000). A letter always sorts after
    // a plain digit in text order, so this stays correctly sortable forever.
    const nextPrefix = prefix ? String.fromCharCode(prefix.charCodeAt(0) + 1) : 'A'
    return `${nextPrefix}1000`
}

// `existingLineItemsByKey` is a Map of _key -> the invoice's currently
// stored discount fields for that item, used only to decide whether a
// discount is unchanged (preserve attribution) or new/different (attribute
// to actorName). Pass an empty Map when there's no prior invoice (creation).
async function resolveLineItems(submittedLineItems, existingLineItemsByKey = new Map(), actorName) {
    let lineItemsTotal = 0
    const resolvedLineItems = []

    for (const item of submittedLineItems || []) {
        const newDiscount = normalizeDiscountInput(item)
        const existingDiscount = item._key ? existingLineItemsByKey.get(item._key) : null
        const discountOut = newDiscount.discountType === 'none'
            ? { discountType: 'none' }
            : { ...newDiscount, discountAppliedBy: resolveDiscountAppliedBy(newDiscount, existingDiscount, actorName) }

        if (item.itemType === 'misc') {
            const price = Number(item.miscSellPrice) || 0
            lineItemsTotal += applyDiscount(price, newDiscount.discountType, newDiscount.discountValue)
            resolvedLineItems.push({
                _type: 'lineItem',
                _key: item._key || randomKey(),
                itemType: 'misc',
                miscName: cleanText(item.miscName),
                miscSellPrice: price,
                miscNote: cleanText(item.miscNote),
                ...discountOut,
            })
        } else {
            const catalogItem = await readClient.fetch(
                `*[_type == "inventoryItem" && _id == $id][0]{ sellPrice }`,
                { id: item.inventoryItemId }
            )
            const quantity = Number(item.quantity) || 1
            const unitPrice = catalogItem?.sellPrice || 0
            lineItemsTotal += applyDiscount(unitPrice * quantity, newDiscount.discountType, newDiscount.discountValue)
            resolvedLineItems.push({
                _type: 'lineItem',
                _key: item._key || randomKey(),
                itemType: 'catalog',
                inventoryItem: { _type: 'reference', _ref: item.inventoryItemId },
                quantity,
                ...discountOut,
            })
        }
    }

    return { resolvedLineItems, lineItemsTotal }
}

export default async function handler(req, res) {
    // ---- GET: one invoice (?id=), a filtered list (?customerId= / ?propertyId=), or everything ----
    if (req.method === 'GET') {
        try {
            const { id, customerId, propertyId, calendarMonth, unconfirmedCancelations } = req.query

            if (unconfirmedCancelations) {
                const canceled = await readClient.fetch(
                    `*[_type == "customerInvoice" && status == "canceled" && cancelAcknowledged != true] | order(canceledAt desc){
                        _id,
                        invoiceNumber,
                        serviceDate,
                        cancelReason,
                        canceledAt,
                        "customerFirstName": customer->firstName,
                        "customerLastName": customer->lastName,
                        "additionalContactFirstName": customer->additionalContactFirstName,
                        "additionalContactLastName": customer->additionalContactLastName,
                        "propertyAddress": property->address
                    }`
                )
                const withNames = canceled.map((inv) => {
                    const primary = [inv.customerFirstName, inv.customerLastName].filter(Boolean).join(' ')
                    const secondary = [inv.additionalContactFirstName, inv.additionalContactLastName].filter(Boolean).join(' ')
                    return { ...inv, customerName: secondary ? `${primary} / ${secondary}` : primary }
                })
                return res.status(200).json({ invoices: withNames })
            }

            if (calendarMonth) {
                const monthInvoices = await readClient.fetch(
                    `*[_type == "customerInvoice" && status != "canceled" && jobStatus != "complete" && serviceDate >= $monthStart && serviceDate <= $monthEnd]{
                        _id,
                        invoiceNumber,
                        serviceDate,
                        jobStatus,
                        workPerformed,
                        "customerFirstName": customer->firstName,
                        "customerLastName": customer->lastName,
                        "additionalContactFirstName": customer->additionalContactFirstName,
                        "additionalContactLastName": customer->additionalContactLastName,
                        "propertyAddress": property->address
                    }`,
                    { monthStart: `${calendarMonth}-01`, monthEnd: `${calendarMonth}-31` }
                )
                const withNames = monthInvoices.map((inv) => {
                    const primary = [inv.customerFirstName, inv.customerLastName].filter(Boolean).join(' ')
                    const secondary = [inv.additionalContactFirstName, inv.additionalContactLastName].filter(Boolean).join(' ')
                    return { ...inv, customerName: secondary ? `${primary} / ${secondary}` : primary }
                })
                return res.status(200).json({ invoices: withNames })
            }


            if (id) {
                const invoice = await readClient.fetch(
                    `*[_type == "customerInvoice" && _id == $id][0]{
                        _id,
                        invoiceNumber,
                        serviceDate,
                        workPerformed,
                        technician,
                        laborCost,
                        totalAmount,
                        paymentStatus,
                        jobStatus,
                        status,
                        cancelReason,
                        canceledAt,
                        cancelAcknowledged,
                        notes,
                        createdAt,
                        discountType,
                        discountValue,
                        discountReason,
                        discountReasonNote,
                        discountAppliedBy,
                        "propertyId": property->_id,
                        "customerEmail": customer->email,
                        "customerBillingAddress": customer->billingAddress,

                        lineItems[]{
                            _key,
                            itemType,
                            quantity,
                            miscName,
                            miscSellPrice,
                            miscNote,
                            discountType,
                            discountValue,
                            discountReason,
                            discountReasonNote,
                            discountAppliedBy,
                            "inventoryItemId": inventoryItem->_id,
                            "inventoryItemName": inventoryItem->name,
                            "inventoryItemPrice": inventoryItem->sellPrice,
                            "isEquipment": inventoryItem->isEquipment
                        }
                    }`,
                    { id }
                )
                if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
                return res.status(200).json({ invoice })
            }

            let filter = `_type == "customerInvoice" && status != "canceled"`
            const params = {}
            if (customerId) {
                filter += ` && customer._ref == $customerId`
                params.customerId = customerId
            }
            if (propertyId) {
                filter += ` && property._ref == $propertyId`
                params.propertyId = propertyId
            }


            const invoices = await readClient.fetch(
                `*[${filter}] | order(serviceDate desc){
                    _id,
                    invoiceNumber,
                    serviceDate,
                    workPerformed,
                    notes,
                    totalAmount,
                    paymentStatus,
                    jobStatus,
                    status,
                    cancelReason,
                    canceledAt,
                    createdAt,
                    paidDate,
                    payments,
                    "customerFirstName": customer->firstName,
                    "customerLastName": customer->lastName,
                    "additionalContactFirstName": customer->additionalContactFirstName,
                    "additionalContactLastName": customer->additionalContactLastName,
                    "customerEmail": customer->email,
                    "customerId": customer->_id,
                    "customerCredit": customer->creditBalance,
                    "propertyAddress": property->address,
                     "propertyId": property->_id
                }`,
                params
            )
            const invoicesWithNames = invoices.map((inv) => {
                const primary = [inv.customerFirstName, inv.customerLastName].filter(Boolean).join(' ')
                const secondary = [inv.additionalContactFirstName, inv.additionalContactLastName].filter(Boolean).join(' ')
                return { ...inv, customerName: secondary ? `${primary} / ${secondary}` : primary }
            })
            return res.status(200).json({ invoices: invoicesWithNames })
        } catch (err) {
            console.error('Failed to fetch invoice(s):', err)
            return res.status(500).json({ error: 'Could not load invoice data' })
        }
    }

    // ---- POST: create a new invoice ----
    if (req.method === 'POST') {
        const body = req.body || {}
        const customerId = body.customerId
        const propertyId = body.propertyId

        if (!customerId || typeof customerId !== 'string' || customerId.startsWith('local-')) {
            return res.status(400).json({ error: 'A saved customer is required before creating an invoice' })
        }
        if (!propertyId) {
            return res.status(400).json({ error: 'A property is required to create an invoice' })
        }

        try {
            const { resolvedLineItems, lineItemsTotal } = await resolveLineItems(body.lineItems)
            const laborCost = Number(body.laborCost) || 0
            const totalAmount = lineItemsTotal + laborCost
            const receipts = Array.isArray(body.receipts) ? await Promise.all(body.receipts.map(uploadReceipt)) : []
            const invoiceNumber = await nextInvoiceNumber()

            const created = await writeClient.create({
                _type: 'customerInvoice',
                customer: { _type: 'reference', _ref: customerId },
                property: { _type: 'reference', _ref: propertyId },
                invoiceNumber,
                serviceDate: body.serviceDate || new Date().toISOString().slice(0, 10),
                workPerformed: cleanText(body.workPerformed),
                technician: cleanText(body.technician),
                lineItems: resolvedLineItems,
                laborCost,
                totalAmount,
                paymentStatus: 'unpaid',
                jobStatus: body.startNow ? 'ongoing' : 'notStarted',
                status: 'active',
                payments: [],
                receipts,
                notes: cleanText(body.notes),
                createdAt: new Date().toISOString(),
            })

            return res.status(200).json({ success: true, id: created._id, invoiceNumber })
        } catch (err) {
            console.error('Failed to create invoice:', err)
            return res.status(500).json({ error: 'Could not save invoice' })
        }
    }

    // ---- PATCH: edit contents (action: "update", default), record a payment
    // (action: "payment"), apply account credit (action: "credit"), change job
    // status (action: "setJobStatus"), cancel/reactivate (action: "cancel" /
    // "reactivate"), dismiss the calendar alert (action: "acknowledgeCancelation"),
    // or an employee updating parts/equipment & discounts from the field
    // (action: "employeeUpdateLineItems") ----
    if (req.method === 'PATCH') {
        const body = req.body || {}
        const action = body.action || 'update'
        const invoiceId = body.invoiceId

        if (!invoiceId) {
            return res.status(400).json({ error: 'Missing invoiceId' })
        }

        try {
            if (action === 'payment') {
                const amount = Number(body.amount)
                if (!amount || amount <= 0) {
                    return res.status(400).json({ error: 'A valid payment amount is required' })
                }

                const invoice = await readClient.fetch(
                    `*[_type == "customerInvoice" && _id == $id][0]{ totalAmount, payments, "customerId": customer._ref }`,
                    { id: invoiceId }
                )
                if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

                const method = body.method === 'check' ? 'check' : 'cash'
                const newPayment = {
                    _type: 'payment',
                    _key: randomKey(),
                    amount,
                    method,
                    date: body.date || new Date().toISOString().slice(0, 10),
                    note: cleanText(body.note, 500),
                    checkNumber: method === 'check' ? cleanText(body.checkNumber) : undefined,
                    signee: method === 'check' ? cleanText(body.signee) : undefined,
                }

                const existingPayments = invoice.payments || []
                const totalPaid = [...existingPayments, newPayment].reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                const totalAmount = Number(invoice.totalAmount) || 0
                const overage = Math.max(totalPaid - totalAmount, 0)
                const paymentStatus = totalPaid >= totalAmount && totalAmount > 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'
                const paidDate = paymentStatus === 'paid' ? newPayment.date : undefined

                await writeClient
                    .patch(invoiceId)
                    .setIfMissing({ payments: [] })
                    .append('payments', [newPayment])
                    .set({ paymentStatus, ...(paidDate ? { paidDate } : {}) })
                    .commit()

                if (overage > 0 && invoice.customerId) {
                    await writeClient
                        .patch(invoice.customerId)
                        .setIfMissing({ creditBalance: 0 })
                        .inc({ creditBalance: overage })
                        .commit()
                }

                return res.status(200).json({
                    success: true,
                    paymentStatus,
                    balanceRemaining: Math.max(totalAmount - totalPaid, 0),
                    creditAdded: overage,
                })
            }

            if (action === 'credit') {
                const invoice = await readClient.fetch(
                    `*[_type == "customerInvoice" && _id == $id][0]{ totalAmount, payments, "customerId": customer._ref, "customerCredit": customer->creditBalance }`,
                    { id: invoiceId }
                )
                if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

                const existingPayments = invoice.payments || []
                const totalPaid = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                const totalAmount = Number(invoice.totalAmount) || 0
                const balanceOwed = Math.max(totalAmount - totalPaid, 0)
                const availableCredit = Number(invoice.customerCredit) || 0
                const amountToApply = Math.min(balanceOwed, availableCredit)

                if (amountToApply <= 0) {
                    return res.status(400).json({ error: 'No credit available to apply' })
                }

                const creditPayment = {
                    _type: 'payment',
                    _key: randomKey(),
                    amount: amountToApply,
                    method: 'credit',
                    date: new Date().toISOString().slice(0, 10),
                    note: 'Applied from account credit',
                }

                const newTotalPaid = totalPaid + amountToApply
                const paymentStatus = newTotalPaid >= totalAmount && totalAmount > 0 ? 'paid' : 'partial'
                const paidDate = paymentStatus === 'paid' ? creditPayment.date : undefined

                await writeClient
                    .patch(invoiceId)
                    .setIfMissing({ payments: [] })
                    .append('payments', [creditPayment])
                    .set({ paymentStatus, ...(paidDate ? { paidDate } : {}) })
                    .commit()

                await writeClient.patch(invoice.customerId).dec({ creditBalance: amountToApply }).commit()

                return res.status(200).json({
                    success: true,
                    amountApplied: amountToApply,
                    paymentStatus,
                    balanceRemaining: Math.max(totalAmount - newTotalPaid, 0),
                })
            }

            if (action === 'setJobStatus') {
                const jobStatus = body.jobStatus
                if (!['notStarted', 'ongoing', 'complete'].includes(jobStatus)) {
                    return res.status(400).json({ error: 'Invalid job status' })
                }
                await writeClient.patch(invoiceId).set({ jobStatus }).commit()
                return res.status(200).json({ success: true, jobStatus })
            }

            if (action === 'cancel') {
                const cancelReason = cleanText(body.cancelReason, 500)
                const canceledAt = body.canceledAt || new Date().toISOString().slice(0, 10)

                await writeClient
                    .patch(invoiceId)
                    .set({ status: 'canceled', cancelReason, canceledAt, cancelAcknowledged: false })
                    .commit()

                return res.status(200).json({ success: true, status: 'canceled', cancelReason, canceledAt })
            }

            if (action === 'reactivate') {
                await writeClient.patch(invoiceId).set({ status: 'active' }).commit()
                return res.status(200).json({ success: true, status: 'active' })
            }

            if (action === 'acknowledgeCancelation') {
                await writeClient.patch(invoiceId).set({ cancelAcknowledged: true }).commit()
                return res.status(200).json({ success: true, cancelAcknowledged: true })
            }

            // Employee-facing, from the field — adding/removing parts & equipment,
            // and/or adjusting discounts (including giving something away free).
            // PIN-gated since this is reachable from the employee portal, not
            // just /desktop, and deliberately narrower than action:'update' —
            // it can only ever touch lineItems and the invoice-level discount,
            // never serviceDate/workPerformed/technician/notes.
            if (action === 'employeeUpdateLineItems') {
                const pinCheck = await verifyEmployeePin(body.employeeId, body.pin)
                if (!pinCheck.ok) return res.status(pinCheck.status).json({ error: pinCheck.error })
                const actorName = pinCheck.name

                const existing = await readClient.fetch(
                    `*[_type == "customerInvoice" && _id == $id][0]{
                        payments, laborCost, discountType, discountValue, discountReason, discountReasonNote, discountAppliedBy,
                        lineItems[]{ _key, itemType, quantity, miscName, miscSellPrice, miscNote, discountType, discountValue, discountReason, discountReasonNote, discountAppliedBy, "inventoryItemId": inventoryItem->_id }
                    }`,
                    { id: invoiceId }
                )
                if (!existing) return res.status(404).json({ error: 'Invoice not found' })

                const existingLineItemsByKey = new Map((existing.lineItems || []).map((li) => [li._key, li]))
                const submittedItems = body.lineItems !== undefined ? body.lineItems : (existing.lineItems || []).map(toResolveInput)
                const { resolvedLineItems, lineItemsTotal } = await resolveLineItems(submittedItems, existingLineItemsByKey, actorName)

                const laborCost = Number(existing.laborCost) || 0
                const subtotal = lineItemsTotal + laborCost

                const submittedInvoiceDiscount = body.discountType !== undefined
                    ? { discountType: body.discountType, discountValue: body.discountValue, discountReason: body.discountReason, discountReasonNote: body.discountReasonNote }
                    : undefined
                const invoiceDiscountOut = resolveInvoiceDiscount(submittedInvoiceDiscount, existing, actorName)

                const totalAmount = applyDiscount(subtotal, invoiceDiscountOut.discountType, invoiceDiscountOut.discountValue)
                const totalPaid = (existing.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                const paymentStatus = totalPaid >= totalAmount && totalAmount > 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

                await writeClient
                    .patch(invoiceId)
                    .set({ lineItems: resolvedLineItems, totalAmount, paymentStatus, ...invoiceDiscountOut })
                    .commit()

                return res.status(200).json({ success: true, totalAmount, paymentStatus })
            }

            // action === 'update' — editing an invoice's contents (also handles
            // editing the cancelation reason/date on an already-canceled invoice)
            const existing = await readClient.fetch(
                `*[_type == "customerInvoice" && _id == $id][0]{
                    payments, status, serviceDate, workPerformed, technician, notes, laborCost,
                    discountType, discountValue, discountReason, discountReasonNote, discountAppliedBy,
                    lineItems[]{ _key, itemType, quantity, miscName, miscSellPrice, miscNote, discountType, discountValue, discountReason, discountReasonNote, discountAppliedBy, "inventoryItemId": inventoryItem->_id }
                }`,
                { id: invoiceId }
            )
            if (!existing) return res.status(404).json({ error: 'Invoice not found' })

            const updatePayload = {}

            // Only touch invoice contents (line items, totals, etc.) if this
            // update actually includes them — a cancelReason/canceledAt-only
            // edit shouldn't recompute totals or require anything else to be sent.
            const touchesPricing = body.lineItems !== undefined || body.laborCost !== undefined || body.discountType !== undefined
            if (touchesPricing) {
                const existingLineItemsByKey = new Map((existing.lineItems || []).map((li) => [li._key, li]))
                const submittedItems = body.lineItems !== undefined ? body.lineItems : (existing.lineItems || []).map(toResolveInput)
                const { resolvedLineItems, lineItemsTotal } = await resolveLineItems(submittedItems, existingLineItemsByKey, 'Michael')

                const laborCost = body.laborCost !== undefined ? (Number(body.laborCost) || 0) : (Number(existing.laborCost) || 0)
                const subtotal = lineItemsTotal + laborCost

                const submittedInvoiceDiscount = body.discountType !== undefined
                    ? { discountType: body.discountType, discountValue: body.discountValue, discountReason: body.discountReason, discountReasonNote: body.discountReasonNote }
                    : undefined
                const invoiceDiscountOut = resolveInvoiceDiscount(submittedInvoiceDiscount, existing, 'Michael')

                const totalAmount = applyDiscount(subtotal, invoiceDiscountOut.discountType, invoiceDiscountOut.discountValue)
                const totalPaid = (existing.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                const paymentStatus = totalPaid >= totalAmount && totalAmount > 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

                Object.assign(updatePayload, {
                    serviceDate: body.serviceDate !== undefined ? body.serviceDate : existing.serviceDate,
                    workPerformed: body.workPerformed !== undefined ? cleanText(body.workPerformed) : existing.workPerformed,
                    technician: body.technician !== undefined ? cleanText(body.technician) : existing.technician,
                    lineItems: resolvedLineItems,
                    laborCost,
                    totalAmount,
                    notes: body.notes !== undefined ? cleanText(body.notes) : existing.notes,
                    paymentStatus,
                    ...invoiceDiscountOut,
                })
            }

            if (existing.status === 'canceled') {
                if (body.cancelReason !== undefined) updatePayload.cancelReason = cleanText(body.cancelReason, 500)
                if (body.canceledAt !== undefined) updatePayload.canceledAt = body.canceledAt
            }

            await writeClient.patch(invoiceId).set(updatePayload).commit()

            return res.status(200).json({ success: true, ...updatePayload })
        } catch (err) {
            console.error('Failed to update invoice:', err)
            return res.status(500).json({ error: 'Could not update invoice' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}