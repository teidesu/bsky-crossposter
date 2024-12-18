import { readCar } from '@atcute/car'
import * as CBOR from '@atcute/cbor'
import { ffetchBase } from '@fuman/fetch'
import { getUserPds } from './identity.ts'

export async function getRecord(params: {
    did: string
    collection: string
    rkey: string
}): Promise<unknown | null> {
    const { did, rkey, collection } = params
    const res = await ffetchBase('/xrpc/com.atproto.sync.getRecord', {
        baseUrl: await getUserPds(did),
        query: {
            did,
            rkey,
            collection,
        },
        validateResponse: res => res.status === 200 || res.status === 404,
    })

    if (res.status === 404) return null

    const car = readCar(new Uint8Array(await res.arrayBuffer()))
    for (const it of car.iterate()) {
        const decoded = CBOR.decode(it.bytes)
        if (!('$type' in decoded)) continue
        if (decoded.$type !== collection) continue

        return decoded
    }

    return null
}

export async function getBlobUrl(did: string, cid: string) {
    const pds = await getUserPds(did)
    return new URL(`/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`, pds).href
}

export function getPostUrl(params: { did: string, rkey: string }) {
    return `https://bsky.app/profile/${params.did}/post/${params.rkey}`
}

export function parseAtUri(uri: string) {
    if (!uri.startsWith('at://')) throw new Error('not an at uri')

    const [did, collection, rkey] = uri.slice(5).split('/')
    if (!did || !collection || !rkey) throw new Error('invalid at uri')

    return { did, collection, rkey }
}
