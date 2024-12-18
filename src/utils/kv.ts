import type * as v from '@badrap/valita'
import { eq } from 'drizzle-orm/expressions'
import { db } from '../db/db.ts'
import { kv } from '../db/schema.ts'

export function getKv<T extends v.Type<any>>(key: string, parser: T): v.Infer<T> | undefined {
    const json = db
        .select({ value: kv.value })
        .from(kv)
        .where(eq(kv.key, key))
        .get()
    if (!json) return

    return parser.parse(json.value)
}

export function setKv(key: string, value: unknown) {
    return db
        .insert(kv)
        .values({ key, value })
        .onConflictDoUpdate({
            target: kv.key,
            set: { value },
        })
        .execute()
}
