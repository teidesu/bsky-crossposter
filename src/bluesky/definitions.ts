import type { JetStreamEvent } from '../jetstream/definitions.ts'
import * as v from '@badrap/valita'
import { DateType } from '../utils/valita.ts'

const ImagesEmbed = v.object({
    $type: v.literal('app.bsky.embed.images'),
    images: v.array(
        v.object({
            alt: v.string().optional(),
            aspectRatio: v.object({
                height: v.number(),
                width: v.number(),
            }).optional(),
            image: v.object({
                $type: v.literal('blob'),
                ref: v.object({
                    $link: v.string(),
                }),
                mimeType: v.string(),
                size: v.number(),
            }),
        }),
    ),
})
export type ImagesEmbed = v.Infer<typeof ImagesEmbed>

const VideoEmbed = v.object({
    $type: v.literal('app.bsky.embed.video'),
    video: v.object({
        $type: v.literal('blob'),
        ref: v.object({
            $link: v.string(),
        }),
        mimeType: v.string(),
        size: v.number(),
    }),
    aspectRatio: v.object({
        height: v.number(),
        width: v.number(),
    }).optional(),
})
export type VideoEmbed = v.Infer<typeof VideoEmbed>

const RecordEmbed = v.object({
    $type: v.literal('app.bsky.embed.record'),
    record: v.object({
        cid: v.string(),
        uri: v.string(),
    }),
})
export type RecordEmbed = v.Infer<typeof RecordEmbed>

const Facet = v.object({
    index: v.object({
        byteStart: v.number(),
        byteEnd: v.number(),
    }),
    features: v.array(
        v.union(
            v.object({
                $type: v.literal('app.bsky.richtext.facet#link'),
                uri: v.string(),
            }),
            v.object({
                $type: v.literal('app.bsky.richtext.facet#mention'),
                did: v.string(),
            }),
            v.object({
                $type: v.literal('app.bsky.richtext.facet#hashtag'),
                tag: v.string(),
            }),
        ),
    ),
})

export const BlueskyPost = v.object({
    $type: v.literal('app.bsky.feed.post'),
    createdAt: DateType,
    langs: v.array(v.string()).optional(),
    reply: v.object({
        parent: v.object({
            cid: v.string(),
            uri: v.string(),
        }),
        root: v.object({
            cid: v.string(),
            uri: v.string(),
        }),
    }).optional(),
    embed: v.union(
        RecordEmbed,
        ImagesEmbed,
        VideoEmbed,
        v.object({
            $type: v.literal('app.bsky.embed.recordWithMedia'),
            media: v.union(ImagesEmbed, VideoEmbed),
            record: RecordEmbed,
        }),
        v.object({
            $type: v.literal('app.bsky.embed.external'),
            external: v.object({
                description: v.string(),
                thumb: v.object({
                    $type: v.literal('blob'),
                    ref: v.object({
                        $link: v.string(),
                    }),
                    mimeType: v.string(),
                    size: v.number(),
                }).optional(),
                title: v.string(),
                uri: v.string(),
            }),
        }),
    ).optional(),
    labels: v.object({
        $type: v.literal('com.atproto.label.defs#selfLabels'),
        values: v.array(
            v.object({ val: v.string() }),
        ),
    }).optional(),
    facets: v.array(Facet).optional(),
    text: v.string(),
})
export type BlueskyPost = v.Infer<typeof BlueskyPost>

export const BlueskyRepost = v.object({
    $type: v.literal('app.bsky.feed.repost'),
    createdAt: v.string(),
    subject: v.object({
        cid: v.string(),
        uri: v.string(),
    }),
})
export type BlueskyRepost = v.Infer<typeof BlueskyRepost>

export const BlueskyLike = v.object({
    $type: v.literal('app.bsky.feed.like'),
    createdAt: v.string(),
    subject: v.object({
        cid: v.string(),
        uri: v.string(),
    }),
})
export type BlueskyLike = v.Infer<typeof BlueskyLike>

export const BlueskyRecord = v.union(
    BlueskyPost,
    BlueskyRepost,
    BlueskyLike,
)
export type BlueskyRecord = v.Infer<typeof BlueskyRecord>

export function extractRecordFromEvent(event: JetStreamEvent): BlueskyRecord | null {
    if (event.kind !== 'commit') return null
    if (!event.commit.record) return null

    try {
        return BlueskyRecord.parse(event.commit.record, { mode: 'passthrough' })
    } catch (err) {
        console.error('failed to parse record', event.commit.record)
        console.log(err)
        return null
    }
}
