import { useState, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'

const EMPTY_PROPERTY_ADDRESS = { street: '', city: '', state: '', zip: '' }
const EMPTY_PROPERTY_DETAILS = {
    street: '', city: '', state: '', zip: '',
    wellOrMunicipal: '', gateCodeKeyEntry: '', mainShutoffLocation: '',
}

function isValidPhone(value) {
    const digits = value.replace(/\D/g, '')
    return digits.length === 10 || digits.length === 11
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// Turns a { street, city, state, zip } object into one display line. Used
// in the review screen, the property search results, and the generated PDF.
function formatAddress(address) {
    if (!address || (!address.street && !address.city && !address.state && !address.zip)) return ''
    const cityStateZip = [address.city, address.state].filter(Boolean).join(', ')
    return [address.street, [cityStateZip, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

export default function IntakeWizard() {
    // stage walks: name -> bestPhone -> altPhone -> property-search ->
    // (property-new, only if creating) -> billingAddress -> email -> notes
    // -> review -> done
    const [stage, setStage] = useState('firstName')
    const [draft, setDraft] = useState('')
    const [fieldError, setFieldError] = useState('')

    const [customer, setCustomer] = useState({ firstName: '', lastName: '', bestPhone: '', altPhone: '', billingAddress: undefined, dog: '', email: '', notes: '' })
    const [billingAddressDraft, setBillingAddressDraft] = useState(EMPTY_PROPERTY_ADDRESS)

    const [properties, setProperties] = useState([])
    const [propertySearchTerm, setPropertySearchTerm] = useState('')
    const [selectedPropertyId, setSelectedPropertyId] = useState(null)
    const [propertyDisplay, setPropertyDisplay] = useState(null) // { address, wellOrMunicipal, ... } for review/PDF
    const [newPropertyDraft, setNewPropertyDraft] = useState(EMPTY_PROPERTY_DETAILS)

    const [existingCustomerId, setExistingCustomerId] = useState(null)
    const [savedCustomerId, setSavedCustomerId] = useState(null)
    const [loadingExisting, setLoadingExisting] = useState(false)
    const [status, setStatus] = useState('idle') // idle | submitting | error
    const inputRef = useRef(null)

    useEffect(() => {
        if (stage !== 'property-search') return
        fetch('/api/properties')
            .then((res) => (res.ok ? res.json() : { properties: [] }))
            .then(({ properties: list }) => setProperties(list || []))
            .catch(() => { })
    }, [stage])

    // If opened as .../intake?edit=<id>, load that customer + their linked
    // property and jump straight to review.
    useEffect(() => {
        const editId = new URLSearchParams(window.location.search).get('edit')
        if (!editId) return

        setLoadingExisting(true)
        fetch(`/api/customers?id=${encodeURIComponent(editId)}`)
            .then((res) => {
                if (!res.ok) throw new Error('Load failed')
                return res.json()
            })
            .then(({ customer: loaded }) => {
                setCustomer({
                    firstName: loaded.firstName || '',
                    lastName: loaded.lastName || '',
                    bestPhone: loaded.bestPhone || '',
                    altPhone: loaded.altPhone || '',
                    billingAddress: loaded.billingAddress,
                    dog: loaded.dog || '',
                    email: loaded.email || '',
                    notes: loaded.notes || '',
                })
                if (loaded.property) {
                    setSelectedPropertyId(loaded.property._id)
                    setPropertyDisplay(loaded.property)
                }
                setExistingCustomerId(loaded._id)
                setStage('review')
            })
            .catch((err) => {
                console.error(err)
                setStatus('error')
            })
            .finally(() => setLoadingExisting(false))
    }, [])

    useEffect(() => {
        setFieldError('')
        if (['firstName', 'lastName', 'bestPhone', 'altPhone', 'email'].includes(stage)) {
            setDraft(customer[stage] || '')
            if (inputRef.current) inputRef.current.focus()
        }
        if (stage === 'notes') {
            setDraft(customer.notes || '')
        }
        if (stage === 'billingAddress') {
            setBillingAddressDraft(customer.billingAddress || EMPTY_PROPERTY_ADDRESS)
        }
    }, [stage])

    function validatePhone(value, required) {
        if (required && !value.trim()) return 'This one is needed to start the profile.'
        if (!value.trim()) return ''
        if (!isValidPhone(value)) return "That doesn't look like a full phone number."
        return ''
    }

    // ---- name / bestPhone / altPhone / email / notes (simple one-field screens) ----
    function submitSimpleField(e) {
        e.preventDefault()
        const value = draft.trim()

        if ((stage === 'firstName' || stage === 'lastName') && !value) {
            setFieldError('This one is needed to start the profile.')
            return
        }
        if (stage === 'bestPhone') {
            const error = validatePhone(value, true)
            if (error) return setFieldError(error)
        }
        if (stage === 'altPhone') {
            const error = validatePhone(value, false)
            if (error) return setFieldError(error)
        }
        if (stage === 'email' && value && !isValidEmail(value)) {
            setFieldError("That doesn't look like a valid email.")
            return
        }

        setCustomer((prev) => ({ ...prev, [stage]: value }))

        if (stage === 'firstName') setStage('lastName')
        else if (stage === 'lastName') setStage('bestPhone')
        else if (stage === 'bestPhone') setStage('altPhone')
        else if (stage === 'altPhone') setStage('property-search')
        else if (stage === 'email') setStage('notes')
        else if (stage === 'notes') setStage('review')
    }

    // ---- billing address ----
    function submitBillingAddress(e) {
        e.preventDefault()
        const trimmed = {
            street: billingAddressDraft.street.trim(),
            city: billingAddressDraft.city.trim(),
            state: billingAddressDraft.state.trim(),
            zip: billingAddressDraft.zip.trim(),
        }
        const hasAny = trimmed.street || trimmed.city || trimmed.state || trimmed.zip
        if (hasAny && (!trimmed.street || !trimmed.city || !trimmed.state)) {
            setFieldError('Add a street, city, and state, or leave all fields blank to skip.')
            return
        }
        setCustomer((prev) => ({ ...prev, billingAddress: hasAny ? trimmed : undefined }))
        setStage('email')
    }

    // ---- property search ----
    const propertyMatches = properties.filter((p) => {
        const term = propertySearchTerm.trim().toLowerCase()
        if (!term) return false
        return formatAddress(p.address).toLowerCase().includes(term)
    })

    function linkExistingProperty(property) {
        setSelectedPropertyId(property._id)
        setPropertyDisplay(property)
        setNewPropertyDraft(EMPTY_PROPERTY_DETAILS)
        setStage('billingAddress')
    }

    function startNewProperty() {
        setSelectedPropertyId(null)
        setNewPropertyDraft((prev) => ({ ...prev, street: propertySearchTerm }))
        setStage('property-new')
    }

    function submitNewProperty(e) {
        e.preventDefault()
        const { street, city, state } = newPropertyDraft
        if (!street.trim() || !city.trim() || !state.trim()) {
            setFieldError('Street, city, and state are needed to start the profile.')
            return
        }
        setPropertyDisplay({
            address: { street: street.trim(), city: city.trim(), state: newPropertyDraft.state.trim(), zip: newPropertyDraft.zip.trim() },
            wellOrMunicipal: newPropertyDraft.wellOrMunicipal,
            gateCodeKeyEntry: newPropertyDraft.gateCodeKeyEntry,
            mainShutoffLocation: newPropertyDraft.mainShutoffLocation,
        })
        setFieldError('')
        setStage('billingAddress')
    }

    function goBack() {
        const order = ['firstName', 'lastName', 'bestPhone', 'altPhone', 'property-search', 'property-new', 'billingAddress', 'dog', 'email', 'notes']
        const index = order.indexOf(stage)
        if (index <= 0) return
        setStage(order[index - 1])
    }

    async function handleConfirm() {
        setStatus('submitting')
        setFieldError('')
        try {
            let propertyId = selectedPropertyId

            if (!propertyId) {
                const propRes = await fetch('/api/properties', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address: propertyDisplay.address,
                        wellOrMunicipal: propertyDisplay.wellOrMunicipal,
                        gateCodeKeyEntry: propertyDisplay.gateCodeKeyEntry,
                        mainShutoffLocation: propertyDisplay.mainShutoffLocation,
                    }),
                })
                if (!propRes.ok) throw new Error('Property save failed')
                const propData = await propRes.json()
                propertyId = propData.id
            }

            const payload = { ...customer, propertyId, id: existingCustomerId || undefined }
            const res = await fetch('/api/customers', {
                method: existingCustomerId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error('Customer save failed')

            const saveData = await res.json()
            setSavedCustomerId(existingCustomerId || saveData.id)

            setStage('done')
            setStatus('idle')
        } catch (err) {
            console.error(err)
            setStatus('error')
        }
    }

    function startOver() {
        setStage('firstName')
        setDraft('')
        setFieldError('')
        setCustomer({ firstName: '', lastName: '', bestPhone: '', altPhone: '', billingAddress: undefined, dog: '', email: '', notes: '' })
        setBillingAddressDraft(EMPTY_PROPERTY_ADDRESS)
        setPropertySearchTerm('')
        setSelectedPropertyId(null)
        setPropertyDisplay(null)
        setNewPropertyDraft(EMPTY_PROPERTY_DETAILS)
        setExistingCustomerId(null)
        setStatus('idle')
        window.history.replaceState({}, '', window.location.pathname)
    }

    const SIMPLE_LABELS = {
        firstName: "What's the customer's first name?",
        lastName: "What's their last name?",
        bestPhone: 'Best phone number to reach them?',
        altPhone: 'Any other phone number? (skip if none)',
        email: 'Email address? (skip if none)',
        notes: "Anything else about them? Best time to call, etc. (skip if none)",
    }

    if (loadingExisting) {
        return (
            <div className="min-h-screen bg-navy flex items-center justify-center">
                <p className="text-white/50 text-lg">Loading customer...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-navy flex flex-col items-center px-4 py-10">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <h1 className="font-serif text-2xl text-white">
                        {existingCustomerId ? 'Edit Customer Profile' : 'New Customer Intake'}
                    </h1>
                    <p className="text-white/40 text-xs mt-1">Adirondack Advanced Water Solutions</p>
                </div>

                {/* ---- simple one-field screens ---- */}
                {['firstName', 'lastName', 'bestPhone', 'altPhone', 'email', 'notes'].includes(stage) && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-6">{SIMPLE_LABELS[stage]}</p>
                        <form onSubmit={submitSimpleField} className="flex flex-col gap-3">
                            {stage === 'notes' ? (
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
                                    type={stage.toLowerCase().includes('phone') ? 'tel' : 'text'}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                    placeholder="Type here..."
                                />
                            )}
                            {fieldError && <p className="text-red-400 text-sm">{fieldError}</p>}
                            <button
                                type="submit"
                                className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                {draft.trim() ? 'Next' : stage === 'name' || stage === 'bestPhone' ? 'Next' : 'Skip'}
                            </button>
                        </form>
                        {stage !== 'firstName' && (
                            <button onClick={goBack} className="w-full text-white/40 hover:text-white/70 text-sm mt-4 py-2 transition-colors">
                                ← Back
                            </button>
                        )}
                    </div>
                )}

                {/* ---- property search ---- */}
                {stage === 'property-search' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-2">Where's the service address?</p>
                        <p className="text-white/40 text-xs mb-4">
                            We check first in case this house has been serviced before — under this customer or a previous owner.
                        </p>
                        <input
                            type="text"
                            value={propertySearchTerm}
                            onChange={(e) => setPropertySearchTerm(e.target.value)}
                            placeholder="Start typing the address..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue mb-3"
                        />
                        <div className="flex flex-col gap-2 mb-4">
                            {propertyMatches.map((p) => (
                                <button
                                    key={p._id}
                                    onClick={() => linkExistingProperty(p)}
                                    className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                >
                                    <p className="text-white text-sm">{formatAddress(p.address)}</p>
                                    <p className="text-white/40 text-xs">Existing property — link this customer to it</p>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={startNewProperty}
                            className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            + This is a new address
                        </button>
                        <button onClick={goBack} className="w-full text-white/40 hover:text-white/70 text-sm mt-4 py-2 transition-colors">
                            ← Back
                        </button>
                    </div>
                )}

                {/* ---- new property details ---- */}
                {stage === 'property-new' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-1">New property details</p>
                        <p className="text-white/40 text-xs mb-4">This stays with the house, even if it's sold later.</p>
                        <div className="flex flex-col gap-3">
                            <input
                                type="text" placeholder="Street" value={newPropertyDraft.street}
                                onChange={(e) => setNewPropertyDraft((p) => ({ ...p, street: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text" placeholder="City" value={newPropertyDraft.city}
                                    onChange={(e) => setNewPropertyDraft((p) => ({ ...p, city: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                />
                                <input
                                    type="text" placeholder="State" value={newPropertyDraft.state}
                                    onChange={(e) => setNewPropertyDraft((p) => ({ ...p, state: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                />
                            </div>
                            <input
                                type="text" placeholder="ZIP (optional)" value={newPropertyDraft.zip}
                                onChange={(e) => setNewPropertyDraft((p) => ({ ...p, zip: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <div className="flex gap-2">
                                {['Well', 'Municipal', 'Not sure'].map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => setNewPropertyDraft((p) => ({ ...p, wellOrMunicipal: opt }))}
                                        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${newPropertyDraft.wellOrMunicipal === opt ? 'bg-blue text-white' : 'bg-white/5 text-white/50 border border-white/10'
                                            }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text" placeholder="Gate code / key / entry instructions (skip if none)" value={newPropertyDraft.gateCodeKeyEntry}
                                onChange={(e) => setNewPropertyDraft((p) => ({ ...p, gateCodeKeyEntry: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <input
                                type="text" placeholder="Main shutoff location (skip if unknown)" value={newPropertyDraft.mainShutoffLocation}
                                onChange={(e) => setNewPropertyDraft((p) => ({ ...p, mainShutoffLocation: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            {fieldError && <p className="text-red-400 text-sm">{fieldError}</p>}
                            <button
                                onClick={submitNewProperty}
                                className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Next
                            </button>
                            <button onClick={() => setStage('property-search')} className="w-full text-white/40 hover:text-white/70 text-sm py-2 transition-colors">
                                ← Back to address search
                            </button>
                        </div>
                    </div>
                )}

                {/* ---- billing address ---- */}
                {stage === 'billingAddress' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-6">Billing address, if different from the service address? (skip if same)</p>
                        <form onSubmit={submitBillingAddress} className="flex flex-col gap-3">
                            <input
                                type="text" placeholder="Street" value={billingAddressDraft.street}
                                onChange={(e) => setBillingAddressDraft((p) => ({ ...p, street: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text" placeholder="City" value={billingAddressDraft.city}
                                    onChange={(e) => setBillingAddressDraft((p) => ({ ...p, city: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                />
                                <input
                                    type="text" placeholder="State" value={billingAddressDraft.state}
                                    onChange={(e) => setBillingAddressDraft((p) => ({ ...p, state: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                                />
                            </div>
                            <input
                                type="text" placeholder="ZIP" value={billingAddressDraft.zip}
                                onChange={(e) => setBillingAddressDraft((p) => ({ ...p, zip: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue"
                            />
                            {fieldError && <p className="text-red-400 text-sm">{fieldError}</p>}
                            <button type="submit" className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                                {billingAddressDraft.street ? 'Next' : 'Skip'}
                            </button>
                        </form>
                    </div>
                )}

                {/* ---- dog on site (belongs to the customer, not the house) ---- */}
                {stage === 'dog' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-6">Is there a dog on site?</p>
                        <div className="flex flex-col gap-3">
                            {['Yes', 'No'].map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => {
                                        setCustomer((prev) => ({ ...prev, dog: opt }))
                                        setStage('email')
                                    }}
                                    className="w-full bg-white/5 hover:bg-blue border border-white/10 hover:border-blue text-white text-lg py-4 rounded-xl transition-colors active:scale-[0.98]"
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        <button onClick={goBack} className="w-full text-white/40 hover:text-white/70 text-sm mt-4 py-2 transition-colors">
                            ← Back
                        </button>
                    </div>
                )}

                {/* ---- review ---- */}
                {stage === 'review' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <p className="text-white text-xl font-serif mb-6">{existingCustomerId ? 'Review before updating' : 'Review before saving'}</p>
                        <div className="flex flex-col gap-3 mb-6">
                            <ReviewRow label="First Name" value={customer.firstName} onEdit={() => setStage('firstName')} />
                            <ReviewRow label="Last Name" value={customer.lastName} onEdit={() => setStage('lastName')} />
                            <ReviewRow label="Best Phone" value={customer.bestPhone} onEdit={() => setStage('bestPhone')} />
                            <ReviewRow label="Alt Phone" value={customer.altPhone} onEdit={() => setStage('altPhone')} />
                            <ReviewRow label="Service Address" value={formatAddress(propertyDisplay?.address)} onEdit={() => setStage('property-search')} />
                            <ReviewRow label="Well / Municipal" value={propertyDisplay?.wellOrMunicipal} onEdit={() => setStage('property-search')} />
                            <ReviewRow label="Billing Address" value={formatAddress(customer.billingAddress)} onEdit={() => setStage('billingAddress')} />
                            <ReviewRow label="Dog on site?" value={customer.dog} onEdit={() => setStage('dog')} />                            <ReviewRow label="Email" value={customer.email} onEdit={() => setStage('email')} />
                            <ReviewRow label="Notes" value={customer.notes} onEdit={() => setStage('notes')} />
                        </div>
                        {status === 'error' && <p className="text-red-400 text-sm mb-4 text-center">Something went wrong saving — check your connection and try again.</p>}
                        <button
                            onClick={handleConfirm}
                            disabled={status === 'submitting'}
                            className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                        >
                            {status === 'submitting' ? 'Saving...' : existingCustomerId ? 'Save Changes' : 'Confirm & Save Customer'}
                        </button>
                    </div>
                )}

                {/* ---- done ---- */}
                {stage === 'done' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                        <p className="text-brand-green text-4xl mb-4">✓</p>
                        <p className="text-white text-xl font-serif mb-2">{existingCustomerId ? 'Customer updated' : 'Customer saved'}</p>
                        <p className="text-white/50 text-sm mb-6">{customer.firstName || 'This customer'}'s profile PDF has been downloaded, and the record is saved.</p>
                        <button
                            onClick={() => generatePdf(customer, propertyDisplay)}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-3"
                        >
                            Print Profile (PDF)
                        </button>
                        <a
                            href={`/desktop?addJobFor=${savedCustomerId}`}
                            className="block w-full text-center bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-3"
                        >
                            + Add Job
                        </a>
                        <button onClick={startOver} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]">
                            + Add Another Customer
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function ReviewRow({ label, value, onEdit }) {
    return (
        <button onClick={onEdit} className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors">
            <p className="text-white/40 text-[11px] uppercase tracking-widest">{label}</p>
            <p className="text-white text-sm mt-0.5">{value?.trim?.() ? value : <span className="text-white/30 italic">— skipped, tap to add —</span>}</p>
        </button>
    )
}

// ---- PDF generation ---------------------------------------------------------
async function generatePdf(customer, property) {
    const NAVY = [19, 53, 94]
    const GRAY_LABEL = [130, 130, 130]
    const GRAY_LINE = [190, 190, 190]
    const BLACK = [20, 20, 20]

    const doc = new jsPDF({ unit: 'pt', format: 'letter' })

    const logoDataUrl = await loadImageAsDataUrl('/logo-icon.png')
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 36, 30, 60, 60)
    }

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

    const sectionBar = (label) => {
        doc.setFillColor(...NAVY)
        doc.rect(36, y - 13, 540, 20, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.text(label, 41, y + 1)
        y += 28
    }

    const field = (label, value, x, colWidth) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...GRAY_LABEL)
        doc.text(label.toUpperCase(), x, y)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...BLACK)
        const text = value && value.trim ? (value.trim() || '—') : '—'
        const fitted = doc.splitTextToSize(text, colWidth)
        doc.text(fitted, x, y + 13)
        return fitted.length
    }

    const rowGap = 38

    sectionBar('CUSTOMER')
    field('Name', [customer.firstName, customer.lastName].filter(Boolean).join(' '), 36, 220)
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

    const safeName = ([customer.firstName, customer.lastName].filter(Boolean).join('-') || 'customer').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()

    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...NAVY)
    doc.text('Equipment Record — Serials & Warranty', 36, 46)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GRAY_LABEL)
    doc.text(`Customer: ${[customer.firstName, customer.lastName].filter(Boolean).join(' ')}`, 36, 64)

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