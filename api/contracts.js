import { createClient } from '@sanity/client'

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

// A template is treated as an addendum template if its wording refers to
// the original contract's number. That's the one thing an addendum can't
// be filled in correctly without, so it's the check that matters.
function isAddendumTemplate(template) {
    return (template?.bodyText || '').includes('{{parentContractId}}')
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
            const { id, customerId, templates } = req.query

            if (templates) {
                const list = await readClient.fetch(
                    `*[_type == "contractTemplate" && active == true] | order(templateType asc){
                        _id, name, templateType, bodyText, scopeOptions
                    }`
                )
                return res.status(200).json({ templates: list })
            }

            if (id) {
                const contract = await readClient.fetch(
                    `*[_type == "contract" && _id == $id][0]{
                        _id, contractId, status, scopeOfWork, totalPrice, priceNotes, termsText,
                        consentGiven, consentTimestamp, signerName, signedAt, signerIp, auditTrail,
                        companyConsentGiven, companyConsentTimestamp, companySignerName, companySignedAt, companySignerIp,
                        "signedPdfUrl": signedPdf.asset->url,
                        "signatureImageUrl": signatureImage.asset->url,
                        "companySignatureImageUrl": companySignatureImage.asset->url,
                        "templateName": template->name,
                        "templateType": template->templateType,
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
                return res.status(200).json({ contract })
            }

            if (customerId) {
                const contracts = await readClient.fetch(
                    `*[_type == "contract" && customer._ref == $customerId] | order(createdAt desc){
                        _id, contractId, status, totalPrice, createdAt,
                        "templateName": template->name,
                        "isAddendum": defined(parentContract) || defined(linkedParentContract),
                        "parentDocId": coalesce(parentContract._ref, linkedParentContract._ref)
                    }`,
                    { customerId }
                )
                return res.status(200).json({ contracts })
            }

            return res.status(400).json({ error: 'Missing id, customerId, or templates param' })
        } catch (err) {
            console.error('Failed to fetch contract(s):', err)
            return res.status(500).json({ error: 'Could not load contract data' })
        }
    }

    // ---- POST: create a new contract (or addendum) from a template ----
    if (req.method === 'POST') {
        const body = req.body || {}
        const { templateId, customerId, propertyId, invoiceId, scopeOfWork, totalPrice, priceNotes, parentContractDocId, serviceDate } = body

        if (!templateId || !customerId || !propertyId) {
            return res.status(400).json({ error: 'Missing templateId, customerId, or propertyId' })
        }

        try {
            const [template, customer, property, parent] = await Promise.all([
                readClient.fetch(`*[_type == "contractTemplate" && _id == $id][0]{ bodyText }`, { id: templateId }),
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