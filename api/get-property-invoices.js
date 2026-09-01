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

    const propertyId = req.query.propertyId
    if (!propertyId) {
        return res.status(400).json({ error: 'Missing propertyId' })
    }

    try {
        const invoices = await client.fetch(
            `*[_type == "customerInvoice" && property._ref == $propertyId] | order(serviceDate desc){
                _id,
                invoiceNumber,
                serviceDate,
                workPerformed,
                totalAmount,
                paymentStatus,
                paidDate,
                payments,
                "customerName": customer->firstName + " " + customer->lastName,                "customerId": customer->_id,
                "customerCredit": customer->creditBalance,
                "propertyAddress": property->address
            }`,
            { propertyId }
        )
        return res.status(200).json({ invoices })
    } catch (err) {
        console.error('Failed to fetch property invoices:', err)
        return res.status(500).json({ error: 'Could not load property history' })
    }
}