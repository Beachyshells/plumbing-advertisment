// One-time patch — sets category and isEquipment on the inventory items
// imported earlier. Safe to delete after running once.
//
// Run from your aws-plumbing project folder:
//   node --env-file=.env.local patch-inventory-categories.js

import { createClient } from '@sanity/client'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
})

const patches = [
    {
        "name": "grate ground green",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "14/3 Outdoor Cord 100'",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "Pump Wire Twisted 12-2",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "12/2 250' UF-B Wire",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "Battery Rayovac 9 Volt Single",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "Digital Multi Meter",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "Electrical Tape Heavy Duty",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "Red Wire Conn. 14-12AWG",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "Conduit Pipe 1/2\"x10'",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "Conduit Male Adapter 1/2 in",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "Conduit LB 1/2 IN",
        "category": "Electrical",
        "isEquipment": false
    },
    {
        "name": "5/16\" Poly Braided Rope",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "1'' Nylon Coupling",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Rubber Strap 24\"",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Water Heater Thermostat Lower",
        "category": "Heating",
        "isEquipment": false
    },
    {
        "name": "Water Heater Thermostat Upper",
        "category": "Heating",
        "isEquipment": false
    },
    {
        "name": "Water Heater 50 gal electric",
        "category": "Heating",
        "isEquipment": true
    },
    {
        "name": "Water Heater 40 GAL  Electric",
        "category": "Heating",
        "isEquipment": true
    },
    {
        "name": "Softener Salt Pellets  40 lbs",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Stainless steel tee 1 in",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Miscellaneous",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "1\" Nylon Insert Elbow",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Heat Shrinks",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1 1/4'' MPT X 1'' Stainless Insert Adapter",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Map Gas Cylinder",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pump Rope 1/4''",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Stainless Steel Hose Clamps11/2",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Well Pump 1/2hp 5gpm 230v",
        "category": "Plumbing",
        "isEquipment": true
    },
    {
        "name": "Hose Clamp #20 13/16 x 1 3/4",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Coupling Insert 1 Inch Stainless",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Well Cap 6\"",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pressure switch Lo cut of 30-50",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Check Valve 1''FPT X 11/4MPT",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1'' Male Adapter Stainless Steel",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Well Pump 1/2hp 10gpm 230v",
        "category": "Plumbing",
        "isEquipment": true
    },
    {
        "name": "Waterline 1\"x100' 160psi",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Bladder Tank Vertical 20 Gal",
        "category": "Plumbing",
        "isEquipment": true
    },
    {
        "name": "3/4'' Steel Ins Male Adapter",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Tank Tee Kit -Long w/ Union",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Water Filter RS1-DS",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "hose clamp #16",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Torque Arrester",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "waterline 1' X 300ft 160 psi",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Fernco 6 x 4 P1056-64",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Fernco 4 In P1056-44",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Fernco Elbow 4",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "PVC Pipe 4\"x20' Pipe Foamcore",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "SCH 40 90 Degree Elbow 4 IN",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "PVC Cement All Weather",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "PVC Ball Valve 2\" Glue",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Flush Lever Front Mount",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pvc Pipe 2\"x5 ft",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "4\"x2\" PVC Coupling",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "4\"x4\"x2\" PVC Tee",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1\" Poly Insert Coupling",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Blue Monster Thread Tape",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Pipe 3/4\"x20' Blue Type A",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Elbow 1 IN",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Male Adapt 1x1 pex mpt",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Pipe 1\"x10 White Type A",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Clamps 1'' 5PK",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "hose clamps microgear #4",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Compression Union 3/8",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1\" Pex Ball Valve",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1/4\" Hose Splicer",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1'' Pitless Adapter",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1\"x3/4\" Galv Reduc Coupling",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "0.75\"x2\" Galv Pipe Nipple",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Coupling 1/2 x 3/4",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Female Adapt 3/4x3/4 Pex FP",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1-1/4\" Stainless Insert Male Adapter",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Bladder Tank Horizontal 20 Gal",
        "category": "Plumbing",
        "isEquipment": true
    },
    {
        "name": "Check Valve 1'' Brass",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Tank Tee Kit-Short",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1'' Brass Plug",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Jet Pump 1/2 HP Deep Well",
        "category": "Plumbing",
        "isEquipment": true
    },
    {
        "name": "Bronze 1\" Female Adaptor",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "SS Nipple 1inXclose",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Fernco 6 x 6 P1056-66",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pressure Switch 40-60",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex 1/2x3/4 Male Adapt Pex MPT",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pressure Switch 20-40",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Well Pump 3/4hp 10gpm 230v",
        "category": "Plumbing",
        "isEquipment": true
    },
    {
        "name": "Bronze 1\" Male Adapter",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Poly Barb Plug 1\"",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1\" Pex female adapter",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Well Pump 1hp 5gpm 230v",
        "category": "Plumbing",
        "isEquipment": true
    },
    {
        "name": "Pex 1/2\" Elbow 10pk",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex 1/2\" Elbow 40pk",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pinch Clamps 1/2\" 100pk",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "1/2'' X 3/8'' Angled Valve Pex",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex 1/2\" Ball Valve",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Pipe 1/2'' X 100' Blue",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Clamps 1/2\" 25pk",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "3/4\" Poly Barb x FPT adapter",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Tee 1/2 25 Pk",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex 1/2 Barb x 3/8 Strt Valve",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Pipe 1/2\"x100' Red PEX-A",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "3/4'' Poly Barb Elbow",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "3/4 Slip x 3/4 FPT Elbow",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Waterline 3/4\"x100'",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Stainless Steel Elbow 3/4\"MPTx3/4\" Barb",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Pex Female Adapt 3/4fptx1/2",
        "category": "Plumbing",
        "isEquipment": false
    },
    {
        "name": "Toboggan Winter Trek Dark Blue 66in",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Rock Salt Marco 50lbs (clean)",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Septic Tank 300 Gal.Black Round",
        "category": "Other",
        "isEquipment": true
    },
    {
        "name": "PVC Pipe Cutter",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Pipe Wrench Aluminum 14in.",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Pipe Wrench Aluminum 18in.",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "Pipe Wrench Aluminum 24in.",
        "category": "Other",
        "isEquipment": false
    },
    {
        "name": "DeWalt 1 3/4\" Holesaw",
        "category": "Other",
        "isEquipment": false
    }
]

async function run() {
    if (!process.env.SANITY_WRITE_TOKEN) {
        console.error('SANITY_WRITE_TOKEN is not set.')
        process.exit(1)
    }

    let updated = 0
    let notFound = 0

    for (const p of patches) {
        const doc = await client.fetch(
            `*[_type == "inventoryItem" && name == $name][0]{ _id }`,
            { name: p.name }
        )
        if (!doc) {
            console.error(`✗ Not found: ${p.name}`)
            notFound++
            continue
        }
        await client.patch(doc._id).set({ category: p.category, isEquipment: p.isEquipment }).commit()
        console.log(`✓ ${p.name} — ${p.category}${p.isEquipment ? ' (equipment)' : ''}`)
        updated++
    }

    console.log(`\nDone. Updated: ${updated}, Not found: ${notFound}`)
}

run()