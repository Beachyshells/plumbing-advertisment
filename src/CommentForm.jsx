import { useState } from 'react'

export default function CommentForm() {
    const [status, setStatus] = useState(null)
    const [form, setForm] = useState({ name: '', location: '', comment: '' })

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setStatus('sending')
        try {
            const res = await fetch('/api/submit-comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error('Submit failed')
            setStatus('success')
            setForm({ name: '', location: '', comment: '' })
        } catch (err) {
            console.error(err)
            setStatus('error')
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label htmlFor="c_name" className="text-[11px] tracking-widest uppercase text-white/35">Your name</label>
                <input
                    id="c_name"
                    name="name"
                    type="text"
                    autoComplete='name'
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Jane S."
                    className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none focus:border-blue transition-colors placeholder:text-white/20"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label htmlFor="c_location" className="text-[11px] tracking-widest uppercase text-white/35">Your town</label>
                <input
                    id="c_location"
                    name="location"
                    type="text"
                    autoComplete='address-level2'
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Saranac Lake"
                    className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none focus:border-blue transition-colors placeholder:text-white/20"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label htmlFor="c_comment" className="text-[11px] tracking-widest uppercase text-white/35">Your experience</label>
                <textarea
                    id="c_comment"
                    name="comment"
                    autoComplete="off"
                    required
                    value={form.comment}
                    onChange={handleChange}
                    placeholder="They fixed our well pump the same day..."
                    className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none h-28 resize-y focus:border-blue transition-colors placeholder:text-white/20"
                />
            </div>
            <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-blue hover:bg-blue-light text-white py-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors active:scale-[0.98] disabled:opacity-50"
            >
                {status === 'sending' ? 'Sending...' : status === 'success' ? 'Thank you! We\'ll review it shortly.' : status === 'error' ? 'Something went wrong' : 'Share your experience'}
            </button>
            {status === 'success' && (
                <p className="text-xs text-white/40 text-center">Your comment will appear once we've approved it.</p>
            )}
        </form>
    )
}