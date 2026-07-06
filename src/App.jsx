import { useState, useEffect } from 'react'
import heroImage from './assets/hero-image.webp'
import Testimonials from './Testimonials'
import CommentForm from './CommentForm'
import { motion } from 'framer-motion'
import Gallery from './Gallery'
import vanFull from './assets/van-full.webp'
import vanBrand from './assets/van-brand.webp'
import ContactForm from './ContactForm'

// Preload the hero image as early as possible
if (typeof document !== 'undefined') {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = heroImage
  link.fetchPriority = 'high'
  document.head.appendChild(link)
}


export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [viewportH, setViewportH] = useState(0)

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } }
  }

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY)
          ticking = false
        })
        ticking = true
      }
    }

    const handleResize = () => setViewportH(window.innerHeight)
    handleResize()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    let scrollTimer
    const onScroll = () => {
      setIsScrolling(true)
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => setIsScrolling(false), 200)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(scrollTimer)
    }
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return
    const handleKey = (e) => {

      if (e.key === 'Escape') setIsMenuOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isMenuOpen])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('recovered')) {
      url.searchParams.delete('recovered')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  useEffect(() => {
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  return (
    <div className="bg-navy text-body min-h-screen font-sans overflow-x-hidden">

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-navy-dark/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col leading-none">
            <span className="font-serif text-xl md:text-2xl text-body">Adirondack Advanced</span>
            <span className="text-xs md:text-[13px] tracking-[0.14em] uppercase text-accent mt-0.5">Water Solutions</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-body/50 text-base hover:text-body transition-colors no-underline">Home</a>
            <a href="#services" className="text-body/50 text-base hover:text-body transition-colors no-underline">Services</a>
            <a href="#products" className="text-body/50 text-base hover:text-body transition-colors no-underline">Products</a>
            <a href="#gallery" className="text-body/50 text-base hover:text-body transition-colors no-underline">Gallery</a>
            <a href="#about" className="text-body/50 text-base hover:text-body transition-colors no-underline">About</a>
            <a href="#contact" className="text-body/50 text-base hover:text-body transition-colors no-underline">Contact</a>
            <a href="tel:+15185349949" className="bg-blue hover:bg-blue-light text-body px-5 py-3 rounded-full font-semibold text-lg shadow-lg no-underline flex items-center gap-2 transition-colors">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
              </svg>
              Emergency
            </a>
          </nav>
          <button className="md:hidden text-body/70 focus:outline-none" onClick={() => setIsMenuOpen(o => !o)} aria-label={isMenuOpen ? "Close menu" : "Open menu"}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>
        </div>
      </header>

      {/* FLOATING EMERGENCY BUTTON (mobile only) */}
      <motion.a
        href="tel:+15185349949"
        className="md:hidden fixed bottom-15 right-5 z-50 bg-blue text-body px-5 py-3 rounded-full font-semibold text-lg shadow-lg no-underline flex items-center gap-2"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: isScrolling ? 0 : 1,
          scale: isScrolling ? 0.8 : 1,
          pointerEvents: isScrolling ? 'none' : 'auto',
        }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
        </svg>
        Emergency
      </motion.a>

      {/* MOBILE DRAWER */}
      {isMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />}
      <div
        aria-hidden={!isMenuOpen}
        inert={!isMenuOpen ? true : undefined}
        className={`fixed top-0 right-0 h-screen w-72 bg-navy-drawer border-l border-white/10 z-50 flex flex-col pt-20 px-8 pb-8 transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button className="absolute top-5 right-5 text-body/50 hover:text-body text-2xl" onClick={() => setIsMenuOpen(false)}>✕</button>
        <div className="flex flex-col gap-6 mt-4">
          <a href="#home" className="text-body/70 text-lg no-underline hover:text-body transition-colors" onClick={() => setIsMenuOpen(false)}>Home</a>
          <a href="#services" className="text-body/70 text-lg no-underline hover:text-body transition-colors" onClick={() => setIsMenuOpen(false)}>Services</a>
          <a href="#products" className="text-body/70 text-lg no-underline hover:text-body transition-colors" onClick={() => setIsMenuOpen(false)}>Products</a>
          <a href="#gallery" className="text-body/70 text-lg no-underline hover:text-body transition-colors" onClick={() => setIsMenuOpen(false)}>Gallery</a>
          <a href="#about" className="text-body/70 text-lg no-underline hover:text-body transition-colors" onClick={() => setIsMenuOpen(false)}>About</a>
          <a href="#contact" className="text-body/70 text-lg no-underline hover:text-body transition-colors" onClick={() => setIsMenuOpen(false)}>Contact</a>
          <a href="tel:+15185349949" className="mt-4 bg-blue text-body text-center py-3.5 rounded-xl font-semibold text-sm no-underline hover:bg-blue-light transition-colors" onClick={() => setIsMenuOpen(false)}>Emergency</a>
        </div>
      </div>


      {/* HERO */}
      <section
        id="home"
        className="relative min-h-[80svh] lg:min-h-svh w-full overflow-hidden bg-navy"
      >
        {/* FIXED IMAGE LAYER — stable height, won't jump with the address bar */}
        <div
          className="fixed top-0 left-0 right-0 h-lvh z-0 lg:w-1/2"
          style={{
            opacity: Math.max(1 - scrollY / ((viewportH || 800) * 0.85), 0), transition: 'opacity 0.1s linear',
          }}
        >
          <img
            src={heroImage}
            alt="Faucet flowing into an Adirondack mountain river"
            fetchPriority="high"
            className="w-full h-full object-cover object-right lg:[clip-path:polygon(0_0,100%_0,90%_100%,0_100%)]"
            style={{ pointerEvents: 'none' }}
          />

          {/* Gradient overlay: clear at top, dark at bottom */}
          <div
            className="absolute inset-0 lg:hidden"
            style={{
              background: 'linear-gradient(to bottom, rgba(10,22,40,0) 0%, rgba(10,22,40,0) 25%, rgba(10,22,40,0.5) 50%, rgba(10,22,40,0.85) 70%, rgba(10,22,40,1) 100%)',
            }}
          />
        </div>

        {/* TEXT — scrolls over the fixed image */}
        <div className="relative z-10 flex flex-col justify-end pb-10 min-h-[80svh] lg:min-h-svh px-6 lg:px-14 lg:justify-center lg:pt-24 lg:w-1/2 lg:ml-auto landscape:justify-center landscape:pt-24 landscape:pb-16">
          <motion.div
            className="max-w-xl lg:ml-auto"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.2, delayChildren: 0.15 } } }}
          >
            <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal leading-tight text-body my-6">
              Pure as the mountains.<br />
              <motion.em variants={fadeUp} className="italic text-accent">Right from your tap.</motion.em>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-sm text-body lg:text-body leading-relaxed mb-8">
              Well pumps, advanced filtration, and water solutions — built for the Adirondacks. When something goes wrong, we answer.
            </motion.p>
            <motion.div variants={fadeUp} className="flex gap-3 flex-wrap">
              <a href="#contact" className="inline-flex items-center gap-2 bg-blue hover:bg-blue-light text-body px-6 py-3.5 rounded-xl font-semibold text-sm no-underline transition-colors">Get service</a>
              <a href="sms:+15185349949" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium no-underline bg-white/15 text-body border border-blue hover:bg-white/32 transition-colors">Text us</a>
            </motion.div>
            <ul className="list-none flex flex-wrap gap-4 mt-8 p-0">
              {['Call for estimates', 'Clinton · Essex · Franklin Counties'].map(item => (
                <li key={item} className="flex items-center gap-1.5 text-xs text-body/75">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-green shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section >

      {/* SCROLLING SECTIONS LAYER */}
      <div className="relative z-20 bg-navy" >

        {/* TRUST BAR */}
        <div className="border-y border-white/6 bg-navy" >
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col items-center gap-3">

            <p className="text-xs tracking-[0.18em] uppercase text-accent">
              Owner-operated · Certified
            </p>
            <p>North Country Area</p>

            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">

              {[
                { num: '3', label: 'Counties served' },
                { num: 'Same-day', label: 'Callbacks' },
                { num: '100%', label: 'Owner-supervised' },
                { num: 'Certified', label: 'Installer' },
              ].map(stat => (
                <div key={stat.num} className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl text-body">{stat.num}</span>
                  <span className="text-sm text-accent">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Fading testimonials */}
            <div className="border-t border-white/6 py-6">
              <Testimonials />
            </div>

          </div>
        </div >

        {/*FILTRATION SERVICES */}
        < section id="services" className="bg-navy" >
          <div className="max-w-7xl mx-auto py-16 md:py-24 px-6">
            <p className="text-xs tracking-[0.18em] uppercase text-accent mb-2">What we do</p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-body mb-10 md:mb-12">Full-service water solutions</h2>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={{
                visible: { transition: { staggerChildren: 0.55 } }
              }}
            >
              {[
                {
                  title: 'Well & pump',
                  icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
                  items: [
                    { bold: 'Emergency pump service:', text: ' No water? We diagnose and replace failing pumps fast.' },
                    { bold: 'Pressure tanks:', text: ' Constant pressure solutions for consistent flow.' },
                    { bold: 'Well sanitization:', text: ' Professional treatments to eliminate bacteria and odors.' },
                  ]
                },
                {
                  title: 'Filtration',
                  icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
                  items: [
                    { bold: 'Custom systems:', text: " Engineered for the North Country's unique mineral profile." },
                    { bold: 'UV sterilization:', text: ' 99.9% of pathogens eliminated.' },
                    { bold: 'Iron & sulfur:', text: ' Our fix for rotten egg smells and orange staining.' },
                  ]
                },
                {
                  title: 'Drains & inspection',
                  icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
                  items: [
                    { bold: 'Drain cleaning:', text: ' Professional snaking for stubborn clogs.' },
                    { bold: 'Camera inspection:', text: ' HD video to find pipe issues without guesswork.' },
                    { bold: 'Well blowouts:', text: ' Clearing blockages and restoring flow to your well.' },
                  ]
                },
              ].map(service => (
                <motion.div
                  key={service.title}
                  className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-white/25 transition-colors"
                  variants={{
                    hidden: { opacity: 0, x: 60 },
                    visible: { opacity: 1, x: 0, transition: { duration: 1.2, ease: 'easeOut' } }
                  }}
                >                  <div className="w-10 h-10 rounded-xl bg-blue/15 flex items-center justify-center text-accent mb-4">{service.icon}</div>
                  <h3 className="font-serif text-xl font-normal text-body mb-4">{service.title}</h3>
                  <ul className="list-none flex flex-col gap-2.5 p-0">
                    {service.items.map(item => (
                      <li key={item.bold} className="text-sm text-body/55 leading-relaxed">
                        <strong className="text-body/70 font-semibold">{item.bold}</strong>{item.text}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section >

        {/*PLUMBING SERVICES*/}
        < section id="plumbing" className="bg-navy-600" >
          <div className="max-w-7xl mx-auto py-16 md:py-24 px-6">

            <p className="text-xs tracking-[0.18em] uppercase text-accent mb-2">Plumbing services</p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-body mb-10 md:mb-12">Plumbing & pipe work</h2>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={{
                visible: { transition: { staggerChildren: 0.55 } }
              }}
            >              {[
              {
                title: 'Repairs & leaks',
                icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>,
                items: [
                  { bold: 'Leak detection:', text: ' Pinpointing hidden leaks before they cause damage.' },
                  { bold: 'Pipe repair:', text: ' Burst, frozen, or corroded lines fixed fast.' },
                  { bold: 'Emergency calls:', text: ' Same-day response when water is where it shouldn\'t be.' },
                ]
              },
              {
                title: 'Fixtures & installs',
                icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2v6M9 5h6M6 11h12v3a6 6 0 01-12 0z" /><line x1="12" y1="20" x2="12" y2="22" /></svg>,
                items: [
                  { bold: 'Faucets & sinks:', text: ' Supply and install for kitchen and bath.' },
                  { bold: 'Toilets & vanities:', text: ' Upgrades and replacements done clean.' },
                  { bold: 'Water heaters:', text: ' Tank and tankless installs and service.' },
                ]
              },
              {
                title: 'Lines & remodels',
                icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4v16M4 8h10a3 3 0 013 3v0a3 3 0 01-3 3H8" /></svg>,
                items: [
                  { bold: 'Repipes:', text: ' Full or partial replacement of aging plumbing.' },
                  { bold: 'New construction:', text: ' Rough-in and finish work for builds and additions.' },
                  { bold: 'Remodel plumbing:', text: ' Relocating lines for kitchen and bath projects.' },
                ]
              },
            ].map(service => (
              <motion.div
                key={service.title}
                className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-white/25 transition-colors"
                variants={{
                  hidden: { opacity: 0, x: 60 },
                  visible: { opacity: 1, x: 0, transition: { duration: 1.2, ease: 'easeOut' } }
                }}
              >                   <div className="w-10 h-10 rounded-xl bg-blue/15 flex items-center justify-center text-accent mb-4">{service.icon}</div>
                <h3 className="font-serif text-xl font-normal text-body mb-4">{service.title}</h3>
                <ul className="list-none flex flex-col gap-2.5 p-0">
                  {service.items.map(item => (
                    <li key={item.bold} className="text-sm text-body/55 leading-relaxed">
                      <strong className="text-body/70 font-semibold">{item.bold}</strong>{item.text}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
            </motion.div>
          </div>
        </section >

        {/* PRODUCT DESCRIPTIONS */}
        < section id="products" className="border-t border-white/5 bg-navy" >
          <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
            <p className="text-sm tracking-[0.18em] uppercase text-accent mb-2">What we install</p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-body mb-10 md:mb-12">Water solutions for every home</h2>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={{
                visible: { transition: { staggerChildren: 0.55 } }
              }}
            >               {[
              { title: 'Traditional Water Softener', description: 'Removes the hard water minerals that cause limescale buildup, stained fixtures, spotty dishes, and damage to your pipes and appliances.', badge: 'Most popular' },
              { title: 'Salt-Free Water Conditioner', description: 'No salt, no electricity, no maintenance. Conditions your water and prevents scale buildup for 5-6 years — a true set it and forget it solution.', badge: null },
              { title: 'Chloramine Reduction Solution', description: 'Filters chloramines, chlorine, hydrogen sulfide, and other chemicals from every tap in your home — drinking, cooking, and bathing.', badge: null },
            ].map(product => (

              <motion.div
                key={product.title}
                className="bg-white/3 border border-white/10 rounded-2xl p-6  hover:border-white/25 transition-colors"
                variants={{
                  hidden: { opacity: 0, x: 60 },
                  visible: { opacity: 1, x: 0, transition: { duration: 1.2, ease: 'easeOut' } }
                }}
              >
                {product.badge && <span className="self-start text-[11px] font-semibold tracking-wide uppercase bg-blue/20 text-accent px-3 py-1 rounded-full">{product.badge}</span>}

                <h3 className="font-serif text-xl font-normal text-body pt-2">{product.title}</h3>
                <p className="text-xs text-body/65 leading-relaxed flex-1">{product.description}</p>
                <a href="#contact" className="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/15 text-body/70 text-sm font-medium px-4 py-2 mt-2 rounded-xl no-underline transition-colors">Get a quote</a>              </motion.div>

            ))}
            </motion.div>
          </div>
        </section >

        {/* ABOUT */}
        < div id="about" className="border-t border-white/5 bg-navy-drawer" >
          <div className="max-w-7xl mx-auto px-6 py-16 flex gap-6 md:gap-12 items-center flex-col md:flex-row">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-blue/20 flex items-center justify-center text-accent">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xs tracking-[0.18em] uppercase text-accent mb-2">The man behind it all</p>
              <p className="text-body/80 text-sm md:text-base leading-relaxed max-w-2xl">
                Born and raised in the North Country — I know these mountains, these wells, and these winters. I'm on every job personally, and no matter what it takes, we stay on it until it's solved.
              </p>
            </div>
          </div>
        </div >

        {/* CONTACT */}
        < section id="contact" className="border-t border-white/5 bg-navy" >
          <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-14 items-start">
            <div>
              <p className="text-xs tracking-[0.18em] uppercase text-accent mb-2">Get in touch</p>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-body mb-4">Call for service.</h2>
              <p className="text-sm text-body/80 leading-relaxed mb-6 md:mb-8">
                Call, text, or drop us a message. We're out in the field dawn to dusk — and whatever time you reach us, you'll always get our standard rate. No after-hours markup, ever.
              </p>
              <ul className="list-none flex flex-col gap-4 p-0">
                <li className="flex items-center gap-3 text-sm text-body/65">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-accent shrink-0">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
                  </span>
                  <a href="tel:+15185349949" className="no-underline text-body/60 hover:text-body transition-colors">(518) 534-9949</a>
                </li>
                <li className="flex items-center gap-3 text-sm text-body/60">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-accent shrink-0">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                  </span>
                  <a href="mailto:contact@adkadvancedwatersolutions.com" className="no-underline text-body/60 hover:text-body transition-colors">contact@adkadvancedwatersolutions.com</a>                </li>
                <li className="flex items-center gap-3 text-sm text-body/60">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-accent shrink-0">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                  </span>
                  Clinton · Franklin · Essex Counties
                </li>
              </ul>
            </div>



            {/*CONTACT FORM*/}
            <div className="bg-white/3 border border-white/5 rounded-2xl p-6">
              <ContactForm />
            </div>
          </div>
        </section >

        {/* GALLERY */}
        <section id="gallery" className="border-t border-white/5 bg-navy-600">
          {/* VAN BANNER */}
          <div className="relative w-full h-56 md:h-80 overflow-hidden">
            <img src={vanFull} alt="Adirondack Advanced Water Solutions service van" className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-600 via-navy-600/30 to-transparent" />
          </div>

          <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
            <p className="text-xs tracking-[0.18em] uppercase text-accent mb-2">Our work</p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-body mb-10 md:mb-12">Serving our neighbors, one job at a time</h2>
            <Gallery />
          </div>
        </section>


        {/*COMMENT FORM */}
        < section className="border-t border-white/5 bg-navy-600" >
          <div className="max-w-2xl mx-auto px-6 py-16 md:py-24">
            <p className="text-xs tracking-[0.18em] uppercase text-accent mb-2 text-center">Share your story</p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-body mb-3 text-center">Leave a comment</h2>
            <p className="text-sm text-body/60 leading-relaxed mb-8 text-center">
              Had work done? Tell your neighbors about it.
            </p>
            <CommentForm />
          </div>
        </section >


        {/* FOOTER */}
        < footer className="pb-30 border-t border-white/5 bg-navy-dark" >
          <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col items-center text-center gap-1">
            <h3 className="font-serif text-xl font-normal text-body">Adirondack Advanced</h3>
            <p className="text-xs tracking-[0.14em] uppercase text-accent mb-4">Water Solutions</p>
            <p className="text-sm text-body/50">Serving counties — Clinton · Essex · Franklin</p>
            <p className="text-sm text-body/50 mb-4">
              <a href="tel:+15185349949" className="no-underline text-body/60 hover:text-body transition-colors">(518) 534-9949</a>
              {' · '}
              <a href="mailto:contact@adkadvancedwatersolutions.com" className="no-underline text-body/60 hover:text-body transition-colors">contact@adkadvancedwatersolutions.com</a>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs text-body/25">
              <span>© 2026 Adirondack Advanced Water Solutions</span>
              <span className="hidden sm:inline">·</span>
              <span>Owner-Operated</span>
            </div>
          </div>
        </footer >

      </div >
    </div >
  )
}