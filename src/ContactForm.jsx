import { useState } from 'react'
import emailjs from '@emailjs/browser'



export default function ContactForm() {
    const [status, setStatus] = useState(null)
    const [form, setForm] = useState({ from_name: '', from_contact: '', message: '' })

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setStatus('sending')
        try {
            await emailjs.send(
                'ADK_SERVICES',
                'template_oz9fl65',
                {
                    from_name: form.from_name,
                    from_contact: form.from_contact,
                    message: form.message,
                },
                '7derGOKaoYJKZFxce'
            )
            setStatus('success')
            setForm({ from_name: '', from_contact: '', message: '' })
        } catch (err) {
            setStatus('error')
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label htmlFor="from_name" className="text-[11px] tracking-widest uppercase text-white/55">Your name</label>
                <input
                    id="from_name"
                    name="from_name"
                    type="text"
                    required
                    value={form.from_name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none focus:border-blue transition-colors placeholder:text-white/20"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label htmlFor="from_contact" className="text-[11px] tracking-widest uppercase text-white/55">Phone or email</label>
                <input
                    id="from_contact"
                    name="from_contact"
                    type="text"
                    required
                    value={form.from_contact}
                    onChange={handleChange}
                    placeholder="(518) 555-0100"
                    className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none focus:border-blue transition-colors placeholder:text-white/20"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label htmlFor="message" className="text-[11px] tracking-widest uppercase text-white/55">What's going on?</label>
                <textarea
                    id="message"
                    name="message"
                    required
                    value={form.message}
                    onChange={handleChange}
                    placeholder="No water, strange smell, slow drain..."
                    className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none h-28 resize-y focus:border-blue transition-colors placeholder:text-white/20"
                />
            </div>
            <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-blue hover:bg-blue-light text-white py-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors active:scale-[0.98] disabled:opacity-50"
            >
                {status === 'sending' ? 'Sending...' : status === 'success' ? 'Message sent!' : status === 'error' ? 'Something went wrong' : 'Send message'}
            </button>
        </form>
    )
}