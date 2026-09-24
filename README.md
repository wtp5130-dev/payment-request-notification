# Validate Watch

A small Next.js landing page and webhook receiver for ClickUp list `901816752697`. It records a task when its status changes to `Validate` (`sc901816752697_xMTGXVI`) and shows the latest matching event in the dashboard.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add your ClickUp token and a webhook secret. The token stays server-side.
3. Run `npm run dev` and open `http://localhost:3000`.

The event store is in memory for this lightweight monitor. On Vercel, use a database or KV store if the latest event must survive serverless instance changes.

## ClickUp webhook

Create a ClickUp webhook for task status updates on the target list. Set its endpoint to:

`https://YOUR-VERCEL-DOMAIN.vercel.app/api/clickup/webhook`

Set the webhook secret to the same value as `CLICKUP_WEBHOOK_SECRET`. ClickUp should send its signature in `x-signature`. The receiver accepts only events from the configured list and the Validate status.

## Deploy to Vercel

1. Push this folder to a Git provider and import it at [vercel.com/new](https://vercel.com/new), or run `npx vercel` from the project root.
2. Add the variables from `.env.example` in Vercel project settings.
3. Deploy, then create the ClickUp webhook using the production URL above.

Run `npm run lint` and `npm run build` before deploying.
