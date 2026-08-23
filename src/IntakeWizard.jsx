import { useState, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'

// ---- Question definitions -------------------------------------------------
// type: 'text' | 'tel' | 'textarea' | 'choice'
// Keep this list in the exact order Michael should be asked.
const QUESTIONS = [
    { key: 'name', label: "What's the customer's name?", type: 'text', required: true },
    { key: 'bestPhone', label: 'Best phone number to reach them?', type: 'tel', required: true },
    { key: 'altPhone', label: 'Any other phone number? (skip if none)', type: 'tel' },
    { key: 'serviceAddress', label: "What's the service address — where the work is?", type: 'textarea', required: true },
    { key: 'wellOrMunicipal', label: 'Is their water well or municipal?', type: 'choice', options: ['Well', 'Municipal', 'Not sure'] },
    { key: 'billingAddress', label: 'Billing address, if different from service address? (skip if same)', type: 'textarea' },
    { key: 'email', label: 'Email address? (skip if none)', type: 'text' },
    { key: 'gateCodeKeyEntry', label: 'Any gate code, key location, or entry instructions? (skip if none)', type: 'text' },
    { key: 'dog', label: 'Is there a dog on site?', type: 'choice', options: ['Yes', 'No'] },
    { key: 'mainShutoffLocation', label: "Where's the main water shutoff located? (skip if unknown)", type: 'text' },
    { key: 'notes', label: 'Anything else? Parking, stairs, tenant, best time to call... (skip if none)', type: 'textarea' },
]

const TOTAL = QUESTIONS.length

export default function IntakeWizard() {
    const [step, setStep] = useState(0) // 0..TOTAL-1 = questions, TOTAL = review, TOTAL+1 = done
    const [answers, setAnswers] = useState({})
    const [draft, setDraft] = useState('')
    const [status, setStatus] = useState('idle') // idle | submitting | error
    const inputRef = useRef(null)

    useEffect(() => {
        if (step < TOTAL && inputRef.current) inputRef.current.focus()
    }, [step])

    const q = QUESTIONS[step]

    function goNext(value) {
        const v = value !== undefined ? value : draft
        setAnswers((prev) => ({ ...prev, [q.key]: v.trim ? v.trim() : v }))
        setDraft('')
        setStep((s) => s + 1)
    }

    function goBack() {
        if (step === 0) return
        const prevKey = QUESTIONS[Math.min(step, TOTAL) - 1]?.key
        setDraft(answers[prevKey] || '')
        setStep((s) => s - 1)
    }

    function editQuestion(index) {
        setDraft(answers[QUESTIONS[index].key] || '')
        setStep(index)
    }

    function handleSubmitStep(e) {
        e.preventDefault()
        if (q.required && !draft.trim()) return
        goNext()
    }

    async function handleConfirm() {
        setStatus('submitting')
        try {
            const res = await fetch('/api/submit-customer-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(answers),
            })
            if (!res.ok) throw new Error('Save failed')
            await generatePdf(answers)
            setStep(TOTAL + 1)
            setStatus('idle')
        } catch (err) {
            console.error(err)
            setStatus('error')
        }
    }

    function startOver() {
        setAnswers({})
        setDraft('')
        setStatus('idle')
        setStep(0)
    }

    const progressPct = Math.round((Math.min(step, TOTAL) / TOTAL) * 100)

    return (
        <div className="min-h-screen bg-navy flex flex-col items-center px-4 py-10">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <h1 className="font-serif text-2xl text-white">New Customer Intake</h1>
                    <p className="text-white/40 text-xs mt-1">Adirondack Advanced Water Solutions</p>
                </div>

                {/* Progress bar */}
                {step <= TOTAL && (
                    <div className="w-full h-1.5 rounded-full bg-white/10 mb-10 overflow-hidden">
                        <div
                            className="h-full bg-blue transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                )}

                {/* Question step */}
                {step < TOTAL && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
                            Question {step + 1} of {TOTAL}
                        </p>
                        <p className="text-white text-xl font-serif mb-6">{q.label}</p>

                        {q.type === 'choice' ? (
                            <div className="flex flex-col gap-3">
                                {q.options.map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => goNext(opt)}
                                        className="w-full bg-white/5 hover:bg-blue border border-white/10 hover:border-blue text-white text-lg py-4 rounded-xl transition-colors active:scale-[0.98]"
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <form onSubmit={handleSubmitStep} className="flex flex-col gap-4">
                                {q.type === 'textarea' ? (
                                    <textarea
                                        ref={inputRef}
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue h-28 resize-none"
                                        placeholder="Type here..."
                                    />
                                ) : (
                                    <input
                                        ref={inputRef}
                                        type={q.type === 'tel' ? 'tel' : 'text'}
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                        placeholder="Type here..."
                                    />
                                )}
                                <button
                                    type="submit"
                                    disabled={q.required && !draft.trim()}
                                    className="w-full bg-blue hover:bg-blue-light disabled:opacity-30 disabled:cursor-not-allowed text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                                >
                                    {draft.trim() ? 'Next' : q.required ? 'Next' : 'Skip'}
                                </button>
                            </form>
                        )}

                        {step > 0 && (
                            <button
                                onClick={goBack}
                                className="w-full text-white/40 hover:text-white/70 text-sm mt-4 py-2 transition-colors"
                            >
                                ← Back
                            </button>
                        )}
                    </div>
                )}

                {/* Review step */}
                {step === TOTAL && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-6">Review before saving</p>
                        <div className="flex flex-col gap-3 mb-6">
                            {QUESTIONS.map((qq, i) => (
                                <button
                                    key={qq.key}
                                    onClick={() => editQuestion(i)}
                                    className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                >
                                    <p className="text-white/40 text-[11px] uppercase tracking-widest">{qq.label}</p>
                                    <p className="text-white text-sm mt-0.5">
                                        {answers[qq.key]?.trim() ? answers[qq.key] : <span className="text-white/30 italic">— skipped, tap to add —</span>}
                                    </p>
                                </button>
                            ))}
                        </div>

                        {status === 'error' && (
                            <p className="text-red-400 text-sm mb-4 text-center">Something went wrong saving — check your connection and try again.</p>
                        )}

                        <button
                            onClick={handleConfirm}
                            disabled={status === 'submitting'}
                            className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            {status === 'submitting' ? 'Saving...' : 'Confirm & Save Customer'}
                        </button>
                    </div>
                )}

                {/* Done step */}
                {step === TOTAL + 1 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                        <p className="text-brand-green text-4xl mb-4">✓</p>
                        <p className="text-white text-xl font-serif mb-2">Customer saved</p>
                        <p className="text-white/50 text-sm mb-6">
                            {answers.name || 'This customer'}'s profile PDF has been downloaded, and the record is saved.
                        </p>
                        <button
                            onClick={startOver}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            + Add Another Customer
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ---- PDF generation ---------------------------------------------------------
// Matches the real customer-profile-template.pdf: same logo, same navy
// branding, same section names/order/columns, and the exact equipment +
// service history grids (those already fit typed text fine). The customer
// info rows are spaced for legible typed text rather than the template's
// literal handwriting-width rows, which are too tight for printed labels.
async function generatePdf(a) {
    const NAVY = [19, 53, 94]
    const GRAY_LABEL = [130, 130, 130]
    const GRAY_LINE = [190, 190, 190]
    const BLACK = [20, 20, 20]

    const doc = new jsPDF({ unit: 'pt', format: 'letter' })

    // ---- Logo (fetched from /logo-icon.png, same file used elsewhere on the site) ----
    const logoDataUrl = await loadImageAsDataUrl('/logo-icon.png')
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 36, 30, 60, 60)
    }

    // ---- Header ----
    const headerX = logoDataUrl ? 108 : 36
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.text('Adirondack Advanced Water Solutions', headerX, 50)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    doc.text('Plumbing  •  Water Filtration  •  Pumps', headerX, 66)

    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('(518) 534-9949', headerX, 80)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text('CUSTOMER PROFILE', 576, 50, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY_LABEL)
    doc.text(`Customer since  ${new Date().toLocaleDateString()}`, 576, 66, { align: 'right' })

    let y = 118
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(1)
    doc.line(36, y, 576, y)
    y += 24

    // ---- Section bar helper ----
    const sectionBar = (label) => {
        doc.setFillColor(...NAVY)
        doc.rect(36, y - 13, 540, 20, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.text(label, 41, y + 1)
        y += 28
    }

    // ---- Field: label above, value below, generous spacing ----
    const field = (label, value, x, colWidth) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(label.toUpperCase(), x, y)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        const text = value && value.trim() ? value : '—'
        const fitted = doc.splitTextToSize(text, colWidth)
        doc.text(fitted, x, y + 13)
        return fitted.length
    }

    const rowGap = 38

    // ===== CUSTOMER =====
    sectionBar('CUSTOMER')
    field('Name', a.name, 36, 220)
    field('Best Phone', a.bestPhone, 264, 150)
    field('Alt Phone', a.altPhone, 422, 154)
    y += rowGap

    field('Service Address', a.serviceAddress, 36, 350)
    field('Well / Municipal', a.wellOrMunicipal, 394, 182)
    y += rowGap

    field('Billing Address (if different)', a.billingAddress, 36, 350)
    field('Email', a.email, 394, 182)
    y += rowGap + 8

    // ===== SITE ACCESS & CAUTIONS =====
    sectionBar('SITE ACCESS & CAUTIONS')
    field('Gate Code / Key / Entry', a.gateCodeKeyEntry, 36, 220)
    field('Dog?', a.dog, 264, 100)
    field('Main Shutoff Location', a.mainShutoffLocation, 372, 204)
    y += rowGap

    field('Notes (parking, stairs, tenant, best time to call)', a.notes, 36, 540)
    y += rowGap + 8

    // ===== EQUIPMENT AT A GLANCE (matches template's exact grid — empty, filled at site visits) =====
    sectionBar('EQUIPMENT AT A GLANCE')
    const equipTop = y - 13
    doc.setFillColor(245, 245, 245)
    doc.rect(36, equipTop, 540, 15, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('TYPE', 41, y - 2)
    doc.text('MAKE / MODEL', 161, y - 2)
    doc.text('LOCATION IN HOME', 331, y - 2)
    doc.text('INSTALLED', 481, y - 2)

    doc.setDrawColor(...GRAY_LINE)
    doc.setLineWidth(0.5)
    const equipRowH = 22
    const equipBottom = equipTop + 15 + equipRowH * 4
    for (let i = 0; i <= 4; i++) {
        const ry = equipTop + 15 + equipRowH * i
        doc.line(36, ry, 576, ry)
    }
    ;[36, 156, 326, 476, 576].forEach((cx) => doc.line(cx, equipTop, cx, equipBottom))
    y = equipBottom + 24

    // ===== SERVICE HISTORY =====
    sectionBar('SERVICE HISTORY')
    const histTop = y - 13
    doc.setFillColor(245, 245, 245)
    doc.rect(36, histTop, 540, 15, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('DATE', 41, y - 2)
    doc.text('TECH', 116, y - 2)
    doc.text('WORK PERFORMED / PARTS USED', 201, y - 2)
    doc.text('INVOICE #', 496, y - 2)

    const histRowH = 22
    const histRows = 6
    const histBottom = histTop + 15 + histRowH * histRows
    for (let i = 0; i <= histRows; i++) {
        const ry = histTop + 15 + histRowH * i
        doc.line(36, ry, 576, ry)
    }
    ;[36, 111, 196, 491, 576].forEach((cx) => doc.line(cx, histTop, cx, histBottom))

    const safeName = (a.name || 'customer').replace(/[^a-z0-9]+/gi, '-').toLowerCase()

    // ===== PAGE 2: Equipment Record — Serials & Warranty (blank, pen-fill on site) =====
    doc.addPage()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...NAVY)
    doc.text('Equipment Record — Serials & Warranty', 36, 46)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GRAY_LABEL)
    doc.text(`Customer: ${a.name || ''}`, 36, 64)

    doc.setFontSize(9)
    doc.text(`File No. ____________`, 576, 55, { align: 'right' })

    const unitBar = (label, top) => {
        doc.setFillColor(...NAVY)
        doc.rect(36, top, 540, 15.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(255, 255, 255)
        doc.text(label, 41, top + 11)
    }

    const unitSubrow = (topY, labels) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(...GRAY_LABEL)
        labels.forEach(([text, x]) => doc.text(text, x, topY))
        doc.setDrawColor(...GRAY_LINE)
        doc.setLineWidth(0.5)
        doc.line(36, topY + 4.5, 576, topY + 4.5)
    }

    unitBar('UNIT 1', 102.7)
    unitSubrow(126.5, [['EQUIPMENT TYPE', 38.1], ['MAKE', 218.1], ['MODEL', 398.1]])
    unitSubrow(138.6, [['SERIAL NUMBER', 38.1], ['INSTALL DATE', 218.1], ['INSTALLED BY', 353.1], ['WARRANTY EXPIRES', 488.1]])
    unitSubrow(150.8, [['FILTER / CARTRIDGE PART NO.', 38.1], ['SIZE', 218.1], ['REPLACE EVERY', 353.1], ['LAST CHANGED', 488.1]])

    unitBar('UNIT 2', 175.5)
    unitSubrow(199.2, [['EQUIPMENT TYPE', 38.1], ['MAKE', 218.1], ['MODEL', 398.1]])
    unitSubrow(211.4, [['SERIAL NUMBER', 38.1], ['INSTALL DATE', 218.1], ['INSTALLED BY', 353.1], ['WARRANTY EXPIRES', 488.1]])
    unitSubrow(223.5, [['FILTER / CARTRIDGE PART NO.', 38.1], ['SIZE', 218.1], ['REPLACE EVERY', 353.1], ['LAST CHANGED', 488.1]])

    unitBar('UNIT 3', 248.2)
    unitSubrow(272.0, [['EQUIPMENT TYPE', 38.1], ['MAKE', 218.1], ['MODEL', 398.1]])
    unitSubrow(284.1, [['SERIAL NUMBER', 38.1], ['INSTALL DATE', 218.1], ['INSTALLED BY', 353.1], ['WARRANTY EXPIRES', 488.1]])
    unitSubrow(296.3, [['FILTER / CARTRIDGE PART NO.', 38.1], ['SIZE', 218.1], ['REPLACE EVERY', 353.1], ['LAST CHANGED', 488.1]])

    // Water Test Results
    doc.setFillColor(...NAVY)
    doc.rect(36, 321.0, 540, 15.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(255, 255, 255)
    doc.text('WATER TEST RESULTS', 41, 332)

    doc.setFillColor(245, 245, 245)
    doc.rect(36, 336.6, 540, 14.6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('DATE', 41, 346.3)
    doc.text('HARDNESS', 121, 346.3)
    doc.text('IRON', 196.1, 346.3)
    doc.text('PH', 271.1, 346.3)
    doc.text('TDS', 336.1, 346.3)
    doc.text('NOTES', 401.1, 346.3)

    doc.setDrawColor(...GRAY_LINE)
    doc.setLineWidth(0.5)
        ;[351.8, 373.8, 395.8, 417.8].forEach((yy) => doc.line(36, yy, 576, yy))
        ;[36, 116, 191, 266, 331, 396, 576].forEach((xx) => doc.line(xx, 336.6, xx, 417.8))

    // Consumables — Call-back Schedule
    doc.setFillColor(...NAVY)
    doc.rect(36, 438.5, 540, 15.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(255, 255, 255)
    doc.text('CONSUMABLES — CALL-BACK SCHEDULE', 41, 449.5)

    doc.setFillColor(245, 245, 245)
    doc.rect(36, 454.1, 540, 14.8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY_LABEL)
    doc.text('ITEM / PART NO.', 41, 464)
    doc.text('UNIT IT BELONGS TO', 201, 464)
    doc.text('INTERVAL', 331, 464)
    doc.text('LAST DONE', 416, 464)
    doc.text('NEXT DUE', 501, 464)

    const consumableRows = [469.4, 491.4, 513.4, 535.4, 557.4, 579.4, 601.4]
    consumableRows.forEach((yy) => doc.line(36, yy, 576, yy))
        ;[36, 196, 326, 411, 496, 576].forEach((xx) => doc.line(xx, 454.1, xx, 601.9))

    // Notes
    doc.setFillColor(...NAVY)
    doc.rect(36, 622.1, 540, 15.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(255, 255, 255)
    doc.text('NOTES', 41, 633)

    doc.setFillColor(245, 245, 245)
    doc.rect(36, 637.7, 540, 14.7, 'F')
    const notesRows = [652.9, 675.6, 698.3, 721.0]
    notesRows.forEach((yy) => doc.line(36, yy, 576, yy))

    doc.save(`customer-profile-${safeName}.pdf`)
}

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