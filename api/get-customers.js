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

    try {
        const customers = await client.fetch(
            `*[_type == "customerProfile"] | order(lastName asc){
                _id,
                firstName,
                lastName,
                bestPhone,
                billingAddress,
                email,
                status,
                createdAt,
                               creditBalance,
                "property": property->{
                    _id,
                    address
                }
            }`
        )
        return res.status(200).json({ customers })
    } catch (err) {
        console.error('Failed to fetch customers:', err)
        return res.status(500).json({ error: 'Could not load customers' })
    }
}