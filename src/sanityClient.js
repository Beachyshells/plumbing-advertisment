import { createClient } from '@sanity/client'

export const sanityClient = createClient({
    projectId: 't9p92c4q',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
})