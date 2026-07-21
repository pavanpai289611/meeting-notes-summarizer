# Deploying to Render

This repo includes a [`render.yaml`](./render.yaml) Blueprint, so Render can pick up the
build/start commands and the required environment variable automatically — connect the repo
and set one secret, then deploy.

## Steps

1. Push this repo to GitHub (if it isn't there already).
2. In the [Render dashboard](https://dashboard.render.com), click **New** → **Blueprint**.
3. Connect your GitHub account (if not already connected) and select this repository.
4. Render detects `render.yaml` and shows the `meeting-notes-summarizer` web service it
   defines (`buildCommand: npm run build`, `startCommand: npm start`). Confirm it.
5. Render prompts you to fill in **`ANTHROPIC_API_KEY`** — it's marked `sync: false` in
   `render.yaml` specifically so it's never stored in the file or in git. Paste your real
   Anthropic API key here, directly in the dashboard, nowhere else.
6. Click **Deploy**. Render runs `npm run build` (installs and builds the client, producing
   `client/dist`), then `npm start` (starts the Express server, which serves both
   `/api/summarize` and the built frontend on the port Render assigns via `PORT`).
7. Once the deploy finishes, open the assigned `*.onrender.com` URL — the app should load, and
   pasting a real transcript and clicking Summarize should return a real structured summary.

**If you'd rather not use the Blueprint flow:** **New** → **Web Service** → connect the repo →
set Build Command to `npm run build` and Start Command to `npm start` → add the
`ANTHROPIC_API_KEY` environment variable manually under the service's **Environment** tab →
deploy.

## Free tier note

If this service is on Render's free plan, it spins down after a period of inactivity — the
first request after being idle takes roughly 30–60 seconds while the instance cold-starts.
Subsequent requests are fast until it goes idle again.
