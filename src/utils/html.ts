import type { BlueskyPost } from '../bluesky/definitions.ts'
import type { JetStreamEvent } from '../jetstream/definitions.ts'
import { utf8 } from '@fuman/utils'
import { getPostUrl } from '../bluesky/utils.ts'

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

export function makeLinkToOriginalPost(event: JetStreamEvent, text: string): string {
    if (event.kind !== 'commit' || !event.commit.rkey) throw new Error('not a commit')

    return `<a href="${getPostUrl({ did: event.did, rkey: event.commit.rkey })}">${escapeHtml(text)}</a>`
}

export function formatPostText(post: BlueskyPost): string {
    if (!post.facets?.length) return escapeHtml(post.text)

    let result = ''
    let bytePos = 0

    const encodedText = utf8.encoder.encode(post.text)

    for (const facet of post.facets) {
        result += utf8.decoder.decode(encodedText.subarray(bytePos, facet.index.byteStart))

        let content = escapeHtml(
            utf8.decoder.decode(encodedText.subarray(facet.index.byteStart, facet.index.byteEnd)),
        )

        for (const feature of facet.features) {
            switch (feature.$type) {
                case 'app.bsky.richtext.facet#link': {
                    content = `<a href="${feature.uri}">${content}</a>`
                    break
                }
                case 'app.bsky.richtext.facet#mention': {
                    content = `<a href="https://bsky.app/profile/${feature.did}">${content}</a>`
                    break
                }
                case 'app.bsky.richtext.facet#hashtag': {
                    content = `<a href="https://bsky.app/profile/${feature.tag}">${content}</a>`
                    break
                }
            }
        }

        result += content
        bytePos = facet.index.byteEnd
    }

    if (bytePos < encodedText.length) {
        result += utf8.decoder.decode(encodedText.subarray(bytePos))
    }

    return result
}
