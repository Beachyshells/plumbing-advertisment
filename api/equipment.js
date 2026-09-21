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

const EQUIPMENT_PROJECTION = `
    _id,
    equipmentType,
    make,
    model,
    serialNumber,
    installDate,
    installedBy,
    warrantyExpires,
    filterPartNumber,
    filterSize,
    replaceEvery,
    lastChanged,
    notes,
    invoiceId,
    "propertyId": property->_id
`

export default async function handler(req, res) {
    // ---- GET: every equipment document for a property ----
    if (req.method === 'GET') {
        try {
            const { propertyId } = req.query
            if (!propertyId) {
                return res.status(400).json({ error: 'Missing propertyId' })
            }
            const equipment = await readClient.fetch(
                `*[_type == "equipment" && property._ref == $propertyId] | order(createdAt asc){${EQUIPMENT_PROJECTION}}`,
                { propertyId }
            )
            return res.status(200).json({ equipment })
        } catch (err) {
            console.error('Failed to fetch equipment:', err)
            return res.status(500).json({ error: 'Could not load equipment' })
        }
    }

    // ---- POST: create a new equipment document ----
    if (req.method === 'POST') {
        const body = req.body || {}
        if (!body.propertyId) {
            return res.status(400).json({ error: 'Missing propertyId' })
        }
        try {
            const created = await writeClient.create({
                _type: 'equipment',
                property: { _type: 'reference', _ref: body.propertyId },
                equipmentType: cleanText(body.equipmentType, 200),
                make: cleanText(body.make, 200),
                model: cleanText(body.model, 200),
                serialNumber: cleanText(body.serialNumber, 200),
                installDate: body.installDate || undefined,
                installedBy: cleanText(body.installedBy, 200),
                warrantyExpires: body.warrantyExpires || undefined,
                filterPartNumber: cleanText(body.filterPartNumber, 200),
                filterSize: cleanText(body.filterSize, 200),
                replaceEvery: cleanText(body.replaceEvery, 200),
                lastChanged: body.lastChanged || undefined,
                notes: cleanText(body.notes, 1000),
                invoiceId: cleanText(body.invoiceId, 200) || undefined,
                createdAt: new Date().toISOString(),
            })
            return res.status(200).json({ success: true, id: created._id })
        } catch (err) {
            console.error('Failed to create equipment:', err)
            return res.status(500).json({ error: 'Could not save equipment' })
        }
    }

    // ---- PATCH: edit an existing equipment document, by its own _id ----
    if (req.method === 'PATCH') {
        const body = req.body || {}
        const equipmentId = body.equipmentId
        if (!equipmentId) {
            return res.status(400).json({ error: 'Missing equipmentId' })
        }
        try {
            await writeClient
                .patch(equipmentId)
                .set({
                    equipmentType: cleanText(body.equipmentType, 200),
                    make: cleanText(body.make, 200),
                    model: cleanText(body.model, 200),
                    serialNumber: cleanText(body.serialNumber, 200),
                    installDate: body.installDate || undefined,
                    installedBy: cleanText(body.installedBy, 200),
                    warrantyExpires: body.warrantyExpires || undefined,
                    filterPartNumber: cleanText(body.filterPartNumber, 200),
                    filterSize: cleanText(body.filterSize, 200),
                    replaceEvery: cleanText(body.replaceEvery, 200),
                    lastChanged: body.lastChanged || undefined,
                    notes: cleanText(body.notes, 1000),
                    ...(body.invoiceId !== undefined ? { invoiceId: cleanText(body.invoiceId, 200) || undefined } : {}),
                })
                .commit()
            return res.status(200).json({ success: true })
        } catch (err) {
            console.error('Failed to update equipment:', err)
            return res.status(500).json({ error: 'Could not update equipment' })
        }
    }

    // ---- DELETE: remove an equipment document entirely ----
    if (req.method === 'DELETE') {
        const body = req.body || {}
        const equipmentId = body.equipmentId
        if (!equipmentId) {
            return res.status(400).json({ error: 'Missing equipmentId' })
        }
        try {
            await writeClient.delete(equipmentId)
            return res.status(200).json({ success: true })
        } catch (err) {
            console.error('Failed to delete equipment:', err)
            return res.status(500).json({ error: 'Could not delete equipment' })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}