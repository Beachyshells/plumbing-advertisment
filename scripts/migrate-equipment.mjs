// One-time migration: copies every property's embedded equipment[] array
// into standalone `equipment` documents that reference the property.
//
// This ONLY COPIES data — it never deletes or modifies property.equipment[].
// Safe to inspect the results in Sanity Studio before doing anything else.
//
// Run from the plumbing-advertisment folder:
//   $env:SANITY_WRITE_TOKEN="paste_token_here"; node scripts/migrate-equipment.mjs

import { createClient } from '@sanity/client'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
})

async function migrate() {
    if (!process.env.SANITY_WRITE_TOKEN) {
        console.error('Missing SANITY_WRITE_TOKEN — set it before running this script.')
        process.exit(1)
    }

    const existingCount = await client.fetch(`count(*[_type == "equipment"])`)
    if (existingCount > 0 && process.env.CONFIRM !== 'yes') {
        console.log(`There are already ${existingCount} equipment document(s) in the dataset.`)
        console.log('Re-running this could create duplicates.')
        console.log('If you\'re sure you want to proceed anyway, re-run with CONFIRM=yes set.')
        process.exit(1)
    }

    const properties = await client.fetch(`*[_type == "property"]{ _id, "street": address.street, equipment }`)

    let created = 0
    let skipped = 0

    for (const property of properties) {
        for (const item of property.equipment || []) {
            if (!item) { skipped++; continue }
            await client.create({
                _type: 'equipment',
                property: { _type: 'reference', _ref: property._id },
                equipmentType: item.equipmentType,
                make: item.make,
                model: item.model,
                serialNumber: item.serialNumber,
                installDate: item.installDate,
                installedBy: item.installedBy,
                warrantyExpires: item.warrantyExpires,
                filterPartNumber: item.filterPartNumber,
                filterSize: item.filterSize,
                replaceEvery: item.replaceEvery,
                lastChanged: item.lastChanged,
                notes: item.notes,
                invoiceId: item.invoiceId,
                createdAt: new Date().toISOString(),
            })
            created++
            console.log(`Migrated: ${item.equipmentType || 'Untitled unit'} — ${property.street || property._id}`)
        }
    }

    console.log(`\nDone. Created ${created} equipment document(s).${skipped ? ` Skipped ${skipped} empty entr${skipped === 1 ? 'y' : 'ies'}.` : ''}`)
    console.log('property.equipment[] was NOT touched — go check the new Equipment list in Sanity Studio before doing anything else.')
}

migrate().catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
})