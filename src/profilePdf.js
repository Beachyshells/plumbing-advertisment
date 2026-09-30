import jsPDF from 'jspdf'

// The printable customer profile — page 1 (customer, site access, equipment
// at a glance, service history) and the Equipment Record (every unit's
// serial and warranty details, plus water tests, consumables, and notes).
//
// Anything we have on file is filled in. Anything we don't is left as a
// blank line to write on, so the same printout works for a brand-new
// customer and one with years of history.
//
//   customer  — the customerProfile (name, phones, email, dog, billing...)
//   property  — the service property (address, well/municipal, gate, shutoff)
//   equipment — equipment records at that property (optional)
//   invoices  — that customer's jobs at that property, newest first (optional)

const NAVY = [19, 53, 94]
const GRAY_LABEL = [130, 130, 130]
const GRAY_LINE = [190, 190, 190]
const BLACK = [20, 20, 20]
const LIGHT = [245, 245, 245]

const LEFT = 36
const RIGHT = 576
const WIDTH = RIGHT - LEFT
const BOTTOM = 740

function loadImageAsDataUrl(url) {
    return new Promise((resolve) => {
        fetch(url)
            .then((res) => (res.ok ? res.blob() : null))
            .then((blob) => {
                if (!blob) return resolve(null)
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result)
                reader.onerror = () => resolve(null)
                reader.readAsDataURL(blob)
            })
            .catch(() => resolve(null))
    })
}

