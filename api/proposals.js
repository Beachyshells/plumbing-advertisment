import { createClient } from '@sanity/client'
import { Resend } from 'resend'
import { requireAdmin } from './_auth.js'

// Proposals (quotes): Michael builds one, emails the customer a link, and
// the customer accepts or declines it on a public page. An accepted
// proposal is turned into a job (invoice) with the same items.
//
// Public (the customer's page): read one proposal by its id, record that it
// was opened, accept, decline. Everything else is Michael only.

const readClient = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_READ_TOKEN,
    useCdn: false,
})

const writeClient = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
})

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_ADDRESS = 'Adirondack Advanced Water Solutions <contact@adkadvancedwatersolutions.com>'

function cleanText(value, maxLength = 1000) {
    if (typeof value !== 'string') return ''
    return value.slice(0, maxLength)
}

function cleanDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function cleanMoney(value) {
    const n = Number(value)
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function randomKey() {
    return Math.random().toString(36).slice(2, 10)
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) return forwarded.split(',')[0].trim()
    return req.socket?.remoteAddress || 'unknown'
}

function event(name, ip) {
    return { _type: 'proposalEvent', _key: randomKey(), event: name, timestamp: new Date().toISOString(), ipAddress: ip }
}

async function nextProposalId() {
    const highest = await readClient.fetch(
        `*[_type == "proposal" && defined(proposalId)] | order(proposalId desc)[0].proposalId`
    )
    const match = (highest || '').match(/^P-(\d+)$/)
    return match ? `P-${Number(match[1]) + 1}` : 'P-1001'
}

// Line items keep their quoted price, so the proposal always shows what was
// actually offered even if catalog prices change later.
function cleanLineItems(items) {
    if (!Array.isArray(items)) return []
    return items.slice(0, 100).flatMap((item) => {
        const quantity = Math.max(Number(item?.quantity) || 1, 1)
        const unitPrice = cleanMoney(item?.unitPrice)
        if (item?.itemType === 'catalog' && item.inventoryItemId) {
            return [{
                _type: 'proposalLineItem',
                _key: randomKey(),
                itemType: 'catalog',
                inventoryItem: { _type: 'reference', _ref: item.inventoryItemId },
                name: cleanText(item.name, 200),
                quantity,
                unitPrice,
            }]
        }
        const name = cleanText(item?.name, 200).trim()
        if (!name) return []
        return [{ _type: 'proposalLineItem', _key: randomKey(), itemType: 'misc', name, quantity, unitPrice }]
    })
}

function totalOf(lineItems, laborCost) {
    const parts = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0)
    return cleanMoney(parts + (Number(laborCost) || 0))
}

const PUBLIC_PROJECTION = `{
    _id, proposalId, status, workDescription, notes, laborCost, totalPrice, validUntil,
    estimatedStartDate, createdAt, acceptedAt, acceptedName, declinedAt,
    "lineItems": lineItems[]{ name, quantity },
    "customerFirstName": customer->firstName,
    "customerLastName": customer->lastName,
    "propertyAddress": property->address
}`

const FULL_PROJECTION = `{
    _id, proposalId, status, workDescription, notes, laborCost, totalPrice, validUntil,
    estimatedStartDate, createdAt, sentAt, acceptedAt, acceptedName, acceptedIp,
    declinedAt, declineReason, auditTrail,
    lineItems[]{
        _key, itemType, name, quantity, unitPrice,
        "inventoryItemId": inventoryItem->_id,
        "currentPrice": inventoryItem->sellPrice
    },
    "customerId": customer->_id,
    "customerFirstName": customer->firstName,
    "customerLastName": customer->lastName,
    "customerEmail": customer->email,
    "propertyId": property->_id,
    "propertyAddress": property->address,
    "invoiceId": invoice->_id,
    "invoiceNumber": invoice->invoiceNumber
}`

const LIST_PROJECTION = `{
    _id, proposalId, status, totalPrice, validUntil, createdAt, workDescription,
    "customerId": customer._ref,
    "customerFirstName": customer->firstName,
    "customerLastName": customer->lastName,
    "propertyAddress": property->address,
    "invoiceNumber": invoice->invoiceNumber
}`

