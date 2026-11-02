# Valythm

A minimalist, browser-local audio loop. Upload audio or record from your microphone; each snippet joins the end of one continuously looping track.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://127.0.0.1:5173`).

## Notes

- Audio is decoded and kept in browser memory for the current page session. Reloading clears the sequence.
- Playback uses the Web Audio API. Recordings can be previewed before adding them.
- The UI is built with Next.js, Tailwind CSS, and Framer Motion. The included Vinext setup is used for Sites hosting.
