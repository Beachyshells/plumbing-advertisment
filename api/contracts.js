import { createClient } from '@sanity/client'
import { Resend } from 'resend'

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

// Emails the customer a link to their fully signed contract, where they can
// view and download it. Michael sends this with a button once both sides
// have signed. Returns true if the email went out.
async function emailSignedCopy(req, contract) {
    if (!contract?.customerEmail) return false
    const copyUrl = `https://${req.headers.host}/sign-contract?id=${encodeURIComponent(contract._id)}`
    try {
        const { error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: contract.customerEmail,
            subject: `Your signed contract${contract.contractId ? ` — ${contract.contractId}` : ''}`,
            text: `Hi ${contract.customerFirstName || 'there'},\n\nThank you! Your contract with Adirondack Advanced Water Solutions has been signed by both parties.\n\nYou can view and download your signed copy here:\n\n${copyUrl}\n\nPlease keep it for your records. If you have any questions, just reply to this email or give us a call.\n\nThank you,\nAdirondack Advanced Water Solutions`,
        })
        if (error) {
            console.error('Resend rejected the signed-copy email:', error)
            return false
        }
        return true
    } catch (err) {
        console.error('Failed to send signed-copy email:', err)
        return false
    }
}

function cleanText(value, maxLength = 1000) {
    if (typeof value !== 'string') return ''
    return value.slice(0, maxLength)
}

function randomKey() {
    return Math.random().toString(36).slice(2, 10)
}

function formatAddress(address) {
    if (!address) return ''
    return [address.street, address.city, address.state].filter(Boolean).join(', ')
}

// Best-effort — good enough for an audit trail on a small local business
// app, not meant to defeat a determined spoofer.
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) return forwarded.split(',')[0].trim()
    return req.socket?.remoteAddress || 'unknown'
}

async function nextContractId() {
    const highest = await readClient.fetch(
        `*[_type == "contract" && defined(contractId) && !defined(parentContract)] | order(contractId desc)[0].contractId`
    )
    if (!highest) return 'C-1001'
    const match = highest.match(/^C-(\d+)$/)
    if (!match) return 'C-1001'
    return `C-${Number(match[1]) + 1}`
}

async function nextAddendumId(parentContractId, parentDocId) {
    const count = await readClient.fetch(
        `count(*[_type == "contract" && parentContract._ref == $parentDocId])`,
        { parentDocId }
    )
    return `${parentContractId}-A${count + 1}`
}

function fillTemplate(bodyText, values) {
    return (bodyText || '')
        .replaceAll('{{customerName}}', values.customerName || '')
        .replaceAll('{{propertyAddress}}', values.propertyAddress || '')
        .replaceAll('{{scopeOfWork}}', values.scopeOfWork || '')
        .replaceAll('{{totalPrice}}', values.totalPrice || '')
        .replaceAll('{{serviceDate}}', values.serviceDate || '')
        .replaceAll('{{parentContractId}}', values.parentContractId || '')
}

// A template is an addendum template if its Type says so. Older templates
// are also recognized by their wording referring to the original contract's
// number, so nothing breaks if a Type was set wrong.
function isAddendumTemplate(template) {
    return template?.templateType === 'addendum' || (template?.bodyText || '').includes('{{parentContractId}}')
}

// Printed in the header of every layout-2 contract, and saved on each one so
// an old contract keeps the details that were true when it was signed.
const COMPANY_INFO = {
    name: 'Adirondack Advanced Water Solutions',
    street: '18 Nichols Rd',
    cityStateZip: 'West Chazy, NY 12992',
    phone: '(518) 534-9949',
    email: 'contact@adkadvancedwatersolutions.com',
}

const LINE_ITEM_KINDS = ['part', 'equipment', 'labor', 'other']
const PRICE_BASES = ['total', 'perVisit', 'perYear']

function cleanDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function cleanMoney(value) {
    if (value === '' || value === null || value === undefined) return undefined
    const n = Number(value)
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined
}

