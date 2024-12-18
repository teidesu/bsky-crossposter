import * as v from '@badrap/valita'
import { ffetchBase } from '@fuman/fetch'
import { Deferred, LruMap } from '@fuman/utils'

const DidDocument = v.object({
    id: v.string(),
    alsoKnownAs: v.array(v.string()),
    service: v.array(v.object({
        id: v.string(),
        type: v.string(),
        serviceEndpoint: v.string(),
    })),
})
type DidDocument = v.Infer<typeof DidDocument>

const cache = new LruMap<string, DidDocument>(100)
const pending = new Map<string, Promise<void>>()

export async function getUserDidDocument(did: string): Promise<DidDocument> {
    if (cache.has(did)) {
        // eslint-disable-next-line ts/no-non-null-assertion
        return cache.get(did)!
    }

    const promise = pending.get(did)
    if (promise) {
        await promise
        // eslint-disable-next-line ts/no-non-null-assertion
        return cache.get(did)!
    }

    const deferred = new Deferred<void>()

    try {
        let json
        if (did.startsWith('did:web:')) {
            json = await ffetchBase('/.well-known/did.json', {
                baseUrl: `https://${did.replace('did:web:', '')}`,
            }).json()
        } else if (did.startsWith('did:plc')) {
            json = await ffetchBase(`https://plc.directory/${did}`).json()
        } else {
            throw new Error(`Invalid DID: ${did}`)
        }

        const parsed = DidDocument.parse(json, { mode: 'passthrough' })
        if (parsed.id !== did) {
            throw new Error(`DID document did not match DID: ${did}`)
        }

        cache.set(did, parsed)
        deferred.resolve()
        pending.delete(did)

        return parsed
    } catch (e) {
        pending.delete(did)
        deferred.reject(e)
        throw e
    }
}

export async function getUserPds(did: string): Promise<string> {
    const doc = await getUserDidDocument(did)

    const pds = doc.service.find(s => s.type === 'AtprotoPersonalDataServer')
    if (!pds) {
        throw new Error('DID document does not contain a PDS')
    }

    return pds.serviceEndpoint
}
