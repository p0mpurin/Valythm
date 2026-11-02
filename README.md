# Valythm

A minimalist, browser-local audio loop. Upload audio or record from your microphone; each snippet joins the end of one continuously looping track.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Next.js (usually `http://localhost:3000`).

## Notes

- Audio is decoded and kept in browser memory for the current page session. Reloading clears the sequence.
- Playback uses the Web Audio API. Recordings can be previewed before adding them.
- The UI is built with Next.js, Tailwind CSS, and Framer Motion.

## Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import `p0mpurin/Valythm` from GitHub.
2. Keep **Framework Preset: Next.js** and **Root Directory: `./`**. Use the default build and output settings.
3. Click **Deploy**. No environment variables are required.

Vercel will deploy later pushes to `main` automatically once the GitHub integration is connected. Microphone recording requires a secure origin, which the Vercel deployment provides.
