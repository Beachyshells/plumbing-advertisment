import { createClient } from '@sanity/client'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
})

function randomKey() {
    return Math.random().toString(36).slice(2, 10)
}

function cleanText(value, maxLength = 200) {
    if (typeof value !== 'string') return ''
    return value.slice(0, maxLength)
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body || {}
    const invoiceId = body.invoiceId
    const amount = Number(body.amount)

    if (!invoiceId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'A valid invoice and payment amount are required' })
    }

    try {
        const invoice = await client.fetch(
            `*[_type == "customerInvoice" && _id == $id][0]{ totalAmount, payments, "customerId": customer._ref }`,
            { id: invoiceId }
        )
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' })
        }

        const method = body.method === 'check' ? 'check' : 'cash'
        const newPayment = {
            _type: 'payment',
            _key: randomKey(),
            amount,
            method,
            date: body.date || new Date().toISOString().slice(0, 10),
            note: cleanText(body.note, 500),
            checkNumber: method === 'check' ? cleanText(body.checkNumber) : undefined,
            signee: method === 'check' ? cleanText(body.signee) : undefined,
        }

        const existingPayments = invoice.payments || []
        const totalPaid = [...existingPayments, newPayment].reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        const totalAmount = Number(invoice.totalAmount) || 0
        const overage = Math.max(totalPaid - totalAmount, 0)

        const paymentStatus = totalPaid >= totalAmount && totalAmount > 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'
        const paidDate = paymentStatus === 'paid' ? newPayment.date : undefined

        await client
            .patch(invoiceId)
            .setIfMissing({ payments: [] })
            .append('payments', [newPayment])
            .set({ paymentStatus, ...(paidDate ? { paidDate } : {}) })
            .commit()

        // Any amount beyond what was owed becomes account credit for the
        // customer, rather than sitting as a negative balance on this one
        // invoice — that way it's usable on whatever job comes next.
        if (overage > 0 && invoice.customerId) {
            await client
                .patch(invoice.customerId)
                .setIfMissing({ creditBalance: 0 })
                .inc({ creditBalance: overage })
                .commit()
        }

        return res.status(200).json({
            success: true,
            paymentStatus,
            balanceRemaining: Math.max(totalAmount - totalPaid, 0),
            creditAdded: overage,
        })
    } catch (err) {
        console.error('Failed to record payment:', err)
        return res.status(500).json({ error: 'Could not record payment' })
    }
}