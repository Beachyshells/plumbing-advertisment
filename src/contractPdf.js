import jsPDF from 'jspdf'
import { buildContractSections, formatDate, formatDateTime } from './contractLayout.js'

function loadImageAsDataUrl(url) {
    return new Promise((resolve) => {
        fetch(url)
            .then((res) => res.blob())
            .then((blob) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result)
                reader.onerror = () => resolve(null)
                reader.readAsDataURL(blob)
            })
            .catch(() => resolve(null))
    })
}

// Places a signature image on the PDF. Tries the exact method that has
// always worked first (the original file, loaded the same way as the logo),
// and only if that fails, a flattened white-background JPEG from Sanity.
// Returns true if a signature was placed.
async function placeSignature(doc, url, x, y, width, height) {
    if (!url) return false
    const attempts = [url]
    if (url.includes('cdn.sanity.io/images/')) attempts.push(`${url}?fm=jpg&bg=ffffff`)
    for (const attempt of attempts) {
        const dataUrl = await loadImageAsDataUrl(attempt)
        if (!dataUrl || !dataUrl.startsWith('data:image/')) {
            console.error('Signature image did not load:', attempt)
            continue
        }
        const format = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
        try {
            doc.addImage(dataUrl, format, x, y, width, height)
            return true
        } catch (err) {
            console.error('Could not place signature image:', attempt, err)
        }
    }
    return false
}

// Picks the right layout: contracts created with the sectioned layout get
// the new PDF, and every older contract prints exactly as it always has.
export async function generateContractPdf(contract) {
    if (Number(contract?.layoutVersion) === 2) return generateLayout2Pdf(contract)
    return generateOriginalContractPdf(contract)
}

// ---- Original layout (unchanged) ----
async function generateOriginalContractPdf(contract) {
    const NAVY = [19, 53, 94]
    const GRAY_LABEL = [130, 130, 130]
    const GRAY_LINE = [225, 225, 225]
    const BLACK = [30, 30, 30]
    const LIGHT_BG = [246, 248, 251]

    const doc = new jsPDF({ unit: 'pt', format: 'letter' })

    const logoDataUrl = await loadImageAsDataUrl('/logo-icon.png')
    const headerX = logoDataUrl ? 92 : 36
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 36, 32, 46, 46)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.setTextColor(...NAVY)
    doc.text('Adirondack Advanced Water Solutions', headerX, 48)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('Plumbing  •  Water Filtration  •  Pumps', headerX, 62)
    doc.text('(518) 534-9949  •  contact@adkadvancedwatersolutions.com', headerX, 74)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...NAVY)
    doc.text('CONTRACT', 576, 46, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GRAY_LABEL)
    doc.text(`#${contract.contractId || ''}`, 576, 62, { align: 'right' })
    if (contract.parentContractId) {
        doc.text(`Addendum to ${contract.parentContractId}`, 576, 74, { align: 'right' })
    }

    let y = 100
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(1.5)
    doc.line(36, y, 576, y)
    y += 24

    // ---- Customer / property panel ----
    const customerName = [contract.customerFirstName, contract.customerLastName].filter(Boolean).join(' ')
    const addressLines = doc.splitTextToSize(
        [contract.propertyAddress?.street, [contract.propertyAddress?.city, contract.propertyAddress?.state].filter(Boolean).join(', ')].filter(Boolean).join(', ') || '—',
        500
    )
    const panelHeight = 40 + addressLines.length * 13

    doc.setFillColor(...LIGHT_BG)
    doc.roundedRect(36, y - 10, 540, panelHeight, 4, 4, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('CUSTOMER', 50, y + 10)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    doc.text(customerName || '—', 50, y + 25)
    doc.text(addressLines, 50, y + 40)

    y += panelHeight + 24

    // ---- Contract body text ----
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...BLACK)
    const bodyLines = doc.splitTextToSize(contract.termsText || '', 540)

    for (const line of bodyLines) {
        if (y > 730) {
            doc.addPage()
            y = 50
        }
        doc.text(line, 36, y)
        y += 13
    }

    y += 20

    // ---- Signature block ----
    if (y > 650) {
        doc.addPage()
        y = 60
    }

    doc.setDrawColor(...GRAY_LINE)
    doc.setLineWidth(1)
    doc.line(36, y, 576, y)
    y += 24

    // Draws one party's signature block — either their actual captured
    // e-signature, or blank lines for a wet-ink signature if they haven't
    // signed yet. Each party is checked independently, since a contract
    // can be signed by one side and not the other at the same time.
    async function drawSignatureSection(label, signerName, signedAt, signatureImageUrl) {
        if (y > 700) {
            doc.addPage()
            y = 60
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(label, 36, y)
        y += 16

        if (signedAt) {
            // Same sturdier loading as the new layout — the page layout of
            // older contracts is unchanged, only how the image is fetched.
            const drawn = await placeSignature(doc, signatureImageUrl, 36, y, 160, 60)
            if (!drawn) {
                doc.setFont('helvetica', 'italic')
                doc.setFontSize(9)
                doc.setTextColor(...GRAY_LABEL)
                doc.text('Electronic signature on file.', 36, y + 34)
            }
            y += 70

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            doc.setTextColor(...BLACK)
            doc.text(signerName || '', 36, y)
            y += 14
            doc.setFontSize(9)
            doc.setTextColor(...GRAY_LABEL)
            doc.text(`Signed ${signedAt.slice(0, 10)}`, 36, y)
            y += 30
        } else {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            doc.setTextColor(...BLACK)
            doc.text('Signature: _____________________________', 36, y)
            doc.text('Date: _______________', 400, y)
            y += 26
            doc.text('Print Name: _____________________________', 36, y)
            y += 30
        }
    }

    await drawSignatureSection('CUSTOMER', contract.signerName, contract.signedAt, contract.signatureImageUrl)
    await drawSignatureSection('COMPANY REPRESENTATIVE', contract.companySignerName, contract.companySignedAt, contract.companySignatureImageUrl)

    // ---- Footer ----
    doc.setDrawColor(...GRAY_LINE)
    doc.setLineWidth(0.75)
    doc.line(36, 740, 576, 740)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('Adirondack Advanced Water Solutions', 306, 756, { align: 'center' })

    const safeName = (customerName || 'contract').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    doc.save(`contract-${contract.contractId || 'draft'}-${safeName}.pdf`)
}

