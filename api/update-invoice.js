import { createClient } from '@sanity/client'

const client = createClient({
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

export default async function handler(req, res) {
    if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body || {}
    const invoiceId = body.invoiceId
    if (!invoiceId) {
        return res.status(400).json({ error: 'Missing invoiceId' })
    }

    try {
        const existing = await client.fetch(
            `*[_type == "customerInvoice" && _id == $id][0]{ payments, paymentStatus }`,
            { id: invoiceId }
        )
        if (!existing) {
            return res.status(404).json({ error: 'Invoice not found' })
        }

        // The safeguard against editing a paid/partial invoice by accident
        // lives on the client (the "type edit to confirm" prompt) — this
        // endpoint just does the actual update once that's been confirmed.

        const submittedLineItems = Array.isArray(body.lineItems) ? body.lineItems : []
        let lineItemsTotal = 0
        const resolvedLineItems = []

        for (const item of submittedLineItems) {
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
                const catalogItem = await client.fetch(
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

        const laborCost = Number(body.laborCost) || 0
        const totalAmount = lineItemsTotal + laborCost

        const totalPaid = (existing.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        const paymentStatus = totalPaid >= totalAmount && totalAmount > 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

        await client
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