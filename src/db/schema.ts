import * as d from 'drizzle-orm/sqlite-core'

export const forwardedPost = d.sqliteTable('bluesky_fwd_post', {
    did: d.text('did'),
    rkey: d.text('rkey'),
    tgChatId: d.int('tg_chat_id').notNull(),
    tgMsgIds: d.text('telegram_msg_ids', { mode: 'json' }).$type<number[]>().notNull(),
}, t => ({
    pk: d.primaryKey({
        columns: [t.did, t.rkey],
    }),
}))

export const kv = d.sqliteTable('kv', {
    key: d.text('key').primaryKey(),
    value: d.text('value', { mode: 'json' }).notNull(),
})
