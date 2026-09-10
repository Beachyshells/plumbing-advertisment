// One-time import script — seeds the inventory catalog from Begor's Supply
// purchase history. Safe to delete after running once.
//
// Run from your aws-plumbing project folder:
//   node import-inventory.js
//
// Requires SANITY_WRITE_TOKEN to be set in your environment (same token
// your api/*.js files already use — check your .env.local file).

import { createClient } from '@sanity/client'

const client = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
})

const items = [
    {
        "name": "grate ground green",
        "supplier": "Begor's Supply",
        "buyPrice": 3.59,
        "sellPrice": 6.82,
        "notes": "Category: Drainage Tile Fittings, imported from purchase history (Jan 15, 2026)"
    },
    {
        "name": "14/3 Outdoor Cord 100'",
        "supplier": "Begor's Supply",
        "buyPrice": 58.49,
        "sellPrice": 111.13,
        "notes": "Category: Electrical, imported from purchase history (Jan 2, 2026)"
    },
    {
        "name": "Pump Wire Twisted 12-2",
        "supplier": "Begor's Supply",
        "buyPrice": 1.15,
        "sellPrice": 2.18,
        "notes": "Category: Electrical, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "12/2 250' UF-B Wire",
        "supplier": "Begor's Supply",
        "buyPrice": 217.95,
        "sellPrice": 294.23,
        "notes": "Category: Electrical, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "Battery Rayovac 9 Volt Single",
        "supplier": "Begor's Supply",
        "buyPrice": 3.59,
        "sellPrice": 6.82,
        "notes": "Category: Electrical, imported from purchase history (Feb 4, 2026)"
    },
    {
        "name": "Digital Multi Meter",
        "supplier": "Begor's Supply",
        "buyPrice": 40.49,
        "sellPrice": 76.93,
        "notes": "Category: Electrical, imported from purchase history (Feb 4, 2026)"
    },
    {
        "name": "Electrical Tape Heavy Duty",
        "supplier": "Begor's Supply",
        "buyPrice": 2.61,
        "sellPrice": 4.96,
        "notes": "Category: Electrical, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "Red Wire Conn. 14-12AWG",
        "supplier": "Begor's Supply",
        "buyPrice": 4.99,
        "sellPrice": 9.48,
        "notes": "Category: Electrical, imported from purchase history (Aug 6, 2026)"
    },
    {
        "name": "Conduit Pipe 1/2\"x10'",
        "supplier": "Begor's Supply",
        "buyPrice": 5.02,
        "sellPrice": 9.54,
        "notes": "Category: Electrical, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "Conduit Male Adapter 1/2 in",
        "supplier": "Begor's Supply",
        "buyPrice": 0.71,
        "sellPrice": 1.35,
        "notes": "Category: Electrical, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "Conduit LB 1/2 IN",
        "supplier": "Begor's Supply",
        "buyPrice": 3.5,
        "sellPrice": 6.65,
        "notes": "Category: Electrical, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "5/16\" Poly Braided Rope",
        "supplier": "Begor's Supply",
        "buyPrice": 0.09,
        "sellPrice": 0.17,
        "notes": "Category: Hardware, imported from purchase history (Jan 2, 2026)"
    },
    {
        "name": "1'' Nylon Coupling",
        "supplier": "Begor's Supply",
        "buyPrice": 0.79,
        "sellPrice": 1.5,
        "notes": "Category: Hardware, imported from purchase history (Jan 2, 2026)"
    },
    {
        "name": "Rubber Strap 24\"",
        "supplier": "Begor's Supply",
        "buyPrice": 3.49,
        "sellPrice": 6.63,
        "notes": "Category: Hardware, imported from purchase history (Jan 15, 2026)"
    },
    {
        "name": "Water Heater Thermostat Lower",
        "supplier": "Begor's Supply",
        "buyPrice": 14.39,
        "sellPrice": 27.34,
        "notes": "Category: Heating, imported from purchase history (Feb 2, 2026)"
    },
    {
        "name": "Water Heater Thermostat Upper",
        "supplier": "Begor's Supply",
        "buyPrice": 26.99,
        "sellPrice": 51.28,
        "notes": "Category: Heating, imported from purchase history (Feb 2, 2026)"
    },
    {
        "name": "Water Heater 50 gal electric",
        "supplier": "Begor's Supply",
        "buyPrice": 529.43,
        "sellPrice": 714.73,
        "notes": "Category: Heating, imported from purchase history (Feb 9, 2026)"
    },
    {
        "name": "Water Heater 40 GAL  Electric",
        "supplier": "Begor's Supply",
        "buyPrice": 465.49,
        "sellPrice": 628.41,
        "notes": "Category: Heating, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "Softener Salt Pellets  40 lbs",
        "supplier": "Begor's Supply",
        "buyPrice": 9.99,
        "sellPrice": 18.98,
        "notes": "Category: Household Items, imported from purchase history (Feb 3, 2026)"
    },
    {
        "name": "Stainless steel tee 1 in",
        "supplier": "Begor's Supply",
        "buyPrice": 12.99,
        "sellPrice": 24.68,
        "notes": "Category: Misc, imported from purchase history (Feb 26, 2026)"
    },
    {
        "name": "Miscellaneous",
        "supplier": "Begor's Supply",
        "buyPrice": 499.99,
        "sellPrice": 674.99,
        "notes": "Category: Misc, imported from purchase history (Apr 16, 2026)"
    },
    {
        "name": "1\" Nylon Insert Elbow",
        "supplier": "Begor's Supply",
        "buyPrice": 1.25,
        "sellPrice": 2.38,
        "notes": "Category: Plumbing, imported from purchase history (Jan 26, 2026)"
    },
    {
        "name": "Heat Shrinks",
        "supplier": "Begor's Supply",
        "buyPrice": 2.96,
        "sellPrice": 5.62,
        "notes": "Category: Plumbing, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "1 1/4'' MPT X 1'' Stainless Insert Adapter",
        "supplier": "Begor's Supply",
        "buyPrice": 14.88,
        "sellPrice": 28.27,
        "notes": "Category: Plumbing, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "Map Gas Cylinder",
        "supplier": "Begor's Supply",
        "buyPrice": 11.69,
        "sellPrice": 22.21,
        "notes": "Category: Plumbing, imported from purchase history (Jan 27, 2026)"
    },
    {
        "name": "Pump Rope 1/4''",
        "supplier": "Begor's Supply",
        "buyPrice": 0.1,
        "sellPrice": 0.19,
        "notes": "Category: Plumbing, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "Stainless Steel Hose Clamps11/2",
        "supplier": "Begor's Supply",
        "buyPrice": 1.99,
        "sellPrice": 3.78,
        "notes": "Category: Plumbing, imported from purchase history (Jun 18, 2026)"
    },
    {
        "name": "Well Pump 1/2hp 5gpm 230v",
        "supplier": "Begor's Supply",
        "buyPrice": 519.95,
        "sellPrice": 701.93,
        "notes": "Category: Plumbing, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "Hose Clamp #20 13/16 x 1 3/4",
        "supplier": "Begor's Supply",
        "buyPrice": 2.51,
        "sellPrice": 4.77,
        "notes": "Category: Plumbing, imported from purchase history (Aug 3, 2026)"
    },
    {
        "name": "Coupling Insert 1 Inch Stainless",
        "supplier": "Begor's Supply",
        "buyPrice": 10.79,
        "sellPrice": 20.5,
        "notes": "Category: Plumbing, imported from purchase history (Jul 7, 2026)"
    },
    {
        "name": "Well Cap 6\"",
        "supplier": "Begor's Supply",
        "buyPrice": 42.49,
        "sellPrice": 80.73,
        "notes": "Category: Plumbing, imported from purchase history (Jan 7, 2026)"
    },
    {
        "name": "Pressure switch Lo cut of 30-50",
        "supplier": "Begor's Supply",
        "buyPrice": 26.99,
        "sellPrice": 51.28,
        "notes": "Category: Plumbing, imported from purchase history (Jan 7, 2026)"
    },
    {
        "name": "Check Valve 1''FPT X 11/4MPT",
        "supplier": "Begor's Supply",
        "buyPrice": 27.99,
        "sellPrice": 53.18,
        "notes": "Category: Plumbing, imported from purchase history (Jan 7, 2026)"
    },
    {
        "name": "1'' Male Adapter Stainless Steel",
        "supplier": "Begor's Supply",
        "buyPrice": 12.4,
        "sellPrice": 23.56,
        "notes": "Category: Plumbing, imported from purchase history (Jul 7, 2026)"
    },
    {
        "name": "Well Pump 1/2hp 10gpm 230v",
        "supplier": "Begor's Supply",
        "buyPrice": 469.99,
        "sellPrice": 634.49,
        "notes": "Category: Plumbing, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "Waterline 1\"x100' 160psi",
        "supplier": "Begor's Supply",
        "buyPrice": 64.59,
        "sellPrice": 122.72,
        "notes": "Category: Plumbing, imported from purchase history (Jan 27, 2026)"
    },
    {
        "name": "Bladder Tank Vertical 20 Gal",
        "supplier": "Begor's Supply",
        "buyPrice": 199.99,
        "sellPrice": 269.99,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "3/4'' Steel Ins Male Adapter",
        "supplier": "Begor's Supply",
        "buyPrice": 4.22,
        "sellPrice": 8.02,
        "notes": "Category: Plumbing, imported from purchase history (Jan 7, 2026)"
    },
    {
        "name": "Tank Tee Kit -Long w/ Union",
        "supplier": "Begor's Supply",
        "buyPrice": 107.99,
        "sellPrice": 145.79,
        "notes": "Category: Plumbing, imported from purchase history (May 7, 2026)"
    },
    {
        "name": "Water Filter RS1-DS",
        "supplier": "Begor's Supply",
        "buyPrice": 12.39,
        "sellPrice": 23.54,
        "notes": "Category: Plumbing, imported from purchase history (Jan 9, 2026)"
    },
    {
        "name": "hose clamp #16",
        "supplier": "Begor's Supply",
        "buyPrice": 1.79,
        "sellPrice": 3.4,
        "notes": "Category: Plumbing, imported from purchase history (Jul 7, 2026)"
    },
    {
        "name": "Torque Arrester",
        "supplier": "Begor's Supply",
        "buyPrice": 11.0,
        "sellPrice": 20.9,
        "notes": "Category: Plumbing, imported from purchase history (Jun 18, 2026)"
    },
    {
        "name": "waterline 1' X 300ft 160 psi",
        "supplier": "Begor's Supply",
        "buyPrice": 189.99,
        "sellPrice": 256.49,
        "notes": "Category: Plumbing, imported from purchase history (Jan 14, 2026)"
    },
    {
        "name": "Fernco 6 x 4 P1056-64",
        "supplier": "Begor's Supply",
        "buyPrice": 27.15,
        "sellPrice": 51.58,
        "notes": "Category: Plumbing, imported from purchase history (Jan 15, 2026)"
    },
    {
        "name": "Fernco 4 In P1056-44",
        "supplier": "Begor's Supply",
        "buyPrice": 6.57,
        "sellPrice": 12.48,
        "notes": "Category: Plumbing, imported from purchase history (Jan 15, 2026)"
    },
    {
        "name": "Fernco Elbow 4",
        "supplier": "Begor's Supply",
        "buyPrice": 19.79,
        "sellPrice": 37.6,
        "notes": "Category: Plumbing, imported from purchase history (Jan 15, 2026)"
    },
    {
        "name": "PVC Pipe 4\"x20' Pipe Foamcore",
        "supplier": "Begor's Supply",
        "buyPrice": 38.81,
        "sellPrice": 73.74,
        "notes": "Category: Plumbing, imported from purchase history (Jan 15, 2026)"
    },
    {
        "name": "SCH 40 90 Degree Elbow 4 IN",
        "supplier": "Begor's Supply",
        "buyPrice": 10.43,
        "sellPrice": 19.82,
        "notes": "Category: Plumbing, imported from purchase history (Jan 15, 2026)"
    },
    {
        "name": "PVC Cement All Weather",
        "supplier": "Begor's Supply",
        "buyPrice": 17.99,
        "sellPrice": 34.18,
        "notes": "Category: Plumbing, imported from purchase history (Jan 15, 2026)"
    },
    {
        "name": "PVC Ball Valve 2\" Glue",
        "supplier": "Begor's Supply",
        "buyPrice": 15.99,
        "sellPrice": 30.38,
        "notes": "Category: Plumbing, imported from purchase history (Jan 16, 2026)"
    },
    {
        "name": "Flush Lever Front Mount",
        "supplier": "Begor's Supply",
        "buyPrice": 5.39,
        "sellPrice": 10.24,
        "notes": "Category: Plumbing, imported from purchase history (Jan 16, 2026)"
    },
    {
        "name": "Pvc Pipe 2\"x5 ft",
        "supplier": "Begor's Supply",
        "buyPrice": 8.5,
        "sellPrice": 16.15,
        "notes": "Category: Plumbing, imported from purchase history (Jan 16, 2026)"
    },
    {
        "name": "4\"x2\" PVC Coupling",
        "supplier": "Begor's Supply",
        "buyPrice": 10.79,
        "sellPrice": 20.5,
        "notes": "Category: Plumbing, imported from purchase history (Jan 16, 2026)"
    },
    {
        "name": "4\"x4\"x2\" PVC Tee",
        "supplier": "Begor's Supply",
        "buyPrice": 18.89,
        "sellPrice": 35.89,
        "notes": "Category: Plumbing, imported from purchase history (Jan 16, 2026)"
    },
    {
        "name": "1\" Poly Insert Coupling",
        "supplier": "Begor's Supply",
        "buyPrice": 2.24,
        "sellPrice": 4.26,
        "notes": "Category: Plumbing, imported from purchase history (Jan 26, 2026)"
    },
    {
        "name": "Blue Monster Thread Tape",
        "supplier": "Begor's Supply",
        "buyPrice": 4.85,
        "sellPrice": 9.21,
        "notes": "Category: Plumbing, imported from purchase history (Feb 9, 2026)"
    },
    {
        "name": "Pex Pipe 3/4\"x20' Blue Type A",
        "supplier": "Begor's Supply",
        "buyPrice": 13.99,
        "sellPrice": 26.58,
        "notes": "Category: Plumbing, imported from purchase history (Feb 2, 2026)"
    },
    {
        "name": "Pex Elbow 1 IN",
        "supplier": "Begor's Supply",
        "buyPrice": 5.47,
        "sellPrice": 10.39,
        "notes": "Category: Plumbing, imported from purchase history (Feb 3, 2026)"
    },
    {
        "name": "Pex Male Adapt 1x1 pex mpt",
        "supplier": "Begor's Supply",
        "buyPrice": 5.61,
        "sellPrice": 10.66,
        "notes": "Category: Plumbing, imported from purchase history (Feb 3, 2026)"
    },
    {
        "name": "Pex Pipe 1\"x10 White Type A",
        "supplier": "Begor's Supply",
        "buyPrice": 15.29,
        "sellPrice": 29.05,
        "notes": "Category: Plumbing, imported from purchase history (Aug 3, 2026)"
    },
    {
        "name": "Pex Clamps 1'' 5PK",
        "supplier": "Begor's Supply",
        "buyPrice": 8.09,
        "sellPrice": 15.37,
        "notes": "Category: Plumbing, imported from purchase history (Feb 3, 2026)"
    },
    {
        "name": "hose clamps microgear #4",
        "supplier": "Begor's Supply",
        "buyPrice": 1.79,
        "sellPrice": 3.4,
        "notes": "Category: Plumbing, imported from purchase history (Feb 4, 2026)"
    },
    {
        "name": "Compression Union 3/8",
        "supplier": "Begor's Supply",
        "buyPrice": 8.99,
        "sellPrice": 17.08,
        "notes": "Category: Plumbing, imported from purchase history (Feb 4, 2026)"
    },
    {
        "name": "1\" Pex Ball Valve",
        "supplier": "Begor's Supply",
        "buyPrice": 29.99,
        "sellPrice": 56.98,
        "notes": "Category: Plumbing, imported from purchase history (Feb 4, 2026)"
    },
    {
        "name": "1/4\" Hose Splicer",
        "supplier": "Begor's Supply",
        "buyPrice": 1.97,
        "sellPrice": 3.74,
        "notes": "Category: Plumbing, imported from purchase history (Feb 4, 2026)"
    },
    {
        "name": "1'' Pitless Adapter",
        "supplier": "Begor's Supply",
        "buyPrice": 75.99,
        "sellPrice": 144.38,
        "notes": "Category: Plumbing, imported from purchase history (Jun 25, 2026)"
    },
    {
        "name": "1\"x3/4\" Galv Reduc Coupling",
        "supplier": "Begor's Supply",
        "buyPrice": 4.91,
        "sellPrice": 9.33,
        "notes": "Category: Plumbing, imported from purchase history (Feb 5, 2026)"
    },
    {
        "name": "0.75\"x2\" Galv Pipe Nipple",
        "supplier": "Begor's Supply",
        "buyPrice": 1.99,
        "sellPrice": 3.78,
        "notes": "Category: Plumbing, imported from purchase history (Feb 5, 2026)"
    },
    {
        "name": "Pex Coupling 1/2 x 3/4",
        "supplier": "Begor's Supply",
        "buyPrice": 1.96,
        "sellPrice": 3.72,
        "notes": "Category: Plumbing, imported from purchase history (Feb 9, 2026)"
    },
    {
        "name": "Pex Female Adapt 3/4x3/4 Pex FP",
        "supplier": "Begor's Supply",
        "buyPrice": 3.51,
        "sellPrice": 6.67,
        "notes": "Category: Plumbing, imported from purchase history (Feb 9, 2026)"
    },
    {
        "name": "1-1/4\" Stainless Insert Male Adapter",
        "supplier": "Begor's Supply",
        "buyPrice": 18.09,
        "sellPrice": 34.37,
        "notes": "Category: Plumbing, imported from purchase history (Aug 6, 2026)"
    },
    {
        "name": "Bladder Tank Horizontal 20 Gal",
        "supplier": "Begor's Supply",
        "buyPrice": 216.0,
        "sellPrice": 291.6,
        "notes": "Category: Plumbing, imported from purchase history (May 21, 2026)"
    },
    {
        "name": "Check Valve 1'' Brass",
        "supplier": "Begor's Supply",
        "buyPrice": 17.99,
        "sellPrice": 34.18,
        "notes": "Category: Plumbing, imported from purchase history (Feb 26, 2026)"
    },
    {
        "name": "Tank Tee Kit-Short",
        "supplier": "Begor's Supply",
        "buyPrice": 89.99,
        "sellPrice": 121.49,
        "notes": "Category: Plumbing, imported from purchase history (Feb 26, 2026)"
    },
    {
        "name": "1'' Brass Plug",
        "supplier": "Begor's Supply",
        "buyPrice": 6.42,
        "sellPrice": 12.2,
        "notes": "Category: Plumbing, imported from purchase history (Feb 26, 2026)"
    },
    {
        "name": "Jet Pump 1/2 HP Deep Well",
        "supplier": "Begor's Supply",
        "buyPrice": 375.0,
        "sellPrice": 506.25,
        "notes": "Category: Plumbing, imported from purchase history (Feb 26, 2026)"
    },
    {
        "name": "Bronze 1\" Female Adaptor",
        "supplier": "Begor's Supply",
        "buyPrice": 17.99,
        "sellPrice": 34.18,
        "notes": "Category: Plumbing, imported from purchase history (May 7, 2026)"
    },
    {
        "name": "SS Nipple 1inXclose",
        "supplier": "Begor's Supply",
        "buyPrice": 8.99,
        "sellPrice": 17.08,
        "notes": "Category: Plumbing, imported from purchase history (Feb 26, 2026)"
    },
    {
        "name": "Fernco 6 x 6 P1056-66",
        "supplier": "Begor's Supply",
        "buyPrice": 21.41,
        "sellPrice": 40.68,
        "notes": "Category: Plumbing, imported from purchase history (Mar 7, 2026)"
    },
    {
        "name": "Pressure Switch 40-60",
        "supplier": "Begor's Supply",
        "buyPrice": 23.99,
        "sellPrice": 45.58,
        "notes": "Category: Plumbing, imported from purchase history (Mar 26, 2026)"
    },
    {
        "name": "Pex 1/2x3/4 Male Adapt Pex MPT",
        "supplier": "Begor's Supply",
        "buyPrice": 3.7,
        "sellPrice": 7.03,
        "notes": "Category: Plumbing, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "Pressure Switch 20-40",
        "supplier": "Begor's Supply",
        "buyPrice": 19.49,
        "sellPrice": 37.03,
        "notes": "Category: Plumbing, imported from purchase history (May 21, 2026)"
    },
    {
        "name": "Well Pump 3/4hp 10gpm 230v",
        "supplier": "Begor's Supply",
        "buyPrice": 569.99,
        "sellPrice": 769.49,
        "notes": "Category: Plumbing, imported from purchase history (Jul 27, 2026)"
    },
    {
        "name": "Bronze 1\" Male Adapter",
        "supplier": "Begor's Supply",
        "buyPrice": 12.99,
        "sellPrice": 24.68,
        "notes": "Category: Plumbing, imported from purchase history (Jun 25, 2026)"
    },
    {
        "name": "Poly Barb Plug 1\"",
        "supplier": "Begor's Supply",
        "buyPrice": 1.34,
        "sellPrice": 2.55,
        "notes": "Category: Plumbing, imported from purchase history (Jul 7, 2026)"
    },
    {
        "name": "1\" Pex female adapter",
        "supplier": "Begor's Supply",
        "buyPrice": 7.73,
        "sellPrice": 14.69,
        "notes": "Category: Plumbing, imported from purchase history (Aug 3, 2026)"
    },
    {
        "name": "Well Pump 1hp 5gpm 230v",
        "supplier": "Begor's Supply",
        "buyPrice": 741.0,
        "sellPrice": 1000.35,
        "notes": "Category: Plumbing, imported from purchase history (Aug 18, 2026)"
    },
    {
        "name": "Pex 1/2\" Elbow 10pk",
        "supplier": "Begor's Supply",
        "buyPrice": 15.99,
        "sellPrice": 30.38,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "Pex 1/2\" Elbow 40pk",
        "supplier": "Begor's Supply",
        "buyPrice": 42.6,
        "sellPrice": 80.94,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "Pinch Clamps 1/2\" 100pk",
        "supplier": "Begor's Supply",
        "buyPrice": 24.29,
        "sellPrice": 46.15,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "1/2'' X 3/8'' Angled Valve Pex",
        "supplier": "Begor's Supply",
        "buyPrice": 7.68,
        "sellPrice": 14.59,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "Pex 1/2\" Ball Valve",
        "supplier": "Begor's Supply",
        "buyPrice": 6.69,
        "sellPrice": 12.71,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "Pex Pipe 1/2'' X 100' Blue",
        "supplier": "Begor's Supply",
        "buyPrice": 22.46,
        "sellPrice": 42.67,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "Pex Clamps 1/2\" 25pk",
        "supplier": "Begor's Supply",
        "buyPrice": 10.65,
        "sellPrice": 20.23,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "3/4\" Poly Barb x FPT adapter",
        "supplier": "Begor's Supply",
        "buyPrice": 2.75,
        "sellPrice": 5.22,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "Pex Tee 1/2 25 Pk",
        "supplier": "Begor's Supply",
        "buyPrice": 44.99,
        "sellPrice": 85.48,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "Pex 1/2 Barb x 3/8 Strt Valve",
        "supplier": "Begor's Supply",
        "buyPrice": 8.24,
        "sellPrice": 15.66,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "Pex Pipe 1/2\"x100' Red PEX-A",
        "supplier": "Begor's Supply",
        "buyPrice": 37.99,
        "sellPrice": 72.18,
        "notes": "Category: Plumbing, imported from purchase history (Aug 15, 2026)"
    },
    {
        "name": "3/4'' Poly Barb Elbow",
        "supplier": "Begor's Supply",
        "buyPrice": 1.34,
        "sellPrice": 2.55,
        "notes": "Category: Plumbing, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "3/4 Slip x 3/4 FPT Elbow",
        "supplier": "Begor's Supply",
        "buyPrice": 1.34,
        "sellPrice": 2.55,
        "notes": "Category: Plumbing, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "Waterline 3/4\"x100'",
        "supplier": "Begor's Supply",
        "buyPrice": 26.96,
        "sellPrice": 51.22,
        "notes": "Category: Plumbing, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "Stainless Steel Elbow 3/4\"MPTx3/4\" Barb",
        "supplier": "Begor's Supply",
        "buyPrice": 12.22,
        "sellPrice": 23.22,
        "notes": "Category: Plumbing, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "Pex Female Adapt 3/4fptx1/2",
        "supplier": "Begor's Supply",
        "buyPrice": 3.49,
        "sellPrice": 6.63,
        "notes": "Category: Plumbing, imported from purchase history (Aug 17, 2026)"
    },
    {
        "name": "Toboggan Winter Trek Dark Blue 66in",
        "supplier": "Begor's Supply",
        "buyPrice": 49.99,
        "sellPrice": 94.98,
        "notes": "Category: Seasonal, imported from purchase history (Jan 16, 2026)"
    },
    {
        "name": "Rock Salt Marco 50lbs (clean)",
        "supplier": "Begor's Supply",
        "buyPrice": 10.44,
        "sellPrice": 19.84,
        "notes": "Category: Seasonal, imported from purchase history (Feb 4, 2026)"
    },
    {
        "name": "Septic Tank 300 Gal.Black Round",
        "supplier": "Begor's Supply",
        "buyPrice": 750.0,
        "sellPrice": 1012.5,
        "notes": "Category: Septic Supplies, imported from purchase history (Apr 16, 2026)"
    },
    {
        "name": "PVC Pipe Cutter",
        "supplier": "Begor's Supply",
        "buyPrice": 21.99,
        "sellPrice": 41.78,
        "notes": "Category: Tools, imported from purchase history (Feb 2, 2026)"
    },
    {
        "name": "Pipe Wrench Aluminum 14in.",
        "supplier": "Begor's Supply",
        "buyPrice": 31.99,
        "sellPrice": 60.78,
        "notes": "Category: Tools, imported from purchase history (Feb 24, 2026)"
    },
    {
        "name": "Pipe Wrench Aluminum 18in.",
        "supplier": "Begor's Supply",
        "buyPrice": 44.99,
        "sellPrice": 85.48,
        "notes": "Category: Tools, imported from purchase history (Feb 24, 2026)"
    },
    {
        "name": "Pipe Wrench Aluminum 24in.",
        "supplier": "Begor's Supply",
        "buyPrice": 54.99,
        "sellPrice": 104.48,
        "notes": "Category: Tools, imported from purchase history (Feb 24, 2026)"
    },
    {
        "name": "DeWalt 1 3/4\" Holesaw",
        "supplier": "Begor's Supply",
        "buyPrice": 17.09,
        "sellPrice": 32.47,
        "notes": "Category: Tools, imported from purchase history (Mar 7, 2026)"
    }
]

async function run() {
    if (!process.env.SANITY_WRITE_TOKEN) {
        console.error('SANITY_WRITE_TOKEN is not set. Check your .env.local file.')
        process.exit(1)
    }

    console.log(`Importing ${items.length} inventory items...`)
    let created = 0
    let failed = 0

    for (const item of items) {
        try {
            await client.create({
                _type: 'inventoryItem',
                name: item.name,
                supplier: item.supplier,
                buyPrice: item.buyPrice,
                sellPrice: item.sellPrice,
                notes: item.notes,
                createdAt: new Date().toISOString(),
            })
            created++
            console.log(`✓ ${item.name}`)
        } catch (err) {
            failed++
            console.error(`✗ Failed: ${item.name} — ${err.message}`)
        }
    }

    console.log(`\nDone. Created: ${created}, Failed: ${failed}`)
}

run()