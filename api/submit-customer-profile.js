import { createClient } from '@sanity/client'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
})

// Every field here is optional except name + serviceAddress — the wizard
// lets Michael skip anything he doesn't have on hand.
const MAX_LENGTH = 1000

function clean(value) {
    if (typeof value !== 'string') return ''
    return value.slice(0, MAX_LENGTH)
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body || {}
    const name = clean(body.name)
    const serviceAddress = clean(body.serviceAddress)

    if (!name || !serviceAddress) {
        return res.status(400).json({ error: 'Name and service address are required' })
    }

    try {
        await client.create({
            _type: 'customerProfile',
            name,
            bestPhone: clean(body.bestPhone),
            altPhone: clean(body.altPhone),
            serviceAddress,
            wellOrMunicipal: clean(body.wellOrMunicipal),
            billingAddress: clean(body.billingAddress),
            email: clean(body.email),
            gateCodeKeyEntry: clean(body.gateCodeKeyEntry),
            dog: clean(body.dog),
            mainShutoffLocation: clean(body.mainShutoffLocation),
            notes: clean(body.notes),
            source: 'intake-wizard',
            createdAt: new Date().toISOString(),
        })
        return res.status(200).json({ success: true })
    } catch (err) {
        console.error('Failed to create customer profile:', err)
        return res.status(500).json({ error: 'Could not save customer profile' })
    }
}