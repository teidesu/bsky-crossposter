import type { JetStreamEvent } from '../jetstream/definitions.ts'
import * as v from '@badrap/valita'
import { DateType } from '../utils/valita.ts'
import { getRecord } from './utils.ts'

const Threadgate = v.object({
    $type: v.literal('app.bsky.feed.threadgate'),
    createdAt: DateType,
    allow: v.array(
        v.union(
            v.object({ $type: v.literal('app.bsky.feed.threadgate#mentionRule') }),
            v.object({ $type: v.literal('app.bsky.feed.threadgate#followingRule') }),
            v.object({
                $type: v.literal('app.bsky.feed.threadgate#listRule'),
                list: v.array(v.string()),
            }),
        ),
    ),
}).rest(v.unknown())
export type Threadgate = v.Infer<typeof Threadgate>

export async function getPostThreadgate(params: {
    did: string
    rkey: string
}): Promise<Threadgate | null> {
    const { did, rkey } = params
    const res = await getRecord({
        did,
        rkey,
        collection: 'app.bsky.feed.threadgate',
    })

    return res ? Threadgate.parse(res) : null
}

export async function getPostThreadgateFor(event: JetStreamEvent): Promise<Threadgate | null> {
    if (event.kind !== 'commit') return null
    if (!event.commit.rkey) return null

    return getPostThreadgate({
        did: event.did,
        rkey: event.commit.rkey,
    })
}
