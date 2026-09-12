import { useEffect } from 'react'

// A small, auto-dismissing confirmation banner. Render <Toast message={toast}
// onDone={() => setToast(null)} /> near the top of any page, then call
// setToast('Part added') after any action that should give clear feedback.
export default function Toast({ message, onDone }) {
    useEffect(() => {
        if (!message) return
        const timer = setTimeout(onDone, 2200)
        return () => clearTimeout(timer)
    }, [message])

    if (!message) return null

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-brand-green text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg animate-[fadeIn_0.2s_ease-out]">
            {message}
        </div>
    )
}