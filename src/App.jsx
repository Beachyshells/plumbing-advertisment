import { useState, useEffect, useRef } from 'react'
import heroImage from './assets/hero-image.png'
import emailjs from '@emailjs/browser'

function ContactForm() {
  const formRef = useRef()
  const [status, setStatus] = useState(null)

  const handleSubmit = async () => {
    setStatus('sending')
    const form = formRef.current
    try {
      await emailjs.send(
        'ADK_SERVICES',
        'template_oz9fl65',
        {
          from_name: form.querySelector('[name="from_name"]').value,
          from_contact: form.querySelector('[name="from_contact"]').value,
          message: form.querySelector('[name="message"]').value,
        },
        '7derGOKaoYJKZFxce'
      )
      setStatus('success')
    } catch (err) {
      console.log(err)
      setStatus('error')
    }
  }

  return (
    <div ref={formRef} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] tracking-widest uppercase text-white/35">Your name</label>
        <input name="from_name" type="text" placeholder="Jane Smith" className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none focus:border-[#176cc8] transition-colors placeholder:text-white/20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] tracking-widest uppercase text-white/35">Phone or email</label>
        <input name="from_contact" type="text" placeholder="(518) 555-0100" className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none focus:border-[#176cc8] transition-colors placeholder:text-white/20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] tracking-widest uppercase text-white/35">What's going on?</label>
        <textarea name="message" placeholder="No water, strange smell, slow drain..." className="bg-white/5 border border-white/10 rounded-xl text-white/85 text-sm py-3 px-4 outline-none h-28 resize-y focus:border-[#176cc8] transition-colors placeholder:text-white/20" />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={status === 'sending'}
        className="w-full bg-[#176cc8] hover:bg-[#1a7de0] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors active:scale-[0.98] disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending...' : status === 'success' ? 'Message sent!' : status === 'error' ? 'Something went wrong' : 'Send message'}
      </button>
    </div>
  )
}

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="bg-[#0a1628] text-[#e0e7f1] min-h-screen">

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#081024]/70 backdrop-blur-md border-b border-white/5">
        <div className="max-w-9xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex flex-col leading-none">
            <span className="font-serif text-2xl text-white">Adirondack Advanced</span>
            <span className="text-[13px] tracking-[0.14em] uppercase text-[#6daee0] mt-0.5">Water Solutions</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-white/50 text-base hover:text-white transition-colors no-underline">Home</a>
            <a href="#services" className="text-white/50 text-base hover:text-white transition-colors no-underline">Services</a>
            <a href="#products" className="text-white/50 text-base hover:text-white transition-colors no-underline">Products</a>
            <a href="#about" className="text-white/50 text-base hover:text-white transition-colors no-underline">About</a>
            <a href="#contact" className="text-white/50 text-base hover:text-white transition-colors no-underline">Contact</a>
            <a href="tel:+15185349949" className="bg-[#176cc8] text-white px-4 py-2 rounded-full text-sm font-semibold no-underline hover:bg-[#1a7de0] transition-colors">Emergency</a>
          </nav>
          <button className="md:hidden text-white/70" onClick={() => setIsMenuOpen(o => !o)}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {isMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />}
      <div className={`fixed top-0 right-0 h-screen w-72 bg-[#0d1f3c] border-l border-white/8 z-50 flex flex-col pt-16 px-8 pb-8 transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button className="absolute top-5 right-5 text-white/50 hover:text-white text-xl" onClick={() => setIsMenuOpen(false)}>✕</button>
        <div className="flex flex-col gap-7 mt-4">
          <a href="#home" className="text-white/60 text-base no-underline hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>Home</a>
          <a href="#services" className="text-white/60 text-base no-underline hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>Services</a>
          <a href="#products" className="text-white/60 text-base no-underline hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>Products</a>
          <a href="#about" className="text-white/60 text-base no-underline hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>About</a>
          <a href="#contact" className="text-white/60 text-base no-underline hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>Contact</a>
          <a href="tel:+15185349949" className="mt-3 bg-[#176cc8] text-white text-center py-3.5 rounded-xl font-semibold text-sm no-underline hover:bg-[#1a7de0] transition-colors" onClick={() => setIsMenuOpen(false)}>Emergency</a>
        </div>
      </div>

      {/* HERO */}
      <section id="home" className="relative h-screen w-full">

        {/* FIXED BACKGROUND — mobile full width */}
        <div className="fixed inset-0 z-0">
          {/* MOBILE */}
          <div className="md:hidden w-full h-full">
            <img src={heroImage} alt="Crystal clear Adirondack mountain water" className="w-full h-full object-cover object-top" />
          </div>

          {/* DESKTOP — diagonal split */}
          <div className="hidden md:block w-full h-full">
            <div className="absolute inset-0 flex">
              <div className="w-1/2 h-full shrink-0" style={{ clipPath: 'polygon(0 0, 100% 0, 90% 100%, 0 100%)' }}>
                <img src={heroImage} alt="Crystal clear Adirondack mountain water" className="w-full h-full object-cover object-center" />
              </div>
            </div>
          </div>
          {/* DARKENING OVERLAY */}
          <div className="absolute inset-0 bg-[#0a1628]" style={{ opacity: 0.55 + Math.min(scrollY / 600, 0.45) }} />
        </div>

        {/* HERO CONTENT */}
        <div className="relative z-10 flex flex-col items-end py-10 md:py-24 lg:py-32 min-h-screen max-w-7xl mx-auto">
          <div className="max-w-xl">
            <p className="text-[11px] tracking-[0.18em] uppercase text-[#6daee0] mb-4">
              Owner-operated · Certified · North Country
            </p>
            <h1 className="font-serif text-5xl md:text-6xl font-normal leading-tight text-white mb-6">
              Pure as the mountains.<br /><em className="italic text-[#6daee0]">Right from your tap.</em>
            </h1>
            <p className="text-base text-white/50 leading-relaxed mb-8">
              Well pumps, advanced filtration, and water solutions — built for the Adirondacks. When something goes wrong, we answer.
            </p>
            <div className="flex gap-3 flex-wrap">
              <a href="#contact" className="inline-flex items-center gap-2 bg-[#176cc8] hover:bg-[#1a7de0] text-white px-6 py-3.5 rounded-xl font-semibold text-sm no-underline transition-colors">Get service</a>
              <a href="sms:+15185349949" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium no-underline bg-white/7 text-white/70 border border-white/12 hover:bg-white/12 transition-colors">Text us</a>
            </div>
            <ul className="list-none flex flex-wrap gap-4 mt-8 p-0">
              {['Call for estimates', 'Clinton · Essex · Franklin Counties'].map(item => (
                <li key={item} className="flex items-center gap-1.5 text-xs text-white/35">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1a9e4a] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* EVERYTHING ELSE — scrolls over hero */}
      <div className="relative z-10">

        {/* TRUST BAR */}
        <div className="border-y border-white/6 bg-[#0a1628]">
          <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-x-10">
            {[
              { num: '3', label: 'Counties served — Clinton, Essex & Franklin' },
              { num: 'Same-day', label: 'Callback for emergencies' },
              { num: '100%', label: 'Owner-supervised' },
              { num: 'Certified', label: 'Installer' },
            ].map(stat => (
              <div key={stat.num} className="flex flex-col md:flex-row items-center md:items-baseline gap-1 md:gap-2 text-center md:text-left">
                <span className="font-serif text-2xl text-white">{stat.num}</span>
                <span className="text-xs text-white/35 tracking-wide">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/*TESTIMONIALS
        <section className="max-w-7xl mx-auto py-20 px-6">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#6daee0] mb-2">What neighbors say</p>
          <h2 className="font-serif text-4xl font-normal text-white mb-12">Don't take our word for it</h2>
          <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
            {[
              { quote: "Add review here.", initials: 'XX', name: 'Name', loc: 'Location' },
              { quote: "Add review here.", initials: 'XX', name: 'Name', loc: 'Location' },
            ].map(t => (
              <div key={t.initials} className="bg-white/3 border border-white/7 rounded-2xl p-6">
                <p className="text-sm text-white/55 leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#176cc8]/20 flex items-center justify-center text-xs font-semibold text-[#6daee0] shrink-0">{t.initials}</div>
                  <div>
                    <p className="text-sm font-medium text-white/70">{t.name}</p>
                    <p className="text-xs text-white/30 mt-0.5">{t.loc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        */}

        {/* SERVICES */}
        <section id="services" className="bg-[#0a1628] max-w-7xl mx-auto py-20 px-6">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#6daee0] mb-2">What we do</p>
          <h2 className="font-serif text-4xl font-normal text-white mb-12">Full-service water solutions</h2>
          <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
            {[
              {
                title: 'Well & pump',
                icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
                items: [
                  { bold: 'Emergency pump service:', text: ' No water? We diagnose and replace failing pumps fast.' },
                  { bold: 'Pressure tanks:', text: ' Constant pressure solutions for consistent flow.' },
                  { bold: 'Well sanitization:', text: ' Professional treatments to eliminate bacteria and odors.' },
                ]
              },
              {
                title: 'Filtration',
                icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
                items: [
                  { bold: 'Custom systems:', text: " Engineered for the North Country's unique mineral profile." },
                  { bold: 'UV sterilization:', text: ' Hospital-grade tech — 99.9% of pathogens eliminated.' },
                  { bold: 'Iron & sulfur:', text: ' Our fix for rotten egg smells and orange staining.' },
                ]
              },
              {
                title: 'Drains & inspection',
                icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
                items: [
                  { bold: 'Drain cleaning:', text: ' Professional snaking for stubborn clogs.' },
                  { bold: 'Camera inspection:', text: ' HD video to find pipe issues without guesswork.' },
                  { bold: 'Well blowouts:', text: ' Clearing blockages and restoring flow to your well.' },
                ]
              },
            ].map(service => (
              <div key={service.title} className="bg-white/3 border border-white/7 rounded-2xl p-6 hover:border-white/14 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#176cc8]/15 flex items-center justify-center text-[#6daee0] mb-4">{service.icon}</div>
                <h3 className="font-serif text-xl font-normal text-white mb-4">{service.title}</h3>
                <ul className="list-none flex flex-col gap-2.5 p-0">
                  {service.items.map(item => (
                    <li key={item.bold} className="text-sm text-white/40 leading-relaxed">
                      <strong className="text-white/65 font-semibold">{item.bold}</strong>{item.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-sm text-white/35 mt-10 border-t border-white/6 pt-8">
            Also available for pipe repairs, fixture installations, and general plumbing throughout Clinton, Essex &amp; Franklin Counties.
          </p>
        </section>

        {/* PRODUCTS */}
        <section id="products" className="border-t border-white/6 bg-[#0a1628]">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <p className="text-[11px] tracking-[0.18em] uppercase text-[#6daee0] mb-2">What we install</p>
            <h2 className="font-serif text-4xl font-normal text-white mb-12">Water solutions for every home</h2>
            <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
              {[
                { title: 'Traditional Water Softener', description: 'Removes the hard water minerals that cause limescale buildup, stained fixtures, spotty dishes, and damage to your pipes and appliances.', badge: 'Most popular' },
                { title: 'Salt-Free Water Conditioner', description: 'No salt, no electricity, no maintenance. Conditions your water and prevents scale buildup for 5-6 years — a true set it and forget it solution.', badge: null },
                { title: 'Chloramine Reduction Solution', description: 'Filters chloramines, chlorine, hydrogen sulfide, and other chemicals from every tap in your home — drinking, cooking, and bathing.', badge: null },
              ].map(product => (
                <div key={product.title} className="bg-white/3 border border-white/7 rounded-2xl p-6 flex flex-col gap-4 hover:border-white/14 transition-colors">
                  {product.badge && <span className="self-start text-[11px] font-semibold tracking-wide uppercase bg-[#176cc8]/20 text-[#6daee0] px-3 py-1 rounded-full">{product.badge}</span>}
                  <h3 className="font-serif text-xl font-normal text-white">{product.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed flex-1">{product.description}</p>
                  <a href="#contact" className="inline-flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-medium py-2.5 rounded-xl no-underline transition-colors">Get a quote</a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <div id="about" className="border-t border-white/6 bg-[#0c1f3f]">
          <div className="max-w-7xl mx-auto px-6 py-16 flex gap-12 items-center max-md:flex-col max-md:gap-8">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-[#176cc8]/20 flex items-center justify-center text-[#6daee0]">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] tracking-[0.18em] uppercase text-[#6daee0] mb-2">The man behind it all</p>
              <p className="text-white/70 text-base leading-relaxed max-w-2xl">
                Born and raised in the North Country — I know these mountains, these wells, and these winters. I'm on every job personally, and no matter what it takes, we stay on it until it's solved. No shortcuts, no runaround.
              </p>
            </div>
          </div>
        </div>

        {/* CONTACT */}
        <section id="contact" className="border-t border-white/6 bg-[#0a1628]">
          <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-2 gap-14 items-start max-md:grid-cols-1 max-md:gap-10">
            <div>
              <p className="text-[11px] tracking-[0.18em] uppercase text-[#6daee0] mb-2">Get in touch</p>
              <h2 className="font-serif text-4xl font-normal text-white mb-4">Call for service.</h2>
              <p className="text-sm text-white/50 leading-relaxed mb-8">
                Call, text, or drop us a message. We're out in the field dawn to dusk — and whatever time you reach us, you'll always get our standard rate. No after-hours markup, ever.
              </p>
              <ul className="list-none flex flex-col gap-4 p-0">
                <li className="flex items-center gap-3 text-sm text-white/55">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-[#6daee0] shrink-0">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
                  </span>
                  (518) 534-9949
                </li>
                <li className="flex items-center gap-3 text-sm text-white/55">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-[#6daee0] shrink-0">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                  </span>
                  adkadvancedwatersolutions@gmail.com
                </li>
                <li className="flex items-center gap-3 text-sm text-white/55">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-[#6daee0] shrink-0">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                  </span>
                  Clinton · Franklin · Essex Counties
                </li>
              </ul>
            </div>
            <ContactForm />
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/6 bg-[#0a1628]">
          <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col items-center text-center gap-1">
            <h3 className="font-serif text-xl font-normal text-white">Adirondack Advanced</h3>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[#6daee0] mb-4">Water Solutions</p>
            <p className="text-sm text-white/40">Serving Clinton, Essex and Franklin counties</p>
            <p className="text-sm text-white/40 mb-4">(518) 534-9949 · adkadvancedwatersolutions@gmail.com</p>
            <div className="flex gap-4 text-xs text-white/25">
              <span>© 2026 Adirondack Advanced Water Solutions</span>
              <span>·</span>
              <span>Owner-Operated</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}