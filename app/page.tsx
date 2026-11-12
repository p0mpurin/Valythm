"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Pause, Play, X } from "lucide-react";
import { formatTime } from "@/lib/audio";
import { MAX_NAME, MAX_SECONDS } from "@/lib/constants";
import { Header, Shell } from "./header";
import { LiveScope } from "./live-scope";
import { useRecorder } from "./use-recorder";
import { Waveform } from "./waveform";

const ease = [.22, 1, .36, 1] as const;
const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: .55, ease } };

export default function RecordPage() {
  const rec = useRecorder();
  const [name, setName] = useState("");
  const ring = useMotionValue(0);
  const ringOpacity = useTransform(ring, value => value > .002 ? 1 : 0);
  const timer = useRef<HTMLSpanElement>(null);
  const recording = rec.phase === "recording";
  const sending = rec.phase === "sending";
  const { elapsed } = rec;
  const view = rec.phase === "review" || sending ? "review" : rec.phase === "sent" ? "sent" : "capture";

  useEffect(() => {
    if (!recording) { const settle = animate(ring, 0, { duration: .7, ease }); return () => settle.stop(); }
    let frame = 0;
    const tick = () => {
      const seconds = elapsed();
      ring.set(seconds / MAX_SECONDS);
      if (timer.current) timer.current.textContent = formatTime(seconds);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [recording, elapsed, ring]);

  return <Shell>
    <Header>
      <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${recording ? "bg-red-600 shadow-[0_0_12px_#dc2626]" : "bg-zinc-700"}`} />
    </Header>

    <section className="flex flex-1 flex-col items-center justify-center py-14">
      <AnimatePresence mode="wait">
        {view === "capture" && <motion.div key="capture" {...fade} className="flex w-full flex-col items-center">
          <p className="mb-12 text-[10px] font-medium uppercase tracking-[.23em] text-zinc-500">{recording ? <span className="text-red-500">Recording</span> : "Leave a voice in the loop"}</p>

          <div className="relative size-[184px] sm:size-[212px]">
            <AnimatePresence>{recording && [0, 1].map(i => <motion.span key={i} className="absolute inset-0 rounded-full border border-red-600/50" initial={{ scale: 1, opacity: 0 }} animate={{ scale: [1, 1.5], opacity: [.55, 0] }} exit={{ opacity: 0 }} transition={{ duration: 2.6, repeat: Infinity, delay: i * 1.3, ease: "easeOut" }} />)}</AnimatePresence>
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth=".5" />
              <motion.circle cx="50" cy="50" r="49" fill="none" stroke="#dc2626" strokeWidth=".9" strokeLinecap="round" style={{ pathLength: ring, opacity: ringOpacity }} />
            </svg>
            <motion.button whileTap={{ scale: .96 }} onClick={recording ? rec.stop : rec.start} disabled={rec.phase === "starting"} aria-label={recording ? "Stop recording" : "Start recording"}
              className="group absolute inset-[14px] flex items-center justify-center rounded-full border border-white/[.09] bg-white/[.012] transition-colors duration-300 hover:border-white/25 hover:bg-white/[.03] disabled:cursor-wait">
              <motion.span animate={recording ? { width: 30, height: 30, borderRadius: 7 } : { width: 46, height: 46, borderRadius: 23 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="block bg-red-600 shadow-[0_0_34px_rgba(220,38,38,.35)] transition-shadow duration-300 group-hover:shadow-[0_0_44px_rgba(220,38,38,.55)]" />
            </motion.button>
          </div>

          <div className="mt-11 text-sm tabular-nums tracking-[.04em]"><span ref={timer} className="text-white">0:00</span><span className="text-zinc-600"> / {formatTime(MAX_SECONDS)}</span></div>
          <div className="mt-6 h-16 w-full max-w-[420px]">
            <AnimatePresence mode="wait">
              {recording
                ? <motion.div key="scope" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .4 }}><LiveScope level={rec.level} /></motion.div>
                : <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-1 text-center text-xs text-zinc-600">{rec.phase === "starting" ? "Waiting for the microphone…" : "Tap to record. You can listen back before sending."}</motion.p>}
            </AnimatePresence>
          </div>
        </motion.div>}

        {view === "review" && rec.take && <motion.div key="review" {...fade} className="w-full max-w-[560px]">
          <div className="mb-5 flex items-baseline justify-between">
            <p className="text-[10px] font-medium uppercase tracking-[.23em] text-zinc-500">Listen back</p>
            <span className="text-xs tabular-nums text-zinc-500">{formatTime(rec.take.duration)}</span>
          </div>
          <div className="border-y border-white/[.075] py-2"><Waveform shapes={[rec.take]} progress={rec.previewProgress} className="h-[120px] sm:h-[150px]" /></div>
          <div className="mt-7 flex items-center gap-5">
            <button onClick={rec.togglePreview} disabled={sending} aria-label={rec.previewing ? "Pause preview" : "Play preview"} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 hover:scale-105 disabled:opacity-40">
              {rec.previewing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <input value={name} onChange={event => setName(event.target.value)} maxLength={MAX_NAME} placeholder="Name it (optional)" aria-label="Recording name" disabled={sending}
              className="h-11 min-w-0 flex-1 border-b border-white/15 bg-transparent text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-red-600" />
          </div>
          <div className="mt-9 flex gap-3">
            <button onClick={rec.discard} disabled={sending} className="flex h-12 flex-1 items-center justify-center gap-2 border border-white/15 text-xs text-zinc-300 transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"><X size={14} /> Discard</button>
            <button onClick={async () => { if (await rec.send(name)) setName(""); }} disabled={sending} className="relative flex h-12 flex-1 items-center justify-center overflow-hidden bg-red-600 text-xs font-medium transition-colors hover:bg-red-700 disabled:cursor-wait">
              {sending && <motion.span className="absolute inset-y-0 left-0 w-1/3 bg-white/15" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />}
              <span className="relative">{sending ? "Sending…" : "Add to the loop"}</span>
            </button>
          </div>
        </motion.div>}

        {view === "sent" && <motion.div key="sent" {...fade} className="flex flex-col items-center text-center">
          <svg viewBox="0 0 52 52" className="size-16" aria-hidden>
            <motion.circle cx="26" cy="26" r="25" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth=".8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .7, ease }} />
            <motion.path d="M17 27l6 6 12-13" fill="none" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .5, delay: .35, ease }} />
          </svg>
          <p className="mt-7 text-xl font-medium tracking-[-.035em]">Added to the loop</p>
          <p className="mt-2 text-xs text-zinc-500">It will play on the speaker in a moment.</p>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>{rec.error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-8 flex max-w-[420px] items-center gap-3 text-center text-xs text-red-400"><span className="h-1 w-1 shrink-0 rounded-full bg-red-500" />{rec.error}</motion.p>}</AnimatePresence>
    </section>

    <footer className="flex justify-center pt-6">
      <Link href="/listen" className="group inline-flex items-center gap-2 py-2 text-[10px] font-medium uppercase tracking-[.22em] text-zinc-500 transition-colors duration-300 hover:text-white">
        Listen to the loop <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </footer>
  </Shell>;
}