function formatAddress(address) {
    if (!address || (!address.street && !address.city && !address.state && !address.zip)) return ''
    const cityStateZip = [address.city, address.state].filter(Boolean).join(', ')
    return [address.street, [cityStateZip, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

// "2026-10-01" -> "10/1/2026", built from the parts so time zones can't shift it.
function formatDate(value) {
    if (!value || typeof value !== 'string') return ''
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return value
    return `${Number(match[2])}/${Number(match[3])}/${match[1]}`
}

function text(value) {
    if (value === null || value === undefined) return ''
    return String(value).trim()
}

function fullName(customer) {
    return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ')
}

export async function generateProfilePdf({ customer = {}, property = {}, equipment = [], invoices = [] }) {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const logoDataUrl = await loadImageAsDataUrl('/logo-icon.png')
    const name = fullName(customer)

    let y = 0

    // ---- Shared drawing helpers ----
    function sectionBar(label) {
        doc.setFillColor(...NAVY)
        doc.rect(LEFT, y - 13, WIDTH, 20, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.text(label, LEFT + 5, y + 1)
        y += 28
    }

    function field(label, value, x, colWidth) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(label.toUpperCase(), x, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        const fitted = doc.splitTextToSize(text(value) || '—', colWidth)
        doc.text(fitted.slice(0, 2), x, y + 13)
    }

    // A table with a gray header row, fixed columns, and `rows` lines. Rows
    // with data are filled in; the rest stay blank to write on.
    function table({ columns, data, rows, rowHeight = 22 }) {
        const top = y - 13
        doc.setFillColor(...LIGHT)
        doc.rect(LEFT, top, WIDTH, 15, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...GRAY_LABEL)
        columns.forEach((c) => doc.text(c.label, c.x + 5, y - 2))

        const bodyTop = top + 15
        const bottom = bodyTop + rowHeight * rows
        doc.setDrawColor(...GRAY_LINE)
        doc.setLineWidth(0.5)
        for (let i = 0; i <= rows; i++) doc.line(LEFT, bodyTop + rowHeight * i, RIGHT, bodyTop + rowHeight * i)
        ;[...columns.map((c) => c.x), RIGHT].forEach((cx) => doc.line(cx, top, cx, bottom))

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(...BLACK)
        data.slice(0, rows).forEach((row, i) => {
            const rowY = bodyTop + rowHeight * i + rowHeight / 2 + 3
            columns.forEach((c, ci) => {
                const next = columns[ci + 1]?.x ?? RIGHT
                const fitted = doc.splitTextToSize(text(row[ci]), next - c.x - 8)
                doc.text(fitted[0] || '', c.x + 4, rowY)
            })
        })
        y = bottom + 24
    }

    // ================= PAGE 1 =================
    const headerX = logoDataUrl ? 108 : LEFT
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', LEFT, 30, 60, 60)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.text('Adirondack Advanced Water Solutions', headerX, 50)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Plumbing  •  Water Filtration  •  Pumps', headerX, 66)
    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('(518) 534-9949', headerX, 80)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text('CUSTOMER PROFILE', RIGHT, 50, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    const since = formatDate((customer.createdAt || '').slice(0, 10)) || new Date().toLocaleDateString()
    doc.text(`Customer since  ${since}`, RIGHT, 66, { align: 'right' })
    doc.text(`Printed  ${new Date().toLocaleDateString()}`, RIGHT, 80, { align: 'right' })

    y = 118
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(1)
    doc.line(LEFT, y, RIGHT, y)
    y += 24

    const rowGap = 38
    sectionBar('CUSTOMER')
    field('Name', name, 36, 220)
    field('Best Phone', customer.bestPhone, 264, 150)
    field('Alt Phone', customer.altPhone, 422, 154)
    y += rowGap
    field('Service Address', formatAddress(property?.address), 36, 350)
    field('Well / Municipal', property?.wellOrMunicipal, 394, 182)
    y += rowGap
    field('Billing Address (if different)', formatAddress(customer.billingAddress), 36, 350)
    field('Email', customer.email, 394, 182)
    y += rowGap + 8

    sectionBar('SITE ACCESS & CAUTIONS')
    field('Gate Code / Key / Entry', property?.gateCodeKeyEntry, 36, 220)
    field('Dog?', customer.dog, 264, 100)
    field('Main Shutoff Location', property?.mainShutoffLocation, 372, 204)
    y += rowGap + 8

    sectionBar('EQUIPMENT AT A GLANCE')
    const glanceRows = Math.max(4, Math.min(equipment.length, 6))
    table({
        columns: [
            { label: 'TYPE', x: 36 },
            { label: 'MAKE / MODEL', x: 156 },
            { label: 'SERIAL NO.', x: 326 },
            { label: 'INSTALLED', x: 476 },
        ],
        data: equipment.map((e) => [
            e.equipmentType,
            [e.make, e.model].filter(Boolean).join(' '),
            e.serialNumber,
            formatDate(e.installDate),
        ]),
        rows: glanceRows,
    })
    if (equipment.length > glanceRows) {
        y -= 18
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(`+ ${equipment.length - glanceRows} more — see Equipment Record`, LEFT, y)
        y += 18
    }

    sectionBar('SERVICE HISTORY')
    const history = invoices.filter((inv) => inv.status !== 'canceled')
    const historyRows = Math.max(3, Math.floor((BOTTOM - y + 13 - 15) / 22))
    table({
        columns: [
            { label: 'DATE', x: 36 },
            { label: 'TECH', x: 111 },
            { label: 'WORK PERFORMED / PARTS USED', x: 196 },
            { label: 'INVOICE #', x: 491 },
        ],
        data: history.map((inv) => [formatDate(inv.serviceDate), inv.technician, inv.workPerformed, inv.invoiceNumber]),
        rows: historyRows,
    })

    // ================= EQUIPMENT RECORD =================
    let pageTitleDone = false
    function equipmentPageHeader() {
        doc.addPage()
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(...NAVY)
        doc.text(`Equipment Record — Serials & Warranty${pageTitleDone ? ' (continued)' : ''}`, LEFT, 46)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(`Customer: ${name}`, LEFT, 64)
        doc.text(formatAddress(property?.address), RIGHT, 64, { align: 'right' })
        pageTitleDone = true
        y = 96
    }

    function ensureSpace(height) {
        if (y + height > BOTTOM) equipmentPageHeader()
    }

    // One labeled cell: small gray label, value underneath, line under both.
    function cell(label, value, x) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(label, x + 2, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(...BLACK)
        doc.text(text(value), x + 2, y + 11)
    }

    function unitRow(cells) {
        cells.forEach(([label, value, x]) => cell(label, value, x))
        doc.setDrawColor(...GRAY_LINE)
        doc.setLineWidth(0.5)
        doc.line(LEFT, y + 15, RIGHT, y + 15)
        y += 26
    }

    const UNIT_HEIGHT = 16 + 26 * 3 + 16
    function unitBlock(label, e = {}) {
        ensureSpace(UNIT_HEIGHT)
        doc.setFillColor(...NAVY)
        doc.rect(LEFT, y, WIDTH, 15.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(255, 255, 255)
        doc.text(label, LEFT + 5, y + 11)
        y += 27
        unitRow([['EQUIPMENT TYPE', e.equipmentType, 36], ['MAKE', e.make, 216], ['MODEL', e.model, 396]])
        unitRow([['SERIAL NUMBER', e.serialNumber, 36], ['INSTALL DATE', formatDate(e.installDate), 216], ['INSTALLED BY', e.installedBy, 351], ['WARRANTY EXPIRES', formatDate(e.warrantyExpires), 486]])
        unitRow([['FILTER / CARTRIDGE PART NO.', e.filterPartNumber, 36], ['SIZE', e.filterSize, 216], ['REPLACE EVERY', e.replaceEvery, 351], ['LAST CHANGED', formatDate(e.lastChanged), 486]])
        y += 4
    }

    equipmentPageHeader()
    // Every unit on file, plus at least one blank block to write a new one in.
    const units = equipment.length ? [...equipment, {}] : [{}, {}, {}]
    units.forEach((e, i) => {
        const extra = [e.propertyLabel, text(e.notes)].filter(Boolean).join(' — ')
        unitBlock(`UNIT ${i + 1}${extra ? ` — ${extra.slice(0, 80)}` : ''}`, e)
    })

    y += 10
    ensureSpace(120)
    y += 13
    sectionBar('WATER TEST RESULTS')
    table({
        columns: [
            { label: 'DATE', x: 36 },
            { label: 'HARDNESS', x: 116 },
            { label: 'IRON', x: 191 },
            { label: 'PH', x: 266 },
            { label: 'TDS', x: 331 },
            { label: 'NOTES', x: 396 },
        ],
        data: [],
        rows: 3,
    })

    const consumables = equipment.filter((e) => e.filterPartNumber || e.replaceEvery)
    const consumableRows = Math.max(4, consumables.length + 2)
    ensureSpace(40 + consumableRows * 22)
    y += 13
    sectionBar('CONSUMABLES — CALL-BACK SCHEDULE')
    table({
        columns: [
            { label: 'ITEM / PART NO.', x: 36 },
            { label: 'UNIT IT BELONGS TO', x: 196 },
            { label: 'INTERVAL', x: 326 },
            { label: 'LAST DONE', x: 411 },
            { label: 'NEXT DUE', x: 496 },
        ],
        data: consumables.map((e) => [
            [e.filterPartNumber, e.filterSize].filter(Boolean).join(' — '),
            [e.equipmentType, e.make].filter(Boolean).join(' — '),
            e.replaceEvery,
            formatDate(e.lastChanged),
            '',
        ]),
        rows: consumableRows,
    })

    ensureSpace(120)
    y += 13
    sectionBar('NOTES')
    doc.setDrawColor(...GRAY_LINE)
    doc.setLineWidth(0.5)
    if (text(customer.notes)) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(...BLACK)
        const lines = doc.splitTextToSize(text(customer.notes), WIDTH - 8).slice(0, 4)
        lines.forEach((line, i) => doc.text(line, LEFT + 4, y + i * 22))
    }
    for (let i = 0; i < 4; i++) doc.line(LEFT, y + 6 + i * 22, RIGHT, y + 6 + i * 22)

    const safeName = (name.replace(/\s+/g, '-') || 'customer').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
    doc.save(`customer-profile-${safeName}.pdf`)
}
