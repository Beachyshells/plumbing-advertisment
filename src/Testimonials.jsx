import { useState, useEffect } from 'react'
import { sanityClient } from './sanityClient'

export default function Testimonials() {
    const [comments, setComments] = useState([])
    const [index, setIndex] = useState(0)
    const [visible, setVisible] = useState(true)

    // Fetch approved comments from Sanity on mount
    useEffect(() => {
        sanityClient
            .fetch(`*[_type == "comment" && status == "approved"] | order(createdAt desc){
        _id, name, location, comment
      }`)
            .then((data) => setComments(data))
            .catch((err) => console.error('Could not load testimonials:', err))
    }, [])

    // Rotate through comments with a fade
    useEffect(() => {
        if (comments.length <= 1) return
        const interval = setInterval(() => {
            setVisible(false) // start fade out
            setTimeout(() => {
                setIndex((i) => (i + 1) % comments.length)
                setVisible(true) // fade the next one in
            }, 600) // matches the fade duration below
        }, 6000) // each comment shows ~6 seconds
        return () => clearInterval(interval)
    }, [comments])

    // Nothing to show if no approved comments yet
    if (comments.length === 0) return null

    const current = comments[index]

    return (
        <div className="max-w-2xl mx-auto px-6 text-center">
            <div
                style={{
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 0.6s ease-in-out',
                }}
            >
                <p className="font-serif text-lg md:text-xl text-body italic leading-relaxed mb-3">
                    "{current.comment}"
                </p>
                <p className="text-xs tracking-[0.14em] uppercase text-accent">
                    {current.name}{current.location ? ` · ${current.location}` : ''}
                </p>
            </div>
        </div>
    )
}