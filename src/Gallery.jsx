import { useState, useEffect } from 'react'
import { sanityClient, urlFor } from './sanityClient'

export default function Gallery() {
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        sanityClient
            .fetch(`*[_type == "project"] | order(order asc, createdAt desc){
        _id, caption, customCaption, image1, image2, image3, video
      }`)
            .then((data) => {
                setProjects(data)
                setLoading(false)
            })
            .catch((err) => {
                console.error('Could not load projects:', err)
                setLoading(false)
            })
    }, [])

    if (loading) return null
    if (!projects.length) return null

    return (
        <div className="grid grid-cols-1 gap-8">
            {projects.map((project) => {
                const caption = project.caption === 'custom' ? project.customCaption : project.caption
                const images = [project.image1, project.image2, project.image3].filter(Boolean)
                const smallImages = project.video ? images : images.slice(1)

                return (
                    <div key={project._id} className="bg-white/3 border border-white/5 rounded-2xl p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Big slot: video (if present) or first image */}
                            <div className="relative rounded-xl overflow-hidden bg-navy-600 aspect-video md:aspect-auto md:min-h-75">
                                {project.video ? (
                                    <VideoEmbed url={project.video} />
                                ) : (
                                    images[0] && (
                                        <img
                                            src={urlFor(img).width(600).format('webp').quality(75).url()}
                                            alt={caption || 'Service photo'}
                                            className="w-full h-full object-cover"
                                        />
                                    )
                                )}
                            </div>

                            {/* Small images */}
                            <div className="grid grid-cols-2 gap-4">
                                {smallImages.map((img, i) => {
                                    // If there's an odd one out (3rd image), make it span full width
                                    const isLastOdd = smallImages.length % 2 === 1 && i === smallImages.length - 1
                                    return (
                                        <img
                                            key={i}
                                            src={urlFor(img).width(600).format('webp').quality(75).url()}
                                            alt={caption || 'Service photo'}
                                            className={`w-full h-full object-cover rounded-xl ${isLastOdd ? 'col-span-2 aspect-video' : 'aspect-square'}`}
                                        />
                                    )
                                })}
                            </div>
                        </div>

                        {/* Caption pill — bottom center */}
                        {caption && (
                            <div className="mt-4 flex justify-center">
                                <span className="text-[11px] font-semibold tracking-wide uppercase bg-blue/20 text-accent px-4 py-1.5 rounded-full">
                                    {caption}
                                </span>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function VideoEmbed({ url }) {
    const embedUrl = getEmbedUrl(url)
    if (!embedUrl) return null
    return (
        <iframe
            src={embedUrl}
            className="w-full h-full min-h-60"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Service video"
        />
    )
}

function getEmbedUrl(url) {
    if (!url) return null
    // YouTube (watch, youtu.be, and shorts)
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/)
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`
    // Vimeo
    const vimeo = url.match(/vimeo\.com\/(\d+)/)
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
    return null
}