import { createClient } from '@sanity/client'
import CreateImageUrlBuilder from '@sanity/image-url'

export const sanityClient = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
})

const builder = CreateImageUrlBuilder(sanityClient)

export function urlFor(source) {
    return builder.image(source)
}