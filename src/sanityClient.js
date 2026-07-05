import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const sanityClient = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
})

const builder = imageUrlBuilder(sanityClient)

export function urlFor(source) {
    return builder.image(source)
}