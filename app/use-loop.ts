"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { peaksFor } from "@/lib/audio";
import { POLL_MS } from "@/lib/constants";
import { LoopEngine, type Segment } from "@/lib/loop-engine";
import type { SegmentMeta } from "@/lib/store";

export type Connection = "connecting" | "live" | "offline";

/** The shared loop: polls the server for recordings and plays them back to back. */
export function useLoop() {
  const engine = useRef<LoopEngine | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [playing, setPlaying] = useState(false);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState("");
  const removing = useRef(new Set<string>());

  useEffect(() => {
    const loop = new LoopEngine();
    engine.current = loop;
    loop.onChange = () => { setSegments(loop.segments); setPlaying(loop.playing); };
    const failed = new Set<string>();
    let busy = false, stopped = false;

    const sync = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const response = await fetch("/api/segments", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const { segments: remote } = await response.json() as { segments: SegmentMeta[] };
        setConnection("live");
        const ids = new Set(remote.map(item => item.id));
        for (const segment of loop.segments) if (!ids.has(segment.id)) loop.remove(segment.id);
        for (const item of remote) {
          if (stopped) return;
          if (failed.has(item.id) || removing.current.has(item.id) || loop.segments.some(segment => segment.id === item.id)) continue;
          try {
            const audio = await fetch(`/api/segments/${item.id}`);
            if (!audio.ok) throw new Error();
            const buffer = await loop.context.decodeAudioData(await audio.arrayBuffer());
            if (!stopped) loop.append({ id: item.id, name: item.name, duration: buffer.duration, buffer, peaks: peaksFor(buffer) });
          } catch { failed.add(item.id); }
        }
      } catch {
        setConnection("offline");
      } finally { busy = false; }
    };

    void sync();
    const timer = window.setInterval(sync, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); loop.dispose(); };
  }, []);

  // Keep the speaker phone's screen awake while the loop plays.
  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => { if (document.visibilityState === "visible") navigator.wakeLock.request("screen").then(value => { lock = value; }).catch(() => {}); };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { document.removeEventListener("visibilitychange", acquire); void lock?.release(); };
  }, [playing]);

  const toggle = useCallback(() => { const loop = engine.current; if (loop) { if (loop.playing) loop.pause(); else loop.play(); } }, []);
  const seek = useCallback((fraction: number) => { const loop = engine.current; if (loop) loop.seek(Math.max(0, Math.min(.999, fraction)) * loop.total); }, []);
  const position = useCallback(() => engine.current?.position() ?? 0, []);
  const level = useCallback(() => {
    const analyser = engine.current?.analyser;
    if (!analyser || !engine.current?.playing) return 0;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const value of data) sum += value * value;
    return Math.min(1, Math.sqrt(sum / data.length) * 4);
  }, []);

  const remove = useCallback(async (id: string) => {
    removing.current.add(id);
    engine.current?.remove(id);
    setError("");
    try {
      const response = await fetch(`/api/segments/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Could not remove that recording.");
    } finally { removing.current.delete(id); }
  }, []);

  const total = segments.reduce((sum, segment) => sum + segment.duration, 0);
  return { segments, total, playing, connection, error, setError, toggle, seek, position, level, remove };
}
