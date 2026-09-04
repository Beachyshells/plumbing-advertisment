import jsPDF from 'jspdf'

export function generateInvoicePdf(invoice) {
    const NAVY = [19, 53, 94]
    const GRAY_LABEL = [130, 130, 130]
    const GRAY_LINE = [190, 190, 190]
    const BLACK = [20, 20, 20]

    const doc = new jsPDF({ unit: 'pt', format: 'letter' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.text('Adirondack Advanced Water Solutions', 36, 50)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    doc.text('Plumbing  •  Water Filtration  •  Pumps', 36, 66)

    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('(518) 534-9949', 36, 80)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...NAVY)
    doc.text('INVOICE', 576, 50, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GRAY_LABEL)
    doc.text(`#${invoice.invoiceNumber || ''}`, 576, 66, { align: 'right' })
    doc.text(invoice.serviceDate || '', 576, 80, { align: 'right' })

    let y = 118
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(1)
    doc.line(36, y, 576, y)
    y += 28

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('BILL TO', 36, y)
    doc.text('SERVICE ADDRESS', 320, y)
    y += 15

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    doc.text(invoice.customerName || '—', 36, y)
    const addressLines = doc.splitTextToSize(
        [invoice.propertyAddress?.street, [invoice.propertyAddress?.city, invoice.propertyAddress?.state].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(', ') || '—',
        220
    )
    doc.text(addressLines, 320, y)
    y += 20 + addressLines.length * 12

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

    doc.setFillColor(...NAVY)
    doc.rect(36, y - 12, 540, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('DESCRIPTION', 41, y + 2)
    doc.text('QTY', 421, y + 2)
    doc.text('AMOUNT', 576, y + 2, { align: 'right' })
    y += 22

    const items = invoice.lineItems || []
    items.forEach((item) => {
        const label = item.itemType === 'misc' ? item.miscName : item.inventoryItemName
        const qty = item.itemType === 'misc' ? '' : String(item.quantity || 1)
        const amount = item.itemType === 'misc' ? item.miscSellPrice : (item.inventoryItemPrice || 0) * (item.quantity || 1)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        doc.text(label || '—', 41, y)
        doc.text(qty, 421, y)
        doc.text(`$${Number(amount || 0).toFixed(2)}`, 576, y, { align: 'right' })
        doc.setDrawColor(...GRAY_LINE)
        doc.setLineWidth(0.5)
        doc.line(36, y + 8, 576, y + 8)
        y += 22
    })

    if (invoice.laborCost) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text('Labor', 41, y)
        doc.text(`$${Number(invoice.laborCost).toFixed(2)}`, 576, y, { align: 'right' })
        doc.line(36, y + 8, 576, y + 8)
        y += 22
    }

    y += 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text('TOTAL', 421, y)
    doc.text(`$${Number(invoice.totalAmount || 0).toFixed(2)}`, 576, y, { align: 'right' })
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
            doc.text(`${p.date}  —  ${desc}`, 41, y)
            doc.text(`$${Number(p.amount).toFixed(2)}`, 576, y, { align: 'right' })
            y += 16
        })
        y += 10
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...(balance > 0 ? [200, 100, 0] : [20, 150, 60]))
    doc.text(balance > 0 ? `BALANCE DUE: $${balance.toFixed(2)}` : 'PAID IN FULL', 576, y, { align: 'right' })

    const safeName = (invoice.customerName || 'invoice').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    doc.save(`invoice-${invoice.invoiceNumber || 'draft'}-${safeName}.pdf`)
}