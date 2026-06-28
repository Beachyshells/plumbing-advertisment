import { createClient } from '@sanity/client'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN, // secret, from env var — never hardcoded
    useCdn: false,
})

export default async function handler(req, res) {
    console.log('--- DEBUG: SANITY_WRITE_TOKEN Check ---');
    console.log('Value exists:', !!process.env.SANITY_WRITE_TOKEN);
    console.log('Token snippet:', process.env.SANITY_WRITE_TOKEN ? process.env.SANITY_WRITE_TOKEN.substring(0, 5) + '...' : 'UNDEFINED');
    console.log('Token starts:', process.env.SANITY_WRITE_TOKEN?.slice(0, 10), 'length:', process.env.SANITY_WRITE_TOKEN?.length)
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { name, location, comment } = req.body || {}

    // Basic validation
    if (!name || !comment) {
        return res.status(400).json({ error: 'Name and comment are required' })
    }

    // Light length limits to prevent abuse
    if (name.length > 100 || (location && location.length > 100) || comment.length > 1000) {
        return res.status(400).json({ error: 'Input too long' })
    }

    try {
        await client.create({
            _type: 'comment',
            name: String(name).slice(0, 100),
            location: location ? String(location).slice(0, 100) : '',
            comment: String(comment).slice(0, 1000),
            status: 'pending', // always pending — you approve in the Studio
            createdAt: new Date().toISOString(),
        })
        return res.status(200).json({ success: true })
    } catch (err) {
        console.error('Failed to create comment:', err)
        return res.status(500).json({ error: 'Could not submit comment' })
    }
}