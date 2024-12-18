import * as v from '@badrap/valita'

export const common = {
    did: v.string(),
    // NB: we use a custom reviver that converts them to strings, because otherwise it doesn't fit into the JS number range
    // time_us: v.number(),
    time_us: v.string(),
} as const

const JetStreamCommit = v.object({
    rev: v.string(),
    operation: v.union(
        v.literal('create'),
        v.literal('update'),
        v.literal('delete'),
    ),
    collection: v.string(),
    rkey: v.string(),
    cid: v.string(),
    record: v.unknown(),
}).partial()
export type JetStreamCommit = v.Infer<typeof JetStreamCommit>

const JetStreamIdentity = v.object({
    did: v.string(),
    handle: v.string().optional(),
    seq: v.number(),
    time: v.string(),
})
export type JetStreamIdentity = v.Infer<typeof JetStreamIdentity>

const JetStreamAccount = v.object({
    active: v.boolean(),
    did: v.string(),
    seq: v.number(),
    status: v.string().optional(),
    time: v.string(),
})
export type JetStreamAccount = v.Infer<typeof JetStreamAccount>

export const JetStreamEvent = v.union(
    v.object({
        kind: v.literal('commit'),
        commit: JetStreamCommit,
        ...common,
    }),
    v.object({
        kind: v.literal('identity'),
        identity: JetStreamIdentity,
        ...common,
    }),
    v.object({
        kind: v.literal('account'),
        account: JetStreamAccount,
        ...common,
    }),
)
export type JetStreamEvent = v.Infer<typeof JetStreamEvent>

export function parseJetStreamEvent(event: string): JetStreamEvent {
    const json = JSON.parse(event, (key: any, value: any, ctx?: { source: string }) => {
        if (!ctx) throw new Error('ctx is not available in JSON.parse (runtime is not supported)')

        if (key === 'time_us') {
            return ctx.source
        }

        return value
    })

    return JetStreamEvent.parse(json)
}
