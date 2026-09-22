import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = 'Adirondack Advanced Water Solutions <contact@adkadvancedwatersolutions.com>'

function cleanText(value, maxLength = 500) {
    if (typeof value !== 'string') return ''
    return value.slice(0, maxLength)
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body || {}
    const to = cleanText(body.to, 200)
    const customerName = cleanText(body.customerName, 200)
    const contractDocId = cleanText(body.contractDocId, 200)
    const contractLabel = cleanText(body.contractLabel, 200)

    if (!to) return res.status(400).json({ error: 'Missing recipient email' })
    if (!contractDocId) return res.status(400).json({ error: 'Missing contract id' })

    // Derived from the actual request host rather than hardcoded, so this
    // works correctly on the live domain and on any preview deployment.
    const signUrl = `https://${req.headers.host}/sign-contract?id=${encodeURIComponent(contractDocId)}`

    try {
        const { error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject: `Please review and sign your contract${contractLabel ? ` — ${contractLabel}` : ''}`,
            text: `Hi ${customerName || 'there'},\n\nPlease review and sign your contract with Adirondack Advanced Water Solutions using the secure link below:\n\n${signUrl}\n\nIf you have any questions, just reply to this email or give us a call.\n\nThank you,\nAdirondack Advanced Water Solutions`,
        })

        if (error) {
            console.error('Resend rejected the contract email:', error)
            return res.status(502).json({ error: 'Email service rejected the send' })
        }

        return res.status(200).json({ success: true })
    } catch (err) {
        console.error('Failed to send contract email:', err)
        return res.status(500).json({ error: 'Could not send contract email' })
    }
}