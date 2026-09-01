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
        return res.status(400).json({ error: 'Missing customer id' })
    }

    try {
        const customer = await client.fetch(
            `*[_type == "customerProfile" && _id == $id][0]{
                _id,
                firstName,
                lastName,
                bestPhone,
                altPhone,
                               billingAddress,
                dog,
                email,
                notes,
                status,
                creditBalance,
                "property": property->{
                    _id,
                    address,
                    wellOrMunicipal,
                    gateCodeKeyEntry,
                    mainShutoffLocation
                }
            }`,
            { id }
        )

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' })
        }

        return res.status(200).json({ customer })
    } catch (err) {
        console.error('Failed to fetch customer:', err)
        return res.status(500).json({ error: 'Could not load customer' })
    }
}