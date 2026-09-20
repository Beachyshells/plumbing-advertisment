import { useState, useEffect } from 'react'

// A cents-first money input, like a POS terminal or ATM: you type digits,
// and the decimal point places itself automatically from the right. This
// is a structural safety net against "meant $4.25, typed 425" — there's no
// decimal point to forget, since the digits you type ARE the cents.
//
// `value` is a plain number/string like 4.25. `onChange` is called with
// the new value as a string, e.g. "4.25" — same shape existing setters
// already expect from a text input's value.
export default function MoneyInput({ value, onChange, placeholder, autoFocus, onKeyDown }) {
    const [digits, setDigits] = useState(() => {
        const cents = Math.round((Number(value) || 0) * 100)
        return cents > 0 ? String(cents) : ''
    })

    useEffect(() => {
        const cents = Math.round((Number(value) || 0) * 100)
        const nextDigits = cents > 0 ? String(cents) : ''
        setDigits((prev) => (prev !== nextDigits ? nextDigits : prev))
    }, [value])

    function handleChange(e) {
        const raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
        setDigits(raw)
        const cents = Number(raw || '0')
        onChange((cents / 100).toFixed(2))
    }

    const displayValue = digits
        ? (Number(digits) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''

    return (
        <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg pointer-events-none">$</span>
            <input
                type="text"
                inputMode="numeric"
                autoFocus={autoFocus}
                value={displayValue}
                onChange={handleChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder || '0.00'}
                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 pl-8 pr-4 outline-none focus:border-blue"
            />
        </div>
    )
}
