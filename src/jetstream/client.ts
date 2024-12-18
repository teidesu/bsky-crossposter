import type { WebSocketConnectionFramed } from '@fuman/net'
import type { JetStreamEvent } from './definitions.ts'
import { connectWsFramed, PersistentConnection } from '@fuman/net'
import { Emitter } from '@fuman/utils'
import { parseJetStreamEvent } from './definitions.ts'

const DEFAULT_URLS = [
    'wss://jetstream1.us-east.bsky.network',
    'wss://jetstream2.us-east.bsky.network',
    'wss://jetstream1.us-west.bsky.network',
    'wss://jetstream2.us-west.bsky.network',
]

export interface JetStreamClientOptions {
    url?: string
    wantedDids?: string[]
    wantedCollections?: string[]
    maxMessageSizeBytes?: string[]
    startCursor?: string
}

export class JetStreamClient {
    #cursor?: string
    #endpoint: string
    #connection: PersistentConnection<URL, WebSocketConnectionFramed>

    readonly onConnect = new Emitter<void>()
    readonly onDisconnect = new Emitter<void>()
    readonly onEvent = new Emitter<JetStreamEvent>()

    constructor(private readonly options: JetStreamClientOptions = {}) {
        this.#cursor = options.startCursor
        this.#endpoint = options.url ?? DEFAULT_URLS[Math.floor(Math.random() * DEFAULT_URLS.length)]

        this.#connection = new PersistentConnection({
            connect: (url) => {
                // we need to update cursor when reconnecting
                if (this.#cursor) url.searchParams.set('cursor', this.#cursor)
                return connectWsFramed({ url })
            },
            onOpen: this.#onOpen.bind(this),
            onClose: () => this.onDisconnect.emit(),
        })
    }

    async #onOpen(conn: WebSocketConnectionFramed) {
        this.onConnect.emit()

        while (true) {
            const frame = await conn.readFrame()
            if (typeof frame !== 'string') continue

            try {
                const parsed = parseJetStreamEvent(frame)
                this.onEvent.emit(parsed)

                this.#cursor = parsed.time_us
            } catch (err) {
                console.warn('failed to parse event:', frame)
                console.warn(err)
                continue
            }
        }
    }

    connect() {
        const url = new URL('/subscribe', this.#endpoint)

        for (const did of this.options.wantedDids ?? []) {
            url.searchParams.append('wantedDids', did)
        }
        for (const collection of this.options.wantedCollections ?? []) {
            url.searchParams.append('wantedCollections', collection)
        }

        if (this.options.maxMessageSizeBytes) url.searchParams.append('maxMessageSizeBytes', String(this.options.maxMessageSizeBytes))

        return this.#connection.connect(url)
    }

    close() {
        return this.#connection.close()
    }
}
