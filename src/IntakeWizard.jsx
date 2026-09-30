import { useState, useRef, useEffect } from 'react'
import { generateProfilePdf } from './profilePdf.js'

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

    const [customer, setCustomer] = useState({ firstName: '', lastName: '', bestPhone: '', altPhone: '', additionalContactFirstName: '', additionalContactLastName: '', billingAddress: undefined, dog: '', email: '', notes: '' })
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

    const [existingCustomerMatches, setExistingCustomerMatches] = useState([])

    function loadCustomerById(id) {
        setLoadingExisting(true)
        return fetch(`/api/customers?id=${encodeURIComponent(id)}`)
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
    }

    async function checkForExistingCustomer() {
        try {
            const res = await fetch(`/api/customers?search=${encodeURIComponent(customer.lastName)}`)
            const data = await res.json()
            setExistingCustomerMatches(data.customers || [])
        } catch (err) {
            setExistingCustomerMatches([])
        }
        setStage('existing-customer-check')
    }

    // If opened as .../intake?edit=<id>, load that customer + their linked
    // property and jump straight to review.
    useEffect(() => {
        const editId = new URLSearchParams(window.location.search).get('edit')
        if (!editId) return
        loadCustomerById(editId)
    }, [])

    useEffect(() => {
        setFieldError('')
        if (['firstName', 'lastName', 'bestPhone', 'altPhone', 'additionalContactFirstName', 'additionalContactLastName', 'email'].includes(stage)) {
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
    async function submitSimpleField(e) {
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

        // Editing one field of an existing customer should save that field
        // and go straight back to review — not continue through the rest
        // of the new-customer wizard, and definitely not re-run the
        // duplicate-check search (which would find and reload this same
        // customer from the server, wiping out the edit that was just made).
        if (existingCustomerId) {
            setStage('review')
            return
        }

        if (stage === 'firstName') setStage('lastName')
        else if (stage === 'lastName') setStage('bestPhone')
        else if (stage === 'bestPhone') setStage('altPhone')
        else if (stage === 'altPhone') setStage('additionalContactFirstName')
        else if (stage === 'additionalContactFirstName') setStage('additionalContactLastName')
        else if (stage === 'additionalContactLastName') await checkForExistingCustomer()
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
        setStage(existingCustomerId ? 'review' : 'email')
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
        const order = ['firstName', 'lastName', 'bestPhone', 'altPhone', 'additionalContactFirstName', 'additionalContactLastName', 'existing-customer-check', 'property-search', 'property-new', 'billingAddress', 'dog', 'email', 'notes']
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
        setCustomer({ firstName: '', lastName: '', bestPhone: '', altPhone: '', additionalContactFirstName: '', additionalContactLastName: '', billingAddress: undefined, dog: '', email: '', notes: '' })
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
        additionalContactFirstName: "First name of additional contact? (skip if none)",
        additionalContactLastName: "Last name of additional contact? (skip if none)",
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
                {['firstName', 'lastName', 'bestPhone', 'altPhone', 'additionalContactFirstName', 'additionalContactLastName', 'email', 'notes'].includes(stage) && (<div className="bg-white/5 border border-white/10 rounded-2xl p-6">
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

                {/* ---- check for existing customer match ---- */}
                {stage === 'existing-customer-check' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        {existingCustomerMatches.length > 0 ? (
                            <>
                                <p className="text-white text-xl font-serif mb-2">Is this one of these people?</p>
                                <p className="text-white/40 text-xs mb-4">
                                    We found existing customers with a similar last name — tap the right one, or confirm this is someone new.
                                </p>
                                <div className="flex flex-col gap-2 mb-4">
                                    {existingCustomerMatches.map((c) => (
                                        <button
                                            key={c._id}
                                            onClick={() => loadCustomerById(c._id)}
                                            className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors"
                                        >
                                            <p className="text-white text-sm">{c.firstName} {c.lastName}</p>
                                            <p className="text-white/40 text-xs">{c.bestPhone}</p>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setStage('property-search')}
                                    className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                                >
                                    None of these — this is a new customer
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-white text-xl font-serif mb-4">No existing match found</p>
                                <button
                                    onClick={() => setStage('property-search')}
                                    className="w-full bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                                >
                                    Continue as a new customer
                                </button>
                            </>
                        )}
                        <button onClick={() => setStage('altPhone')} className="w-full text-white/40 hover:text-white/70 text-sm mt-4 py-2 transition-colors">
                            ← Back
                        </button>
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
                                        setStage(existingCustomerId ? 'review' : 'email')
                                    }}
                                    className="w-full bg-white/5 hover:bg-brand-green border border-white/10 hover:border-brand-green text-white text-lg py-4 rounded-xl transition-colors active:scale-[0.98]"
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
                            <ReviewRow label="Additional Contact" value={[customer.additionalContactFirstName, customer.additionalContactLastName].filter(Boolean).join(' ')} onEdit={() => setStage('additionalContactFirstName')} />                            <ReviewRow label="Service Address" value={formatAddress(propertyDisplay?.address)} onEdit={() => setStage('property-search')} />
                            <ReviewRow label="Well / Municipal" value={propertyDisplay?.wellOrMunicipal} onEdit={() => setStage('property-search')} />
                            <ReviewRow label="Billing Address" value={formatAddress(customer.billingAddress)} onEdit={() => setStage('billingAddress')} />
                            <ReviewRow label="Dog on site?" value={customer.dog} onEdit={() => setStage('dog')} />
                            <ReviewRow label="Email" value={customer.email} onEdit={() => setStage('email')} />
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
                        <a
                            href={`/desktop?viewCustomer=${savedCustomerId}`}
                            className="block w-full text-center bg-blue hover:bg-blue-light text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-3"
                        >
                            View Customer Profile
                        </a>
                        <a
                            href={`/desktop?addJobFor=${savedCustomerId}`}
                            className="block w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-3"
                        >
                            + Add Job
                        </a>
                        <button
                            onClick={() => generateProfilePdf({ customer, property: propertyDisplay })}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-3"
                        >
                            Print Profile (PDF)
                        </button>
                        <button onClick={startOver} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] mb-3">
                            + Add Another Customer
                        </button>
                        <a
                            href="/desktop" className="block text-white/40 hover:text-white/70 text-sm py-2 transition-colors">
                            ← Back to Desktop
                        </a>
                    </div >
                )
                }
            </div >
        </div >
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
