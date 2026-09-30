import { createClient } from '@sanity/client'
import { requireAdmin, requireStaff, readToken, makeToken } from './_auth.js'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_READ_TOKEN,
    useCdn: false,
})

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { pin } = req.body || {}

    if (!pin || typeof pin !== 'string') {
        return res.status(400).json({ error: 'PIN is required' })
    }

    try {
        // There should only ever be one accessPin document.
        const record = await client.fetch(
            `*[_type == "accessPin"][0]{ pin }`
        )

        if (!record || !record.pin) {
            // Nothing set up in Sanity yet — fail safe, don't let anyone in.
            return res.status(500).json({ error: 'Access PIN not configured' })
        }

        const isCorrect = pin === record.pin
        if (!isCorrect) return res.status(200).json({ correct: false })

        // A signed login token the app sends with every admin API call.
        return res.status(200).json({ correct: true, token: makeToken({ role: 'admin' }) })
    } catch (err) {
        console.error('Failed to verify PIN:', err)
        return res.status(500).json({ error: 'Could not verify PIN' })
    }
}