import * as v from '@badrap/valita'
import { AsyncLock } from '@fuman/utils'
import { handler, watchedDids } from '../config.ts'
import { JetStreamClient } from './jetstream/client.ts'
import { getKv, setKv } from './utils/kv.ts'

const CURSOR_KV_KEY = 'jetstream_cursor'

const js = new JetStreamClient({
    wantedDids: watchedDids,
    wantedCollections: ['app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.like'],
    startCursor: getKv(CURSOR_KV_KEY, v.string()),
})

const lock = new AsyncLock()
js.onEvent.add((event) => {
    if (event.kind !== 'commit') return
    setKv(CURSOR_KV_KEY, event.time_us)

    lock.acquire()
        .then(() => handler(event))
        .catch((err) => {
            console.error('failed to handle event', event)
            console.log(err)
        })
        .finally(() => lock.release())
})

js.connect()
