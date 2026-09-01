import { createClient } from '@sanity/client'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
})

function cleanText(value) {
    if (typeof value !== 'string') return ''
    return value.slice(0, 1000)
}

function randomKey() {
    return Math.random().toString(36).slice(2, 10)
}

// Receipts arrive as base64 data URLs (e.g. "data:image/jpeg;base64,...")
// from the wizard's camera/file input, and get uploaded to Sanity's asset
// store here.
async function uploadReceipt(base64Image) {
    const [header, data] = base64Image.split(',')
    const contentType = header.match(/data:(.*);base64/)?.[1] || 'image/jpeg'
    const buffer = Buffer.from(data, 'base64')
    const asset = await client.assets.upload('image', buffer, { contentType })
    return { _type: 'image', _key: randomKey(), asset: { _type: 'reference', _ref: asset._id } }
}

async function nextInvoiceNumber() {
    const existingCount = await client.fetch(`count(*[_type == "customerInvoice"])`)
    return String(1001 + existingCount)
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body || {}
    const customerId = body.customerId

    if (!customerId || typeof customerId !== 'string' || customerId.startsWith('local-')) {
        return res.status(400).json({ error: 'A saved customer is required before creating an invoice' })
    }

    try {
        // Pricing is recomputed here rather than trusted from the client, in
        // case a catalog price changed between when the invoice was built
        // (possibly offline) and when it actually reaches the server.
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

        const receipts = Array.isArray(body.receipts) ? await Promise.all(body.receipts.map(uploadReceipt)) : []

        const invoiceNumber = await nextInvoiceNumber()

        // Every invoice starts unpaid with nothing recorded — real status
        // only ever comes from actual payments logged via record-payment.js.
        const paymentStatus = 'unpaid'
        const paidDate = undefined

        const propertyId = body.propertyId
        if (!propertyId) {
            return res.status(400).json({ error: 'A property is required to create an invoice' })
        }

        const created = await client.create({
            _type: 'customerInvoice',
            customer: { _type: 'reference', _ref: customerId },
            property: { _type: 'reference', _ref: propertyId },
            invoiceNumber,
            serviceDate: body.serviceDate || new Date().toISOString().slice(0, 10),
            paidDate,
            workPerformed: cleanText(body.workPerformed),
            technician: cleanText(body.technician),
            lineItems: resolvedLineItems,
            laborCost,
            totalAmount,
            paymentStatus,
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