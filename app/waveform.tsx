"use client";

import { useEffect, useRef } from "react";
import type { Segment } from "./use-loop";

export function Waveform({ segments, progress, playing, onSeek }: { segments: Segment[]; progress: number; playing: boolean; onSeek: (fraction: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);
  const playingRef = useRef(playing);
  progressRef.current = progress;
  playingRef.current = playing;

  useEffect(() => {
    const element = canvas.current;
    const parent = wrapper.current;
    if (!element || !parent) return;
    let width = 0, height = 0, frame = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    const draw = (time: number) => {
      const ctx = element.getContext("2d");
      if (!ctx || !width) return;
      ctx.clearRect(0, 0, width, height);
      const count = Math.max(65, Math.floor(width / 4.5));
      const step = width / count;
      const total = segments.reduce((sum, item) => sum + item.duration, 0);
      const center = height * .51;
      for (let i = 0; i < count; i++) {
        const x = (i + .5) * step;
        const fraction = i / count;
        let amplitude = 0;
        if (total) {
          let seconds = fraction * total;
          for (const item of segments) {
            if (seconds <= item.duration) { amplitude = item.peaks[Math.min(239, Math.floor(seconds / item.duration * 240))] || 0; break; }
            seconds -= item.duration;
          }
          amplitude = Math.pow(amplitude, .7);
        } else {
          const envelope = Math.pow(Math.sin(Math.PI * fraction), 2.1);
          amplitude = (.12 + .52 * Math.abs(Math.sin(i * .19) * Math.cos(i * .047)) + .21 * Math.abs(Math.sin(i * .83))) * envelope;
        }
        const drift = total ? playingRef.current ? 1 + Math.sin(time / 230 + i * .17) * .025 : 1 : 1 + Math.sin(time / 1500 + i * .05) * .035;
        const bar = Math.max(3, Math.min(height * .8, (8 + amplitude * height * .68) * drift));
        const barWidth = Math.max(1.25, Math.min(2.3, step * .45));
        ctx.globalAlpha = total ? (fraction <= progressRef.current ? .96 : .78) : .72;
        ctx.fillStyle = total && fraction <= progressRef.current ? "#dc2626" : total ? "#555559" : "#343438";
        ctx.beginPath();
        ctx.roundRect(x - barWidth / 2, center - bar / 2, barWidth, bar, barWidth / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (total) {
        const x = Math.max(2, Math.min(width - 2, progressRef.current * width));
        const glow = ctx.createLinearGradient(x, 0, x, height);
        glow.addColorStop(0, "rgba(220,38,38,0)");
        glow.addColorStop(.2, "rgba(220,38,38,.8)");
        glow.addColorStop(.8, "rgba(220,38,38,.8)");
        glow.addColorStop(1, "rgba(220,38,38,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - .5, 0, 1, height);
        ctx.fillStyle = "#e23b3b";
        ctx.beginPath(); ctx.arc(x, center, 3, 0, Math.PI * 2); ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [segments]);

  return <div ref={wrapper} className="relative h-[210px] w-full cursor-crosshair sm:h-[270px]" onClick={event => { if (segments.length) onSeek((event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.clientWidth); }} title={segments.length ? "Click to seek" : undefined}><canvas ref={canvas} className="block" aria-label={segments.length ? "Waveform of the combined track" : "Decorative waveform"} /></div>;
}
