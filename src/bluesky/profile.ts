import * as v from '@badrap/valita'
import { asNonNull } from '@fuman/utils'
import { getRecord } from './utils.ts'

const Profile = v.object({
    $type: v.literal('app.bsky.actor.profile'),
    // there are also banner/avatar/pinnedPost but i don't care enough
    description: v.string().optional(),
    displayName: v.string().optional(),
})
export type Profile = v.Infer<typeof Profile>

export async function getProfile(did: string) {
    const record = await getRecord({
        did,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
    })

    return Profile.parse(asNonNull(record), { mode: 'passthrough' })
}
