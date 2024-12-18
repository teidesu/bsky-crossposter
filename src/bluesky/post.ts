import { BlueskyPost } from './definitions.ts'
import { getRecord, parseAtUri } from './utils.ts'

export async function getPost(params: {
    did: string
    rkey: string
}): Promise<BlueskyPost | null> {
    const { did, rkey } = params
    const res = await getRecord({
        did,
        rkey,
        collection: 'app.bsky.feed.post',
    })

    return res ? BlueskyPost.parse(res) : null
}

export async function getPostByUri(uri: string): Promise<BlueskyPost | null> {
    const { did, collection, rkey } = parseAtUri(uri)
    if (collection !== 'app.bsky.feed.post') return null

    const res = await getRecord({
        did,
        rkey,
        collection,
    })

    return res ? BlueskyPost.parse(res) : null
}
