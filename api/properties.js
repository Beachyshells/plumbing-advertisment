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

function titleCase(value) {
    if (typeof value !== 'string') return ''
    return value
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(' ')
}

function randomKey() {
    return Math.random().toString(36).slice(2, 10)
}

const PROPERTY_PROJECTION = `
    _id,
    address,
    wellOrMunicipal,
    gateCodeKeyEntry,
    mainShutoffLocation,
    equipment
`

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const id = req.query.id
        try {
            if (id) {
                const property = await readClient.fetch(
                    `*[_type == "property" && _id == $id][0]{${PROPERTY_PROJECTION}}`,
                    { id }
                )
                if (!property) return res.status(404).json({ error: 'Property not found' })
                return res.status(200).json({ property })
            }

            const properties = await readClient.fetch(
                `*[_type == "property"] | order(createdAt desc){${PROPERTY_PROJECTION}}`
            )
            return res.status(200).json({ properties })
        } catch (err) {
            console.error('Failed to fetch properties:', err)
            return res.status(500).json({ error: 'Could not load properties' })
        }
    }

    if (req.method === 'POST') {
        const body = req.body || {}
        const address = body.address || {}
        const street = titleCase(cleanText(address.street))
        const city = titleCase(cleanText(address.city))
        const state = cleanText(address.state).toUpperCase()
        const zip = cleanText(address.zip)

        if (!street || !city || !state) {
            return res.status(400).json({ error: 'Street, city, and state are required' })
        }

        try {
            const created = await writeClient.create({
                _type: 'property',
                address: { street, city, state, zip },
                wellOrMunicipal: cleanText(body.wellOrMunicipal),
                gateCodeKeyEntry: cleanText(body.gateCodeKeyEntry),
                mainShutoffLocation: cleanText(body.mainShutoffLocation),
                notes: cleanText(body.notes),
                createdAt: new Date().toISOString(),
            })
            return res.status(200).json({ success: true, id: created._id })
        } catch (err) {
            console.error('Failed to create property:', err)
            return res.status(500).json({ error: 'Could not save property' })
        }
    }

    if (req.method === 'PATCH') {
        const body = req.body || {}
        const action = body.action || 'update'
        const propertyId = body.propertyId

        if (!propertyId) {
            return res.status(400).json({ error: 'Missing propertyId' })
        }

        try {
            if (action === 'addEquipment') {
                const item = body.equipment || {}
                const newItem = {
                    _type: 'equipmentItem',
                    _key: randomKey(),
                    equipmentType: cleanText(item.equipmentType, 200),
                    make: cleanText(item.make, 200),
                    model: cleanText(item.model, 200),
                    serialNumber: cleanText(item.serialNumber, 200),
                    installDate: item.installDate || undefined,
                    installedBy: cleanText(item.installedBy, 200),
                    warrantyExpires: item.warrantyExpires || undefined,
                    filterPartNumber: cleanText(item.filterPartNumber, 200),
                    filterSize: cleanText(item.filterSize, 200),
                    replaceEvery: cleanText(item.replaceEvery, 200),
                    lastChanged: item.lastChanged || undefined,
                    notes: cleanText(item.notes, 1000),
                }
                await writeClient
                    .patch(propertyId)
                    .setIfMissing({ equipment: [] })
                    .append('equipment', [newItem])
                    .commit()
                return res.status(200).json({ success: true })
            }

            if (action === 'updateEquipment') {
                const key = body.equipmentKey
                const item = body.equipment || {}
                if (!key) return res.status(400).json({ error: 'Missing equipmentKey' })

                await writeClient
                    .patch(propertyId)
                    .set({
                        [`equipment[_key=="${key}"].equipmentType`]: cleanText(item.equipmentType, 200),
                        [`equipment[_key=="${key}"].make`]: cleanText(item.make, 200),
                        [`equipment[_key=="${key}"].model`]: cleanText(item.model, 200),
                        [`equipment[_key=="${key}"].serialNumber`]: cleanText(item.serialNumber, 200),
                        [`equipment[_key=="${key}"].installDate`]: item.installDate || undefined,
                        [`equipment[_key=="${key}"].installedBy`]: cleanText(item.installedBy, 200),
                        [`equipment[_key=="${key}"].warrantyExpires`]: item.warrantyExpires || undefined,
                        [`equipment[_key=="${key}"].filterPartNumber`]: cleanText(item.filterPartNumber, 200),
                        [`equipment[_key=="${key}"].filterSize`]: cleanText(item.filterSize, 200),
                        [`equipment[_key=="${key}"].replaceEvery`]: cleanText(item.replaceEvery, 200),
                        [`equipment[_key=="${key}"].lastChanged`]: item.lastChanged || undefined,
                        [`equipment[_key=="${key}"].notes`]: cleanText(item.notes, 1000),
                    })
                    .commit()
                return res.status(200).json({ success: true })
            }

            if (action === 'deleteEquipment') {
                const key = body.equipmentKey
                if (!key) return res.status(400).json({ error: 'Missing equipmentKey' })
                await writeClient
                    .patch(propertyId)
                    .unset([`equipment[_key=="${key}"]`])
                    .commit()
                return res.status(200).json({ success: true })
            }

            // action === 'update' (default) — editing the property's own core details
            const address = body.address || {}
            const street = titleCase(cleanText(address.street))
            const city = titleCase(cleanText(address.city))
            const state = cleanText(address.state).toUpperCase()
            const zip = cleanText(address.zip)

            if (!street || !city || !state) {
                return res.status(400).json({ error: 'Street, city, and state are required' })
            }

            await writeClient
                .patch(propertyId)
                .set({
                    address: { street, city, state, zip },
                    wellOrMunicipal: cleanText(body.wellOrMunicipal),
                    gateCodeKeyEntry: cleanText(body.gateCodeKeyEntry),
                    mainShutoffLocation: cleanText(body.mainShutoffLocation),
                    notes: cleanText(body.notes),
                })
                .commit()
            return res.status(200).json({ success: true })
        } catch (err) {
            console.error('Failed to update property:', err)
            return res.status(500).json({ error: 'Could not update property' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}