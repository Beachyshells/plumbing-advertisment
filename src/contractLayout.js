// Turns a layout-2 contract into the sections it shows, in order. The
// contract page, the customer's signing page, and the PDF all use this, so
// the three can never disagree about what the contract says.

export const CONTRACT_TITLES = {
    oneTime: 'Service Agreement',
    installation: 'Installation Contract',
    recurring: 'Maintenance Agreement',
    liabilityWaiver: 'Waiver and Access Agreement',
    addendum: 'Addendum',
}

export function formatMoney(amount) {
    return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// "2026-10-01" -> "October 1, 2026". Built from the parts directly, so the
// date never shifts a day because of time zones.
export function formatDate(value) {
    if (!value || typeof value !== 'string') return ''
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return value
    const [, y, m, d] = match
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[Number(m) - 1]} ${Number(d)}, ${y}`
}

export function formatDateTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/New_York' }) + ' (Eastern)'
}

export function formatAddressLines(address) {
    if (!address || typeof address !== 'object') return []
    const cityStateZip = [[address.city, address.state].filter(Boolean).join(', '), address.zip].filter(Boolean).join(' ')
    return [address.street, cityStateZip].filter(Boolean)
}

function itemLabel(item) {
    const qty = Number(item.quantity) || 1
    const makeModel = item.kind === 'equipment' ? [item.make, item.model].filter(Boolean).join(' ') : ''
    return {
        quantity: qty,
        name: item.name,
        detail: makeModel,
        changeType: item.changeType || null,
    }
}

// Returns null for original-layout contracts — callers keep showing those
// exactly the way they always have.
export function buildContractSections(contract) {
    if (!contract || Number(contract.layoutVersion) !== 2) return null

    const isAddendum = !!(contract.parentContractId || contract.linkedParentContractId || contract.templateType === 'addendum')
    const type = isAddendum ? 'addendum' : contract.templateType || 'oneTime'
    const isRecurring = type === 'recurring'
    const isWaiver = type === 'liabilityWaiver'
    const usesDepositSchedule = type === 'oneTime' || type === 'installation'

    const customerName = [contract.customerFirstName, contract.customerLastName].filter(Boolean).join(' ')
    const items = (contract.lineItems || []).map(itemLabel)
    const rawItems = contract.lineItems || []

    const sections = []

    // ---- Customer & Property ----
    sections.push({
        key: 'parties',
        title: 'Customer & Property',
        kind: 'lines',
        lines: [customerName || '—', ...formatAddressLines(contract.propertyAddress)],
    })

    // ---- Original contract (addenda) ----
    if (isAddendum) {
        const originalNumber = contract.parentContractId || contract.linkedParentContractId
        sections.push({
            key: 'original',
            title: 'Original Contract',
            kind: 'lines',
            lines: [
                `Contract ${originalNumber || '—'}`,
                contract.originalSignedAt ? `Signed ${formatDate(contract.originalSignedAt.slice(0, 10))}` : null,
            ].filter(Boolean),
        })
    }

    // ---- Description / Purpose ----
    if (contract.workDescription?.trim()) {
        sections.push({
            key: 'description',
            title: isWaiver ? 'Purpose' : 'Description of Work',
            kind: 'text',
            text: contract.workDescription.trim(),
        })
    }

    // ---- Scope / Changes / Equipment ----
    if (!isWaiver) {
        const extraScope = contract.scopeOfWork || []
        if (isAddendum) {
            if (items.length || extraScope.length) {
                sections.push({ key: 'changes', title: 'Changes', kind: 'items', items, extraScope, showChangeType: true })
            }
        } else {
            const scopeItems = rawItems.filter((i) => i.kind !== 'equipment').map(itemLabel)
            const equipmentItems = rawItems.filter((i) => i.kind === 'equipment').map(itemLabel)
            if (scopeItems.length || extraScope.length) {
                sections.push({ key: 'scope', title: 'Scope of Work', kind: 'items', items: scopeItems, extraScope })
            }
            if (equipmentItems.length) {
                sections.push({ key: 'equipment', title: 'Equipment', kind: 'items', items: equipmentItems, extraScope: [] })
            }
        }
    }

    // ---- Visit frequency (maintenance) ----
    if (isRecurring && contract.visitFrequency) {
        sections.push({ key: 'frequency', title: 'Visit Frequency', kind: 'lines', lines: [contract.visitFrequency] })
    }

    // ---- Price and Payment ----
    const price = Number(contract.totalPrice)
    const hasPrice = contract.totalPrice !== null && contract.totalPrice !== undefined && Number.isFinite(price)
    const priceRows = []
    if (isAddendum) {
        if (hasPrice) {
            // A plain hyphen, not a typographic minus — the PDF's built-in font
            // can't draw the minus character.
            priceRows.push({ label: 'Price change', value: `${price < 0 ? '-' : '+'}${formatMoney(Math.abs(price))}` })
            if (contract.originalContractTotal !== null && contract.originalContractTotal !== undefined) {
                const before = Number(contract.originalContractTotal) || 0
                priceRows.push({ label: 'Contract total before this addendum', value: formatMoney(before) })
                priceRows.push({ label: 'New contract total', value: formatMoney(before + price), emphasis: true })
            }
        }
    } else if (isRecurring) {
        if (hasPrice) {
            const basis = { perVisit: ' per visit', perYear: ' per year' }[contract.priceBasis] || ''
            priceRows.push({ label: 'Price', value: `${formatMoney(price)}${basis}`, emphasis: true })
        }
    } else if (isWaiver) {
        if (hasPrice && price > 0) priceRows.push({ label: 'Price', value: formatMoney(price), emphasis: true })
    } else if (hasPrice) {
        priceRows.push({ label: 'Total', value: formatMoney(price), emphasis: true })
        const deposit = Number(contract.depositAmount) || 0
        if (usesDepositSchedule && deposit > 0) {
            priceRows.push({ label: 'Deposit due at signing', value: formatMoney(deposit) })
            priceRows.push({ label: 'Balance due upon completion', value: formatMoney(price - deposit) })
        } else if (usesDepositSchedule) {
            priceRows.push({ label: 'Payment', value: 'Due upon completion' })
        }
    }
    if (priceRows.length || contract.priceNotes?.trim()) {
        sections.push({
            key: 'price',
            title: isAddendum ? 'Price Change' : 'Price and Payment',
            kind: 'price',
            rows: priceRows,
            notes: contract.priceNotes?.trim() || '',
        })
    }

    // ---- Schedule ----
    const startLabel = isAddendum ? 'Effective date' : isRecurring ? 'Agreement begins' : isWaiver ? 'Date of work' : 'Start date'
    const scheduleRows = []
    if (contract.startDate) scheduleRows.push({ label: startLabel, value: formatDate(contract.startDate) })
    if (contract.estimatedCompletionDate && usesDepositSchedule) {
        scheduleRows.push({ label: 'Estimated completion', value: formatDate(contract.estimatedCompletionDate) })
    }
    if (scheduleRows.length) sections.push({ key: 'schedule', title: 'Schedule', kind: 'price', rows: scheduleRows, notes: '' })

    // ---- Terms ----
    // The templates start with their own "TERMS AND CONDITIONS" line; drop
    // it so the heading doesn't appear twice under the section title.
    const terms = (contract.termsText || '').trim().replace(/^terms and conditions\s*\n+/i, '')
    if (terms) {
        sections.push({ key: 'terms', title: 'Terms and Conditions', kind: 'terms', text: terms })
    }

    return {
        type,
        title: CONTRACT_TITLES[type] || 'Contract',
        customerName,
        company: contract.companyInfo || null,
        sections,
        // The 3-day cancellation form goes with job contracts (per the terms).
        includeCancellationNotice: usesDepositSchedule,
    }
}
