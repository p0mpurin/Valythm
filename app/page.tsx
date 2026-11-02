"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Mic, Pause, Pencil, Play, Radio, RotateCcw, Square, Upload, X } from "lucide-react";
import { useLoop } from "./use-loop";
import { Waveform } from "./waveform";

type Pending = { blob: Blob; url: string; duration: number };
const fmt = (time: number) => { const n = Math.max(0, Math.floor(time || 0)); return `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`; };

export default function Home() {
  const loop = useLoop();
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [recordingName, setRecordingName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordStart = useRef(0);
  const pendingRef = useRef<Pending | null>(null);
  const segmentCount = useRef(0);
  pendingRef.current = pending;
  segmentCount.current = loop.segments.length;

  useEffect(() => () => { stream.current?.getTracks().forEach(track => track.stop()); if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.url); }, []);
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setRecordSeconds(Math.floor((Date.now() - recordStart.current) / 1000)), 200); return () => clearInterval(timer); }, [recording]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    for (const file of files) {
      if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|ogg|flac|aac|webm)$/i.test(file.name)) { loop.setError(`${file.name} is not an audio file.`); continue; }
      await loop.add(file, file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const startRecording = async () => {
    loop.setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { loop.setError("Recording is not available in this browser."); return; }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic;
      chunks.current = [];
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(value => MediaRecorder.isTypeSupported(value));
      const mediaRecorder = new MediaRecorder(mic, type ? { mimeType: type } : undefined);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        mic.getTracks().forEach(track => track.stop());
        stream.current = null;
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        if (!blob.size) { loop.setError("No audio was captured. Please try again."); return; }
        const url = URL.createObjectURL(blob);
        try {
          const audio = new AudioContext();
          const decoded = await audio.decodeAudioData(await blob.arrayBuffer());
          await audio.close();
          setRecordingName("");
          setPending(old => { if (old) URL.revokeObjectURL(old.url); return { blob, url, duration: decoded.duration }; });
        } catch { URL.revokeObjectURL(url); loop.setError("The recording could not be decoded. Please try again."); }
      };
      mediaRecorder.start();
      recordStart.current = Date.now();
      setRecordSeconds(0);
      setRecording(true);
    } catch (error) {
      loop.setError(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone access was denied. Enable it in your browser to record." : "Could not start the microphone. Please check your audio input.");
    }
  };
  const stopRecording = () => { if (recorder.current?.state === "recording") recorder.current.stop(); setRecording(false); };
  const discard = () => { if (pending) URL.revokeObjectURL(pending.url); setPending(null); };
  const accept = async () => { if (!pending) return; await loop.add(pending.blob, recordingName.trim() || `Recording ${segmentCount.current + 1}`); discard(); };
  const finishRename = (id: string) => { loop.rename(id, draftName); setEditingId(null); };

  return <main className="min-h-screen bg-black text-white selection:bg-red-700/60">
    <div className="mx-auto flex min-h-screen max-w-[1536px] flex-col px-5 pb-7 pt-6 sm:px-10 sm:pt-9 lg:px-[72px]">
      <header className="flex items-center justify-between border-b border-white/[.09] pb-6">
        <div className="flex items-center gap-3"><div className="brand-mark"><span /><span /><span /><span /></div><span className="text-[19px] font-semibold tracking-[-.065em]">valythm<span className="text-red-600">.</span></span></div>
        <span className="h-1.5 w-1.5 rounded-full bg-red-600 shadow-[0_0_12px_#dc2626]" />
      </header>

      <section className="relative flex flex-1 flex-col justify-center py-16 sm:py-20">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }} className="mx-auto w-full max-w-[1110px]">
          <div className="relative border-y border-white/[.075] py-2 sm:py-4">
            <div className="pointer-events-none absolute right-0 top-7 flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-zinc-600"><span className={`h-1.5 w-1.5 rounded-full ${loop.playing ? "bg-red-600 shadow-[0_0_10px_#dc2626]" : "bg-zinc-700"}`} /> {loop.playing ? "PLAYING" : "READY"}</div>
            <Waveform segments={loop.segments} progress={loop.total ? loop.position / loop.total : 0} playing={loop.playing} onSeek={loop.seek} />
            <div className="pointer-events-none absolute bottom-7 left-0 text-[10px] tabular-nums tracking-[.1em] text-zinc-600">{fmt(loop.position)}</div>
            <div className="pointer-events-none absolute bottom-7 right-0 text-[10px] tabular-nums tracking-[.1em] text-zinc-600">{fmt(loop.total)}</div>
          </div>

          <div className="mt-8 flex flex-col gap-7 sm:mt-9 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4"><button disabled={!loop.segments.length} onClick={loop.toggle} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105 hover:bg-red-600 hover:text-white disabled:cursor-default disabled:bg-zinc-800 disabled:text-zinc-500 disabled:hover:scale-100" aria-label={loop.playing ? "Pause" : "Play"}>{loop.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}</button><span className="text-xs tabular-nums text-zinc-500">{fmt(loop.position)} <span className="mx-2 text-zinc-700">/</span> {fmt(loop.total)}</span></div>
            <div className="flex items-center gap-2 self-start text-[10px] font-medium uppercase tracking-[.16em] text-zinc-500 sm:self-auto"><RotateCcw size={13} strokeWidth={1.7} className={loop.playing ? "text-red-600" : ""} /> LOOP</div>
          </div>

          <div className="mt-12 grid gap-8 border-t border-white/[.075] pt-8 sm:mt-14 sm:grid-cols-[1fr_auto] sm:items-start">
            <div><h2 className="mb-5 text-[10px] font-medium uppercase tracking-[.23em] text-zinc-500">SEQUENCE <span className="ml-2 text-zinc-700">/ {loop.segments.length.toString().padStart(2, "0")}</span></h2>
              {loop.segments.length ? <div className="flex w-full overflow-x-auto pb-3 scrollbar-none" aria-label="Audio segments"><AnimatePresence initial={false}>{loop.segments.map((segment, index) => <motion.div key={segment.id} initial={{ opacity: 0, width: 0, x: -10 }} animate={{ opacity: 1, width: Math.max(118, Math.min(280, segment.duration / loop.total * 660)), x: 0 }} exit={{ opacity: 0 }} transition={{ duration: .55, ease: [.22, 1, .36, 1] }} className="min-w-[118px] shrink-0 border-l border-red-800/70 bg-gradient-to-r from-white/[.055] to-white/[.015] px-4 py-3.5 first:rounded-l-sm last:rounded-r-sm"><div className="mb-5 text-[10px] tracking-[.12em] text-zinc-600">{String(index + 1).padStart(2, "0")}</div><div className="flex items-center gap-1.5">{editingId === segment.id ? <input autoFocus aria-label={`Name for segment ${index + 1}`} maxLength={40} value={draftName} onChange={event => setDraftName(event.target.value)} onBlur={() => finishRename(segment.id)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} className="min-w-0 flex-1 border-b border-red-600 bg-transparent text-xs text-white outline-none" /> : <><span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-300" title={segment.name}>{segment.name}</span><button aria-label={`Rename ${segment.name}`} title="Rename segment" onClick={() => { setDraftName(segment.name); setEditingId(segment.id); }} className="shrink-0 text-zinc-600 transition-colors hover:text-white"><Pencil size={11} /></button></>}</div><div className="mt-1 text-[10px] tabular-nums text-zinc-600">{fmt(segment.duration)}</div></motion.div>)}</AnimatePresence></div> : <div className="h-[85px] border-l border-white/10" />}
            </div>
            <div className="flex flex-wrap gap-3 sm:pt-7"><input ref={fileInput} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm" multiple className="hidden" onChange={upload} /><button onClick={() => fileInput.current?.click()} className="action-button flex h-12 items-center justify-center gap-2.5 border border-white/20 px-5 text-xs font-medium transition-all hover:border-white/55 hover:bg-white/5"><Upload size={15} strokeWidth={1.7} /> Upload audio</button><button onClick={recording ? stopRecording : startRecording} className={`action-button flex h-12 items-center justify-center gap-2.5 px-5 text-xs font-medium transition-all ${recording ? "bg-red-700 hover:bg-red-600" : "bg-red-600 hover:bg-red-700"}`}>{recording ? <Square size={13} fill="currentColor" /> : <Mic size={15} strokeWidth={1.8} />}{recording ? `Stop · ${fmt(recordSeconds)}` : "Record audio"}</button></div>
          </div>
          <AnimatePresence>{loop.error && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-5 flex items-center gap-3 text-xs text-red-400"><span className="h-1 w-1 rounded-full bg-red-500" />{loop.error}<button onClick={() => loop.setError("")} aria-label="Dismiss message"><X size={13} /></button></motion.div>}</AnimatePresence>
        </motion.div>
      </section>
    </div>

    <AnimatePresence>{recording && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-red-900/50 bg-[#150707] px-5 py-3 shadow-[0_12px_45px_rgba(0,0,0,.6)]"><span className="record-pulse h-2 w-2 rounded-full bg-red-500" /><span className="whitespace-nowrap text-xs text-zinc-200">Recording · {fmt(recordSeconds)}</span><button onClick={stopRecording} className="ml-3 text-xs text-red-400 hover:text-white">Finish</button></motion.div>}</AnimatePresence>
    <AnimatePresence>{pending && <motion.div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-5 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ opacity: 0, y: 20, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="w-full max-w-md border border-white/15 bg-[#0b0b0c] p-7 shadow-2xl sm:p-9"><div className="mb-8 flex items-start justify-between"><div><div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-red-500"><Radio size={13} /> CAPTURE COMPLETE</div><h3 className="text-2xl font-medium tracking-[-.045em]">Keep this segment?</h3><p className="mt-2 text-xs text-zinc-500">Preview your {fmt(pending.duration)} recording before adding it.</p></div><button onClick={discard} aria-label="Close preview" className="text-zinc-600 hover:text-white"><X size={18} /></button></div><audio controls src={pending.url} className="w-full accent-red-600" /><label htmlFor="recording-name" className="mt-7 block text-[10px] uppercase tracking-[.18em] text-zinc-500">Segment name <span className="normal-case tracking-normal text-zinc-700">(optional)</span></label><input id="recording-name" type="text" maxLength={40} value={recordingName} onChange={event => setRecordingName(event.target.value)} placeholder={`Recording ${segmentCount.current + 1}`} className="mt-2 h-11 w-full border-b border-white/20 bg-transparent text-sm text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-red-600" /><div className="mt-8 flex gap-3"><button onClick={discard} className="flex h-11 flex-1 items-center justify-center gap-2 border border-white/20 text-xs text-zinc-300 hover:bg-white/5"><X size={14} /> Discard</button><button onClick={accept} className="flex h-11 flex-1 items-center justify-center gap-2 bg-red-600 text-xs font-medium hover:bg-red-700"><Check size={14} /> Add to sequence</button></div></motion.div></motion.div>}</AnimatePresence>
  </main>;
}
