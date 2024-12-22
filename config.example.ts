import type { EventHandler } from './src/utils/handler.ts'
import { assert } from '@fuman/utils'
import { extractRecordFromEvent } from './src/bluesky/definitions.ts'
import { getPostThreadgateFor } from './src/bluesky/threadgate.ts'
import { makeLinkToOriginalPost } from './src/utils/html.ts'
import { crosspostToTelegram } from './src/utils/telegram.ts'

// did-s of accounts which events will be listened to.
// this means that on every new post on one of these accounts, the `handler` function will be called.
//
// you can find out your did by looking at the response of this api call:
// https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=bsky.app (replace `bsky.app` with your handle)
// it will most likely be a string starting with `did:plc:`
export const watchedDids = ['did:web:tei.su']

// optional: custom jetstream url
// export const jetstreamUrl = 'wss://jetstream.cerulea.blue'

// the function that will be called when an event is received. usually a post, but is also triggered for reposts and likes
export const handler: EventHandler = async (event) => {
    // skip if it's not a post
    if (event.commit.collection !== 'app.bsky.feed.post') return

    // do not crosspost if replies are following-only
    const threadgate = await getPostThreadgateFor(event)
    if (threadgate && threadgate.allow.some(it => it.$type === 'app.bsky.feed.threadgate#followingRule')) {
        return
    }

    // ignore posts ending with a dot
    const post = extractRecordFromEvent(event)
    assert(post?.$type === 'app.bsky.feed.post')
    if (post.text.endsWith('.')) return

    // do the crossposting magic (note: reposts and likes are not supported yet by `crosspostToTelegram`)
    await crosspostToTelegram(event, {
        // ID of the Telegram chat to send the message to
        chatId: -100123123123,
        // prepend a tilde with a link to the original post in bluesky
        finalizeText: text => `${makeLinkToOriginalPost(event, '~')} ${text}`,
    })
}
