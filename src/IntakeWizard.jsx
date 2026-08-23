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
            generatePdf(answers)
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
function generatePdf(a) {
    const NAVY = [10, 22, 40]
    const BLUE = [23, 108, 200]
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const pageW = 612
    const margin = 42
    let y = 50

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...NAVY)
    doc.text('Adirondack Advanced Water Solutions', margin, y)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(...BLUE)
    y += 18
    doc.text('Plumbing  •  Water Filtration  •  Pumps', margin, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    y += 14
    doc.text('(518) 534-9949', margin, y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text('CUSTOMER PROFILE', pageW - margin, 50, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Customer since: ${new Date().toLocaleDateString()}`, pageW - margin, 66, { align: 'right' })

    y += 24
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(1.2)
    doc.line(margin, y, pageW - margin, y)
    y += 30

    const sectionBar = (title) => {
        doc.setFillColor(...NAVY)
        doc.rect(margin, y - 14, pageW - margin * 2, 20, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.text(title, margin + 8, y)
        y += 26
    }

    const field = (label, value, widthFraction = 1, xOffset = 0) => {
        const usableWidth = pageW - margin * 2
        const x = margin + xOffset * usableWidth
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(130, 130, 130)
        doc.text(label.toUpperCase(), x, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10.5)
        doc.setTextColor(20, 20, 20)
        const text = value && value.trim() ? value : '—'
        const lines = doc.splitTextToSize(text, usableWidth * widthFraction - 10)
        doc.text(lines, x, y + 13)
        return lines.length
    }

    const rowGap = 40

    sectionBar('CUSTOMER')
    field('Name', a.name, 0.4)
    field('Best Phone', a.bestPhone, 0.3, 0.4)
    field('Alt Phone', a.altPhone, 0.3, 0.7)
    y += rowGap
    field('Service Address', a.serviceAddress, 0.6)
    field('Well / Municipal', a.wellOrMunicipal, 0.4, 0.6)
    y += rowGap
    field('Billing Address (if different)', a.billingAddress, 0.6)
    field('Email', a.email, 0.4, 0.6)
    y += rowGap + 10

    sectionBar('SITE ACCESS & CAUTIONS')
    field('Gate Code / Key / Entry', a.gateCodeKeyEntry, 0.34)
    field('Dog?', a.dog, 0.16, 0.34)
    field('Main Shutoff Location', a.mainShutoffLocation, 0.5, 0.5)
    y += rowGap
    field('Notes (parking, stairs, tenant, best time to call)', a.notes, 1)
    y += rowGap + 10

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(150, 150, 150)
    doc.text(
        'Equipment details, service history, and water test results are added during site visits.',
        margin,
        y
    )

    const safeName = (a.name || 'customer').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    doc.save(`customer-profile-${safeName}.pdf`)
}