// ---- Layout 2: sectioned contract ----
async function generateLayout2Pdf(contract) {
    const NAVY = [19, 53, 94]
    const GRAY_LABEL = [120, 120, 120]
    const GRAY_LINE = [215, 215, 215]
    const BLACK = [30, 30, 30]
    const LIGHT_BG = [246, 248, 251]
    const GREEN = [22, 128, 61]
    const RED = [185, 28, 28]

    const LEFT = 36
    const RIGHT = 576
    const WIDTH = RIGHT - LEFT
    const BOTTOM = 725

    const built = buildContractSections(contract)
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const company = built.company || {
        name: 'Adirondack Advanced Water Solutions',
        street: '18 Nichols Rd',
        cityStateZip: 'West Chazy, NY 12992',
        phone: '(518) 534-9949',
        email: 'contact@adkadvancedwatersolutions.com',
    }
    const logoDataUrl = await loadImageAsDataUrl('/logo-icon.png')

    let y = 0
    let pageNumber = 1

    function footer() {
        doc.setDrawColor(...GRAY_LINE)
        doc.setLineWidth(0.75)
        doc.line(LEFT, 745, RIGHT, 745)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(`${company.name}  •  ${built.title} ${contract.contractId || ''}`, LEFT, 758)
        doc.text(`Page ${pageNumber}`, RIGHT, 758, { align: 'right' })
    }

    function newPage() {
        footer()
        doc.addPage()
        pageNumber += 1
        y = 50
    }

    // Starts a new page if the next `height` points wouldn't fit.
    function ensureSpace(height) {
        if (y + height > BOTTOM) newPage()
    }

    function sectionTitle(text) {
        ensureSpace(40)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...NAVY)
        doc.text(text.toUpperCase(), LEFT, y)
        doc.setDrawColor(...NAVY)
        doc.setLineWidth(0.75)
        doc.line(LEFT, y + 4, RIGHT, y + 4)
        y += 18
    }

    function paragraph(text, { size = 10, color = BLACK, style = 'normal', indent = 0, lineHeight = 13 } = {}) {
        doc.setFont('helvetica', style)
        doc.setFontSize(size)
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, WIDTH - indent)
        for (const line of lines) {
            ensureSpace(lineHeight)
            doc.text(line, LEFT + indent, y)
            y += lineHeight
        }
    }

    // ---- Header ----
    const headerX = logoDataUrl ? 92 : LEFT
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', LEFT, 32, 46, 46)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.text(company.name, headerX, 46)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    doc.text([company.street, company.cityStateZip].filter(Boolean).join(', '), headerX, 60)
    doc.text([company.phone, company.email].filter(Boolean).join('  •  '), headerX, 72)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...NAVY)
    doc.text(built.title.toUpperCase(), RIGHT, 46, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...GRAY_LABEL)
    doc.text(`No. ${contract.contractId || ''}`, RIGHT, 60, { align: 'right' })
    doc.text(`Date: ${formatDate((contract.createdAt || '').slice(0, 10))}`, RIGHT, 72, { align: 'right' })

    doc.setDrawColor(...NAVY)
    doc.setLineWidth(1.5)
    doc.line(LEFT, 92, RIGHT, 92)
    y = 118

    // ---- Sections ----
    for (const section of built.sections) {
        if (section.kind === 'terms') continue // printed after the job sections, below
        sectionTitle(section.title)

        if (section.kind === 'lines') {
            for (const line of section.lines) paragraph(line)
        }

        if (section.kind === 'text') paragraph(section.text)

        if (section.kind === 'items') {
            doc.setFontSize(10)
            for (const item of section.items) {
                const nameText = item.detail ? `${item.name} — ${item.detail}` : item.name
                const indent = section.showChangeType ? 80 : 34
                const lines = doc.splitTextToSize(nameText, WIDTH - indent)
                ensureSpace(lines.length * 13)
                if (section.showChangeType) {
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(8.5)
                    doc.setTextColor(...(item.changeType === 'remove' ? RED : GREEN))
                    doc.text(item.changeType === 'remove' ? 'REMOVE' : 'ADD', LEFT, y)
                }
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(10)
                doc.setTextColor(...GRAY_LABEL)
                doc.text(`${item.quantity} x`, LEFT + indent - 30, y)
                doc.setTextColor(...BLACK)
                doc.text(lines, LEFT + indent, y)
                y += lines.length * 13
            }
            for (const line of section.extraScope) {
                const indent = section.showChangeType ? 80 : 34
                const lines = doc.splitTextToSize(line, WIDTH - indent)
                ensureSpace(lines.length * 13)
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(10)
                doc.setTextColor(...GRAY_LABEL)
                doc.text('•', LEFT + indent - 22, y)
                doc.setTextColor(...BLACK)
                doc.text(lines, LEFT + indent, y)
                y += lines.length * 13
            }
        }

        if (section.kind === 'price') {
            for (const row of section.rows) {
                ensureSpace(18)
                if (row.emphasis) {
                    doc.setFillColor(...LIGHT_BG)
                    doc.rect(LEFT, y - 11, WIDTH, 17, 'F')
                }
                doc.setFont('helvetica', row.emphasis ? 'bold' : 'normal')
                doc.setFontSize(row.emphasis ? 11 : 10)
                doc.setTextColor(...BLACK)
                doc.text(row.label, LEFT + 6, y)
                doc.text(row.value, RIGHT - 6, y, { align: 'right' })
                y += row.emphasis ? 19 : 15
            }
            if (section.notes) {
                y += 2
                paragraph(section.notes, { size: 9, color: GRAY_LABEL, style: 'italic', lineHeight: 12 })
            }
        }

        y += 12
    }

    // ---- Terms and Conditions ----
    const terms = built.sections.find((s) => s.key === 'terms')
    if (terms) {
        sectionTitle('Terms and Conditions')
        for (const block of terms.text.split(/\n/)) {
            const trimmed = block.trim()
            if (!trimmed) {
                y += 6
                continue
            }
            // Numbered headings like "3. CHANGES TO THE WORK" print bold.
            const isHeading = /^\d+\.\s+[A-Z][A-Z ,;&'/()-]+$/.test(trimmed)
            if (isHeading) ensureSpace(30)
            paragraph(trimmed, { size: 9.5, style: isHeading ? 'bold' : 'normal', lineHeight: 12.5 })
        }
        y += 14
    }

    // ---- Signatures ----
    async function drawSignature(label, signerName, signedAt, signatureImageUrl) {
        ensureSpace(130)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(label, LEFT, y)
        y += 14
        if (signedAt) {
            const drawn = await placeSignature(doc, signatureImageUrl, LEFT, y, 160, 60)
            if (!drawn) {
                doc.setFont('helvetica', 'italic')
                doc.setFontSize(9)
                doc.setTextColor(...GRAY_LABEL)
                doc.text('Electronic signature on file — see Electronic Signature Record.', LEFT, y + 34)
            }
            y += 68
            doc.setDrawColor(...GRAY_LINE)
            doc.line(LEFT, y - 4, LEFT + 240, y - 4)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            doc.setTextColor(...BLACK)
            doc.text(signerName || '', LEFT, y + 8)
            doc.setFontSize(9)
            doc.setTextColor(...GRAY_LABEL)
            doc.text(`Signed electronically ${formatDateTime(signedAt)}`, LEFT, y + 21)
            y += 44
        } else {
            y += 30
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            doc.setTextColor(...BLACK)
            doc.text('Signature: _________________________________', LEFT, y)
            doc.text('Date: _______________', 400, y)
            y += 24
            doc.text('Print Name: ________________________________', LEFT, y)
            y += 30
        }
    }

    // Keep the heading with the customer's signature block.
    ensureSpace(170)
    sectionTitle('Signatures')
    await drawSignature('CUSTOMER', contract.signerName, contract.signedAt, contract.signatureImageUrl)
    await drawSignature(`COMPANY REPRESENTATIVE — ${company.name}`, contract.companySignerName, contract.companySignedAt, contract.companySignatureImageUrl)

    // ---- Notice of Cancellation (job contracts) ----
    if (built.includeCancellationNotice) {
        newPage()
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(...NAVY)
        doc.text('NOTICE OF CANCELLATION', 306, y, { align: 'center' })
        y += 26
        paragraph(`${built.title} No. ${contract.contractId || ''}`, { size: 10, color: GRAY_LABEL })
        paragraph(`Date of transaction: ${contract.signedAt ? formatDate(contract.signedAt.slice(0, 10)) : '____________________'}`, { size: 10 })
        y += 10
        const noticeParagraphs = [
            'You may CANCEL this transaction, without any penalty or obligation, within THREE BUSINESS DAYS from the above date.',
            'If you cancel, any payments made by you under this contract will be returned within TEN BUSINESS DAYS following receipt by the Company of your cancellation notice.',
            'If you cancel, you must make available to the Company at your residence, in substantially as good condition as when received, any goods delivered to you under this contract; or you may, if you wish, comply with the Company\'s instructions regarding the return of the goods at the Company\'s expense and risk.',
            `To cancel this transaction, mail or deliver a signed and dated copy of this cancellation notice, or any other written notice, to ${company.name}, ${[company.street, company.cityStateZip].filter(Boolean).join(', ')}, or email it to ${company.email}, NOT LATER THAN MIDNIGHT of the third business day after the date of transaction above.`,
        ]
        for (const p of noticeParagraphs) {
            paragraph(p, { size: 10.5, lineHeight: 14 })
            y += 10
        }
        y += 16
        paragraph('I HEREBY CANCEL THIS TRANSACTION.', { size: 11, style: 'bold' })
        y += 30
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        doc.text('Date: _______________________', LEFT, y)
        doc.text('Customer\'s Signature: ______________________________', 250, y)
    }

    // ---- E-Signature Record ----
    if (contract.signedAt || contract.companySignedAt) {
        newPage()
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(...NAVY)
        doc.text('ELECTRONIC SIGNATURE RECORD', LEFT, y)
        y += 20
        paragraph(`${built.title} No. ${contract.contractId || ''} — ${built.customerName || ''}`, { size: 10, color: GRAY_LABEL })
        y += 8

        const signer = (label, name, consentAt, signedAt, ip) => {
            if (!signedAt) return
            sectionTitle(label)
            paragraph(`Typed name: ${name || '—'}`)
            paragraph(`Consented to sign electronically: ${formatDateTime(consentAt) || '—'}`)
            paragraph(`Signed: ${formatDateTime(signedAt)}`)
            paragraph(`IP address: ${ip || '—'}`)
            y += 10
        }
        signer('Customer', contract.signerName, contract.consentTimestamp, contract.signedAt, contract.signerIp)
        signer('Company Representative', contract.companySignerName, contract.companyConsentTimestamp, contract.companySignedAt, contract.companySignerIp)

        const eventLabels = {
            created: 'Created',
            sent: 'Sent to customer',
            viewed: 'Opened by customer',
            signed_customer: 'Signed by customer',
            signed_company: 'Signed by company representative',
            voided: 'Voided',
            copy_emailed: 'Signed copy emailed to customer',
            linked_to_original: 'Linked to original contract',
            unlinked_from_original: 'Unlinked from original contract',
        }
        const events = contract.auditTrail || []
        if (events.length) {
            sectionTitle('Audit Trail')
            for (const e of events) {
                paragraph(`${formatDateTime(e.timestamp)} — ${eventLabels[e.event] || e.event}${e.ipAddress ? ` (IP ${e.ipAddress})` : ''}`, { size: 9, lineHeight: 12 })
            }
        }
    }

    footer()
    const safeName = (built.customerName || 'contract').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    doc.save(`contract-${contract.contractId || 'draft'}-${safeName}.pdf`)
}
