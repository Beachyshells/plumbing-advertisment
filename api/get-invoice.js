import { createClient } from '@sanity/client'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_READ_TOKEN,
    useCdn: false,
})

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const id = req.query.id
    if (!id) {
        return res.status(400).json({ error: 'Missing invoice id' })
    }

    try {
        const invoice = await client.fetch(
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
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' })
        }
        return res.status(200).json({ invoice })
    } catch (err) {
        console.error('Failed to fetch invoice:', err)
        return res.status(500).json({ error: 'Could not load invoice' })
    }
}