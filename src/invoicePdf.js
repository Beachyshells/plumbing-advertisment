import jsPDF from 'jspdf'

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

export async function generateInvoicePdf(invoice) {
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
    doc.text('INVOICE', 576, 46, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GRAY_LABEL)
    doc.text(`#${invoice.invoiceNumber || ''}`, 576, 62, { align: 'right' })
    doc.text(invoice.serviceDate || '', 576, 74, { align: 'right' })

    let y = 100
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(1.5)
    doc.line(36, y, 576, y)
    y += 24

    // ---- Bill To / Service Address, in a soft shaded panel ----
    const billingAddr = invoice.customerBillingAddress?.street ? invoice.customerBillingAddress : invoice.propertyAddress
    const billingLines = doc.splitTextToSize(
        [billingAddr?.street, [billingAddr?.city, billingAddr?.state].filter(Boolean).join(', ')].filter(Boolean).join(', ') || '—',
        250
    )
    const addressLines = doc.splitTextToSize(
        [invoice.propertyAddress?.street, [invoice.propertyAddress?.city, invoice.propertyAddress?.state].filter(Boolean).join(', ')].filter(Boolean).join(', ') || '—',
        220
    )
    const panelLines = Math.max(billingLines.length, addressLines.length) + 1
    const panelHeight = 34 + panelLines * 13

    doc.setFillColor(...LIGHT_BG)
    doc.roundedRect(36, y - 10, 540, panelHeight, 4, 4, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('BILL TO', 50, y + 10)
    doc.text('SERVICE ADDRESS', 320, y + 10)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    doc.text(invoice.customerName || '—', 50, y + 25)
    doc.text(billingLines, 50, y + 38)
    doc.text(addressLines, 320, y + 25)

    y += panelHeight + 20

    // ---- Work performed ----
    if (invoice.workPerformed) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...GRAY_LABEL)
        doc.text('WORK PERFORMED', 36, y)
        y += 14
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        const workLines = doc.splitTextToSize(invoice.workPerformed, 540)
        doc.text(workLines, 36, y)
        y += workLines.length * 13 + 16
    }

    if (invoice.notes) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...GRAY_LABEL)
        doc.text('NOTES', 36, y)
        y += 14
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        const noteLines = doc.splitTextToSize(invoice.notes, 540)
        doc.text(noteLines, 36, y)
        y += noteLines.length * 13 + 16
    }

    // ---- Line items table ----
    doc.setFillColor(...NAVY)
    doc.rect(36, y - 12, 540, 22, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('DESCRIPTION', 46, y + 3)
    doc.text('QTY', 421, y + 3)
    doc.text('AMOUNT', 566, y + 3, { align: 'right' })
    y += 24

    const items = invoice.lineItems || []
    items.forEach((item, i) => {
        const label = item.itemType === 'misc' ? item.miscName : item.inventoryItemName
        const qty = item.itemType === 'misc' ? '' : String(item.quantity || 1)
        const amount = item.itemType === 'misc' ? item.miscSellPrice : (item.inventoryItemPrice || 0) * (item.quantity || 1)
        if (i % 2 === 1) {
            doc.setFillColor(...LIGHT_BG)
            doc.rect(36, y - 14, 540, 22, 'F')
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        doc.text(label || '—', 46, y)
        doc.text(qty, 421, y)
        doc.text(`$${Number(amount || 0).toFixed(2)}`, 566, y, { align: 'right' })
        y += 22
    })

    if (invoice.laborCost) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        doc.text('Labor', 46, y)
        doc.text(`$${Number(invoice.laborCost).toFixed(2)}`, 566, y, { align: 'right' })
        y += 22
    }

    doc.setDrawColor(...GRAY_LINE)
    doc.setLineWidth(1)
    doc.line(36, y - 6, 576, y - 6)
    y += 18

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text('TOTAL', 421, y)
    doc.text(`$${Number(invoice.totalAmount || 0).toFixed(2)}`, 566, y, { align: 'right' })
    y += 30

    const payments = invoice.payments || []
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const balance = Math.max((Number(invoice.totalAmount) || 0) - totalPaid, 0)

    if (payments.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...GRAY_LABEL)
        doc.text('PAYMENTS RECEIVED', 36, y)
        y += 16
        payments.forEach((p) => {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            doc.setTextColor(...BLACK)
            const desc = p.method === 'check' && p.checkNumber ? `Check #${p.checkNumber}` : p.method
            doc.text(`${p.date}  —  ${desc}`, 46, y)
            doc.text(`$${Number(p.amount).toFixed(2)}`, 566, y, { align: 'right' })
            y += 16
        })
        y += 10
    }

    doc.setFillColor(...(balance > 0 ? [253, 244, 230] : [231, 246, 237]))
    doc.roundedRect(376, y - 16, 200, 26, 4, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...(balance > 0 ? [200, 100, 0] : [20, 150, 60]))
    doc.text(balance > 0 ? `BALANCE DUE: $${balance.toFixed(2)}` : 'PAID IN FULL', 566, y, { align: 'right' })
    y += 50

    // ---- Footer ----
    doc.setDrawColor(...GRAY_LINE)
    doc.setLineWidth(0.75)
    doc.line(36, 740, 576, 740)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('Thank you for choosing Adirondack Advanced Water Solutions.', 306, 756, { align: 'center' })

    const safeName = (invoice.customerName || 'invoice').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    doc.save(`invoice-${invoice.invoiceNumber || 'draft'}-${safeName}.pdf`)
}