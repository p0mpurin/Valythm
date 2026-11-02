"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Segment = { id: string; name: string; duration: number; buffer: AudioBuffer; peaks: number[] };

function peaksFor(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0);
  return Array.from({ length: 240 }, (_, i) => {
    const start = Math.floor(i * data.length / 240);
    const end = Math.floor((i + 1) * data.length / 240);
    const stride = Math.max(1, Math.floor((end - start) / 40));
    let max = 0;
    for (let j = start; j < end; j += stride) max = Math.max(max, Math.abs(data[j]));
    return Math.min(1, max);
  });
}

export function useLoop() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState("");
  const segmentsRef = useRef<Segment[]>([]);
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const playingRef = useRef(false);
  const startAt = useRef(0);
  const pauseAt = useRef(0);
  const totalRef = useRef(0);
  const total = segments.reduce((sum, item) => sum + item.duration, 0);

  const current = useCallback(() => {
    if (!playingRef.current || !context.current || !totalRef.current) return pauseAt.current;
    return (context.current.currentTime - startAt.current) % totalRef.current;
  }, []);

  const combined = (items: Segment[], audio: AudioContext) => {
    const length = items.reduce((sum, item) => sum + Math.ceil(item.duration * audio.sampleRate), 0);
    const result = audio.createBuffer(2, length, audio.sampleRate);
    let offset = 0;
    for (const item of items) {
      const size = Math.ceil(item.duration * audio.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const input = item.buffer.getChannelData(Math.min(channel, item.buffer.numberOfChannels - 1));
        const output = result.getChannelData(channel);
        for (let i = 0; i < size; i++) {
          const index = i * item.buffer.sampleRate / audio.sampleRate;
          const lower = Math.floor(index);
          output[offset + i] = (input[lower] || 0) * (1 - (index - lower)) + (input[lower + 1] || 0) * (index - lower);
        }
      }
      offset += size;
    }
    return result;
  };

  const start = useCallback(async (items: Segment[], from: number) => {
    if (!items.length) return;
    const audio = context.current || new AudioContext();
    context.current = audio;
    await audio.resume();
    const buffer = combined(items, audio);
    const next = audio.createBufferSource();
    next.buffer = buffer;
    next.loop = true;
    next.connect(audio.destination);
    const offset = Math.max(0, Math.min(from, buffer.duration - 0.001));
    next.start(0, offset);
    source.current?.stop();
    source.current?.disconnect();
    source.current = next;
    startAt.current = audio.currentTime - offset;
    pauseAt.current = offset;
    playingRef.current = true;
    setPlaying(true);
  }, []);

  const toggle = useCallback(async () => {
    if (!segmentsRef.current.length) return;
    if (playingRef.current) {
      pauseAt.current = current();
      source.current?.stop(); source.current?.disconnect(); source.current = null;
      playingRef.current = false;
      setPlaying(false);
      setPosition(pauseAt.current);
    } else await start(segmentsRef.current, pauseAt.current);
  }, [current, start]);

  const seek = useCallback((fraction: number) => {
    const next = Math.max(0, Math.min(0.999, fraction)) * totalRef.current;
    pauseAt.current = next;
    setPosition(next);
    if (playingRef.current) void start(segmentsRef.current, next);
  }, [start]);

  const add = useCallback(async (blob: Blob, name: string) => {
    try {
      const audio = context.current || new AudioContext();
      context.current = audio;
      const buffer = await audio.decodeAudioData(await blob.arrayBuffer());
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error("Invalid audio");
      if (buffer.duration > 300) { setError("Please choose a snippet under five minutes."); return false; }
      const at = current();
      const next = [...segmentsRef.current, { id: crypto.randomUUID(), name, duration: buffer.duration, buffer, peaks: peaksFor(buffer) }];
      segmentsRef.current = next;
      totalRef.current = next.reduce((sum, item) => sum + item.duration, 0);
      setSegments(next);
      setError("");
      if (playingRef.current) await start(next, at);
      return true;
    } catch { setError("That file could not be read as audio. Try another format."); return false; }
  }, [current, start]);

  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = segmentsRef.current.map(item => item.id === id ? { ...item, name: trimmed } : item);
    segmentsRef.current = next;
    setSegments(next);
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => { if (playingRef.current) setPosition(current()); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [current]);
  useEffect(() => () => { source.current?.stop(); void context.current?.close(); }, []);

  return { segments, total, position, playing, error, setError, add, rename, toggle, seek };
}
