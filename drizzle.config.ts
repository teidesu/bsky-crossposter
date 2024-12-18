import type { Config } from 'drizzle-kit'

export default {
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'sqlite',
    dbCredentials: {
        url: '.runtime/data.db',
    },
} satisfies Config
