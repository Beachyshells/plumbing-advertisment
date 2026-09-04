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

async function uploadReceipt(base64Image) {
    const [header, data] = base64Image.split(',')
    const contentType = header.match(/data:(.*);base64/)?.[1] || 'image/jpeg'
    const buffer = Buffer.from(data, 'base64')
    const asset = await writeClient.assets.upload('image', buffer, { contentType })
    return { _type: 'image', _key: randomKey(), asset: { _type: 'reference', _ref: asset._id } }
}

async function nextInvoiceNumber() {
    const existingCount = await readClient.fetch(`count(*[_type == "customerInvoice"])`)
    return String(1001 + existingCount)
}

async function resolveLineItems(submittedLineItems) {
    let lineItemsTotal = 0
    const resolvedLineItems = []

    for (const item of submittedLineItems || []) {
        if (item.itemType === 'misc') {
            const price = Number(item.miscSellPrice) || 0
            lineItemsTotal += price
            resolvedLineItems.push({
                _type: 'lineItem',
                _key: randomKey(),
                itemType: 'misc',
                miscName: cleanText(item.miscName),
                miscSellPrice: price,
                miscNote: cleanText(item.miscNote),
            })
        } else {
            const catalogItem = await readClient.fetch(
                `*[_type == "inventoryItem" && _id == $id][0]{ sellPrice }`,
                { id: item.inventoryItemId }
            )
            const quantity = Number(item.quantity) || 1
            const unitPrice = catalogItem?.sellPrice || 0
            lineItemsTotal += unitPrice * quantity
            resolvedLineItems.push({
                _type: 'lineItem',
                _key: randomKey(),
                itemType: 'catalog',
                inventoryItem: { _type: 'reference', _ref: item.inventoryItemId },
                quantity,
            })
        }
    }

    return { resolvedLineItems, lineItemsTotal }
}

export default async function handler(req, res) {
    // ---- GET: one invoice (?id=), a filtered list (?customerId= / ?propertyId=), or everything ----
    if (req.method === 'GET') {
        try {
            const { id, customerId, propertyId } = req.query

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
                        notes,
                        "customerEmail": customer->email,

                        lineItems[]{
                            itemType,
                            quantity,
                            miscName,
                            miscSellPrice,
                            miscNote,
                            "inventoryItemId": inventoryItem->_id,
                            "inventoryItemName": inventoryItem->name,
                            "inventoryItemPrice": inventoryItem->sellPrice
                        }
                    }`,
                    { id }
                )
                if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
                return res.status(200).json({ invoice })
            }

            let filter = `_type == "customerInvoice"`
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
                    totalAmount,
                    paymentStatus,
                    paidDate,
                    payments,
                    "customerName": customer->firstName + " " + customer->lastName,
                    "customerEmail": customer->email,
                    "customerId": customer->_id,
                    "customerCredit": customer->creditBalance,
                    "propertyAddress": property->address
                }`,
                params
            )
            return res.status(200).json({ invoices })
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
    // (action: "payment"), or apply account credit (action: "credit") ----
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

            // action === 'update' — editing an invoice's contents
            const existing = await readClient.fetch(
                `*[_type == "customerInvoice" && _id == $id][0]{ payments }`,
                { id: invoiceId }
            )
            if (!existing) return res.status(404).json({ error: 'Invoice not found' })

            const { resolvedLineItems, lineItemsTotal } = await resolveLineItems(body.lineItems)
            const laborCost = Number(body.laborCost) || 0
            const totalAmount = lineItemsTotal + laborCost
            const totalPaid = (existing.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
            const paymentStatus = totalPaid >= totalAmount && totalAmount > 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

            await writeClient
                .patch(invoiceId)
                .set({
                    serviceDate: body.serviceDate,
                    workPerformed: cleanText(body.workPerformed),
                    technician: cleanText(body.technician),
                    lineItems: resolvedLineItems,
                    laborCost,
                    totalAmount,
                    notes: cleanText(body.notes),
                    paymentStatus,
                })
                .commit()

            return res.status(200).json({ success: true, totalAmount, paymentStatus })
        } catch (err) {
            console.error('Failed to update invoice:', err)
            return res.status(500).json({ error: 'Could not update invoice' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}