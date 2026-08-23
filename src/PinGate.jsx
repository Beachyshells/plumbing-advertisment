import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'invoicePinVerified'

function getInitialUnlockedState() {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
}

export default function PinGate({ children }) {
    const [unlocked, setUnlocked] = useState(getInitialUnlockedState)
    const [pin, setPin] = useState('')
    const [status, setStatus] = useState('idle') // idle | checking | wrong | error
    const inputRef = useRef(null)

    useEffect(() => {
        if (!unlocked && inputRef.current) {
            inputRef.current.focus()
        }
    }, [unlocked])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!pin.trim()) return

        setStatus('checking')
        try {
            const res = await fetch('/api/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin.trim() }),
            })
            const data = await res.json()

            if (data.correct) {
                localStorage.setItem(STORAGE_KEY, 'true')
                setUnlocked(true)
                setStatus('idle')
            } else {
                setStatus('wrong')
                setPin('')
            }
        } catch (err) {
            console.error(err)
            setStatus('error')
        }
    }

    if (unlocked) return children

    return (
        <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="font-serif text-2xl text-white">Enter Access Code</h1>
                    <p className="text-white/40 text-xs mt-1">Adirondack Advanced Water Solutions</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
                    <input
                        ref={inputRef}
                        type="password"
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-lg py-3 px-4 outline-none focus:border-blue text-center tracking-widest"
                        placeholder="PIN"
                    />

                    {status === 'wrong' && (
                        <p className="text-red-400 text-sm text-center">Incorrect PIN — try again.</p>
                    )}
                    {status === 'error' && (
                        <p className="text-red-400 text-sm text-center">Something went wrong — check your connection and try again.</p>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'checking' || !pin.trim()}
                        className="w-full bg-blue hover:bg-blue-light disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
                    >
                        {status === 'checking' ? 'Checking...' : 'Unlock'}
                    </button>
                </form>
            </div>
        </div>
    )
}