// Items listed by name and quantity only — never a price, per how the
// contract is meant to read (one Total at the bottom).
function cleanLineItems(items, { allowChangeType }) {
    if (!Array.isArray(items)) return []
    return items.slice(0, 100).flatMap((item) => {
        const name = cleanText(item?.name, 200).trim()
        if (!name) return []
        const quantity = Number(item.quantity)
        const kind = LINE_ITEM_KINDS.includes(item.kind) ? item.kind : 'part'
        const out = {
            _type: 'contractLineItem',
            _key: randomKey(),
            name,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            kind,
        }
        if (kind === 'equipment') {
            const make = cleanText(item.make, 100).trim()
            const model = cleanText(item.model, 100).trim()
            if (make) out.make = make
            if (model) out.model = model
        }
        if (allowChangeType && (item.changeType === 'add' || item.changeType === 'remove')) {
            out.changeType = item.changeType
        }
        return [out]
    })
}

// Checks that `parent` can serve as the original for an addendum belonging
// to `customerId`. Returns an error message, or null if it's fine.
function checkParent(parent, customerId) {
    if (!parent) return 'Original contract not found'
    if (parent.isAddendum) return 'That contract is itself an addendum — pick the original contract instead'
    if (parent.status === 'voided') return 'That contract has been voided and can\'t have addenda'
    if (parent.customerId !== customerId) return 'That contract belongs to a different customer'
    return null
}

const PARENT_CHECK_PROJECTION = `{
    _id,
    contractId,
    status,
    "customerId": customer._ref,
    "isAddendum": defined(parentContract) || defined(linkedParentContract)
}`

