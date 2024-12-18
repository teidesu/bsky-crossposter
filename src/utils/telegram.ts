import type { MaybePromise } from '@fuman/utils'
import type {
    APIMethodParams,
    APIMethods,
} from '@gramio/types'
import type { ImagesEmbed, RecordEmbed } from '../bluesky/definitions.ts'
import type { JetStreamEvent } from '../jetstream/definitions.ts'
import * as v from '@badrap/valita'
import { ffetchAddons, ffetchBase } from '@fuman/fetch'
import { ffetchValitaAdapter } from '@fuman/fetch/valita'
import { asNonNull } from '@fuman/utils'
import * as d from 'drizzle-orm/expressions'
import { extractRecordFromEvent } from '../bluesky/definitions.ts'
import { getUserDidDocument } from '../bluesky/identity.ts'
import { getProfile } from '../bluesky/profile.ts'

import { getBlobUrl, getPostUrl, parseAtUri } from '../bluesky/utils.ts'
import { db } from '../db/db.ts'
import { forwardedPost } from '../db/schema.ts'
import { escapeHtml, formatPostText } from './html.ts'

const ffetch = ffetchBase.extend({
    baseUrl: `${process.env.TELEGRAM_API_URL ?? 'https://api.telegram.org'}/bot${process.env.TELEGRAM_TOKEN}/`,
    addons: [
        ffetchAddons.retry(),
        ffetchAddons.parser(ffetchValitaAdapter({ mode: 'passthrough' })),
    ],
    retry: {},
    validateResponse: res => res.status !== 500,
})

const ResponseEnvelope = v.union(
    v.object({
        ok: v.literal(true),
        result: v.unknown(),
    }),
    v.object({
        ok: v.literal(false),
        error_code: v.number(),
        description: v.string(),
    }),
)

const api = new Proxy({} as APIMethods, {
    get:
        <T extends keyof APIMethods>(_target: APIMethods, method: T) =>
            async (params: APIMethodParams<T>) => {
                const res = await ffetch(method, { json: params }).parsedJson(ResponseEnvelope)

                if (!res.ok) {
                    throw new Error(`Telegram API error: ${res.error_code}: ${res.description}`)
                }

                return res.result
            },
})

