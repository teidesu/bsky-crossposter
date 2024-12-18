import * as v from '@badrap/valita'
import { ffetchBase } from '@fuman/fetch'
import { Deferred, LruMap } from '@fuman/utils'

const DidDocument = v.object({
    id: v.string(),
    service: v.array(v.object({
        id: v.string(),
        type: v.string(),
        serviceEndpoint: v.string(),
    })),
})

const cache = new LruMap<string, string>(100)
const pending = new Map<string, Promise<string>>()

export async function getUserPds(did: string): Promise<string> {
    if (cache.has(did)) {
        // eslint-disable-next-line ts/no-non-null-assertion
        return cache.get(did)!
    }

    const promise = pending.get(did)
    if (promise) {
        return promise
    }

    const deferred = new Deferred<string>()

    pending.set(did, deferred.promise)

    try {
        let document
        if (did.startsWith('did:web:')) {
            document = await ffetchBase('/.well-known/did.json', {
                baseUrl: `https://${did.replace('did:web:', '')}`,
            }).json()
        } else if (did.startsWith('did:plc')) {
            document = await ffetchBase(`https://plc.directory/${did}`).json()
        } else {
            throw new Error(`Invalid DID: ${did}`)
        }

        const parsed = DidDocument.parse(document, { mode: 'passthrough' })
        if (parsed.id !== did) {
            throw new Error(`DID document did not match DID: ${did}`)
        }

        const pds = parsed.service.find(s => s.type === 'AtprotoPersonalDataServer')
        if (!pds) {
            throw new Error('DID document does not contain a PDS')
        }

        cache.set(did, pds.serviceEndpoint)
        deferred.resolve(pds.serviceEndpoint)

        return pds.serviceEndpoint
    } catch (e) {
        deferred.reject(e)
        pending.delete(did)
        throw e
    }
}