export default async function handler(req, res) {
    // ---- GET: templates list, one contract, or a customer's contracts ----
    if (req.method === 'GET') {
        try {
            const { id, customerId, templates, all, prefillInvoice } = req.query

            // Suggested contract details from a job, so the wizard starts
            // filled in instead of blank. Nothing is saved here — Michael
            // reviews and edits before the contract is created.
            if (prefillInvoice) {
                const invoice = await readClient.fetch(
                    `*[_type == "customerInvoice" && _id == $id][0]{
                        _id, serviceDate, workPerformed, laborCost, totalAmount,
                        lineItems[]{
                            itemType, quantity, miscName,
                            "catalogName": inventoryItem->name,
                            "isEquipment": inventoryItem->isEquipment
                        }
                    }`,
                    { id: prefillInvoice }
                )
                if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

                const lineItems = (invoice.lineItems || []).flatMap((li) => {
                    if (li.itemType === 'misc') {
                        return li.miscName ? [{ name: li.miscName, quantity: 1, kind: 'part' }] : []
                    }
                    if (!li.catalogName) return []
                    return [{ name: li.catalogName, quantity: Number(li.quantity) || 1, kind: li.isEquipment ? 'equipment' : 'part' }]
                })
                if (Number(invoice.laborCost) > 0) {
                    lineItems.push({ name: 'Labor', quantity: 1, kind: 'labor' })
                }

                return res.status(200).json({
                    prefill: {
                        invoiceId: invoice._id,
                        workDescription: invoice.workPerformed || '',
                        lineItems,
                        totalPrice: invoice.totalAmount ?? null,
                        startDate: invoice.serviceDate || '',
                    },
                })
            }

            if (templates) {
                const list = await readClient.fetch(
                    `*[_type == "contractTemplate" && active == true] | order(templateType asc, name asc){
                        _id, name, templateType, bodyText, scopeOptions
                    }`
                )
                return res.status(200).json({ templates: list })
            }

            if (id) {
                const contract = await readClient.fetch(
                    `*[_type == "contract" && _id == $id][0]{
                        _id, contractId, status, scopeOfWork, totalPrice, priceNotes, termsText,
                        layoutVersion, companyInfo, workDescription, lineItems, startDate, estimatedCompletionDate,
                        visitFrequency, priceBasis, depositAmount, originalContractTotal, originalSignedAt,
                        consentGiven, consentTimestamp, signerName, signedAt, signerIp, auditTrail,
                        companyConsentGiven, companyConsentTimestamp, companySignerName, companySignedAt, companySignerIp,
                        "signedPdfUrl": signedPdf.asset->url,
                        "signatureImageUrl": signatureImage.asset->url,
                        "companySignatureImageUrl": companySignatureImage.asset->url,
                        "templateName": template->name,
                        "templateType": template->templateType,
                        "templateBodyText": template->bodyText,
                        "customerId": customer->_id,
                        "customerFirstName": customer->firstName,
                        "customerLastName": customer->lastName,
                        "customerEmail": customer->email,
                        "customerPhone": customer->phone,
                        "propertyId": property->_id,
                        "propertyAddress": property->address,
                        "invoiceId": invoice->_id,
                        "parentContractId": parentContract->contractId,
                        "parentContractDocId": parentContract->_id,
                        "linkedParentContractId": linkedParentContract->contractId,
                        "linkedParentContractDocId": linkedParentContract->_id,
                        "addenda": *[_type == "contract" && (parentContract._ref == ^._id || linkedParentContract._ref == ^._id)] | order(createdAt asc){
                            _id, contractId, status, createdAt,
                            "isLinkedOnly": !defined(parentContract)
                        },
                        createdAt
                    }`,
                    { id }
                )
                if (!contract) return res.status(404).json({ error: 'Contract not found' })
                // Send back just the yes/no, not the whole template wording.
                const { templateBodyText, ...rest } = contract
                return res.status(200).json({
                    contract: { ...rest, templateIsAddendum: isAddendumTemplate({ templateType: rest.templateType, bodyText: templateBodyText }) },
                })
            }

            if (customerId) {
                const contracts = await readClient.fetch(
                    `*[_type == "contract" && customer._ref == $customerId] | order(createdAt desc){
                        _id, contractId, status, totalPrice, createdAt,
                        "templateName": template->name,
                        "isAddendum": defined(parentContract) || defined(linkedParentContract),
                        "parentDocId": coalesce(parentContract._ref, linkedParentContract._ref),
                        "propertyId": property._ref,
                        "invoiceId": invoice._ref
                    }`,
                    { customerId }
                )
                return res.status(200).json({ contracts })
            }

            // Every contract for the Desktop "Contracts" hub — enough to list,
            // search, and nest addenda, not the full signing details.
            if (all) {
                const contracts = await readClient.fetch(
                    `*[_type == "contract"] | order(createdAt desc){
                        _id, contractId, status, totalPrice, createdAt,
                        "templateName": template->name,
                        "isAddendum": defined(parentContract) || defined(linkedParentContract),
                        "parentDocId": coalesce(parentContract._ref, linkedParentContract._ref),
                        "customerId": customer._ref,
                        "customerFirstName": customer->firstName,
                        "customerLastName": customer->lastName,
                        "propertyAddress": property->address
                    }`
                )
                return res.status(200).json({ contracts })
            }

            return res.status(400).json({ error: 'Missing id, customerId, templates, or all param' })
        } catch (err) {
            console.error('Failed to fetch contract(s):', err)
            return res.status(500).json({ error: 'Could not load contract data' })
        }
    }

    // ---- POST: create a new contract (or addendum) from a template ----
    if (req.method === 'POST') {
        const body = req.body || {}
        const { templateId, customerId, propertyId, invoiceId, scopeOfWork, totalPrice, priceNotes, parentContractDocId, serviceDate } = body
        // Layout 2 is only used when the wizard asks for it, so anything
        // still using the original wizard keeps working exactly as before.
        const isLayout2 = Number(body.layoutVersion) === 2

        if (!templateId || !customerId || !propertyId) {
            return res.status(400).json({ error: 'Missing templateId, customerId, or propertyId' })
        }

        try {
            const [template, customer, property, parent] = await Promise.all([
                readClient.fetch(`*[_type == "contractTemplate" && _id == $id][0]{ bodyText, templateType }`, { id: templateId }),
                readClient.fetch(`*[_type == "customerProfile" && _id == $id][0]{ firstName, lastName }`, { id: customerId }),
                readClient.fetch(`*[_type == "property" && _id == $id][0]{ address }`, { id: propertyId }),
                parentContractDocId
                    ? readClient.fetch(`*[_type == "contract" && _id == $id][0]${PARENT_CHECK_PROJECTION}`, { id: parentContractDocId })
                    : null,
            ])

            if (!template) return res.status(404).json({ error: 'Template not found' })

            // Stops addenda from being created without an original — that's
            // how an unlinked addendum with a blank "Addendum to ___" happens.
            if (isAddendumTemplate(template) && !parentContractDocId) {
                return res.status(400).json({ error: 'This is an addendum template — choose the original contract it amends' })
            }

            if (parentContractDocId) {
                const parentError = checkParent(parent, customerId)
                if (parentError) return res.status(400).json({ error: parentError })
            }

            const customerName = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ')
            const propertyAddress = formatAddress(property?.address)

            const contractId = parent
                ? await nextAddendumId(parent.contractId, parentContractDocId)
                : await nextContractId()

            const termsText = fillTemplate(template.bodyText, {
                customerName,
                propertyAddress,
                scopeOfWork: (scopeOfWork || []).map((s) => `- ${s}`).join('\n'),
                totalPrice: totalPrice != null ? `$${Number(totalPrice).toFixed(2)}` : '',
                serviceDate: serviceDate || '',
                parentContractId: parent?.contractId || '',
            })

            const ip = getClientIp(req)

            if (isLayout2) {
                const templateType = template.templateType || 'oneTime'
                const isAddendum = !!parent
                const isRecurring = templateType === 'recurring'
                const isWaiver = templateType === 'liabilityWaiver'

                const price = cleanMoney(totalPrice)
                // An addendum can lower the price, so only it may be negative.
                if (price !== undefined && price < 0 && !isAddendum) {
                    return res.status(400).json({ error: 'Total price can\'t be negative' })
                }
                const deposit = isAddendum || isWaiver ? undefined : cleanMoney(body.depositAmount)
                if (deposit !== undefined && (deposit < 0 || (price !== undefined && deposit > price))) {
                    return res.status(400).json({ error: 'Deposit must be between $0 and the total price' })
                }

                const startDate = cleanDate(body.startDate)
                const estimatedCompletionDate = isRecurring || isWaiver ? undefined : cleanDate(body.estimatedCompletionDate)
                if (startDate && estimatedCompletionDate && estimatedCompletionDate < startDate) {
                    return res.status(400).json({ error: 'Estimated completion can\'t be before the start date' })
                }

                // For an addendum, save the contract total before this change
                // (the original plus any earlier addenda that weren't voided)
                // and when the original was fully signed.
                let originalContractTotal
                let originalSignedAt
                if (isAddendum) {
                    const history = await readClient.fetch(
                        `*[_type == "contract" && _id == $id][0]{
                            totalPrice, status, signedAt, companySignedAt,
                            "earlierAddenda": *[_type == "contract" && status != "voided" && (parentContract._ref == ^._id || linkedParentContract._ref == ^._id)].totalPrice
                        }`,
                        { id: parentContractDocId }
                    )
                    originalContractTotal = cleanMoney(
                        (Number(history?.totalPrice) || 0) + (history?.earlierAddenda || []).reduce((sum, n) => sum + (Number(n) || 0), 0)
                    )
                    if (history?.status === 'signed') {
                        originalSignedAt = [history.signedAt, history.companySignedAt].filter(Boolean).sort().pop()
                    }
                }

                const created = await writeClient.create({
                    _type: 'contract',
                    contractId,
                    layoutVersion: 2,
                    companyInfo: { ...COMPANY_INFO },
                    template: { _type: 'reference', _ref: templateId },
                    parentContract: parentContractDocId ? { _type: 'reference', _ref: parentContractDocId } : undefined,
                    customer: { _type: 'reference', _ref: customerId },
                    property: { _type: 'reference', _ref: propertyId },
                    invoice: invoiceId ? { _type: 'reference', _ref: invoiceId } : undefined,
                    workDescription: cleanText(body.workDescription, 2000),
                    lineItems: cleanLineItems(body.lineItems, { allowChangeType: isAddendum }),
                    scopeOfWork: (Array.isArray(scopeOfWork) ? scopeOfWork : []).map((s) => cleanText(s, 300)).filter(Boolean).slice(0, 50),
                    startDate,
                    estimatedCompletionDate,
                    visitFrequency: isRecurring ? cleanText(body.visitFrequency, 100) : undefined,
                    priceBasis: isRecurring && PRICE_BASES.includes(body.priceBasis) ? body.priceBasis : 'total',
                    totalPrice: price,
                    depositAmount: deposit,
                    originalContractTotal,
                    originalSignedAt,
                    priceNotes: cleanText(priceNotes, 500),
                    // Layout 2 templates hold only the terms. Filling
                    // placeholders anyway means an older template picked by
                    // mistake doesn't show raw {{braces}}.
                    termsText: fillTemplate(template.bodyText, {
                        customerName,
                        propertyAddress,
                        scopeOfWork: '',
                        totalPrice: price !== undefined ? `$${price.toFixed(2)}` : '',
                        serviceDate: startDate || '',
                        parentContractId: parent?.contractId || '',
                    }),
                    status: 'draft',
                    consentGiven: false,
                    auditTrail: [
                        { _type: 'auditEvent', _key: randomKey(), event: 'created', timestamp: new Date().toISOString(), ipAddress: ip },
                    ],
                    createdAt: new Date().toISOString(),
                })

                return res.status(200).json({ success: true, id: created._id, contractId })
            }

            const created = await writeClient.create({
                _type: 'contract',
                contractId,
                template: { _type: 'reference', _ref: templateId },
                parentContract: parentContractDocId ? { _type: 'reference', _ref: parentContractDocId } : undefined,
                customer: { _type: 'reference', _ref: customerId },
                property: { _type: 'reference', _ref: propertyId },
                invoice: invoiceId ? { _type: 'reference', _ref: invoiceId } : undefined,
                scopeOfWork: scopeOfWork || [],
                totalPrice: totalPrice != null ? Number(totalPrice) : undefined,
                priceNotes: cleanText(priceNotes, 500),
                termsText,
                status: 'draft',
                consentGiven: false,
                auditTrail: [
                    { _type: 'auditEvent', _key: randomKey(), event: 'created', timestamp: new Date().toISOString(), ipAddress: ip },
                ],
                createdAt: new Date().toISOString(),
            })

            return res.status(200).json({ success: true, id: created._id, contractId })
        } catch (err) {
            console.error('Failed to create contract:', err)
            return res.status(500).json({ error: 'Could not create contract' })
        }
    }

    // ---- PATCH: send / view / sign / void / link ----
    if (req.method === 'PATCH') {
        const body = req.body || {}
        const action = body.action
        const contractDocId = body.id

        if (!contractDocId) return res.status(400).json({ error: 'Missing id' })

        try {
            const ip = getClientIp(req)

            if (action === 'send') {
                await writeClient
                    .patch(contractDocId)
                    .set({ status: 'sent' })
                    .append('auditTrail', [{ _type: 'auditEvent', _key: randomKey(), event: 'sent', timestamp: new Date().toISOString(), ipAddress: ip }])
                    .commit()
                return res.status(200).json({ success: true })
            }

            if (action === 'view') {
                // Only move status forward — never downgrade an already-signed
                // contract back to "viewed" just because someone opened it again.
                const existing = await readClient.fetch(`*[_type == "contract" && _id == $id][0]{ status }`, { id: contractDocId })
                let patch = writeClient
                    .patch(contractDocId)
                    .append('auditTrail', [{ _type: 'auditEvent', _key: randomKey(), event: 'viewed', timestamp: new Date().toISOString(), ipAddress: ip }])
                if (existing?.status === 'sent' || existing?.status === 'draft') {
                    patch = patch.set({ status: 'viewed' })
                }
                await patch.commit()
                return res.status(200).json({ success: true })
            }

            if (action === 'sign') {
                const { signerName, signatureDataUrl, consentGiven, signerRole } = body
                if (!consentGiven) return res.status(400).json({ error: 'Consent is required to sign' })
                if (!signerName || !signatureDataUrl) return res.status(400).json({ error: 'Missing signer name or signature' })
                if (signerRole !== 'customer' && signerRole !== 'company') {
                    return res.status(400).json({ error: 'Invalid signer role' })
                }

                const [header, data] = signatureDataUrl.split(',')
                const contentType = header.match(/data:(.*);base64/)?.[1] || 'image/png'
                const buffer = Buffer.from(data, 'base64')
                const asset = await writeClient.assets.upload('image', buffer, { contentType })

                const now = new Date().toISOString()

                const existing = await readClient.fetch(
                    `*[_type == "contract" && _id == $id][0]{ signedAt, companySignedAt }`,
                    { id: contractDocId }
                )
                if (!existing) return res.status(404).json({ error: 'Contract not found' })

                const update = {}
                if (signerRole === 'customer') {
                    update.consentGiven = true
                    update.consentTimestamp = now
                    update.signerName = cleanText(signerName, 200)
                    update.signatureImage = { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }
                    update.signedAt = now
                    update.signerIp = ip
                } else {
                    update.companyConsentGiven = true
                    update.companyConsentTimestamp = now
                    update.companySignerName = cleanText(signerName, 200)
                    update.companySignatureImage = { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }
                    update.companySignedAt = now
                    update.companySignerIp = ip
                }

                // "Signed" only once BOTH sides have signed — otherwise it's
                // partially signed, regardless of which side just went first.
                const customerNowSigned = signerRole === 'customer' ? true : !!existing.signedAt
                const companyNowSigned = signerRole === 'company' ? true : !!existing.companySignedAt
                update.status = customerNowSigned && companyNowSigned ? 'signed' : 'partiallySigned'

                await writeClient
                    .patch(contractDocId)
                    .set(update)
                    .append('auditTrail', [{
                        _type: 'auditEvent',
                        _key: randomKey(),
                        event: signerRole === 'customer' ? 'signed_customer' : 'signed_company',
                        timestamp: now,
                        ipAddress: ip,
                    }])
                    .commit()

                return res.status(200).json({ success: true, signedAt: now, status: update.status })
            }

            // Michael's "Email Signed Copy" button — only once both sides have
            // signed. Can be pressed again to resend; each send is logged.
            if (action === 'emailCopy') {
                const contract = await readClient.fetch(
                    `*[_type == "contract" && _id == $id][0]{
                        _id, contractId, status,
                        "customerEmail": customer->email,
                        "customerFirstName": customer->firstName
                    }`,
                    { id: contractDocId }
                )
                if (!contract) return res.status(404).json({ error: 'Contract not found' })
                if (contract.status !== 'signed') {
                    return res.status(400).json({ error: 'Both sides need to sign before a copy can be emailed' })
                }
                if (!contract.customerEmail) {
                    return res.status(400).json({ error: 'No email on file for this customer' })
                }
                const sent = await emailSignedCopy(req, contract)
                if (!sent) return res.status(502).json({ error: 'The email service didn\'t accept the email — try again' })
                const now = new Date().toISOString()
                await writeClient
                    .patch(contractDocId)
                    .append('auditTrail', [{ _type: 'auditEvent', _key: randomKey(), event: 'copy_emailed', timestamp: now, ipAddress: ip }])
                    .commit()
                return res.status(200).json({ success: true, emailedTo: contract.customerEmail, emailedAt: now })
            }

            if (action === 'void') {
                await writeClient
                    .patch(contractDocId)
                    .set({ status: 'voided' })
                    .append('auditTrail', [{ _type: 'auditEvent', _key: randomKey(), event: 'voided', timestamp: new Date().toISOString(), ipAddress: ip }])
                    .commit()
                return res.status(200).json({ success: true })
            }

            // Grouping-only link for an addendum that already went out without
            // being connected to its original. Never touches the contract
            // number, the signed text, or the signatures — it only records
            // which original this belongs with. Pass parentId: null to unlink.
            if (action === 'link') {
                const parentId = body.parentId || null

                const child = await readClient.fetch(
                    `*[_type == "contract" && _id == $id][0]{
                        _id, status,
                        "customerId": customer._ref,
                        "hasRealParent": defined(parentContract),
                        "linkedParentId": linkedParentContract._ref,
                        "addendaCount": count(*[_type == "contract" && (parentContract._ref == ^._id || linkedParentContract._ref == ^._id)])
                    }`,
                    { id: contractDocId }
                )
                if (!child) return res.status(404).json({ error: 'Contract not found' })

                if (child.hasRealParent) {
                    return res.status(400).json({ error: 'This addendum is already attached to its original contract' })
                }
                if (child.status === 'draft') {
                    return res.status(400).json({
                        error: 'This addendum hasn\'t been sent yet — void it and create it from the original contract\'s "Add Addendum" button so its number and wording are filled in correctly',
                    })
                }

                // ---- Unlink ----
                if (!parentId) {
                    if (!child.linkedParentId) return res.status(400).json({ error: 'This contract isn\'t linked to anything' })
                    await writeClient
                        .patch(contractDocId)
                        .unset(['linkedParentContract'])
                        .append('auditTrail', [{ _type: 'auditEvent', _key: randomKey(), event: 'unlinked_from_original', timestamp: new Date().toISOString(), ipAddress: ip }])
                        .commit()
                    return res.status(200).json({ success: true })
                }

                // ---- Link ----
                if (parentId === contractDocId) {
                    return res.status(400).json({ error: 'A contract can\'t be linked to itself' })
                }
                if (child.addendaCount > 0) {
                    return res.status(400).json({ error: 'This contract has its own addenda, so it can\'t be filed under another contract' })
                }
                if (child.linkedParentId === parentId) {
                    return res.status(200).json({ success: true }) // already linked there — nothing to do
                }

                const parent = await readClient.fetch(
                    `*[_type == "contract" && _id == $id][0]${PARENT_CHECK_PROJECTION}`,
                    { id: parentId }
                )
                const parentError = checkParent(parent, child.customerId)
                if (parentError) return res.status(400).json({ error: parentError })

                const now = new Date().toISOString()
                const events = []
                // Switching from one original to another records both halves,
                // so the history shows it was moved rather than silently changed.
                if (child.linkedParentId) {
                    events.push({ _type: 'auditEvent', _key: randomKey(), event: 'unlinked_from_original', timestamp: now, ipAddress: ip })
                }
                events.push({ _type: 'auditEvent', _key: randomKey(), event: 'linked_to_original', timestamp: now, ipAddress: ip })

                await writeClient
                    .patch(contractDocId)
                    .set({ linkedParentContract: { _type: 'reference', _ref: parentId } })
                    .append('auditTrail', events)
                    .commit()

                return res.status(200).json({ success: true, linkedParentContractId: parent.contractId })
            }

            return res.status(400).json({ error: 'Unknown action' })
        } catch (err) {
            console.error('Failed to update contract:', err)
            return res.status(500).json({ error: 'Could not update contract' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
