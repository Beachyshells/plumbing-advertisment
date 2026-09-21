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

export async function generateContractPdf(contract) {
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

    if (contract.status === 'signed') {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...GRAY_LABEL)
        doc.text('SIGNED', 36, y)
        y += 16

        if (contract.signatureImageUrl) {
            const sigDataUrl = await loadImageAsDataUrl(contract.signatureImageUrl)
            if (sigDataUrl) {
                doc.addImage(sigDataUrl, 'PNG', 36, y, 160, 60)
            }
        }
        y += 70

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        doc.text(contract.signerName || '', 36, y)
        y += 14
        doc.setFontSize(9)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(`Signed ${contract.signedAt ? contract.signedAt.slice(0, 10) : ''}`, 36, y)
    } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        doc.text('Customer Signature: _____________________________', 36, y)
        doc.text('Date: _______________', 400, y)
        y += 40
        doc.text('Print Name: _____________________________', 36, y)
    }

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