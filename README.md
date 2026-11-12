# Valythm

Two phones, one loop. One phone has the microphone, the other is plugged into the speaker.

- **`/` — Record.** One button. Record up to 25 seconds, listen back, optionally name it, then add it to the loop. A small link leads to the second page.
- **`/listen` — The loop.** Every recording, played back to back and looping forever. New recordings appear on their own within a few seconds and join without interrupting playback. Tap play once to start (browsers require a tap before sound). The screen stays awake while it plays.

The recording limit lives in `lib/constants.ts` (`MAX_SECONDS`).

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Locally, recordings are saved in `.valythm-data/`; delete that folder to start over.

Phones can only use the microphone over **https**, so to try it with real phones before deploying, put the dev server behind a tunnel (for example `npx cloudflared tunnel --url http://localhost:3000`) and open the https address it prints on both phones.

## Deploy to Vercel

Vercel functions can't keep files, so the shared recordings live in Upstash Redis (free tier is plenty):

1. In the Vercel project, open **Storage → Create Database → Upstash (Redis)**, create it, and connect it to this project. This adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables.
2. Redeploy.

Without that store, the deployed site loads but sending a recording shows "Storage is not set up yet."

## How it works

- Recordings are converted in the browser to small mono WAV files (32 kHz), so every phone can play them back, and uploaded to `/api/segments`.
- The listen page polls `/api/segments` every 2.5 s and schedules each recording on the Web Audio clock, so the seams are gapless and the loop wraps seamlessly.
- Removing a recording on the listen page (tap ×, then *Remove*) deletes it for everyone.
