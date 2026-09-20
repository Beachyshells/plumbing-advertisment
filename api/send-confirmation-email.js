import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Update this once the domain is verified in Resend — must be an address
// on that verified domain (e.g. confirmations@adkadvancedwatersolutions.com).
const FROM_ADDRESS = 'Adirondack Advanced Water Solutions <REPLACE_ME@adkadvancedwatersolutions.com>'

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
    const workPerformed = cleanText(body.workPerformed, 300)
    const startDate = cleanText(body.startDate, 50)
    const serviceAddress = cleanText(body.serviceAddress, 300)

    if (!to) {
        return res.status(400).json({ error: 'Missing recipient email' })
    }

    const jobLine = workPerformed
        ? `We have your ${workPerformed} scheduled for ${startDate || 'your upcoming date'}.`
        : `We have your job scheduled for ${startDate || 'your upcoming date'}.`

    try {
        const { error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject: `You're scheduled with us${startDate ? ` — ${startDate}` : ''}`,
            text: `Hi ${customerName || 'there'},\n\nThanks for scheduling with us! ${jobLine}${serviceAddress ? `\n\nService address: ${serviceAddress}` : ''}\n\nWe're looking forward to it.\n\nAdirondack Advanced Water Solutions`,
        })

        if (error) {
            console.error('Resend rejected the email:', error)
            return res.status(502).json({ error: 'Email service rejected the send' })
        }

        return res.status(200).json({ success: true })
    } catch (err) {
        console.error('Failed to send confirmation email:', err)
        return res.status(500).json({ error: 'Could not send confirmation email' })
    }
}