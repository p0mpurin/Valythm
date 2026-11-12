"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Pause, Play, RotateCcw, X } from "lucide-react";
import { formatTime } from "@/lib/audio";
import { Header, Shell } from "../header";
import { useLoop } from "../use-loop";
import { Waveform } from "../waveform";

const ease = [.22, 1, .36, 1] as const;
const chipWidth = (duration: number) => Math.max(112, Math.min(320, 70 + duration * 10));

export default function ListenPage() {
  const loop = useLoop();
  const [loops, setLoops] = useState(0);
  const [armed, setArmed] = useState<string | null>(null);
  const time = useRef<HTMLSpanElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const latest = useRef(loop);
  useEffect(() => { latest.current = loop; });

  const progress = useCallback(() => loop.total ? loop.position() / loop.total : 0, [loop]);

  // One frame loop drives the clock, the timeline cursor and loop detection without re-rendering React.
  useEffect(() => {
    let frame = 0, last = 0, active = "";
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const { position, segments, total, playing } = latest.current;
      const now = position();
      if (time.current) time.current.textContent = formatTime(now);
      if (playing && last > total - 1.5 && now < 1.5 && now < last) setLoops(count => count + 1);
      last = now;
      let start = 0, current = "";
      for (const segment of segments) {
        const chip = strip.current?.querySelector<HTMLElement>(`[data-id="${segment.id}"]`);
        const inside = now >= start && now < start + segment.duration;
        if (inside) current = segment.id;
        if (chip) {
          chip.dataset.active = String(inside && total > 0);
          const bar = chip.querySelector<HTMLElement>(".segment-progress");
          if (bar) bar.style.transform = `scaleX(${inside ? (now - start) / segment.duration : 0})`;
        }
        start += segment.duration;
      }
      if (current && current !== active && strip.current) {
        const chip = strip.current.querySelector<HTMLElement>(`[data-id="${current}"]`);
        if (chip) strip.current.scrollTo({ left: chip.offsetLeft - strip.current.clientWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
      }
      active = current;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(null), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const empty = loop.segments.length === 0;
  const status = loop.connection === "offline" ? "Offline" : loop.connection === "connecting" ? "Connecting" : "Live";

  return <Shell>
    <Header>
      <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.2em] text-zinc-500">
        <span className="relative flex h-1.5 w-1.5">
          {loop.connection === "live" && <span className="absolute inset-0 animate-ping rounded-full bg-red-600/60 [animation-duration:2.4s]" />}
          <span className={`relative h-1.5 w-1.5 rounded-full ${loop.connection === "live" ? "bg-red-600" : "bg-zinc-700"}`} />
        </span>
        {status}
      </span>
    </Header>

    <section className="relative flex flex-1 flex-col justify-center py-12 sm:py-20">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, ease }} className="mx-auto w-full max-w-[1110px]">
        <div className="relative border-y border-white/[.075] py-2 sm:py-4">
          <div className="pointer-events-none absolute right-0 top-5 flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-zinc-600"><span className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${loop.playing ? "bg-red-600 shadow-[0_0_10px_#dc2626]" : "bg-zinc-700"}`} />{loop.playing ? "Playing" : "Ready"}</div>
          <Waveform shapes={loop.segments} progress={progress} level={loop.level} onSeek={loop.seek} />
          <AnimatePresence>{empty && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .6 }} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-lg font-medium tracking-[-.03em] text-white sm:text-xl">Waiting for the first voice</p>
            <p className="mt-2 text-xs text-zinc-500">Record one on the other phone. It appears here on its own.</p>
          </motion.div>}</AnimatePresence>
          <div className="pointer-events-none absolute bottom-5 left-0 text-[10px] tabular-nums tracking-[.1em] text-zinc-600">0:00</div>
          <div className="pointer-events-none absolute bottom-5 right-0 text-[10px] tabular-nums tracking-[.1em] text-zinc-600">{formatTime(loop.total)}</div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-6 sm:mt-9">
          <div className="flex items-center gap-4">
            <motion.button whileTap={{ scale: .94 }} disabled={empty} onClick={loop.toggle} aria-label={loop.playing ? "Pause" : "Play"}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black transition-[background-color,color,transform] duration-300 hover:scale-105 hover:bg-red-600 hover:text-white disabled:cursor-default disabled:bg-zinc-900 disabled:text-zinc-600 disabled:hover:scale-100">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={loop.playing ? "pause" : "play"} initial={{ opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .6 }} transition={{ duration: .15 }}>
                  {loop.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
            <span className="text-xs tabular-nums text-zinc-500"><span ref={time} className="text-zinc-300">0:00</span><span className="mx-2 text-zinc-700">/</span>{formatTime(loop.total)}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.16em] text-zinc-500">
            <motion.span animate={{ rotate: -360 * loops }} transition={{ duration: 1.4, ease }} className={`transition-colors duration-500 ${loop.playing ? "text-red-600" : ""}`}><RotateCcw size={13} strokeWidth={1.7} /></motion.span> Loop
          </div>
        </div>

        <div className="mt-12 border-t border-white/[.075] pt-8 sm:mt-14">
          <h2 className="mb-5 text-[10px] font-medium uppercase tracking-[.23em] text-zinc-500">Sequence <span className="ml-2 text-zinc-700">/ {loop.segments.length.toString().padStart(2, "0")}</span></h2>
          <div ref={strip} className="scrollbar-none relative flex w-full overflow-x-auto pb-3" aria-label="Recordings">
            {empty && <div className="h-[86px] border-l border-white/10" />}
            <AnimatePresence initial={false}>
              {loop.segments.map((segment, index) => <motion.div key={segment.id} data-id={segment.id}
                initial={{ opacity: 0, width: 0, backgroundColor: "rgba(220,38,38,.22)" }}
                animate={{ opacity: 1, width: chipWidth(segment.duration), backgroundColor: "rgba(255,255,255,.035)" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: .7, ease, backgroundColor: { duration: 2.4 } }}
                className="segment group relative shrink-0 overflow-hidden ml-px border-l border-red-800/70 first:ml-0">
                <div className="min-w-[112px] px-4 py-3.5">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="segment-index text-[10px] tabular-nums tracking-[.12em] text-zinc-600 transition-colors duration-300">{String(index + 1).padStart(2, "0")}</span>
                    <button onClick={() => { if (armed === segment.id) { setArmed(null); void loop.remove(segment.id); } else setArmed(segment.id); }}
                      aria-label={armed === segment.id ? `Confirm removing ${segment.name || `recording ${index + 1}`}` : `Remove ${segment.name || `recording ${index + 1}`}`}
                      className={`-m-1.5 flex items-center gap-1 p-1.5 text-[10px] transition-all duration-300 ${armed === segment.id ? "text-red-500 opacity-100" : "text-zinc-600 opacity-0 hover:text-white group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-60"}`}>
                      {armed === segment.id && <span>Remove</span>}<X size={12} />
                    </button>
                  </div>
                  <div className="segment-name truncate text-xs font-medium text-zinc-400 transition-colors duration-300" title={segment.name}>{segment.name || <span className="text-zinc-600">Untitled</span>}</div>
                  <div className="mt-1 text-[10px] tabular-nums text-zinc-600">{formatTime(segment.duration)}</div>
                </div>
                <span className="segment-progress absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-red-600" />
              </motion.div>)}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>{loop.error && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-5 flex items-center gap-3 text-xs text-red-400"><span className="h-1 w-1 rounded-full bg-red-500" />{loop.error}<button onClick={() => loop.setError("")} aria-label="Dismiss message"><X size={13} /></button></motion.div>}</AnimatePresence>
      </motion.div>
    </section>

    <footer className="flex justify-center pt-6">
      <Link href="/" className="group inline-flex items-center gap-2 py-2 text-[10px] font-medium uppercase tracking-[.22em] text-zinc-500 transition-colors duration-300 hover:text-white">
        <ArrowLeft size={12} className="transition-transform duration-300 group-hover:-translate-x-1" /> Record
      </Link>
    </footer>
  </Shell>;
}
