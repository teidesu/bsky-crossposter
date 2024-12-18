# bsky-crossposter

simple crossposter from bluesky. currently only supports posting to telegram, though feel free to contribute!

## configuration

this crossposter is configured via code. you can find an example configuration in `config.example.ts` (with comments!).
when deploying, you should make this file available to the app (e.g. by mounting it as a volume).

additionally, you will need to create a Telegram bot and put its token into the `TELEGRAM_TOKEN` environment variable,
and add it to the chat/channel you want to crosspost to.

## development

```bash
echo "export TELEGRAM_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ" > .env
cp config.example.ts config.ts

pnpm i
pnpm exec drizzle-kit migrate
pnpm dev
```

## deployment

a simple docker-compose file is provided, but you can also use the docker image (`ghrc.io/teidesu/bsky-crossposter:latest`) directly.
