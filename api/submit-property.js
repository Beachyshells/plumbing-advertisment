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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body || {}
    const address = body.address || {}
    const street = cleanText(address.street)
    const city = cleanText(address.city)
    const state = cleanText(address.state)
    const zip = cleanText(address.zip)

    if (!street || !city || !state) {
        return res.status(400).json({ error: 'Street, city, and state are required' })
    }

    try {
        const created = await client.create({
            _type: 'property',
            address: { street, city, state, zip },
            wellOrMunicipal: cleanText(body.wellOrMunicipal),
            gateCodeKeyEntry: cleanText(body.gateCodeKeyEntry),
            mainShutoffLocation: cleanText(body.mainShutoffLocation),
            notes: cleanText(body.notes),
            createdAt: new Date().toISOString(),
        })
        return res.status(200).json({ success: true, id: created._id })
    } catch (err) {
        console.error('Failed to create property:', err)
        return res.status(500).json({ error: 'Could not save property' })
    }
}