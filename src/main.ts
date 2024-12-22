import * as v from '@badrap/valita'
import { AsyncLock } from '@fuman/utils'
import * as config from '../config.ts'
import { JetStreamClient } from './jetstream/client.ts'
import { getKv, setKv } from './utils/kv.ts'

const CURSOR_KV_KEY = 'jetstream_cursor'

const js = new JetStreamClient({
    wantedDids: config.watchedDids,
    wantedCollections: ['app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.like'],
    startCursor: getKv(CURSOR_KV_KEY, v.string()),
    startCursorExclusive: true,
    url: (config as { jetstreamUrl?: string }).jetstreamUrl,
})

js.onConnect.add(() => {
    console.log('[i] connected to jetstream')
})
js.onDisconnect.add(() => {
    console.log('[i] disconnected from jetstream')
})

const lock = new AsyncLock()
js.onEvent.add((event) => {
    if (event.kind !== 'commit') return
    setKv(CURSOR_KV_KEY, event.time_us)

    console.log('[i] received %s commit to at://%s/%s (time_us=%s)', event.commit.operation, event.did, event.commit.collection, event.time_us)

    lock.acquire()
        .then(() => config.handler(event))
        .catch((err) => {
            console.error('failed to handle event', event)
            console.log(err)
        })
        .finally(() => lock.release())
})

js.connect()