export default async function handler(req, res) {
    const action = req.method === 'PATCH' ? req.body?.action : null
    const isCustomerCall =
        (req.method === 'GET' && req.query.id && req.query.public === 'true') ||
        (req.method === 'PATCH' && ['view', 'accept', 'decline'].includes(action))
    if (!isCustomerCall && !requireAdmin(req, res)) return

    // ============================== GET ==============================
    if (req.method === 'GET') {
        try {
            const { id, customerId } = req.query
            if (id) {
                const proposal = await readClient.fetch(
                    `*[_type == "proposal" && _id == $id][0]${req.query.public === 'true' ? PUBLIC_PROJECTION : FULL_PROJECTION}`,
                    { id }
                )
                if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
                return res.status(200).json({ proposal })
            }
            const filter = customerId ? `_type == "proposal" && customer._ref == $customerId` : `_type == "proposal"`
            const proposals = await readClient.fetch(`*[${filter}] | order(createdAt desc)${LIST_PROJECTION}`, { customerId: customerId || '' })
            return res.status(200).json({ proposals })
        } catch (err) {
            console.error('Failed to load proposals:', err)
            return res.status(500).json({ error: 'Could not load proposals' })
        }
    }

    const ip = getClientIp(req)

    // ============================== POST (create) ==============================
    if (req.method === 'POST') {
        const body = req.body || {}
        if (!body.customerId || !body.propertyId) {
            return res.status(400).json({ error: 'Pick a customer and property first' })
        }
        const lineItems = cleanLineItems(body.lineItems)
        const laborCost = cleanMoney(body.laborCost)
        if (lineItems.length === 0 && laborCost <= 0) {
            return res.status(400).json({ error: 'Add at least one item or a labor charge' })
        }
        try {
            const proposalId = await nextProposalId()
            const created = await writeClient.create({
                _type: 'proposal',
                proposalId,
                customer: { _type: 'reference', _ref: body.customerId },
                property: { _type: 'reference', _ref: body.propertyId },
                workDescription: cleanText(body.workDescription, 2000),
                lineItems,
                laborCost,
                totalPrice: totalOf(lineItems, laborCost),
                estimatedStartDate: cleanDate(body.estimatedStartDate),
                validUntil: cleanDate(body.validUntil),
                notes: cleanText(body.notes, 2000),
                status: 'draft',
                auditTrail: [event('created', ip)],
                createdAt: new Date().toISOString(),
            })
            return res.status(200).json({ success: true, id: created._id, proposalId })
        } catch (err) {
            console.error('Failed to create proposal:', err)
            return res.status(500).json({ error: 'Could not create proposal' })
        }
    }

    // ============================== PATCH ==============================
    if (req.method === 'PATCH') {
        const body = req.body || {}
        const id = body.id
        if (!id) return res.status(400).json({ error: 'Missing id' })

        try {
            const existing = await readClient.fetch(
                `*[_type == "proposal" && _id == $id][0]{
                    _id, proposalId, status, validUntil,
                    "invoiceId": invoice._ref,
                    "customerEmail": customer->email,
                    "customerFirstName": customer->firstName
                }`,
                { id }
            )
            if (!existing) return res.status(404).json({ error: 'Proposal not found' })
            const today = new Date().toISOString().slice(0, 10)
            const expired = existing.validUntil && existing.validUntil < today

            // ---- Michael: change a draft ----
            if (action === 'edit') {
                if (existing.status !== 'draft') {
                    return res.status(400).json({ error: 'Only a draft can be changed — this one has already been sent' })
                }
                const lineItems = cleanLineItems(body.lineItems)
                const laborCost = cleanMoney(body.laborCost)
                await writeClient
                    .patch(id)
                    .set({
                        workDescription: cleanText(body.workDescription, 2000),
                        lineItems,
                        laborCost,
                        totalPrice: totalOf(lineItems, laborCost),
                        notes: cleanText(body.notes, 2000),
                        ...(cleanDate(body.estimatedStartDate) ? { estimatedStartDate: cleanDate(body.estimatedStartDate) } : {}),
                        ...(cleanDate(body.validUntil) ? { validUntil: cleanDate(body.validUntil) } : {}),
                    })
                    .append('auditTrail', [event('edited', ip)])
                    .commit()
                return res.status(200).json({ success: true })
            }

            // ---- Michael: email the customer a link ----
            if (action === 'send') {
                if (!['draft', 'sent', 'viewed'].includes(existing.status)) {
                    return res.status(400).json({ error: 'This proposal has already been answered' })
                }
                if (!existing.customerEmail) return res.status(400).json({ error: 'No email on file for this customer' })
                const link = `https://${req.headers.host}/proposal?id=${encodeURIComponent(id)}`
                const { error } = await resend.emails.send({
                    from: FROM_ADDRESS,
                    to: existing.customerEmail,
                    subject: `Your proposal from Adirondack Advanced Water Solutions — ${existing.proposalId}`,
                    text: `Hi ${existing.customerFirstName || 'there'},\n\nThank you for the opportunity to quote your project. You can review your proposal and accept it online here:\n\n${link}\n\nIf you have any questions, just reply to this email or give us a call.\n\nThank you,\nAdirondack Advanced Water Solutions`,
                })
                if (error) {
                    console.error('Resend rejected the proposal email:', error)
                    return res.status(502).json({ error: 'The email service didn\'t accept the email — try again' })
                }
                const patch = writeClient.patch(id).append('auditTrail', [event('sent', ip)]).set({ sentAt: new Date().toISOString() })
                if (existing.status === 'draft') patch.set({ status: 'sent' })
                await patch.commit()
                return res.status(200).json({ success: true, emailedTo: existing.customerEmail })
            }

            // ---- Customer: opened the link ----
            if (action === 'view') {
                const patch = writeClient.patch(id).append('auditTrail', [event('viewed', ip)])
                if (existing.status === 'sent') patch.set({ status: 'viewed' })
                await patch.commit()
                return res.status(200).json({ success: true })
            }

            // ---- Customer: accept ----
            if (action === 'accept') {
                if (!['sent', 'viewed'].includes(existing.status)) {
                    return res.status(400).json({ error: 'This proposal can no longer be accepted' })
                }
                if (expired) return res.status(400).json({ error: 'This proposal has expired — please contact us for an updated quote' })
                const name = cleanText(body.acceptedName, 200).trim()
                if (!name || !body.agreed) return res.status(400).json({ error: 'Type your name and check the box to accept' })
                const now = new Date().toISOString()
                await writeClient
                    .patch(id)
                    .set({ status: 'accepted', acceptedName: name, acceptedAt: now, acceptedIp: ip })
                    .append('auditTrail', [event('accepted', ip)])
                    .commit()
                return res.status(200).json({ success: true, acceptedAt: now })
            }

            // ---- Customer: decline ----
            if (action === 'decline') {
                if (!['sent', 'viewed'].includes(existing.status)) {
                    return res.status(400).json({ error: 'This proposal has already been answered' })
                }
                await writeClient
                    .patch(id)
                    .set({ status: 'declined', declinedAt: new Date().toISOString(), declineReason: cleanText(body.reason, 1000) })
                    .append('auditTrail', [event('declined', ip)])
                    .commit()
                return res.status(200).json({ success: true })
            }

            // ---- Michael: link the job made from this proposal ----
            if (action === 'linkInvoice') {
                if (existing.status !== 'accepted') return res.status(400).json({ error: 'Only an accepted proposal can become a job' })
                if (existing.invoiceId) return res.status(400).json({ error: 'A job was already created from this proposal' })
                if (!body.invoiceId) return res.status(400).json({ error: 'Missing invoiceId' })
                await writeClient
                    .patch(id)
                    .set({ invoice: { _type: 'reference', _ref: body.invoiceId } })
                    .append('auditTrail', [event('converted', ip)])
                    .commit()
                return res.status(200).json({ success: true })
            }

            // ---- Michael: withdraw ----
            if (action === 'withdraw') {
                if (existing.status === 'accepted') return res.status(400).json({ error: 'An accepted proposal can\'t be withdrawn' })
                await writeClient.patch(id).set({ status: 'withdrawn' }).append('auditTrail', [event('withdrawn', ip)]).commit()
                return res.status(200).json({ success: true })
            }

            return res.status(400).json({ error: 'Unknown action' })
        } catch (err) {
            console.error('Failed to update proposal:', err)
            return res.status(500).json({ error: 'Could not update proposal' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
