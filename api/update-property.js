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

export default async function handler(req, res) {
    if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body || {}
    const propertyId = body.propertyId
    const address = body.address || {}
    const street = cleanText(address.street)
    const city = cleanText(address.city)
    const state = cleanText(address.state)
    const zip = cleanText(address.zip)

    if (!propertyId || !street || !city || !state) {
        return res.status(400).json({ error: 'Property id, street, city, and state are required' })
    }

    try {
        await client
            .patch(propertyId)
            .set({
                address: { street, city, state, zip },
                wellOrMunicipal: cleanText(body.wellOrMunicipal),
                gateCodeKeyEntry: cleanText(body.gateCodeKeyEntry),
                dog: cleanText(body.dog),
                mainShutoffLocation: cleanText(body.mainShutoffLocation),
                notes: cleanText(body.notes),
            })
            .commit()

        return res.status(200).json({ success: true })
    } catch (err) {
        console.error('Failed to update property:', err)
        return res.status(500).json({ error: 'Could not update property' })
    }
}