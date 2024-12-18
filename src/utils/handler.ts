import type { JetStreamEvent } from '../jetstream/definitions.ts'

export type EventHandler = (event: Extract<JetStreamEvent, { kind: 'commit' }>) => Promise<void>
