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
    // Michael or a logged-in employee (the employee parts screen reads it).
    if (!requireStaff(req, res)) return

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const items = await client.fetch(
            `*[_type == "inventoryItem"] | order(name asc){
                              _id,
                name,
                supplier,
                buyPrice,
                sellPrice,
                category,
                isEquipment
            }`
        )
        return res.status(200).json({ items })
    } catch (err) {
        console.error('Failed to fetch inventory:', err)
        return res.status(500).json({ error: 'Could not load inventory' })
    }
}