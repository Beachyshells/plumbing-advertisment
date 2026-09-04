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

const MAX_LENGTH = 1000

function cleanText(value, maxLength = 1000) {
    if (typeof value !== 'string') return ''
    return value.slice(0, maxLength)
}

function titleCase(value) {
    if (typeof value !== 'string') return ''
    return value
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(' ')
}



function cleanAddress(value) {
    if (!value || typeof value !== 'object') return undefined
    const street = cleanText(value.street)
    const city = cleanText(value.city)
    const state = cleanText(value.state)
    const zip = cleanText(value.zip)
    if (!street && !city && !state && !zip) return undefined
    return { street, city, state, zip }
}

const OPTIONAL_FIELDS = ['altPhone', 'dog', 'email', 'notes']

function computeStatus(profile) {
    const billingAddressFilled =
        !profile.billingAddress ||
        (profile.billingAddress.street && profile.billingAddress.city && profile.billingAddress.state)
    const optionalFieldsFilled = OPTIONAL_FIELDS.every((key) => profile[key])
    return billingAddressFilled && optionalFieldsFilled ? 'complete' : 'incomplete'
}

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const id = req.query.id
        try {
            if (id) {
                const customer = await readClient.fetch(
                    `*[_type == "customerProfile" && _id == $id][0]{
                        _id,
                        firstName,
                        lastName,
                        bestPhone,
                        altPhone,
                        billingAddress,
                        dog,
                        email,
                        notes,
                        status,
                        creditBalance,
                        "property": property->{
                            _id,
                            address,
                            wellOrMunicipal,
                            gateCodeKeyEntry,
                            mainShutoffLocation
                        }
                    }`,
                    { id }
                )
                if (!customer) {
                    return res.status(404).json({ error: 'Customer not found' })
                }
                return res.status(200).json({ customer })
            }

            const customers = await readClient.fetch(
                `*[_type == "customerProfile"] | order(lastName asc){
                    _id,
                    firstName,
                    lastName,
                    bestPhone,
                    billingAddress,
                    email,
                    status,
                    createdAt,
                    creditBalance,
                    "property": property->{
                        _id,
                        address
                    }
                }`
            )
            return res.status(200).json({ customers })
        } catch (err) {
            console.error('Failed to fetch customer(s):', err)
            return res.status(500).json({ error: 'Could not load customer data' })
        }
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const body = req.body || {}
        const firstName = titleCase(cleanText(body.firstName))
        const lastName = titleCase(cleanText(body.lastName))
        const bestPhone = cleanText(body.bestPhone)
        const propertyId = body.propertyId

        if (!firstName || !lastName || !bestPhone || !propertyId) {
            return res.status(400).json({ error: 'First name, last name, best phone, and a property are required' })
        }

        const profile = {
            firstName,
            lastName,
            bestPhone,
            altPhone: cleanText(body.altPhone),
            property: { _type: 'reference', _ref: propertyId },
            billingAddress: cleanAddress(body.billingAddress),
            dog: cleanText(body.dog),
            email: cleanText(body.email),
            notes: cleanText(body.notes),
        }
        profile.status = computeStatus(profile)

        try {
            if (req.method === 'PATCH') {
                const id = body.id
                if (!id) {
                    return res.status(400).json({ error: 'Missing customer id to update' })
                }
                await writeClient
                    .patch(id)
                    .set({ ...profile, updatedAt: new Date().toISOString() })
                    .commit()
                return res.status(200).json({ success: true, id })
            }

            const created = await writeClient.create({
                _type: 'customerProfile',
                ...profile,
                source: 'intake-wizard',
                createdAt: new Date().toISOString(),
            })
            return res.status(200).json({ success: true, id: created._id })
        } catch (err) {
            console.error('Failed to save customer profile:', err)
            return res.status(500).json({ error: 'Could not save customer profile' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}