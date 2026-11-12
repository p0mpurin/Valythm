"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeWav, peaksFor } from "@/lib/audio";
import { MAX_SECONDS, MIN_SECONDS } from "@/lib/constants";

export type Phase = "idle" | "starting" | "recording" | "review" | "sending" | "sent";
export type Take = { id: string; buffer: AudioBuffer; duration: number; peaks: Float32Array };

function micError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access was blocked. Allow it in your browser settings, then try again.";
  if (name === "NotFoundError") return "No microphone was found on this device.";
  if (name === "NotReadableError") return "The microphone is busy in another app.";
  return "Could not start the microphone. Please try again.";
}

export function useRecorder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [take, setTake] = useState<Take | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const autoStop = useRef(0);
  const preview = useRef<{ node: AudioBufferSourceNode; start: number } | null>(null);
  const reset = useRef(0);

  const audio = () => (context.current ??= new AudioContext());
  const releaseMic = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; analyser.current = null; };

  useEffect(() => () => { window.clearTimeout(autoStop.current); window.clearTimeout(reset.current); releaseMic(); void context.current?.close(); }, []);

  const stop = useCallback(() => {
    window.clearTimeout(autoStop.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError("Recording needs a secure (https) connection."); return; }
    if (typeof MediaRecorder === "undefined") { setError("Recording is not supported in this browser."); return; }
    const ctx = audio();
    void ctx.resume();
    setPhase("starting");
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic;
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      ctx.createMediaStreamSource(mic).connect(node);
      analyser.current = node;

      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(value => MediaRecorder.isTypeSupported(value));
      const media = new MediaRecorder(mic, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      media.onstop = async () => {
        releaseMic();
        try {
          const blob = new Blob(chunks, { type: media.mimeType || type || "audio/webm" });
          const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
          if (buffer.duration < MIN_SECONDS) { setError("That was a little too short. Try again."); setPhase("idle"); return; }
          setTake({ id: "take", buffer, duration: Math.min(buffer.duration, MAX_SECONDS), peaks: peaksFor(buffer) });
          setPhase("review");
        } catch { setError("The recording could not be read. Please try again."); setPhase("idle"); }
      };
      recorder.current = media;
      media.start();
      startedAt.current = performance.now();
      autoStop.current = window.setTimeout(stop, MAX_SECONDS * 1000);
      setPhase("recording");
    } catch (reason) {
      releaseMic();
      setError(micError(reason));
      setPhase("idle");
    }
  }, [stop]);

  const elapsed = useCallback(() => phase === "recording" ? Math.min(MAX_SECONDS, (performance.now() - startedAt.current) / 1000) : 0, [phase]);
  const level = useCallback(() => {
    const node = analyser.current;
    if (!node) return 0;
    const data = new Float32Array(node.fftSize);
    node.getFloatTimeDomainData(data);
    let sum = 0;
    for (const value of data) sum += value * value;
    return Math.min(1, Math.sqrt(sum / data.length) * 5);
  }, []);

  const stopPreview = useCallback(() => {
    if (preview.current) { preview.current.node.onended = null; preview.current.node.stop(); preview.current = null; }
    setPreviewing(false);
  }, []);

  const togglePreview = useCallback(() => {
    if (!take) return;
    if (preview.current) { stopPreview(); return; }
    const ctx = audio();
    void ctx.resume();
    const node = ctx.createBufferSource();
    node.buffer = take.buffer;
    node.connect(ctx.destination);
    node.onended = () => { preview.current = null; setPreviewing(false); };
    node.start(0, 0, take.duration);
    preview.current = { node, start: ctx.currentTime };
    setPreviewing(true);
  }, [take, stopPreview]);

  const previewProgress = useCallback(() => {
    if (!preview.current || !take || !context.current) return 0;
    return (context.current.currentTime - preview.current.start) / take.duration;
  }, [take]);

  const discard = useCallback(() => { stopPreview(); setTake(null); setError(""); setPhase("idle"); }, [stopPreview]);

  const send = useCallback(async (name: string) => {
    if (!take) return false;
    stopPreview();
    setPhase("sending");
    setError("");
    try {
      const body = await encodeWav(take.buffer);
      const response = await fetch(`/api/segments?name=${encodeURIComponent(name.trim())}`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error);
      setTake(null);
      setPhase("sent");
      reset.current = window.setTimeout(() => setPhase(current => current === "sent" ? "idle" : current), 2600);
      return true;
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Could not send the recording. Check the connection and try again.");
      setPhase("review");
      return false;
    }
  }, [take, stopPreview]);

  return { phase, take, previewing, error, start, stop, elapsed, level, togglePreview, previewProgress, discard, send };
}