export async function crosspostToTelegram(
    event: JetStreamEvent,
    params: {
        /** id of the chat to send the message to */
        chatId: number
        /**
         * formatter for the quoted post
         *
         * @param uri of the post to quote
         */
        formatQuote?: (uri: string) => Promise<string | null>
        /** position of the quote */
        quotePosition?: 'start' | 'end'
        /**
         * treat quoting own posts as replies
         * @default true
         */
        selfQuoteAsReply?: boolean
        /** finalizer function for the message text */
        finalizeText?: (text: string) => MaybePromise<string>
        /** additional params to be passed to bot api */
        extraParams?: Record<string, unknown>
    },
): Promise<void> {
    const {
        chatId,
        finalizeText = text => text,
        formatQuote = async (uri) => {
            const { did, rkey } = parseAtUri(uri)
            const didDoc = await getUserDidDocument(did)
            const profile = await getProfile(did)

            const handle = didDoc.alsoKnownAs.find(it => it.startsWith('at://'))?.slice(5)

            return `<a href="https://bsky.app/profile/${handle ?? did}/post/${rkey}">quoting ${escapeHtml(profile.displayName || handle || did)}</a>`
        },
        quotePosition = 'start',
        selfQuoteAsReply = true,
        extraParams,
    } = params

    if (event.kind !== 'commit') throw new Error('not a commit')

    if (event.commit.operation === 'delete') {
        const where = d.and(
            d.eq(forwardedPost.did, event.did),
            d.eq(forwardedPost.rkey, asNonNull(event.commit.rkey)),
            d.eq(forwardedPost.tgChatId, chatId),
        )

        const existing = db
            .select({
                tgMsgIds: forwardedPost.tgMsgIds,
            })
            .from(forwardedPost)
            .where(where)
            .get()

        if (!existing) {
            console.log('[i] not deleting post %s as it was not forwarded', event.commit.rkey)
            return
        }

        console.log('[i] deleting post %s from chat %s with ids %s', event.commit.rkey, chatId, existing.tgMsgIds)

        await api.deleteMessages({
            chat_id: chatId,
            message_ids: existing.tgMsgIds,
        })

        await db
            .delete(forwardedPost)
            .where(where)
            .execute()

        return
    }

    // check if we have already crossposted this post
    const existing = db
        .select({
            tgMsgIds: forwardedPost.tgMsgIds,
        })
        .from(forwardedPost)
        .where(d.and(
            d.eq(forwardedPost.did, event.did),
            d.eq(forwardedPost.rkey, asNonNull(event.commit.rkey)),
            d.eq(forwardedPost.tgChatId, chatId),
        ))
        .get()

    if (existing) {
        console.log('[i] post %s was already crossposted to chat %s with ids %s', event.commit.rkey, chatId, existing.tgMsgIds)
        return
    }

    console.log('[i] crossposting post %s to telegram chat %s', event.commit.rkey, chatId)

    const record = extractRecordFromEvent(event)
    if (!record || record.$type !== 'app.bsky.feed.post') {
        // todo we should probably also support reposts
        throw new Error('not a post')
    }

    let text = formatPostText(record)
    const spoiler = record.labels !== undefined && record.labels.values.length > 0

    let images: ImagesEmbed | undefined
    let quote: RecordEmbed | undefined
    let replyToMessageId: number | undefined

    if (record.embed) {
        if (record.embed.$type === 'app.bsky.embed.images') {
            images = record.embed
        } else if (record.embed.$type === 'app.bsky.embed.recordWithMedia') {
            images = record.embed.media
            quote = record.embed.record
        } else if (record.embed.$type === 'app.bsky.embed.record') {
            quote = record.embed
        }
    }

    if (quote && selfQuoteAsReply) {
        const { did } = parseAtUri(quote.record.uri)
        if (did === event.did) {
            // quoting own post, treat as reply
            record.reply = { parent: quote.record, root: quote.record }
            quote = undefined
        }
    }

    if (quote) {
        const formatted = await formatQuote(quote.record.uri)

        if (formatted) {
            if (quotePosition === 'start') {
                text = `${formatted}\n\n${text}`
            } else {
                text = `${text}\n\n${formatted}`
            }
        }
    }

    text = await finalizeText(text)

    if (record.reply) {
        const uri = parseAtUri(record.reply.parent.uri)
        // reply not to a post (is it even possible?), or to another person
        if (uri.collection !== 'app.bsky.feed.post' || uri.did !== event.did) return

        const ids = db.select({
            tgMsgIds: forwardedPost.tgMsgIds,
        })
            .from(forwardedPost)
            .where(d.and(
                d.eq(forwardedPost.did, uri.did),
                d.eq(forwardedPost.rkey, uri.rkey),
                d.eq(forwardedPost.tgChatId, chatId),
            ))
            .get()

        if (!ids) return

        replyToMessageId = ids.tgMsgIds[0]
    }

    let messageIds: number[]
    if (!images || images.images.length === 0) {
        const res = await api.sendMessage({
            text,
            chat_id: chatId,
            reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined,
            parse_mode: 'HTML',
            link_preview_options: {
                is_disabled: quote === undefined,
                url: quote ? getPostUrl(parseAtUri(quote.record.uri)) : undefined,
            },
            ...extraParams,
        })

        messageIds = [res.message_id]
    } else if (images.images.length === 1) {
        const res = await api.sendPhoto({
            caption: text,
            photo: await getBlobUrl(
                event.did,
                images.images[0].image.ref.$link,
            ),
            reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined,
            chat_id: chatId,
            has_spoiler: spoiler,
            parse_mode: 'HTML',
            ...extraParams,
        })

        messageIds = [res.message_id]
    } else {
        const urls = await Promise.all(images.images.map(img => getBlobUrl(event.did, img.image.ref.$link)))
        const res = await api.sendMediaGroup({
            media: urls.map((url, idx) => ({
                type: 'photo',
                media: url,
                caption: idx === 0 ? text : undefined,
                parse_mode: 'HTML',
                has_spoiler: spoiler,
            })),
            reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined,
            chat_id: chatId,
            ...extraParams,
        })

        messageIds = res.map(it => it.message_id)
    }

    console.log('[i] sent post %s to telegram chat %s, ids %s', event.commit.rkey, chatId, messageIds)

    await db
        .insert(forwardedPost)
        .values({
            did: event.did,
            rkey: event.commit.rkey,
            tgChatId: chatId,
            tgMsgIds: messageIds,
        })
        .onConflictDoNothing()
        .execute()
}
