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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const invoiceId = req.body?.invoiceId
    if (!invoiceId) {
        return res.status(400).json({ error: 'Missing invoiceId' })
    }

    try {
        const invoice = await client.fetch(
            `*[_type == "customerInvoice" && _id == $id][0]{ totalAmount, payments, "customerId": customer._ref, "customerCredit": customer->creditBalance }`,
            { id: invoiceId }
        )
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' })
        }

        const existingPayments = invoice.payments || []
        const totalPaid = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        const totalAmount = Number(invoice.totalAmount) || 0
        const balanceOwed = Math.max(totalAmount - totalPaid, 0)
        const availableCredit = Number(invoice.customerCredit) || 0

        const amountToApply = Math.min(balanceOwed, availableCredit)
        if (amountToApply <= 0) {
            return res.status(400).json({ error: 'No credit available to apply' })
        }

        const creditPayment = {
            _type: 'payment',
            _key: randomKey(),
            amount: amountToApply,
            method: 'credit',
            date: new Date().toISOString().slice(0, 10),
            note: 'Applied from account credit',
        }

        const newTotalPaid = totalPaid + amountToApply
        const paymentStatus = newTotalPaid >= totalAmount && totalAmount > 0 ? 'paid' : 'partial'
        const paidDate = paymentStatus === 'paid' ? creditPayment.date : undefined

        await client
            .patch(invoiceId)
            .setIfMissing({ payments: [] })
            .append('payments', [creditPayment])
            .set({ paymentStatus, ...(paidDate ? { paidDate } : {}) })
            .commit()

        await client.patch(invoice.customerId).dec({ creditBalance: amountToApply }).commit()

        return res.status(200).json({
            success: true,
            amountApplied: amountToApply,
            paymentStatus,
            balanceRemaining: Math.max(totalAmount - newTotalPaid, 0),
        })
    } catch (err) {
        console.error('Failed to apply credit:', err)
        return res.status(500).json({ error: 'Could not apply credit' })
    }
}