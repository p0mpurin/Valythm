"use client";

import { useEffect, useRef } from "react";
import { peakAt, type Shape } from "@/lib/audio";

type Props = {
  shapes: Shape[];
  /** Playback position as a 0–1 fraction, read every frame. */
  progress: () => number;
  /** Output loudness 0–1, read every frame; lifts the bars around the cursor. */
  level?: () => number;
  onSeek?: (fraction: number) => void;
  className?: string;
};

export function Waveform({ shapes, progress, level, onSeek, className = "h-[210px] sm:h-[270px]" }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const props = useRef({ shapes, progress, level });
  useEffect(() => { props.current = { shapes, progress, level }; });

  useEffect(() => {
    const element = canvas.current, parent = wrapper.current;
    if (!element || !parent) return;
    let width = 0, height = 0, frame = 0, glow = 0;
    let heights = new Float32Array(0);
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
      frame = requestAnimationFrame(draw);
      const ctx = element.getContext("2d");
      if (!ctx || !width) return;
      const { shapes, progress, level } = props.current;
      const total = shapes.reduce((sum, shape) => sum + shape.duration, 0);
      const count = Math.max(48, Math.floor(width / 4.5));
      if (heights.length !== count) heights = new Float32Array(count);
      const step = width / count;
      const barWidth = Math.max(1.25, Math.min(2.3, step * .45));
      const center = height / 2;
      const at = total ? Math.max(0, Math.min(1, progress())) : 0;
      glow += ((level?.() ?? 0) - glow) * .18;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < count; i++) {
        const fraction = i / count;
        let target: number;
        if (total) {
          const peak = peakAt(shapes, fraction * total, (i + 1) / count * total);
          target = peak < 0 ? 0 : 6 + Math.pow(peak, .7) * height * .7;
        } else {
          // Nothing recorded yet: a quiet, slowly breathing line.
          const envelope = Math.pow(Math.sin(Math.PI * fraction), 2);
          target = 3 + (6 + 22 * Math.abs(Math.sin(i * .19 + time / 2400) * Math.cos(i * .047 - time / 3100))) * envelope;
        }
        // Bars ease toward their targets, so new segments flow in instead of snapping.
        heights[i] += (target - heights[i]) * (total ? .14 : .06);
        if (heights[i] < .5) continue;
        const distance = Math.abs(fraction - at) * width;
        const lift = 1 + glow * .55 * Math.max(0, 1 - distance / 90);
        const bar = Math.min(height * .92, heights[i] * lift);
        const played = total > 0 && fraction < at;
        ctx.fillStyle = played ? "rgba(255,255,255,.92)" : total ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.12)";
        ctx.beginPath();
        ctx.roundRect((i + .5) * step - barWidth / 2, center - bar / 2, barWidth, bar, barWidth / 2);
        ctx.fill();
      }

      if (total) {
        const x = Math.max(1, Math.min(width - 1, at * width));
        const line = ctx.createLinearGradient(x, 0, x, height);
        line.addColorStop(0, "rgba(220,38,38,0)");
        line.addColorStop(.25, "rgba(220,38,38,.85)");
        line.addColorStop(.75, "rgba(220,38,38,.85)");
        line.addColorStop(1, "rgba(220,38,38,0)");
        ctx.fillStyle = line;
        ctx.fillRect(x - .5, 0, 1, height);
        ctx.shadowColor = "#dc2626";
        ctx.shadowBlur = 10 + glow * 18;
        ctx.fillStyle = "#e23b3b";
        ctx.beginPath(); ctx.arc(x, center, 2.5 + glow * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  const seekable = onSeek && shapes.length > 0;
  return <div ref={wrapper} className={`relative w-full ${seekable ? "cursor-crosshair" : ""} ${className}`} onClick={event => { if (seekable) onSeek((event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.clientWidth); }}>
    <canvas ref={canvas} className="block" aria-label={shapes.length ? "Waveform" : "Decorative waveform"} />
  </div>;
}
